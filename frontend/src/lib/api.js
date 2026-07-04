const DEFAULT_API_BASE_URL = '/api'
const DEFAULT_REQUEST_TIMEOUT_MS = 10000

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return DEFAULT_API_BASE_URL
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function resolveUrl(urlOrPath) {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath
  }

  if (urlOrPath.startsWith('/api/')) {
    return urlOrPath
  }

  return buildApiUrl(urlOrPath)
}

export async function apiFetch(urlOrPath, options = {}) {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...restOptions } = options
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(resolveUrl(urlOrPath), {
      ...restOptions,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
