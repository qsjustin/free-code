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

export function getAliyunDefaultOpusModel(): string {
  return process.env.ALIYUN_DEFAULT_OPUS_MODEL || 'glm-5'
}

export function getAliyunDefaultSonnetModel(): string {
  return process.env.ALIYUN_DEFAULT_SONNET_MODEL || 'qwen3.5-plus'
}

export function getAliyunDefaultHaikuModel(): string {
  return process.env.ALIYUN_DEFAULT_HAIKU_MODEL || 'MiniMax-M2.5'
}

export function mapClaudeModelToAliyun(claudeModel: string | null): string {
  if (!claudeModel) return getAliyunDefaultSonnetModel()
  if (ALIYUN_MODELS.some(m => m.id === claudeModel)) return claudeModel
  
  // Also pass through if it matches any custom configured default
  if (claudeModel === getAliyunDefaultOpusModel() || 
      claudeModel === getAliyunDefaultSonnetModel() || 
      claudeModel === getAliyunDefaultHaikuModel()) {
    return claudeModel
  }

  const lower = claudeModel.toLowerCase()
  if (lower.includes('opus')) return getAliyunDefaultOpusModel()
  if (lower.includes('haiku')) return getAliyunDefaultHaikuModel()
  if (lower.includes('sonnet')) return getAliyunDefaultSonnetModel()
  return getAliyunDefaultSonnetModel()
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
    // Important: Use url, not input, because if input is a Request its body may be consumed.
    // Also, we must extract headers if input is a Request to preserve them.
    let headers: HeadersInit = init?.headers || {}
    if (input instanceof Request) {
      const reqHeaders: Record<string, string> = {}
      input.headers.forEach((value, key) => {
        reqHeaders[key] = value
      })
      headers = { ...reqHeaders, ...headers }
    }

    return globalThis.fetch(url, {
      ...init,
      method: input instanceof Request ? input.method : (init?.method || 'POST'),
      headers,
      body: JSON.stringify(anthropicBody),
    })
  }
}
