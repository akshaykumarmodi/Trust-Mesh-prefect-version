const API_BASE = (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '') : '') + '/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Deduplication map for concurrent in-flight GET requests
const inflightGetRequests = new Map();

async function executeRequest(endpoint, options = {}, retries = 2) {
  const url = `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
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

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, config);

      // Handle serverless cold-start and gateway timeouts (502, 503, 504) with safe backoff
      if ([502, 503, 504].includes(response.status) && method === 'GET' && attempt < retries) {
        console.warn(`[API Serverless Warning] HTTP ${response.status} on ${endpoint}. Retrying (${attempt + 1}/${retries})...`);
        await sleep(350 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
        }

        if (response.status === 401) {
          console.warn(`[API Auth Warning] Unauthorized request on ${endpoint}`);
        }

        const err = new Error(errorData.detail || `Request failed with status ${response.status}`);
        err.status = response.status;
        err.endpoint = endpoint;
        throw err;
      }

      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }

      lastError = err;
      const isNetworkErr = err.name === 'TypeError' && String(err.message).toLowerCase().includes('fetch');

      // Retry transient network drop on GET requests
      if (isNetworkErr && method === 'GET' && attempt < retries) {
        console.warn(`[API Network Warning] Fetch drop for ${endpoint}. Retrying in ${300 * (attempt + 1)}ms...`);
        await sleep(300 * (attempt + 1));
        continue;
      }

      if (isNetworkErr) {
        const offlineErr = new Error('Backend API service is temporarily unreachable. Please check network connectivity or server status.');
        offlineErr.status = 0;
        offlineErr.endpoint = endpoint;
        console.error(`[API Network Error] ${endpoint}:`, err);
        throw offlineErr;
      }

      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  throw lastError;
}

async function request(endpoint, options = {}, retries = 2) {
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = `${method}:${endpoint}`;

  // Deduplicate identical in-flight GET requests
  if (method === 'GET' && !options.signal && inflightGetRequests.has(cacheKey)) {
    return inflightGetRequests.get(cacheKey);
  }

  const promise = executeRequest(endpoint, options, retries);

  if (method === 'GET' && !options.signal) {
    inflightGetRequests.set(cacheKey, promise);
    promise.finally(() => {
      inflightGetRequests.delete(cacheKey);
    });
  }

  return promise;
}

// Persistent tombstone ledger for deleted projects across serverless instances and refresh cycles
export const KNOWN_PURGED_IDS = new Set([
  'proj-hyperflow', 'hyperflow-engine',
  'proj-cryptomesh', 'cryptomesh-core',
  'proj-devpulse', 'devpulse-cli',
  'proj-cloudnative', 'cloudnative-router',
  'proj-tensorserve', 'tensorserve-ml',
  'repo-security-mesh', 'security-mesh-gateway'
]);

export const getDeletedProjectIds = () => {
  try {
    const stored = localStorage.getItem('trustmesh_deleted_project_ids');
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set([...KNOWN_PURGED_IDS, ...(Array.isArray(parsed) ? parsed : [])]);
  } catch {
    return new Set(KNOWN_PURGED_IDS);
  }
};

export const markProjectDeleted = (id, slug) => {
  try {
    const set = getDeletedProjectIds();
    if (id) set.add(id);
    if (slug) set.add(slug);
    localStorage.setItem('trustmesh_deleted_project_ids', JSON.stringify([...set]));
  } catch {}
};

export const unmarkProjectDeleted = (id, slug) => {
  try {
    const set = getDeletedProjectIds();
    if (id) set.delete(id);
    if (slug) set.delete(slug);
    localStorage.setItem('trustmesh_deleted_project_ids', JSON.stringify([...set]));
  } catch {}
};

export const filterDeletedProjects = (list) => {
  if (!Array.isArray(list)) return [];
  const deletedSet = getDeletedProjectIds();
  return list.filter((p) => p && !deletedSet.has(p.id) && !deletedSet.has(p.slug));
};

export const api = {
  // System & Overview
  getHealth: () => request('/health'),
  getOverview: () => request('/trust/overview'),

  // Projects
  getProjects: async (options = {}) => {
    const list = await request('/projects', options);
    return filterDeletedProjects(list);
  },
  getProject: (id, options = {}) => request(`/projects/${id}`, options),
  createProject: async (data) => {
    const created = await request('/projects', { method: 'POST', body: JSON.stringify(data) });
    if (created) unmarkProjectDeleted(created.id, created.slug);
    return created;
  },
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: async (id, slug = null) => {
    const res = await request(`/projects/${id}`, { method: 'DELETE' });
    const targetId = res?.deleted_id || id;
    markProjectDeleted(targetId, slug);
    return res;
  },
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

  // AI Analysis Engine
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

  // GitHub Integration
  getGitHubStatus: () => request('/github/status'),
  getGitHubAuthUrl: () => request('/github/oauth/authorize'),
  importGitHubRepo: async (repoUrl, category = 'Infrastructure', customPolicy = null) => {
    const imported = await request('/github/import-repo', {
      method: 'POST',
      body: JSON.stringify({
        repo_url: repoUrl,
        category,
        custom_policy: customPolicy
      })
    });
    if (imported) {
      unmarkProjectDeleted(imported.id, imported.slug);
    }
    return imported;
  },
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
  notifyLogin: (data) => request('/auth/login-notification', { method: 'POST', body: JSON.stringify(data) }),
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
  sendAdminTestEmail: (recipient) =>
    request('/admin/test-email', { method: 'POST', body: JSON.stringify(recipient ? { recipient } : {}) }),
  getSmtpStatus: () => request('/admin/smtp-status'),
  updateSmtpConfig: (data) => request('/admin/smtp-config', { method: 'POST', body: JSON.stringify(data) }),
  getPrivacyNotice: () => request('/admin/privacy-notice'),
};
