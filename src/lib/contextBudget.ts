// 上下文窗口预算：按模型解析真实窗口 + token 估算 + 压缩阈值。
// 上限解析顺序：用户在来源里手填的 contextWindow > 按模型名内置的真实值 > 64k 兜底。
// CJK 按 1 字符≈1 token，宁可高估触发压缩，也不要低估把请求撑爆。

// 没匹配到任何已知模型时的保守兜底
export const DEFAULT_CONTEXT_WINDOW = 64_000
// 预计占用超过该比例时，发送前自动压缩上下文
export const AUTO_COMPACT_RATIO = 0.7

// 已知模型的真实上下文窗口（顺序敏感：具体的在前，泛匹配在后）
const MODEL_WINDOWS: [RegExp, number][] = [
  // OpenAI
  [/gpt-5/i, 400_000],
  [/gpt-4\.1/i, 1_000_000],
  [/gpt-4o|gpt-4-turbo|chatgpt-4o/i, 128_000],
  [/(^|\/)o[134]\b/i, 200_000],
  [/gpt-3\.5/i, 16_385],
  [/gpt-4\b/i, 8_192],
  // Anthropic
  [/claude/i, 200_000],
  // Google
  [/gemini-1\.5-pro/i, 2_000_000],
  [/gemini/i, 1_000_000],
  // DeepSeek（V3.1 起 128k）
  [/deepseek/i, 128_000],
  // 通义千问
  [/qwen-long/i, 1_000_000],
  [/qwen/i, 128_000],
  // 智谱
  [/glm/i, 128_000],
  // Moonshot / Kimi（moonshot-v1 按名字后缀）
  [/moonshot-v1-8k/i, 8_000],
  [/moonshot-v1-32k/i, 32_000],
  [/moonshot-v1-128k/i, 128_000],
  [/kimi/i, 256_000],
  // xAI
  [/grok-4/i, 256_000],
  [/grok/i, 131_072],
  // 开源系（本地 Ollama 实际受 num_ctx 限制，特殊情况请在来源里手填）
  [/llama-?3\.[23]|llama-?4/i, 128_000],
  [/llama/i, 8_192],
  [/mistral|mixtral|ministral/i, 128_000],
]

export function inferContextWindow(model: string): number {
  for (const [re, win] of MODEL_WINDOWS) {
    if (re.test(model)) return win
  }
  return DEFAULT_CONTEXT_WINDOW
}
// 每张图片的估算开销（Anthropic 约 (w×h)/750，1MP 截图 ≈1400+，取偏高值）
export const IMAGE_TOKENS = 1600
// 工具定义（15 个工具的 schema）随每次请求附带的固定开销
export const TOOL_DEFS_OVERHEAD = 2500

// 汉字（含扩展）+ 兼容表意 + 全角符号 + 日文假名 + 韩文音节
const CJK_RE = /[⺀-鿿豈-﫿＀-￯぀-ヿ가-힯𠀀-𱍏]/gu

export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(CJK_RE) || []).length
  // 非 CJK 按 3.5 字符/token：工具结果多为 JSON（引号括号密集），4 会系统性低估
  return Math.ceil(cjk + (text.length - cjk) / 3.5)
}

interface TokenCountable {
  content?: unknown
  images?: string[]
  tool_calls?: { function: { name: string; arguments: string } }[]
}

export function estimateMessageTokens(msg: TokenCountable): number {
  let tokens = 6 // 每条消息的角色/分隔开销
  if (typeof msg.content === 'string') tokens += estimateTokens(msg.content)
  if (msg.images) tokens += msg.images.length * IMAGE_TOKENS
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokens(tc.function.arguments) + estimateTokens(tc.function.name) + 10
    }
  }
  return tokens
}

export function estimateMessagesTokens(messages: TokenCountable[]): number {
  return messages.reduce((n, m) => n + estimateMessageTokens(m), 0)
}

// 压缩摘要的系统提示：摘要将成为压缩点之前内容的唯一来源
export const COMPACT_SYSTEM_PROMPT = `你是对话上下文压缩器。请把用户提供的对话历史压缩成一份结构化摘要，后续对话将只携带这份摘要继续，摘要是压缩点之前内容的唯一来源。要求：
- 保留：用户的核心诉求与偏好、已确认的事实与结论、提到的笔记（标题、ID）、未完成的任务
- 详细保留最近正在进行的任务的状态与下一步
- 丢弃：寒暄、已过时的中间过程、工具调用的原始输出
- 用第三人称陈述（「用户要求…」「助手已完成…」）
- 直接输出摘要正文，不要任何前后缀或解释`
