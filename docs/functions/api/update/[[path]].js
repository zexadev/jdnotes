// Cloudflare Pages Function：给客户端的更新通道做 GitHub 反代
//
//   GET /api/update/latest.json                  → GitHub Release 的 latest.json（原样，不改 url/signature）
//   GET /api/update/download/<tag>/<asset>       → 该 Release 的资产文件（流式透传）
//
// 只反代 zexadev/lapisnote 一个仓库、只放行 GET，tag/资产名做白名单字符校验，别把它变成通用代理。
// 客户端拿到的 latest.json 里 url 仍是 github.com，是否改走这里由客户端自己映射（手机端 mobile_update.rs：
// 先走这里、失败再直连 GitHub），所以桌面 updater 也可以直接把 endpoint 指到这里而验签不受影响。
// 资产按 tag+文件名缓存一天（Release 资产基本不变；CI 对 latest.json 会 --clobber，故它只缓存 5 分钟）。

const REPO = 'zexadev/lapisnote'
const TAG_RE = /^v?\d+(?:\.\d+)*(?:[-.][A-Za-z0-9.]+)?$/
const ASSET_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
}

function withHeaders(res, extra) {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries({ ...CORS, ...extra })) headers.set(k, v)
  // GitHub 那边的 cookie / 权限策略头跟客户端无关
  headers.delete('set-cookie')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export async function onRequest({ request, params }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: CORS })
  }

  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []

  if (segments.length === 1 && segments[0] === 'latest.json') {
    const upstream = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`, {
      headers: { 'user-agent': 'lapis-update-proxy' },
      cf: { cacheEverything: true, cacheTtl: 300 },
    })
    if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502, headers: CORS })
    return withHeaders(upstream, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    })
  }

  if (segments.length === 3 && segments[0] === 'download') {
    const [, tag, asset] = segments
    if (!TAG_RE.test(tag) || !ASSET_RE.test(asset)) {
      return new Response('bad request', { status: 400, headers: CORS })
    }
    const upstream = await fetch(`https://github.com/${REPO}/releases/download/${tag}/${asset}`, {
      method: request.method,
      headers: { 'user-agent': 'lapis-update-proxy' },
      redirect: 'follow',
      cf: { cacheEverything: true, cacheTtl: 86400 },
    })
    // 资产不存在照实回 404（发版漏传 APK 时客户端能区分「没有」和「反代坏了」），其余上游错误一律 502
    if (upstream.status === 404) return new Response('not found', { status: 404, headers: CORS })
    if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502, headers: CORS })
    return withHeaders(upstream, {
      'cache-control': 'public, max-age=86400',
      'content-disposition': `attachment; filename="${asset}"`,
    })
  }

  return new Response('not found', { status: 404, headers: CORS })
}
