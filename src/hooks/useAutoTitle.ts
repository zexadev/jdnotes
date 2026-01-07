import { useState, useCallback } from 'react'
import { getSettings } from './useSettings'

interface GenerateResult {
  title?: string
  tags?: string[]
}

interface UseAutoTitleReturn {
  isGenerating: boolean
  generateTitleAndTags: (content: string, currentTitle?: string) => Promise<GenerateResult>
}

export function useAutoTitle(): UseAutoTitleReturn {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateTitleAndTags = useCallback(async (content: string, currentTitle?: string): Promise<GenerateResult> => {
    const settings = await getSettings()

    if (!settings.aiApiKey) {
      return {}
    }

    setIsGenerating(true)

    try {
      const needTitle = !currentTitle || currentTitle === '无标题' || currentTitle.trim() === ''

      const prompt = needTitle
        ? `根据以下笔记内容，生成：
1. 一个简洁的标题（5-10个字）
2. 2-4个相关标签

使用与内容相同的语言。按以下 JSON 格式返回，不要其他内容：
{"title": "标题", "tags": ["标签1", "标签2"]}`
        : `根据以下笔记内容，生成 2-4 个相关标签。
使用与内容相同的语言。按以下 JSON 格式返回，不要其他内容：
{"tags": ["标签1", "标签2"]}`

      const response = await fetch(`${settings.aiBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.aiApiKey}`,
        },
        body: JSON.stringify({
          model: settings.aiModel,
          messages: [
            {
              role: 'system',
              content: '你是一个笔记助手，帮助用户生成标题和标签。只返回 JSON 格式，不要任何解释。',
            },
            {
              role: 'user',
              content: `${prompt}\n\n笔记内容：\n${content.slice(0, 500)}`,
            },
          ],
          max_tokens: 150,
        }),
      })

      if (!response.ok) {
        throw new Error('API 请求失败')
      }

      const data = await response.json()
      const resultText = data.choices?.[0]?.message?.content?.trim()

      setIsGenerating(false)

      // 解析 JSON 结果
      try {
        // 尝试提取 JSON
        const jsonMatch = resultText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          return {
            title: result.title,
            tags: Array.isArray(result.tags) ? result.tags : undefined,
          }
        }
      } catch {
        // 解析失败，尝试简单提取
      }

      return {}
    } catch (error) {
      setIsGenerating(false)
      return {}
    }
  }, [])

  return {
    isGenerating,
    generateTitleAndTags,
  }
}
