/**
 * Aliyun Fetch Adapter (Anthropic Compatible Endpoint)
 *
 * Intercepts fetch calls from the Anthropic SDK and routes them to
 * Aliyun DashScope (Coding Plan) API.
 * The endpoint is natively Anthropic-compatible, so we only need to map model names.
 */

export const ALIYUN_MODELS = [
  { id: 'qwen3.5-plus', label: 'Qwen3.5 Plus', description: 'Long context, fast, supports image understanding' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', description: 'Excellent tool calling, strong in frontend, supports image understanding' },
  { id: 'glm-5', label: 'GLM-5', description: 'Complex tasks, slower speed' },
  { id: 'MiniMax-M2.5', label: 'MiniMax M2.5', description: 'MiniMax M2.5' },
  { id: 'qwen3-max-2026-01-23', label: 'Qwen3 Max 2026-01-23', description: 'Qwen3 Max' },
  { id: 'qwen3-coder-next', label: 'Qwen3 Coder Next', description: 'Qwen3 Coder Next' },
  { id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', description: 'Qwen3 Coder Plus' },
  { id: 'glm-4.7', label: 'GLM-4.7', description: 'GLM-4.7' },
] as const

export const DEFAULT_ALIYUN_MODEL = 'qwen3.5-plus'

export function mapClaudeModelToAliyun(claudeModel: string | null): string {
  if (!claudeModel) return DEFAULT_ALIYUN_MODEL
  if (ALIYUN_MODELS.some(m => m.id === claudeModel)) return claudeModel
  const lower = claudeModel.toLowerCase()
  if (lower.includes('opus')) return 'glm-5'
  if (lower.includes('haiku')) return 'MiniMax-M2.5'
  if (lower.includes('sonnet')) return 'qwen3.5-plus'
  return DEFAULT_ALIYUN_MODEL
}

export function createAliyunFetch(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // We expect the client to be initialized with the Aliyun baseURL,
    // so the URL is already https://coding.dashscope.aliyuncs.com/apps/anthropic/v1/messages
    const url = input instanceof Request ? input.url : String(input)

    if (!url.includes('/v1/messages')) {
      return globalThis.fetch(input, init)
    }

    let anthropicBody: Record<string, unknown>
    try {
      const bodyText =
        init?.body instanceof ReadableStream
          ? await new Response(init.body).text()
          : typeof init?.body === 'string'
            ? init.body
            : '{}'
      anthropicBody = JSON.parse(bodyText)
    } catch {
      anthropicBody = {}
    }

    const claudeModel = anthropicBody.model as string
    anthropicBody.model = mapClaudeModelToAliyun(claudeModel)

    // Send the exact same Anthropic payload with modified model name
    return globalThis.fetch(input, {
      ...init,
      body: JSON.stringify(anthropicBody),
    })
  }
}
