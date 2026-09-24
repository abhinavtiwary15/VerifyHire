// apps/web/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email: string, password: string, organizationName: string) =>
    request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password, organizationName }) }),

  // Candidates
  getCandidates: (token: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/api/v1/candidates${qs}`, {}, token)
  },
  getCandidate: (token: string, id: string) =>
    request(`/api/v1/candidates/${id}`, {}, token),
  createCandidate: (token: string, data: any) =>
    request('/api/v1/candidates', { method: 'POST', body: JSON.stringify(data) }, token),
  analyzeResume: (token: string, id: string) =>
    request(`/api/v1/candidates/${id}/analyze-resume`, { method: 'POST' }, token),
  updateCandidateStatus: (token: string, id: string, status: string) =>
    request(`/api/v1/candidates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  deleteCandidate: (token: string, id: string) =>
    request(`/api/v1/candidates/${id}`, { method: 'DELETE' }, token),
  disputeFlag: (token: string, candidateId: string, flagId: string, reason: string) =>
    request(`/api/v1/candidates/${candidateId}/flags/${flagId}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }, token),

  // Dashboard
  getDashboardStats: (token: string) =>
    request('/api/v1/dashboard/stats', {}, token),

  // Interview
  createSession: (token: string, candidateId: string, platform?: string) =>
    request('/api/v1/interview/sessions', { method: 'POST', body: JSON.stringify({ candidateId, platform }) }, token),
  getSession: (token: string, sessionToken: string) =>
    request(`/api/v1/interview/sessions/${sessionToken}`, {}, token),
  startSession: (token: string, sessionToken: string) =>
    request(`/api/v1/interview/sessions/${sessionToken}/start`, { method: 'PATCH' }, token),
  endSession: (token: string, sessionToken: string, scores?: any) =>
    request(`/api/v1/interview/sessions/${sessionToken}/end`, { method: 'PATCH', body: JSON.stringify(scores) }, token),

  // Jobs
  getJobs: (token: string) => request('/api/v1/jobs', {}, token),
  createJob: (token: string, data: { title: string; description?: string }) =>
    request('/api/v1/jobs', { method: 'POST', body: JSON.stringify(data) }, token),

  // Billing
  createCheckout: (token: string, plan: string) =>
    request('/api/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }, token),
  createPortal: (token: string) =>
    request('/api/v1/billing/portal', { method: 'POST' }, token),
  getUsage: (token: string) =>
    request('/api/v1/billing/usage', {}, token),

  // Network
  checkNetwork: (token: string, data: any) =>
    request('/api/v1/network/check', { method: 'POST', body: JSON.stringify(data) }, token),

  // Webhooks
  getWebhookConfig: (token: string) =>
    request('/api/v1/webhooks/config', {}, token),
  updateWebhookConfig: (token: string, webhookUrl: string) =>
    request('/api/v1/webhooks/config', { method: 'PATCH', body: JSON.stringify({ webhookUrl }) }, token),
}
