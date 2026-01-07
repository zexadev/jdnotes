import { useState, useCallback, useRef } from 'react'
import { getSettings } from './useSettings'

export type AIAction = 'refine' | 'summarize' | 'translate' | 'continue' | 'custom' | 'template'

// 模板类型
export type TemplateType = 'meeting' | 'brainstorm' | 'code'

// AI 上下文信息
export interface AIContext {
  noteTitle?: string
  surroundingText?: string
}

interface UseAIStreamOptions {
  onChunk?: (chunk: string) => void
  onLine?: (line: string) => void  // 基于行的回调，用于更好的 Markdown 解析
  onFinish?: (fullText: string) => void
  onError?: (error: string) => void
}

interface UseAIStreamReturn {
  isStreaming: boolean
  streamText: string
  error: string | null
  startStream: (action: AIAction, text: string, customPrompt?: string, context?: AIContext, templateType?: TemplateType) => Promise<void>
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

// 构建上下文感知的系统提示
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

  // 添加上下文信息
  if (context?.noteTitle) {
    prompt += `\n\n当前笔记标题：「${context.noteTitle}」`
  }
  if (context?.surroundingText) {
    prompt += `\n\n上下文内容：\n${context.surroundingText}`
  }

  return prompt
}

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const { onChunk, onLine, onFinish, onError } = options
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

  const startStream = useCallback(
    async (action: AIAction, text: string, customPrompt?: string, context?: AIContext, templateType?: TemplateType) => {
      const settings = await getSettings()

      if (!settings.aiApiKey) {
        const errorMsg = '请在设置中配置 API Key'
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }

      // 停止之前的流
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

      const userMessage = text

      try {
        const response = await fetch(`${settings.aiBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.aiApiKey}`,
          },
          body: JSON.stringify({
            model: settings.aiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`API 错误: ${response.status} ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法读取响应流')
        }

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  fullText += content
                  setStreamText(fullText)
                  onChunk?.(content)

                  // 基于行的缓冲处理
                  if (onLine) {
                    lineBufferRef.current += content
                    // 检查是否有完整的行
                    const bufferLines = lineBufferRef.current.split('\n')
                    // 保留最后一个可能不完整的行
                    if (bufferLines.length > 1) {
                      const completeLines = bufferLines.slice(0, -1)
                      lineBufferRef.current = bufferLines[bufferLines.length - 1]
                      completeLines.forEach(l => onLine(l + '\n'))
                    }
                  }
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        // 处理缓冲区中剩余的内容
        if (onLine && lineBufferRef.current) {
          onLine(lineBufferRef.current)
          lineBufferRef.current = ''
        }

        setIsStreaming(false)
        onFinish?.(fullText)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 用户主动停止，不报错
          return
        }
        const errorMsg = err instanceof Error ? err.message : '发生未知错误'
        setError(errorMsg)
        onError?.(errorMsg)
        setIsStreaming(false)
      }
    },
    [onChunk, onLine, onFinish, onError, stopStream]
  )

  return {
    isStreaming,
    streamText,
    error,
    startStream,
    stopStream,
  }
}
