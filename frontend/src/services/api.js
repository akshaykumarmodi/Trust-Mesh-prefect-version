const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('trustmesh_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const adminKey = localStorage.getItem('trustmesh_admin_key');
  if (adminKey && !headers['X-Admin-Key']) {
    headers['X-Admin-Key'] = adminKey;
  }

  const config = {
    headers,
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
  setProjectPeerWeight: (projectId, data) => request(`/projects/${projectId}/peers`, { method: 'POST', body: JSON.stringify(data) }),
  getProjectRelationships: (projectId) => request(`/projects/${projectId}/relationships`),

  // Contributors
  getContributors: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.reputation_state) query.append('reputation_state', params.reputation_state);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/contributors${qs}`);
  },
  getContributor: (id) => request(`/contributors/${id}`),
  createContributor: (data) => request('/contributors', { method: 'POST', body: JSON.stringify(data) }),
  getContributorActivity: (id) => request(`/contributors/${id}/activity`),

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
  scanCampaigns: () => request('/campaigns/scan', { method: 'POST' }),
  updateCampaignStatus: (id, status) => request(`/campaigns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),


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
  resetDemoData: () => request('/ai/reset-demo', { method: 'POST' }),

  // GitHub Integration
  getGitHubStatus: () => request('/github/status'),
  getGitHubAuthUrl: () => request('/github/oauth/authorize'),
  importGitHubRepo: (repoUrl, category = 'Infrastructure', customPolicy = null) =>
    request('/github/import-repo', {
      method: 'POST',
      body: JSON.stringify({
        repo_url: repoUrl,
        category,
        custom_policy: customPolicy
      })
    }),
  getProjectGitHubPulls: (projectId, params = {}) => {
    const query = new URLSearchParams();
    if (params.state) query.append('state', params.state);
    if (params.verification_status) query.append('verification_status', params.verification_status);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/github/projects/${projectId}/pulls${qs}`);
  },
  syncProjectGitHub: (projectId, limit = 30) =>
    request(`/github/projects/${projectId}/sync?limit=${limit}`, { method: 'POST' }),
  verifyGitHubPR: (projectId, prNumber, canonicalUrl = null) =>
    request('/github/verify-pr', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        pr_number: prNumber,
        canonical_url: canonicalUrl
      })
    }),

  // Auth & Identity
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  githubLogin: (data) => request('/auth/github-login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  verifyAccount: (data) => request('/auth/verify-account', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // Admin Monitoring & Email Notification Audit Trail
  getAdminMetrics: () => request('/admin/metrics'),
  getAdminActivities: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.status) query.append('status', params.status);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/admin/activities${qs}`);
  },
  getAdminEmailDeliveries: (params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/admin/email-deliveries${qs}`);
  },
  sendAdminTestEmail: (recipient = 'akshay123modi@gmail.com') =>
    request('/admin/test-email', { method: 'POST', body: JSON.stringify({ recipient }) }),
  getPrivacyNotice: () => request('/admin/privacy-notice'),
};
