const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Dashboard
  getSummary: (params) => request(`/dashboard/summary?${new URLSearchParams(params)}`),
  getAgentStats: (params) => request(`/dashboard/agents?${new URLSearchParams(params)}`),
  getCategories: (params) => request(`/dashboard/categories?${new URLSearchParams(params)}`),
  getTimeline: (params) => request(`/dashboard/timeline?${new URLSearchParams(params)}`),

  // Evaluations
  getEvaluations: (params) => request(`/evaluations?${new URLSearchParams(params)}`),
  getEvaluationDetail: (id) => request(`/evaluations/${id}`),

  // Upload
  uploadFiles: async (formData) => {
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
  getBatchStatus: (id) => request(`/upload/${id}/status`),
  getBatches: (params) => request(`/upload?${new URLSearchParams(params || {})}`),

  // Agents
  getAgents: (params) => request(`/agents?${new URLSearchParams(params || {})}`),
  createAgent: (data) => request('/agents', { method: 'POST', body: JSON.stringify(data) }),
  bulkAgents: (agents) => request('/agents/bulk', { method: 'POST', body: JSON.stringify({ agents }) }),
  updateAgent: (id, data) => request(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id) => request(`/agents/${id}`, { method: 'DELETE' }),

  // Categories
  getCategoryList: (params) => request(`/categories?${new URLSearchParams(params || {})}`),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  bulkCategories: (categories) => request('/categories/bulk', { method: 'POST', body: JSON.stringify({ categories }) }),
  importCategories: () => request('/categories/import-from-conversations', { method: 'POST' }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: (params) => request(`/contacts?${new URLSearchParams(params || {})}`),
  createContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  bulkContacts: (contacts) => request('/contacts/bulk', { method: 'POST', body: JSON.stringify({ contacts }) }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),

  // Health
  health: () => request('/health'),
};
