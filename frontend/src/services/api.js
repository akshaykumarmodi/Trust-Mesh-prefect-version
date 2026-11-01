const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(errorData.detail || 'An error occurred during API request');
    }
    return await response.json();
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // System & Overview
  getHealth: () => request('/health'),
  getOverview: () => request('/trust/overview'),
  
  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Contributors
  getContributors: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.reputation_state) query.append('reputation_state', params.reputation_state);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/contributors${qs}`);
  },
  getContributor: (id) => request(`/contributors/${id}`),

  // Vouches
  getVouches: () => request('/vouches'),
  submitVouch: (data) => request('/vouches', { method: 'POST', body: JSON.stringify(data) }),

  // Denouncements
  getDenouncements: (status = null) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/denouncements${qs}`);
  },
  submitDenouncement: (data) => request('/denouncements', { method: 'POST', body: JSON.stringify(data) }),
  updateDenouncementStatus: (id, data) => request(`/denouncements/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Trust Evaluation Engine
  evaluateTrust: (contributorId, viewingProjectId = null) => {
    const query = new URLSearchParams({ contributor_id: contributorId });
    if (viewingProjectId) query.append('viewing_project_id', viewingProjectId);
    return request(`/trust/evaluate?${query.toString()}`);
  },

  // Interactive Graph for React Flow
  getNetworkGraph: () => request('/network'),

  // Coordinated Campaigns
  getCampaigns: () => request('/campaigns'),
  getCampaign: (id) => request(`/campaigns/${id}`),
  getCampaignAnalytics: () => request('/campaigns/analytics'),

  // Evidence Center
  getEvidence: (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/evidence${qs}`);
  },

  // Federation
  exportFederationBundle: (projectId) => request(`/federation/export/${projectId}`),
  importFederationBundle: (bundle) => request('/federation/import', { method: 'POST', body: JSON.stringify(bundle) }),

  // AI & Demo Utilities
  getAIStatus: () => request('/ai/status'),
  explainWithAI: (targetType, targetId, viewingProjectId = null) => 
    request('/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        viewing_project_id: viewingProjectId
      })
    }),
  resetDemoData: () => request('/ai/reset-demo', { method: 'POST' })
};
