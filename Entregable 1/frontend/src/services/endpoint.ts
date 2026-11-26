import { request } from './api'
export interface EndpointInput {
 token?: string
 params?: Record<string, string | number>
 query?: Record<string, string | number | boolean | undefined>
 body?: unknown
 signal?: AbortSignal
}
export function callEndpoint<T = unknown>(method: string, template: string, input: EndpointInput = {}): Promise<T> {
 const path = template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
  const value = input.params?.[key]
  if (value === undefined || String(value).trim() === '') throw new Error('Falta el identificador ' + key)
  return encodeURIComponent(String(value))
 })
 const query = new URLSearchParams()
 for (const [key, value] of Object.entries(input.query ?? {})) if (value !== undefined) query.set(key, String(value))
 return request<T>(path + (query.size ? '?' + query.toString() : ''), { method, token: input.token, body: input.body, signal: input.signal })
}
