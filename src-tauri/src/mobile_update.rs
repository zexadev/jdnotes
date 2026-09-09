//! 手机端应用内更新
//!
//! 桌面走 tauri-plugin-updater；它在 Android 上没有实现（也没有"静默替换自己"这回事），
//! 所以手机自己拉桌面同一份 latest.json、比版本、把 APK 下到应用缓存目录，
//! 再由 MainActivity 的 JS 桥 `LapisNative.installApk` 交给系统安装器。
//!
//! 不另做 minisign 验签：Android 只允许与已装应用同签名的包覆盖安装，APK 被换过直接装不上；
//! latest.json 与 APK 只认 github.com 的本仓库 Release 地址（下载 URL 前缀在 `download` 里硬校验），
//! 传输上先走文档站的 Cloudflare 反代、不通再直连。
//! 这两个命令桌面也能编译（都只是 HTTP），只是前端只在手机上调。
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

/// 与 tauri.conf.json 里 updater 的 endpoint 同一份清单，CI 发版时给它补 android-aarch64 条目
const LATEST_JSON_URL: &str =
    "https://github.com/zexadev/lapisnote/releases/latest/download/latest.json";
/// 文档站的 Cloudflare Pages Function（docs/functions/api/update）反代同一份清单与资产：
/// github.com 在国内直连不稳，先走它，不通再直连 GitHub。清单内容原样，url 仍是 github.com
const PROXY_LATEST_JSON_URL: &str = "https://jdnotes.zexa.cc/api/update/latest.json";
const PROXY_DOWNLOAD_PREFIX: &str = "https://jdnotes.zexa.cc/api/update/download/";
const ANDROID_PLATFORM_KEY: &str = "android-aarch64";
/// APK 只认本仓库的 Release 资产（github.com 会 302 到 objects.githubusercontent.com，reqwest 自动跟）
const ALLOWED_URL_PREFIX: &str = "https://github.com/zexadev/lapisnote/releases/download/";
const PROGRESS_EVENT: &str = "mobile-update-progress";
/// 进度事件节流：每累计这么多字节发一次，别每个 TCP 分片都过一遍 IPC
const PROGRESS_STEP: u64 = 128 * 1024;

#[derive(Deserialize)]
struct LatestJson {
    version: String,
    notes: Option<String>,
    pub_date: Option<String>,
    #[serde(default)]
    platforms: HashMap<String, PlatformEntry>,
}

#[derive(Deserialize)]
struct PlatformEntry {
    url: String,
}

#[derive(Serialize, Clone)]
pub struct MobileUpdateInfo {
    pub version: String,
    pub current_version: String,
    pub date: Option<String>,
    pub body: Option<String>,
    pub url: String,
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

fn http_client(total_timeout: Option<std::time::Duration>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("Lapis/{}", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(15));
    if let Some(t) = total_timeout {
        builder = builder.timeout(t);
    }
    builder
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

/// 拉 latest.json 比版本。远端不比本地新 → None；比本地新但清单里没有安卓包 → 报错，
/// 别当"已是最新"糊弄过去——那是发版漏传 APK，得让人看见。
/// 顺手清掉上次残留的安装包：装完系统直接杀进程，没有机会事后删；每次启动都会来这里，
/// 前端重启后也不再记得那个路径（重新走下载），所以这里删是安全的
#[tauri::command]
pub async fn mobile_update_check(app: AppHandle) -> Result<Option<MobileUpdateInfo>, String> {
    if let Ok(dir) = updates_dir(&app) {
        clear_dir(&dir);
    }
    let client = http_client(Some(std::time::Duration::from_secs(20)))?;
    let latest = match fetch_latest(&client, PROXY_LATEST_JSON_URL).await {
        Ok(v) => v,
        Err(proxy_err) => {
            log::warn!("反代取更新清单失败，改直连 GitHub: {}", proxy_err);
            fetch_latest(&client, LATEST_JSON_URL).await?
        }
    };

    let remote = semver::Version::parse(latest.version.trim_start_matches('v'))
        .map_err(|e| format!("更新清单里的版本号无法解析 ({}): {}", latest.version, e))?;
    let current = app.package_info().version.clone();
    if remote <= current {
        return Ok(None);
    }

    let url = latest
        .platforms
        .get(ANDROID_PLATFORM_KEY)
        .map(|p| p.url.clone())
        .ok_or_else(|| format!("新版本 v{} 尚未提供安卓安装包", remote))?;

    Ok(Some(MobileUpdateInfo {
        version: remote.to_string(),
        current_version: current.to_string(),
        date: latest.pub_date,
        body: latest.notes,
        url,
    }))
}

async fn fetch_latest(client: &reqwest::Client, url: &str) -> Result<LatestJson, String> {
    client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("获取更新清单失败: {}", e))?
        .error_for_status()
        .map_err(|e| format!("获取更新清单失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析更新清单失败: {}", e))
}

/// github.com 的资产地址 → 文档站反代地址；前缀校验在调用方做过
fn proxied_url(github_url: &str) -> String {
    format!(
        "{}{}",
        PROXY_DOWNLOAD_PREFIX,
        &github_url[ALLOWED_URL_PREFIX.len()..]
    )
}

fn updates_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Android 上 app_cache_dir = context.cacheDir，对应 file_paths.xml 的 <cache-path path=".">，
    // FileProvider 才能给这个文件签 content:// URI
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("获取缓存目录失败: {}", e))?
        .join("updates");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建更新目录失败: {}", e))?;
    Ok(dir)
}

fn clear_dir(dir: &std::path::Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// 把 APK 流式下到缓存目录，按 `mobile-update-progress` 事件报进度，返回落盘绝对路径。
/// 先清掉目录里旧的安装包（上次下载完没装的），别攒
#[tauri::command]
pub async fn mobile_update_download(
    app: AppHandle,
    url: String,
    version: String,
) -> Result<String, String> {
    if !url.starts_with(ALLOWED_URL_PREFIX) {
        return Err(format!("拒绝从非发布地址下载安装包: {}", url));
    }

    let dir = updates_dir(&app)?;
    clear_dir(&dir);
    let final_path = dir.join(format!("Lapis_{}.apk", version));
    let tmp_path = dir.join(format!("Lapis_{}.apk.part", version));

    let client = http_client(None)?;
    // 反代不通（连不上 / 非 2xx / 中途断）就整个从头直连 GitHub 再来一次；.part 文件每次重建
    if let Err(proxy_err) = download_to(&app, &client, &proxied_url(&url), &tmp_path).await {
        log::warn!("反代下载安装包失败，改直连 GitHub: {}", proxy_err);
        let _ = std::fs::remove_file(&tmp_path);
        download_to(&app, &client, &url, &tmp_path).await?;
    }
    std::fs::rename(&tmp_path, &final_path).map_err(|e| format!("安装包落盘失败: {}", e))?;

    Ok(final_path.to_string_lossy().into_owned())
}

/// 流式下到 tmp_path，按事件报进度；content-length 与实收不符算失败
async fn download_to(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    tmp_path: &std::path::Path,
) -> Result<(), String> {
    let mut resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载安装包失败: {}", e))?
        .error_for_status()
        .map_err(|e| format!("下载安装包失败: {}", e))?;
    let total = resp.content_length().unwrap_or(0);

    let mut file =
        std::fs::File::create(tmp_path).map_err(|e| format!("创建安装包文件失败: {}", e))?;
    let mut downloaded: u64 = 0;
    let mut last_emitted: u64 = 0;
    let _ = app.emit(PROGRESS_EVENT, DownloadProgress { downloaded, total });
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("下载安装包中断: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("写入安装包失败: {}", e))?;
        downloaded += chunk.len() as u64;
        if downloaded - last_emitted >= PROGRESS_STEP {
            last_emitted = downloaded;
            let _ = app.emit(PROGRESS_EVENT, DownloadProgress { downloaded, total });
        }
    }
    file.sync_all()
        .map_err(|e| format!("写入安装包失败: {}", e))?;
    drop(file);

    if total > 0 && downloaded != total {
        return Err(format!(
            "安装包下载不完整（{} / {} 字节）",
            downloaded, total
        ));
    }
    let _ = app.emit(
        PROGRESS_EVENT,
        DownloadProgress {
            downloaded,
            total: if total > 0 { total } else { downloaded },
        },
    );
    Ok(())
}
