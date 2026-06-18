# Lapis 多设备同步与手机端 · 设计与进度文档

> 本文件记录云同步、手机端、编辑器统一三件事的方案与进度，供跨对话/新会话快速恢复上下文。2026-05 经多轮评审收敛。**修改方案时同步更新本文件。**

---

## 0. 核心场景与目标

- 真实痛点：用户公司电脑的笔记无法和家里电脑同步。
- 目标：**所有设备（公司电脑 + 家里电脑 + 未来手机）平等节点，各持全量副本，互相同步、最终一致。**
- 关键约束：**开发者不托管任何中心服务器**（开源项目，扛不起成本/运维/合规）。用户要云端能力，需自部署后端或自配存储；不配则两台设备同时在线时点"同步"直连。

---

## 1. 总体架构决策

- **定性**：不是区块链，是 **local-first 多主复制（multi-master）+ 最终一致性同步**，心智模型类比 git（多 remote=多设备，自动 merge，冲突保留双份）。对外营销禁用"区块链"。
- **同步算法与传输解耦**：算法只认"一根能收发加密包的管道"，底层可以是局域网 TCP / iroh 直连 / iroh relay 中继 / 同步包文件 / 未来对象存储。换传输不动算法。
- **同步引擎在 Rust 端**（sqlx 直连 SQLite）。红利：同一份 Rust 代码，带 UI 是桌面 App，去 UI 编译成 daemon 就是 always-on 的 VPS 节点。
- **传输选型**：跨网 P2P 用 **iroh**（Rust 库，自带 NAT 打洞 + relay 中继 + QUIC/TLS 端到端加密，跑 Rust 端不碰 WebView/CSP）。
- **绝不同步整个 .db 文件**（SQLite 文件级同步会损坏/冲突），按**每条笔记记录**增量同步。
- **冲突**：✅ 已实现 git 式三路合并（`diffy` diff3 + `synced_content` 基准快照 + 冲突副本 + 删除保护）。仅一方改→取那方；两方改不同段落→自动合并；改同一处→生成"冲突副本"新笔记；删除 vs 编辑→保留编辑。**绝不静默丢数据。** 元数据（标题/标签）v1 仍 LWW，正文走三路合并。
- **端到端加密**：客户端加密后再过任何中间节点（relay/信箱/存储只见密文）。当前 PoC 阶段未加密（iroh 传输本身已 TLS 加密），应用层 E2E 加密列入后续。
- **明文 AI api_key 绝不进同步通道。**

---

## 2. 数据模型

`notes` 表新增 `uuid TEXT`（全局同步身份，唯一索引），**不动整数主键 id 和外键**。migration `004_sync.sql`；`005_sync_merge.sql` 再加 `synced_content`（三路合并基准）+ `has_conflict`。历史笔记启动时前端幂等回填 uuid（`crypto.randomUUID()`），新建笔记直接带 uuid。**uuid 双保险**：① `initDatabase()`（内含 `backfillUuids`）必须在 App 启动序列调用（曾漏调 → uuid 全空 → 同步导出被 `WHERE uuid IS NOT NULL` 过滤为空 → "新增 0"假象）；② 后端 `read_local_notes` 导出前再兜底补 uuid（`hex(randomblob(16))`），不依赖前端时序。默认笔记（欢迎/快捷键）用**固定 uuid**，避免多设备各留一份。

同步传输单元 `SyncNote`：uuid / title / content / tags / is_favorite / is_deleted / created_at / updated_at / reminder_date / reminder_enabled。`is_deleted` 作为墓碑同步删除。

**关键事实：content 字段存的是 Markdown**（非 HTML；Editor.tsx 用 `getMarkdown()` 保存），图片 base64 内嵌在 Markdown（`![](data:...)`）。

---

## 3. 实现进度

### 阶段一 ✅ 已完成（编译通过，待真机测试）
- `notes` 加 uuid 列 + 启动回填（migration 004 + db.ts backfillUuids）。
- SQLite 开启 WAL + busy_timeout（前端 db.ts + 后端 sqlx），解决前端插件与同步引擎并发写。
- 同步内核（`src-tauri/src/sync.rs`）：读本地笔记序列化、按 uuid 的 LWW 合并（含墓碑删除），可重复合并不产生重复。
- 传输：**局域网 TCP 直连**（端口 38765，length-prefixed JSON 双向交换）+ **同步包文件导出/导入**（异地手动传输兜底）。
- 命令：`sync_get_info` / `sync_connect_lan` / `sync_export_package` / `sync_import_package`。
- 前端：设置 → "设备同步"面板（本机地址、输入对端、一键同步、导出/导入同步包），同步后 emit `db:changed` 刷新。
- 局限：局域网直连要求两台同一网络；公司↔家不同网用文件兜底；冲突走 LWW（新覆盖旧）。

### 阶段二 ✅ 已完成（编译通过，待真机测试）：iroh 跨网 P2P
- 不同网络（公司↔家）也能加密 P2P 直连：NAT 打洞，打不通走 n0 公共 relay 中继（relay 只转发密文不存数据）。
- 复用阶段一的序列化 + LWW 合并内核，只替换传输层（iroh QUIC 双向流取代 TCP）。
- 配对：展示本机 iroh 设备 ID（EndpointId=公钥字符串），对端输入后 `connect`，靠 n0 relay/discovery 按 id 找到对端。
- 命令：`sync_iroh_get_id`（启动 endpoint + 返回本机 ID）、`sync_iroh_connect`（连对端 ID 双向同步）；前端"设置→设备同步"加"跨网同步"区。
- **⚠️ 依赖版本经验（重要，别踩）**：iroh 必须用 **`=1.0.0-rc.0`**，不能用 0.98.2——0.98.2 经 netwatch→`wmi 0.18.4`（最新且唯一版本），与 Tauri 的 `windows-core 0.61` 冲突，wmi 的 `#[implement]` 宏编译失败；**1.0-rc.0 改用 `netdev` 监听网络、绕开 wmi**，编译通过（16.6s，零警告）。Cargo.toml 钉死该版本。
- 局限：未做应用层 E2E 加密（iroh QUIC 本身已 TLS 加密）。

### 合并算法 ✅ 已完成（编译通过，待真机测试）：git 式三路合并
- 从 LWW 升级为三路合并(`diffy` 库 diff3)。migration 005 给 notes 加 `synced_content`(共同祖先 base 快照)+ `has_conflict`;`synced_content` 仅本地用、绝不跨网传。
- 逻辑：仅一方改→取那方(不再误覆盖未改方)；两方改不同段落→自动合并都保留；改同一处→生成「原标题(冲突副本)」新笔记,两版都留；删除 vs 编辑→保留编辑不静默删；首次无 base 且内容不同→冲突副本兜底。**绝不静默丢数据。**
- `SyncStats` 加 `conflicts`,前端同步结果提示冲突数(`merge_notes` 是唯一合并点,5 条同步路径全受益)。
- 后续：图片附件化(让 base 快照不翻倍 + 正文 diff3 更有效)、元数据字段级合并(标签并集等)、可视化冲突解决 UI / 可选 git 标记开关。

### 跨网体验完善 ✅ 已完成（本轮，编译通过待真机测）
- **iroh 设备 ID 持久化**：首次生成 `SecretKey` 存 `app_data_dir/iroh_identity.key`，以后读它喂 `Endpoint::builder().secret_key()` → 设备 ID 重启不变（之前每次随机，跨网配对一重启就失效）。用 `SecretKey::generate/from_bytes/to_bytes`（iroh-base）。
- **设备列表**（前端 localStorage `jdnotes_sync_devices`）：跨网设备添加一次（对方 ID）即记住，点「同步」直接用，不再每次重填 ID；换页/重启都在。
- **probe 自动取名**（命令 `sync_iroh_probe` + `handle_iroh_conn` 识别 `"PROBE"` 标记）：添加设备时先轻量握手验证连通、取回对端在「本设备名称」设的名字，无需手动填名。**注意**：对端须同为含 probe 的新版；旧版收到 `"PROBE"` 会当 JSON 解析失败而断开（表现为 `connection lost`）。
- **本机地址选网卡**：`local_ip()` 改为枚举网卡按家用私网段打分（192.168 > 10 > 172.16~31），避开 VPN(sing-tun)/Docker/WSL 虚拟网卡（曾误选 `172.18.0.1`，对端连不上）。依赖 `netdev`（与 iroh 共用同版本）。
- **同步结果文案**：`describeSync` 改双向人话——「已发出 N 条给对方 + 本机变化 + 方向」，消除旧文案「新增 0」的纯本机视角误导。
- **UI 位置修正**：同步面板原误加在废弃的 `SettingsModal`（无打开入口的死代码），已迁到实际在用的 `src/pages/settings/SyncSettings.tsx`（`SettingsPage` 左侧导航「设备同步」），并删除整个 `SettingsModal`。
- **设备同步页重设计**：所有状态反馈改用**全局 toast**（`lib/toast`，浮层不随页面滚动，不再用会被滚没的页面内提示行）；布局按使用心智重排（本机身份 → 跨网设备列表 → 局域网快速同步 → 其它方式）；设备卡片化（图标圆底 / hover 高亮 / 等宽 ID 缩略 / 悬停才显示移除 / Enter 提交）。
- **真机验证**：局域网 + iroh 跨网 + 设备列表 + probe 取名均已两台实测通过；跨网经 relay 引路、**NAT 打洞成功后走 P2P 直连**传数据（日志见 `PathId` 直连 Available、relay 降为 Backup）。
- **设备在线/离线状态**：设备列表复用 `sync_iroh_probe` 探活（8s 超时算离线），进设置页自动探测、卡片显示在线(绿)/检测中(黄)/离线(灰)圆点 + 「刷新状态」按钮。

### 局域网完整化 ✅ 已完成（本会话，编译通过待真机测）
- **mDNS 自动发现**：`_jdnotes._tcp.local.` 服务，应用启动即注册（不再 lazy 到首次进同步页），1.5s browse 拿邻居列表；TXT 携带 `device`/`fp`/`proto`。
- **持久 fingerprint**：复用 iroh `SecretKey` 派生（公钥 base32 前 16 字符），实例名 + TXT.fp 用同一身份源 → 重启同设备在对方眼里仍是同一台 + 一份身份两种传输共用（mDNS/iroh）。**学 Localsend**；不学 HTTP REST 和 HTTPS 自签证书（双向同步不适用 + LAN 信任假设；E2E 列长期项）。
- **协议版本字段** TXT.proto=1，发现阶段即可判断兼容。
- **多网卡同设备只列一条**：`lan_discover` 按 fp 去重；fp 为空（对端老版本无 TXT.fp）走 IP 兼容路径。
- **过滤"自己发现自己"**：fp == 本机 fp 即跳过。
- **设备名变更立即生效**：`set_device_name` 命令成功后调 `mdns_reregister_device_name`（unregister 旧 fullname → register 新 TXT），对方刷新即看到新名字，不等 TTL 几分钟。
- **退出发 goodbye**：tray「quit」调 `daemon.shutdown()`，对方设备列表立即清除本机。
- **笔记多选同步 modal**（`NoteSelectModal.tsx`）：借鉴 `ExportModal` 多选样式（搜索/全选/计数/卡片勾选），点「选笔记」→ 勾选 → `sync_lan_push_notes(address, note_ids)` 一次推过去。**解的是"不是所有笔记都给对方"核心诉求**——选择性同步取代全量。
- **编辑器旁单条同步**（`MainContent.tsx` 头部 `Send` 按钮 + popover）：iroh 已配对设备列表 + 局域网地址输入，一个 popover 两条路径覆盖。后端 `iroh_push_note(peer_id, note_id)` / `lan_push_note(address, note_id)`。
- **接收方提示**：`handle_conn` / `handle_iroh_conn` merge 完后 emit `sync:received` 含 from/received/inserted/updated/conflicts，前端 `App.tsx` 顶层 listen 弹 toast，解掉「A 推过来 B 静默无感」的体验缺失。

### 后续延伸（局域网层面）
- **首次配对码确认**：双方 fp XOR 哈希取 6 位数字（各自算、不靠网络协商防中间人），首次「选笔记」前双方都看到同一个码 + 都点「我看到对面也是 123456」才进白名单（之后免确认）。咖啡店/宾馆 WiFi 等陌生网络下的隐私收口，列为下一节点。

### 2.0 收口 ✅ 已完成（编译通过待真机测）
- **首次配对码确认**：双方 fingerprint 各自算 SHA256(min|max) 取前 4 字节大端 mod 1_000_000 → 6 位数字。**不靠网络协商防中间人**：用户对屏验证一致才点「建立信任」加入 localStorage `jdnotes_paired_devices` 白名单。
  - 三处接入：SyncSettings 局域网「选笔记」+ SyncSettings iroh「同步」+ MainContent 编辑器旁单条 push（仅 iroh 路径）
  - 局域网手输地址路径**不弹**配对码（用户主动信任 + 没有 fp 派生源）
- **私有笔记标记 `is_private`**：用户在编辑器头部点 Lock 图标切换。被标记的笔记**绝不参与同步**——同步层 `read_local_notes` + 三种 push 命令都加 `COALESCE(is_private, 0) = 0` 过滤；多选弹窗里也直接看不到。导出/导入功能不受影响（属于本机数据迁移，不算"同步给对端"）。

### 2.0 收口（第二轮：安全审计后补强）✅ 已完成（编译通过待真机测）
经多 agent 安全审计 + 对抗性核验，补掉「零认证 blocker 修复后」残留的真缺口（commit `安全收口 (4/4)` + 单条分享局域网发现增强）：
- **接收端认证是后端权威**：配对白名单从纯 localStorage 升级为后端 config 文件 `paired_fingerprints`（`db::is_paired`）。LAN 用「随机 challenge + ed25519 签名验签」把 fingerprint 与私钥绑定，iroh 用 TLS 已验证的 `remote_id`，两者均在 merge 前校验、未配对回 `PAIRING_REQUIRED`。绕过前端 localStorage 直连无效。localStorage 自此仅作 UI 镜像，后端 config 为权威源。
- **出站方向也鉴权**（堵「只防别人推进来、不防自己推给错对象」的方向性盲区）：
  - iroh：`iroh_push_note` / `iroh_sync_connect` 在 connect 前校验 `is_paired(peer_id[..16])`；`iroh_probe` 不加此门（配对前取名需要）。
  - LAN：`lan_connect_authed` 升级**双向握手**——应答方也签发起方 challenge 回证身份（杀「冒名只回 OK」的被动接管/ARP 劫持）。新增 `expected_fp`：mDNS 发现并配对的设备要求应答方指纹**完全一致**；手输地址无预期指纹（用户主动信任）仅验签不绑身份。
- **DoS 上限**：`handle_conn` 握手 10s 超时杀 slowloris；`iroh_accept_loop` 加 `Semaphore(8)` 并发上限；iroh 鉴权前置——未配对对端只读 64 字节（仅够 PROBE），绝不反序列化最大 256MB 的同步包（防解析放大 + 内存占用）。
- **配对状态一致性**：`PairingCodeModal` 先 await 后端 `sync_accept_pairing` 成功才镜像 localStorage + 继续，失败中止——根除「前端以为已配对、后端却没有」导致的「配过却同步不了」。
- **单条分享补齐局域网自动发现**：编辑器 Send popover 打开即 `sync_lan_discover` 列出同网段设备一点直推（之前只有 iroh 设备列表 + 手输地址）；未配对先弹配对码（与设置页「选笔记」一致）；`sync_lan_push_note` 加 `fingerprint` 参数走指纹绑定，与 `sync_lan_push_notes` 对称。
- **PROBE 设备名**：未配对 PROBE 仍返回真设备名（支持「添加设备自动取名」，设备名属半公开低危信息）——审计后明确保留，非遗漏。

### 阶段三 📋 规划
- 冲突保留双份（替代纯 LWW）：版本向量 + 检测并发编辑，败方存"(冲突副本)"笔记。
- **图片存储优化 ✅ 已实现（编译通过，待真机测试）**：base64 内嵌 → `attachments/` 文件夹（文件名 = 内容 sha256，内容寻址去重）+ 正文存 `attachment://<hash>` 短引用。存文件不存 DB BLOB（对标 Obsidian/思源/Logseq，数据主权+可迁移）。
  - **正文存 hash 不存路径（关键）**：换电脑/盘符/文件夹，正文里永远是 `attachment://<hash>` 一字不变 → 不算修改、不冲突、图不裂；渲染时运行时把 hash 翻译成本机实际路径（asset 协议/convertFileSrc），**绝不把转换后的平台相关 URL 回写正文**。
  - **导出自包含（实际实现，解决"导出一个文件"诉求）**：导出 JSON 时把 `attachment://` 还原成 base64 内嵌（仍是单个 JSON、与原导出格式一致），导入时再抽回附件并补 uuid；保留 base64 存库"自包含好导出"的核心优点。同步包/iroh 传输则内联附件 base64、对端按 hash 去重落盘（命令 `read_attachment_data_url`）。
  - **收益**：DB 瘦身、同步只传变化（不再改一个字重传几 MB 图）、**改图不再触发整篇冲突（diff3 对正文重新有效）**、CM6 源码视图不刷屏、图片可见可管理。
  - **附件同步**：附件不可变→永不冲突，按 hash"缺啥拉啥"；阶段二用 iroh-blobs（版本耦合风险，先 PoC，否则自研 have/want/send）。
  - **存量迁移铁律**：先备份 DB → 先写附件再改正文 → **同步更新该笔记 synced_content 基准**（否则迁移后首次同步假冲突爆炸，头号雷）→ 提示用户"已优化 N 张图"。幂等、可中断续跑。
- 应用层端到端加密（用户口令派生密钥，中间节点只见密文）。
- always-on 节点：headless Rust daemon（同步引擎去 UI 编译），部署到用户自己的 VPS/NAS，解决"两端从不同时在线"。
- 自配存储 transport：WebDAV / S3 / 对象存储作为另一种"管道"实现。
- **自动同步**（在线状态已完成，此项待做）：检测到已配对设备在线就自动后台双向同步（默认关、用户开启 + 可定频率）。
- **连接类型标识（直连/中转）：调研后 defer 到 iroh 1.0 stable**。不必换库——iroh 自己的 `Connection::paths()` + `TransportAddr` 的 `Ip`/`Relay` 变体理论上够；但 rc 版要从 paths 快照遍历找 active 路径、且连接瞬时（同步完即 close）捕获时机绕，纯展示功能性价比低。stable 后 API 更顺再做；现阶段看日志可辨直连/中转。

### 决策记录（避免重复纠结）
- **AI 对话历史：暂不纳入同步**。对话是"消息流"非"文档"，需另写消息流 union 合并 + 增量传输；价值低于笔记、体积大；多数本地笔记应用也不同步对话。需要时走「数据管理 → 导出全部数据 JSON」手动迁移（该导出已含对话消息）。

---

## 4. 手机端方案（排在桌面同步之后）

- **技术栈：继续 Tauri v2 mobile（Android）**。理由：Rust 同步引擎零桥接复用（最契合"平等节点"——同步代码一份跑遍所有端）；用户已实测 Tauri Android + SQLite 可行；Tauri+iroh 安卓真机有实证（Lightning P2P 项目）。一套 Tauri+Rust+web 栈对一人维护最省。
- **要认两点**：① iroh 在安卓交叉编译，默认加密后端 aws-lc-rs 会失败，需换 ring 或纯 Rust crypto provider（rustls CryptoProvider 可替换）。② 手机进后台 Tauri/iroh 停（Android 无原生后台 service + Doze，iOS 更严）——**手机是"打开即同步"的间歇在线平等节点，非 7×24 常驻**。
- **手机定位**：查看 + 轻量 Markdown 速记，不做完整富文本。
- **PoC 先行**：手机端最大未知是"iroh 能否在安卓真机交叉编译跑通"。先做最小 PoC（纯 Rust iroh 交叉编译冒烟 → 套 Tauri 真机和桌面同步一条笔记），验证了再投入手机 UI。

---

## 5. 编辑器：统一换 CodeMirror 6（桌面+手机一套）

- **决定**：放弃 Tiptap，桌面和手机统一换 **CodeMirror 6**（Obsidian 同款；项目已依赖 CM6 做代码块，选型风险≈0）。
- **为什么 CM6 而非 Lexical/Milkdown**：后者底层都是 contenteditable，移动端输入法（IME）的根没解决。CM6 有自研编辑模型、非 contenteditable 富文本框，是 Web 跨端里移动端最能用的。
- **默认形态：Live Preview（局部）**——光标行露 Markdown 标记、其它行渲染成接近所见即所得（Obsidian 体验）。纯源码+高亮作可切换次级模式。只对高频项（标题/粗体/链接/图片折叠/待办复选框）做局部 Live Preview，非全量（全量是无底洞）。
- **参考实现**：[atomic-editor](https://github.com/kenforthewin/atomic-editor)（单人开源，CM6+React+TS 的 Obsidian 式 Live Preview，技术栈一致）。
- **AI 流式改写 + diff 高亮在 CM6 上反而更优**（StateField/StateEffect/Decoration 比 ProseMirror 更适合流式插字+diff，代码更短更稳）。
- **砍掉的"伪功能"**（在 Markdown + html:false 下本就存盘即丢）：文字颜色、文本对齐、下划线、多色高亮。表格降级 GFM 文本表；Callout 改 `> [!info]` 或砍；图片 base64 必须用 decoration 折叠成缩略图（源码视图会刷屏）。
- **工程量**：约 2.5–3 周（一人），换编辑范式的中型重构。
- **安全垫**：CM6 已在跑 / 数据是 Markdown 新旧编辑器可共存 / **feature flag 灰度可一键回退 Tiptap、数据不动**。
- **风险**：CM6 中文 IME 非零坑（2026 仍有偶发 bug），需 Android 真机 + 中英文输入法专项验收。

---

## 6. 被否决的方案及原因（避免重复讨论）

- **❌ "个人区块链"**：不需要共识/PoW/不可篡改账本/信任最小化；设备互信，是多主复制不是区块链。
- **❌ 把 jdnotes.db 整个文件丢网盘/Syncthing 自动同步**：SQLite 文件级同步会损坏、产生 conflicted copy、丢整库。只能当单设备备份。
- **❌ 手机当 always-on 后台中继**：移动 OS 后台限制做不到无人值守；真正 always-on 角色交给常开电脑/VPS daemon。手机只"打开即同步"。
- **❌ 换 Lexical/Milkdown 解决手机编辑**：底层仍 contenteditable，没解决 IME 根因。
- **❌ 全量 Live Preview**：一人维护无底洞，只做高频项局部 Live Preview。
- **❌ 开发者托管官方云（当下）**：成本/运维/GDPR 扛不起；架构留口子，未来可加付费云（Joplin/Standard Notes 模式：自托管永远免费、官方云收省心钱），现在不做、不承诺、也别把"永不收费"刻死。

---

## 7. 关键文件清单

| 文件 | 说明 |
|------|------|
| `src-tauri/migrations/004_sync.sql` | notes 加 uuid 列 + 唯一索引 |
| `src-tauri/migrations/005_sync_merge.sql` | notes 加 synced_content(三路合并基准) + has_conflict |
| `src-tauri/src/sync.rs` | 同步内核：序列化 + 三路合并(diffy) + 局域网 TCP + 同步包文件 + iroh 跨网 + 设备 ID 持久化 + probe |
| `src-tauri/src/attachments.rs` | 图片附件：内容寻址(sha256)存储、读取、GC |
| `src-tauri/src/commands.rs` | 同步与附件命令（sync_* / *_attachment_*） |
| `src-tauri/src/lib.rs` | migration 注册（version 4、5）+ 命令注册 |
| `src/lib/db.ts` | WAL、uuid 回填(backfillUuids)、图片附件化迁移、initDatabase、默认笔记固定 uuid |
| `src/pages/settings/SyncSettings.tsx` | 设置 → 「设备同步」页（局域网 / 设备列表 / 同步包 / 清理图片）；旧 `SettingsModal` 已删 |
| `src/pages/SettingsPage.tsx` | 设置页左侧导航容器（应用实际使用的设置 UI） |

分支：`feature/p2p-sync`。
