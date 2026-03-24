import { useState, useCallback, useRef } from 'react'
import { getSettings } from './useSettings'
import type { AIProvider } from './useSettings'
import {
  toOpenAITools,
  toAnthropicTools,
  toGeminiTools,
  toResponsesTools,
  executeToolCall,
  type AIToolContext,
} from '../lib/aiTools'

export type AIAction = 'refine' | 'summarize' | 'translate' | 'continue' | 'custom' | 'template'

// 模板类型
export type TemplateType = 'meeting' | 'brainstorm' | 'code'

// AI 上下文信息
export interface AIContext {
  noteTitle?: string
  surroundingText?: string
}

// 多轮消息格式（provider 无关）
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | AIContentBlock[]
  tool_call_id?: string
  tool_calls?: AIToolCall[]
  images?: string[] // base64 图片
}

export interface AIContentBlock {
  type: 'text' | 'image_url' | 'tool_use' | 'tool_result'
  text?: string
  image_url?: { url: string }
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

export interface AIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface UseAIStreamOptions {
  onChunk?: (chunk: string) => void
  onLine?: (line: string) => void
  onFinish?: (fullText: string) => void
  onError?: (error: string) => void
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void
  onToolResult?: (toolName: string, result: string) => void
}

interface UseAIStreamReturn {
  isStreaming: boolean
  streamText: string
  error: string | null
  startStream: (action: AIAction, text: string, customPrompt?: string, context?: AIContext, templateType?: TemplateType) => Promise<void>
  startStreamWithTools: (messages: AIMessage[], toolContext: AIToolContext) => Promise<void>
  stopStream: () => void
}

// 模板提示词
const TEMPLATE_PROMPTS: Record<TemplateType, string> = {
  meeting: `你是 JD Notes 的会议助手。请根据上下文生成一个结构化的会议纪要模板，使用 Markdown 格式：

## 会议纪要

**日期**：[日期]
**参会人员**：[参会人员]

### 会议议题
1.

### 讨论要点
-

### 决议事项
- [ ]

### 后续行动
- [ ]

只返回模板内容，不要任何解释。`,

  brainstorm: `你是 JD Notes 的创意助手。请根据以下上下文，生成一个 5 点思维大纲，帮助用户深入思考这个主题。使用 Markdown 格式，每个要点要有简短的说明。只返回大纲内容，不要任何前缀。`,

  code: `你是 JD Notes 的编程助手。请根据上下文中的描述，生成相应的代码实现。使用适当的编程语言，并添加简洁的注释。只返回代码块，不要任何额外解释。`,
}

// 构建上下文感知的系统提示（用于编辑器内联 AI，不带 tools）
function buildSystemPrompt(action: AIAction, context?: AIContext, templateType?: TemplateType): string {
  if (action === 'template' && templateType) {
    let prompt = TEMPLATE_PROMPTS[templateType]
    if (context?.noteTitle) {
      prompt += `\n\n当前笔记标题：「${context.noteTitle}」`
    }
    return prompt
  }

  const basePrompts: Record<Exclude<AIAction, 'template'>, string> = {
    refine: '你是 JD Notes 的专业写作助手。请改进以下文本的清晰度、语气和语法。只返回改进后的文本，不要任何解释或前缀。',
    summarize: '你是 JD Notes 的专业写作助手。请用简洁专业的方式总结以下文本，使用要点列表形式。使用与输入文本相同的语言。只返回总结内容。',
    translate: '你是 JD Notes 的翻译助手。如果文本是中文，翻译成英文；如果是英文，翻译成中文。只返回翻译结果，不要任何解释。',
    continue: '你是 JD Notes 的创意写作助手。请自然流畅地续写以下文本，保持与现有文本一致的风格和语气。只返回续写内容，不要任何前缀如"续写："。',
    custom: '你是 JD Notes 的智能助手。请精确遵循用户的指示，只返回结果，不要解释。',
  }

  let prompt = basePrompts[action as Exclude<AIAction, 'template'>]

  if (context?.noteTitle) {
    prompt += `\n\n当前笔记标题：「${context.noteTitle}」`
  }
  if (context?.surroundingText) {
    prompt += `\n\n上下文内容：\n${context.surroundingText}`
  }

  return prompt
}

// ============= OpenAI 兼容 API（简单模式，无 tools） =============
async function* streamOpenAISimple(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status} ${response.statusText}`)
  }

  yield* readSSEStream(response)
}

// ============= OpenAI Responses API（简单模式） =============
async function* streamResponsesSimple(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: [{ role: 'user', content: userMessage }],
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Responses API 错误: ${response.status} - ${errorText}`)
  }

  yield* readResponsesSSE(response)
}

// ============= Anthropic 简单模式 =============
async function* streamAnthropicSimple(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API 错误: ${response.status} - ${errorText}`)
  }

  yield* readAnthropicSSE(response)
}

// ============= Google 简单模式 =============
async function* streamGoogleSimple(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const url = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 4096 },
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google API 错误: ${response.status} - ${errorText}`)
  }

  yield* readGoogleSSE(response)
}

// ============= SSE 读取工具函数 =============

function readSSELines(response: Response): AsyncGenerator<string>
async function* readSSELines(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield line.slice(6).trim()
      }
    }
  }
}

async function* readSSEStream(response: Response): AsyncGenerator<string> {
  for await (const data of readSSELines(response)) {
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) yield content
    } catch { /* ignore */ }
  }
}

async function* readAnthropicSSE(response: Response): AsyncGenerator<string> {
  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        yield parsed.delta.text
      }
    } catch { /* ignore */ }
  }
}

async function* readGoogleSSE(response: Response): AsyncGenerator<string> {
  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) yield text
    } catch { /* ignore */ }
  }
}

async function* readResponsesSSE(response: Response): AsyncGenerator<string> {
  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)
      if (parsed.type === 'response.output_text.delta' && parsed.delta) {
        yield parsed.delta
      }
    } catch { /* ignore */ }
  }
}

// ============= Tools 模式：OpenAI =============

interface OpenAIToolsResult {
  text: string
  toolCalls: AIToolCall[]
  finishReason: string | null
}

async function callOpenAIWithTools(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: object[],
  tools: object[],
  signal: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<OpenAIToolsResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误: ${response.status} - ${errorText}`)
  }

  let text = ''
  const toolCalls: Map<number, AIToolCall> = new Map()
  let finishReason: string | null = null

  for await (const data of readSSELines(response)) {
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const choice = parsed.choices?.[0]

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason
      }

      const delta = choice?.delta
      if (!delta) continue

      // 文本内容
      if (delta.content) {
        text += delta.content
        onChunk?.(delta.content)
      }

      // Tool calls（增量式）
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCalls.has(idx)) {
            toolCalls.set(idx, {
              id: tc.id || '',
              type: 'function',
              function: { name: '', arguments: '' },
            })
          }
          const existing = toolCalls.get(idx)!
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.function.name += tc.function.name
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
        }
      }
    } catch { /* ignore */ }
  }

  return {
    text,
    toolCalls: Array.from(toolCalls.values()),
    finishReason,
  }
}

// ============= Tools 模式：Anthropic =============

interface AnthropicToolsResult {
  text: string
  toolUses: { id: string; name: string; input: Record<string, unknown> }[]
  stopReason: string | null
}

async function callAnthropicWithTools(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: object[],
  tools: object[],
  signal: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<AnthropicToolsResult> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API 错误: ${response.status} - ${errorText}`)
  }

  let text = ''
  const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = []
  let currentToolUse: { id: string; name: string; inputJson: string } | null = null
  let stopReason: string | null = null

  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)

      if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
        stopReason = parsed.delta.stop_reason
      }

      if (parsed.type === 'content_block_start') {
        if (parsed.content_block?.type === 'tool_use') {
          currentToolUse = {
            id: parsed.content_block.id,
            name: parsed.content_block.name,
            inputJson: '',
          }
        }
      }

      if (parsed.type === 'content_block_delta') {
        if (parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
          text += parsed.delta.text
          onChunk?.(parsed.delta.text)
        }
        if (parsed.delta?.type === 'input_json_delta' && parsed.delta?.partial_json && currentToolUse) {
          currentToolUse.inputJson += parsed.delta.partial_json
        }
      }

      if (parsed.type === 'content_block_stop' && currentToolUse) {
        try {
          const input = JSON.parse(currentToolUse.inputJson || '{}')
          toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input })
        } catch {
          toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input: {} })
        }
        currentToolUse = null
      }
    } catch { /* ignore */ }
  }

  return { text, toolUses, stopReason }
}

// ============= Tools 模式：Google =============

interface GoogleToolsResult {
  text: string
  functionCalls: { name: string; args: Record<string, unknown> }[]
}

async function callGoogleWithTools(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  contents: object[],
  tools: object[],
  signal: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<GoogleToolsResult> {
  const url = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools,
      generationConfig: { maxOutputTokens: 4096 },
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google API 错误: ${response.status} - ${errorText}`)
  }

  let text = ''
  const functionCalls: { name: string; args: Record<string, unknown> }[] = []

  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)
      const parts = parsed.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.text) {
          text += part.text
          onChunk?.(part.text)
        }
        if (part.functionCall) {
          functionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          })
        }
      }
    } catch { /* ignore */ }
  }

  return { text, functionCalls }
}

// ============= Tools 模式：Responses API =============

interface ResponsesToolsResult {
  text: string
  functionCalls: { callId: string; name: string; args: Record<string, unknown> }[]
}

async function callResponsesWithTools(
  baseUrl: string,
  apiKey: string,
  model: string,
  instructions: string,
  input: object[],
  tools: object[],
  signal: AbortSignal,
  onChunk?: (chunk: string) => void
): Promise<ResponsesToolsResult> {
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      tools,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Responses API 错误: ${response.status} - ${errorText}`)
  }

  let text = ''
  const functionCalls: { callId: string; name: string; args: Record<string, unknown> }[] = []
  let currentFnCallId = ''
  let currentFnName = ''
  let currentFnArgs = ''

  for await (const data of readSSELines(response)) {
    if (!data) continue
    try {
      const parsed = JSON.parse(data)

      // 文本增量
      if (parsed.type === 'response.output_text.delta' && parsed.delta) {
        text += parsed.delta
        onChunk?.(parsed.delta)
      }

      // 函数调用参数增量
      if (parsed.type === 'response.function_call_arguments.delta' && parsed.delta) {
        currentFnArgs += parsed.delta
      }

      // 新的 output item（可能是 function_call）
      if (parsed.type === 'response.output_item.added' && parsed.item?.type === 'function_call') {
        currentFnCallId = parsed.item.call_id || ''
        currentFnName = parsed.item.name || ''
        currentFnArgs = ''
      }

      // 函数调用完成
      if (parsed.type === 'response.function_call_arguments.done') {
        try {
          const args = JSON.parse(currentFnArgs || '{}')
          functionCalls.push({ callId: currentFnCallId, name: currentFnName, args })
        } catch {
          functionCalls.push({ callId: currentFnCallId, name: currentFnName, args: {} })
        }
        currentFnArgs = ''
      }
    } catch { /* ignore */ }
  }

  return { text, functionCalls }
}

// ============= 格式转换工具函数 =============

function aiMessagesToOpenAI(messages: AIMessage[]): object[] {
  return messages.map(msg => {
    if (msg.role === 'tool') {
      return { role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content }
    }
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return { role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls }
    }
    // 处理图片
    if (msg.images && msg.images.length > 0 && msg.role === 'user') {
      const content: object[] = []
      if (msg.content) content.push({ type: 'text', text: msg.content })
      for (const img of msg.images) {
        content.push({ type: 'image_url', image_url: { url: img } })
      }
      return { role: msg.role, content }
    }
    return { role: msg.role, content: msg.content }
  })
}

function aiMessagesToAnthropic(messages: AIMessage[]): object[] {
  const result: object[] = []

  for (const msg of messages) {
    if (msg.role === 'system') continue // system 单独处理

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const content: object[] = []
      if (msg.content) content.push({ type: 'text', text: msg.content })
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        })
      }
      result.push({ role: 'assistant', content })
      continue
    }

    if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        }],
      })
      continue
    }

    // 处理图片
    if (msg.images && msg.images.length > 0 && msg.role === 'user') {
      const content: object[] = []
      if (msg.content) content.push({ type: 'text', text: msg.content as string })
      for (const img of msg.images) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: match[1], data: match[2] },
          })
        }
      }
      result.push({ role: 'user', content })
      continue
    }

    result.push({ role: msg.role, content: msg.content })
  }

  return result
}

function aiMessagesToGoogle(messages: AIMessage[]): object[] {
  const contents: object[] = []

  for (const msg of messages) {
    if (msg.role === 'system') continue

    if (msg.role === 'assistant') {
      const parts: object[] = []
      if (msg.content) parts.push({ text: msg.content })
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}'),
            },
          })
        }
      }
      contents.push({ role: 'model', parts })
      continue
    }

    if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: 'tool_response',
            response: { result: msg.content },
          },
        }],
      })
      continue
    }

    if (msg.role === 'user') {
      const parts: object[] = []
      if (msg.content) parts.push({ text: msg.content as string })
      if (msg.images) {
        for (const img of msg.images) {
          const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
          }
        }
      }
      contents.push({ role: 'user', parts })
      continue
    }
  }

  return contents
}

function aiMessagesToResponses(messages: AIMessage[]): object[] {
  const input: object[] = []

  for (const msg of messages) {
    if (msg.role === 'system') continue // instructions 单独处理

    if (msg.role === 'assistant') {
      // Responses API 用 output items 表示 assistant 消息
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          })
        }
      }
      if (msg.content) {
        input.push({ role: 'assistant', content: msg.content })
      }
      continue
    }

    if (msg.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: msg.tool_call_id,
        output: msg.content,
      })
      continue
    }

    // user
    input.push({ role: 'user', content: msg.content as string })
  }

  return input
}

// ============= 根据 provider 获取简单流式生成器 =============

function getSimpleStreamGenerator(provider: AIProvider): typeof streamOpenAISimple {
  switch (provider) {
    case 'anthropic':
      return streamAnthropicSimple
    case 'google':
      return streamGoogleSimple
    case 'ollama':
      return streamOpenAISimple // Ollama 兼容 OpenAI 格式
    case 'responses':
      return streamResponsesSimple
    case 'openai':
    default:
      return streamOpenAISimple
  }
}

// ============= Tools 循环执行 =============

const MAX_TOOL_ITERATIONS = 10

async function runToolLoop(
  provider: AIProvider,
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AIMessage[],
  toolContext: AIToolContext,
  signal: AbortSignal,
  onChunk?: (chunk: string) => void,
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void,
  onToolResult?: (toolName: string, result: string) => void,
): Promise<string> {
  let fullText = ''
  const systemPrompt = messages.find(m => m.role === 'system')?.content as string || ''
  const workingMessages = [...messages]

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (signal.aborted) break

    if (provider === 'openai' || provider === 'ollama') {
      const openaiMessages = aiMessagesToOpenAI(workingMessages)
      const tools = toOpenAITools()
      const result = await callOpenAIWithTools(
        baseUrl, apiKey, model, openaiMessages, tools, signal, onChunk
      )
      fullText += result.text

      if (result.toolCalls.length === 0) break

      // 添加 assistant 消息（带 tool_calls）
      workingMessages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: result.toolCalls,
      })

      // 执行每个 tool call
      for (const tc of result.toolCalls) {
        const params = JSON.parse(tc.function.arguments || '{}')
        onToolCall?.(tc.function.name, params)
        const toolResult = await executeToolCall(tc.function.name, params, toolContext)
        onToolResult?.(tc.function.name, toolResult)
        workingMessages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: tc.id,
        })
      }
    } else if (provider === 'anthropic') {
      const anthropicMessages = aiMessagesToAnthropic(workingMessages)
      const tools = toAnthropicTools()
      const result = await callAnthropicWithTools(
        baseUrl, apiKey, model, systemPrompt, anthropicMessages, tools, signal, onChunk
      )
      fullText += result.text

      if (result.toolUses.length === 0) break

      // 添加 assistant 消息
      const assistantToolCalls: AIToolCall[] = result.toolUses.map(tu => ({
        id: tu.id,
        type: 'function' as const,
        function: { name: tu.name, arguments: JSON.stringify(tu.input) },
      }))
      workingMessages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: assistantToolCalls,
      })

      // 执行 tool calls
      for (const tu of result.toolUses) {
        onToolCall?.(tu.name, tu.input)
        const toolResult = await executeToolCall(tu.name, tu.input, toolContext)
        onToolResult?.(tu.name, toolResult)
        workingMessages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: tu.id,
        })
      }
    } else if (provider === 'google') {
      const contents = aiMessagesToGoogle(workingMessages)
      const tools = toGeminiTools()
      const result = await callGoogleWithTools(
        baseUrl, apiKey, model, systemPrompt, contents, tools, signal, onChunk
      )
      fullText += result.text

      if (result.functionCalls.length === 0) break

      // 添加 model response
      const toolCalls: AIToolCall[] = result.functionCalls.map((fc, idx) => ({
        id: `google_${idx}`,
        type: 'function' as const,
        function: { name: fc.name, arguments: JSON.stringify(fc.args) },
      }))
      workingMessages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: toolCalls,
      })

      // 执行 tool calls
      for (const fc of result.functionCalls) {
        onToolCall?.(fc.name, fc.args)
        const toolResult = await executeToolCall(fc.name, fc.args, toolContext)
        onToolResult?.(fc.name, toolResult)
        workingMessages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: `google_${result.functionCalls.indexOf(fc)}`,
        })
      }
    } else if (provider === 'responses') {
      const input = aiMessagesToResponses(workingMessages)
      const tools = toResponsesTools()
      const result = await callResponsesWithTools(
        baseUrl, apiKey, model, systemPrompt, input, tools, signal, onChunk
      )
      fullText += result.text

      if (result.functionCalls.length === 0) break

      // 添加 assistant 输出到消息历史
      const toolCalls: AIToolCall[] = result.functionCalls.map(fc => ({
        id: fc.callId,
        type: 'function' as const,
        function: { name: fc.name, arguments: JSON.stringify(fc.args) },
      }))
      workingMessages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: toolCalls,
      })

      // 执行 tool calls
      for (const fc of result.functionCalls) {
        onToolCall?.(fc.name, fc.args)
        const toolResult = await executeToolCall(fc.name, fc.args, toolContext)
        onToolResult?.(fc.name, toolResult)
        workingMessages.push({
          role: 'tool',
          content: toolResult,
          tool_call_id: fc.callId,
        })
      }
    }
  }

  return fullText
}

// ============= Hook =============

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const { onChunk, onLine, onFinish, onError, onToolCall, onToolResult } = options
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lineBufferRef = useRef<string>('')

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    lineBufferRef.current = ''
  }, [])

  // 简单模式（编辑器内联 AI，不带 tools）
  const startStream = useCallback(
    async (action: AIAction, text: string, customPrompt?: string, context?: AIContext, templateType?: TemplateType) => {
      const settings = await getSettings()

      if (settings.aiProvider !== 'ollama' && !settings.aiApiKey) {
        const errorMsg = '请在设置中配置 API Key'
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }

      stopStream()
      setIsStreaming(true)
      setStreamText('')
      setError(null)
      lineBufferRef.current = ''

      abortControllerRef.current = new AbortController()

      let systemPrompt: string
      if (action === 'template' && templateType) {
        systemPrompt = buildSystemPrompt('template', context, templateType)
      } else if (action === 'custom' && customPrompt) {
        systemPrompt = `${buildSystemPrompt('custom', context)}\n\n用户指令：${customPrompt}`
      } else {
        systemPrompt = buildSystemPrompt(action, context)
      }

      try {
        const streamGenerator = getSimpleStreamGenerator(settings.aiProvider)
        const stream = streamGenerator(
          settings.aiBaseUrl,
          settings.aiApiKey,
          settings.aiModel,
          systemPrompt,
          text,
          abortControllerRef.current.signal
        )

        let fullText = ''

        for await (const content of stream) {
          fullText += content
          setStreamText(fullText)
          onChunk?.(content)

          if (onLine) {
            lineBufferRef.current += content
            const bufferLines = lineBufferRef.current.split('\n')
            if (bufferLines.length > 1) {
              const completeLines = bufferLines.slice(0, -1)
              lineBufferRef.current = bufferLines[bufferLines.length - 1]
              completeLines.forEach(l => onLine(l + '\n'))
            }
          }
        }

        if (onLine && lineBufferRef.current) {
          onLine(lineBufferRef.current)
          lineBufferRef.current = ''
        }

        setIsStreaming(false)
        onFinish?.(fullText)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const errorMsg = err instanceof Error ? err.message : '发生未知错误'
        setError(errorMsg)
        onError?.(errorMsg)
        setIsStreaming(false)
      }
    },
    [onChunk, onLine, onFinish, onError, stopStream]
  )

  // Tools 模式（AI 侧栏聊天，带 tools + 多轮历史）
  const startStreamWithTools = useCallback(
    async (messages: AIMessage[], toolContext: AIToolContext) => {
      const settings = await getSettings()

      if (settings.aiProvider !== 'ollama' && !settings.aiApiKey) {
        const errorMsg = '请在设置中配置 API Key'
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }

      stopStream()
      setIsStreaming(true)
      setStreamText('')
      setError(null)
      lineBufferRef.current = ''

      abortControllerRef.current = new AbortController()

      try {
        const chunkHandler = (chunk: string) => {
          setStreamText(prev => prev + chunk)
          onChunk?.(chunk)

          if (onLine) {
            lineBufferRef.current += chunk
            const bufferLines = lineBufferRef.current.split('\n')
            if (bufferLines.length > 1) {
              const completeLines = bufferLines.slice(0, -1)
              lineBufferRef.current = bufferLines[bufferLines.length - 1]
              completeLines.forEach(l => onLine(l + '\n'))
            }
          }
        }

        const fullText = await runToolLoop(
          settings.aiProvider,
          settings.aiBaseUrl,
          settings.aiApiKey,
          settings.aiModel,
          messages,
          toolContext,
          abortControllerRef.current.signal,
          chunkHandler,
          onToolCall,
          onToolResult,
        )

        if (onLine && lineBufferRef.current) {
          onLine(lineBufferRef.current)
          lineBufferRef.current = ''
        }

        setIsStreaming(false)
        onFinish?.(fullText)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const errorMsg = err instanceof Error ? err.message : '发生未知错误'
        setError(errorMsg)
        onError?.(errorMsg)
        setIsStreaming(false)
      }
    },
    [onChunk, onLine, onFinish, onError, onToolCall, onToolResult, stopStream]
  )

  return {
    isStreaming,
    streamText,
    error,
    startStream,
    startStreamWithTools,
    stopStream,
  }
}
