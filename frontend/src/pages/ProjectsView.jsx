import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  FolderGit2,
  Star,
  Sliders,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Save,
  CheckCircle,
  RefreshCw,
  Plus,
  Network,
  Users,
  X,
  ArrowRight,
  Shield,
  GitPullRequest,
  GitBranch,
  HelpCircle,
} from 'lucide-react';

export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editPolicy, setEditPolicy] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // GitHub Integration State
  const [githubStatus, setGithubStatus] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState('Infrastructure');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [syncingId, setSyncingId] = useState(null);

  // Register Project Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    slug: '',
    description: '',
    repo_url: '',
    category: 'Infrastructure',
    stars: 120,
    strictness: 'balanced',
    min_confidence: 0.60,
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Peering & Relationship Modal
  const [peeringProj, setPeeringProj] = useState(null);
  const [relationships, setRelationships] = useState(null);
  const [relLoading, setRelLoading] = useState(false);
  const [newPeerTargetId, setNewPeerTargetId] = useState('');
  const [newPeerWeight, setNewPeerWeight] = useState(0.8);
  const [peerSaving, setPeerSaving] = useState(false);

  // Pull Requests in Modal
  const [peeringTab, setPeeringTab] = useState('peering'); // 'peering' | 'pulls'
  const [projectPulls, setProjectPulls] = useState([]);
  const [pullsLoading, setPullsLoading] = useState(false);
  const [verifyingPrNumber, setVerifyingPrNumber] = useState(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGithubStatus = async () => {
    try {
      const status = await api.getGitHubStatus();
      setGithubStatus(status);
    } catch (err) {
      console.warn('Failed to load GitHub status:', err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadGithubStatus();
  }, []);

  const handleStartEdit = (proj) => {
    setEditingId(proj.id);
    setEditPolicy(proj.trust_policy || { strictness: 'balanced', min_confidence: 0.6, peer_weights: {} });
  };

  const handleSavePolicy = async (id) => {
    try {
      setSaving(true);
      await api.updateProject(id, { trust_policy: editPolicy });
      setSuccessMsg('Project trust policy updated successfully.');
      setEditingId(null);
      await loadProjects();
    } catch (err) {
      console.error('Failed to update project policy:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');

    if (!registerForm.name.trim()) {
      setRegisterError('Project name is required.');
      return;
    }
    const slug = registerForm.slug.trim() || registerForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      setRegisterLoading(true);
      await api.createProject({
        name: registerForm.name.trim(),
        slug: slug,
        description: registerForm.description.trim(),
        repo_url: registerForm.repo_url.trim(),
        category: registerForm.category,
        stars: parseInt(registerForm.stars, 10) || 0,
        trust_policy: {
          strictness: registerForm.strictness,
          min_confidence: parseFloat(registerForm.min_confidence) || 0.6,
          peer_weights: {}
        }
      });
      setSuccessMsg(`Project "${registerForm.name}" registered in TrustMesh.`);
      setShowRegisterModal(false);
      setRegisterForm({
        name: '',
        slug: '',
        description: '',
        repo_url: '',
        category: 'Infrastructure',
        stars: 120,
        strictness: 'balanced',
        min_confidence: 0.60,
      });
      await loadProjects();
    } catch (err) {
      setRegisterError(err.message || 'Failed to register project.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setImportError('');
    if (!importUrl.trim()) {
      setImportError('Please enter a GitHub repository URL.');
      return;
    }
    try {
      setImportLoading(true);
      const imported = await api.importGitHubRepo(importUrl.trim(), importCategory);
      setSuccessMsg(`Imported GitHub repository "${imported.name}" and synchronized pull requests.`);
      setShowImportModal(false);
      setImportUrl('');
      await loadProjects();
    } catch (err) {
      setImportError(err.message || 'Failed to import repository from GitHub.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleSyncProject = async (projectId) => {
    try {
      setSyncingId(projectId);
      const res = await api.syncProjectGitHub(projectId);
      setSuccessMsg(res.message);
      await loadProjects();
      if (peeringProj && peeringProj.id === projectId) {
        const pulls = await api.getProjectGitHubPulls(projectId);
        setProjectPulls(pulls);
      }
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleVerifyPR = async (projectId, prNumber, canonicalUrl) => {
    try {
      setVerifyingPrNumber(prNumber);
      const res = await api.verifyGitHubPR(projectId, prNumber, canonicalUrl);
      setProjectPulls((prev) =>
        prev.map((pr) =>
          pr.pr_number === prNumber
            ? { ...pr, verification_status: res.verification_status, verification_details: res.verification_details }
            : pr
        )
      );
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingPrNumber(null);
    }
  };

  const handleOpenPeering = async (proj) => {
    setPeeringProj(proj);
    setRelationships(null);
    setPeeringTab(proj.is_github_connected ? 'pulls' : 'peering');
    try {
      setRelLoading(true);
      const [relData, pullsData] = await Promise.all([
        api.getProjectRelationships(proj.id),
        api.getProjectGitHubPulls(proj.id),
      ]);
      setRelationships(relData);
      setProjectPulls(pullsData);
      const other = projects.find((p) => p.id !== proj.id);
      if (other) setNewPeerTargetId(other.id);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setRelLoading(false);
    }
  };

  const handleSavePeerWeight = async () => {
    if (!peeringProj || !newPeerTargetId) return;
    try {
      setPeerSaving(true);
      await api.setProjectPeerWeight(peeringProj.id, {
        target_project_id: newPeerTargetId,
        trust_weight: parseFloat(newPeerWeight) || 0.8,
        notes: `Autonomous peering weight configured by ${peeringProj.name}`
      });
      const updatedRel = await api.getProjectRelationships(peeringProj.id);
      setRelationships(updatedRel);
      await loadProjects();
    } catch (err) {
      alert(`Error updating peer weight: ${err.message}`);
    } finally {
      setPeerSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Federated Open-Source Projects
            </h1>
            {githubStatus && (
              <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-mono border items-center gap-1.5 ${
                githubStatus.auth_status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>GitHub REST API v3 Active</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Import public repositories, synchronize verified pull requests, and configure autonomous trust policies.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-cyan-300 border border-cyan-500/30 font-semibold text-xs tracking-wide shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center gap-2 transition-all"
          >
            <GitPullRequest className="w-4 h-4 text-cyan-400" />
            <span>Import GitHub Repo</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Project</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const isEditing = editingId === proj.id;
            const policy = proj.trust_policy || {};

            return (
              <div
                key={proj.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                        <FolderGit2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-bold text-white text-base">{proj.name}</h2>
                        <div className="text-xs text-cyan-400 font-mono">{proj.slug}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400/80 stroke-none" />
                      <span>{proj.stars?.toLocaleString() || 0}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mt-2">{proj.description}</p>

                  {proj.is_github_connected && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-emerald-400" />
                        <span>GitHub: {proj.github_owner}/{proj.github_repo} ({proj.default_branch || 'main'})</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                        {proj.visibility || 'public'}
                      </span>
                      {proj.last_synced_at && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Synced {new Date(proj.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                      <span>Configured Policy:</span>
                      <span className="text-cyan-400 capitalize">{policy.strictness || 'Balanced'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                      <span>Min Evaluation Confidence:</span>
                      <span className="text-white">{policy.min_confidence || '0.60'}</span>
                    </div>

                    {policy.peer_weights && Object.keys(policy.peer_weights).length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono">AUTONOMOUS PEER WEIGHTS:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(policy.peer_weights).map(([peerId, w]) => (
                            <span
                              key={peerId}
                              className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-800"
                            >
                              {peerId}: {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {proj.repo_url && (
                      <a
                        href={proj.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-mono"
                      >
                        <span>Repository</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {proj.is_github_connected && (
                      <button
                        onClick={() => handleSyncProject(proj.id)}
                        disabled={syncingId === proj.id}
                        className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                        title="Synchronize Pull Requests from GitHub REST API"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingId === proj.id ? 'animate-spin' : ''}`} />
                        <span>{syncingId === proj.id ? 'Syncing...' : 'Sync PRs'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPeering(proj)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-xs font-medium flex items-center gap-1.5 border border-cyan-500/20 transition-colors"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>{proj.is_github_connected ? 'PRs & Peering' : 'Peering & Policy'}</span>
                    </button>

                    <button
                      onClick={() => handleStartEdit(proj)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Tune Policy</span>
                    </button>
                  </div>
                </div>

                {/* Edit Policy Drawer Modal */}
                {isEditing && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        Tune Policy: {proj.name}
                      </h3>

                      <div>
                        <label className="block text-slate-300 text-xs font-medium mb-1">
                          Strictness Mode
                        </label>
                        <select
                          value={editPolicy.strictness || 'balanced'}
                          onChange={(e) =>
                            setEditPolicy({ ...editPolicy, strictness: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                        >
                          <option value="permissive">Permissive (Welcoming to newcomers)</option>
                          <option value="balanced">Balanced (Standard open-source baseline)</option>
                          <option value="high">High (Requires verified peer vouches)</option>
                          <option value="maximum">Maximum (Crypto/Kernel grade security)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 text-xs font-medium mb-1">
                          Minimum Acceptance Confidence (0.1 to 1.0)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1.0"
                          value={editPolicy.min_confidence || 0.6}
                          onChange={(e) =>
                            setEditPolicy({
                              ...editPolicy,
                              min_confidence: parseFloat(e.target.value) || 0.6,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSavePolicy(proj.id)}
                          disabled={saving}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5"
                        >
                          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          <span>Save Policy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PEERING & ACTIVITY MODAL */}
      {peeringProj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5 my-8 animate-in fade-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-cyan-400">Autonomous Trust Peering</span>
                <h3 className="text-base font-bold text-white mt-0.5">{peeringProj.name}</h3>
              </div>
              <button
                onClick={() => setPeeringProj(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setPeeringTab('pulls')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  peeringTab === 'pulls'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5 text-cyan-400" />
                <span>GitHub Pull Requests</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-cyan-300 border border-slate-700">
                  {projectPulls.length}
                </span>
              </button>

              <button
                onClick={() => setPeeringTab('peering')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  peeringTab === 'peering'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Autonomous Peering & Topology
              </button>
            </div>

            {peeringTab === 'pulls' ? (
              <div className="space-y-4 text-xs">
                {/* Pulls Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono text-slate-400">
                    <span>{projectPulls.length} PR records stored in SQLite database</span>
                  </div>
                  {peeringProj.is_github_connected && (
                    <button
                      onClick={() => handleSyncProject(peeringProj.id)}
                      disabled={syncingId === peeringProj.id}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingId === peeringProj.id ? 'animate-spin' : ''}`} />
                      <span>{syncingId === peeringProj.id ? 'Syncing...' : 'Sync GitHub PRs'}</span>
                    </button>
                  )}
                </div>

                {pullsLoading ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    <span>Loading pull requests...</span>
                  </div>
                ) : projectPulls.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-3">
                    <GitPullRequest className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs">No pull requests synchronized for this repository yet.</p>
                    {peeringProj.is_github_connected ? (
                      <button
                        onClick={() => handleSyncProject(peeringProj.id)}
                        disabled={syncingId === peeringProj.id}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 mx-auto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === peeringProj.id ? 'animate-spin' : ''}`} />
                        <span>Sync PRs from GitHub REST API</span>
                      </button>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-mono">
                        This repository is not linked to GitHub yet. Use "Import GitHub Repo" to import live public repos.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {projectPulls.map((pr) => {
                      const isVerifying = verifyingPrNumber === pr.pr_number;
                      const isVerified = pr.verification_status === 'VERIFIED_GITHUB';
                      const isUnable = pr.verification_status === 'UNABLE_TO_VERIFY';

                      return (
                        <div
                          key={pr.id || pr.pr_number}
                          className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-cyan-400 font-semibold text-xs">#{pr.pr_number}</span>
                                <a
                                  href={pr.pr_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-bold text-white text-xs hover:text-cyan-300 flex items-center gap-1 transition-colors"
                                >
                                  <span>{pr.title}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                              </div>
                              <div className="text-[11px] text-slate-400 line-clamp-1">
                                {pr.body || 'No description provided.'}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-semibold ${
                                  pr.is_merged
                                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                    : pr.state === 'open'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {pr.is_merged ? 'MERGED' : pr.state}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1 border ${
                                  isVerified
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                    : isUnable
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                                }`}
                                title={pr.verification_details ? JSON.stringify(pr.verification_details) : ''}
                              >
                                {isVerified ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                ) : isUnable ? (
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <HelpCircle className="w-3 h-3 text-slate-400" />
                                )}
                                <span>
                                  {isVerified
                                    ? 'Verified GitHub record'
                                    : isUnable
                                    ? 'Unable to verify'
                                    : 'Verification unavailable'}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-300">@{pr.author_username}</span>
                              {pr.base_branch && (
                                <span className="text-slate-500">
                                  {pr.base_branch} ← {pr.head_branch}
                                </span>
                              )}
                              {pr.commit_count > 0 && <span>{pr.commit_count} commits</span>}
                              {pr.review_status && <span className="capitalize">{pr.review_status}</span>}
                              <span className={pr.is_synthetic ? 'text-amber-400' : 'text-cyan-400'}>
                                {pr.is_synthetic ? '• Synthetic Demo' : '• Live GitHub API'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVerifyPR(peeringProj.id, pr.pr_number, pr.pr_url)}
                                disabled={isVerifying}
                                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-500/20 text-[10px] flex items-center gap-1 transition-colors"
                              >
                                {isVerifying ? (
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-2.5 h-2.5 text-cyan-400" />
                                )}
                                <span>{isVerifying ? 'Verifying...' : 'Verify Authenticity'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : relLoading ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                <span>Loading peer trust topology...</span>
              </div>
            ) : relationships ? (
              <div className="space-y-5 text-xs">
                {/* Configure a Peer Weight */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Set Peer Trust Weight</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-light">
                    Decide how much weight {peeringProj.name} assigns to vouches and reports originating from a peer repository.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 text-[10px] mb-1">Target Peer Project</label>
                      <select
                        value={newPeerTargetId}
                        onChange={(e) => setNewPeerTargetId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                      >
                        {projects
                          .filter((p) => p.id !== peeringProj.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.slug})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Weight (0.0 to 1.0)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.0"
                        max="1.0"
                        value={newPeerWeight}
                        onChange={(e) => setNewPeerWeight(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSavePeerWeight}
                      disabled={peerSaving}
                      className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5"
                    >
                      {peerSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Peering Weight</span>
                    </button>
                  </div>
                </div>

                {/* Outgoing Peers */}
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Trusted Peers Configured by {peeringProj.name} ({relationships.outgoing_peers?.length || 0})
                  </div>
                  {relationships.outgoing_peers?.length === 0 ? (
                    <div className="p-3 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      No explicit peer weights defined yet. Using global balanced default.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {relationships.outgoing_peers.map((peer, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-white">{peer.project_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{peer.notes}</div>
                          </div>
                          <span className="font-mono text-cyan-400 font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {peer.trust_weight}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Incoming Peers */}
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Projects That Trust {peeringProj.name} ({relationships.incoming_peers?.length || 0})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {relationships.incoming_peers?.map((peer, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="font-semibold text-slate-200">{peer.project_name}</div>
                        <span className="font-mono text-emerald-400 font-bold text-xs">
                          Weight: {peer.trust_weight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Associated Contributors */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Contributors with Vouches or Reports from this Project ({relationships.associated_contributors?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {relationships.associated_contributors?.map((c, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2"
                      >
                        <span className="font-semibold text-white text-[11px]">@{c.username}</span>
                        <span className="text-[9px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                          {c.reputation_state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* REGISTER PROJECT MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-cyan-400" />
                <span>Register Repository Node</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {registerError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Project Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. eBPF Gateway"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Category</label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Cloud Native">Cloud Native</option>
                    <option value="Cryptography">Cryptography</option>
                    <option value="Developer Tools">Developer Tools</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="Security">Security</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Repository URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/org/repo"
                  value={registerForm.repo_url}
                  onChange={(e) => setRegisterForm({ ...registerForm, repo_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows="2"
                  placeholder="Next-generation kernel packet gateway and zero-trust service proxy."
                  value={registerForm.description}
                  onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Initial Strictness Policy</label>
                  <select
                    value={registerForm.strictness}
                    onChange={(e) => setRegisterForm({ ...registerForm, strictness: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  >
                    <option value="permissive">Permissive (Welcoming)</option>
                    <option value="balanced">Balanced (Standard)</option>
                    <option value="high">High (Strict Peer Vouches)</option>
                    <option value="maximum">Maximum (Security Sensitive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">GitHub Stars (Believable Demo)</label>
                  <input
                    type="number"
                    value={registerForm.stars}
                    onChange={(e) => setRegisterForm({ ...registerForm, stars: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {registerLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Repository</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT GITHUB REPOSITORY MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-cyan-400" />
                <span>Import GitHub Repository</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  GitHub Repository URL *
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repository"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Example: <code className="text-cyan-400">https://github.com/facebook/react</code> or any public repository.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Project Category</label>
                <select
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Cloud Native">Cloud Native</option>
                  <option value="Developer Tools">Developer Tools</option>
                  <option value="Cryptography">Cryptography</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-[11px] text-slate-300">
                <div className="font-semibold text-cyan-400 flex items-center gap-1.5 font-mono text-[10px] uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Real GitHub Integration Pipeline</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-slate-400 text-[10px] leading-relaxed">
                  <li>Validates repository canonical URL and fetches metadata via GitHub REST API v3.</li>
                  <li>Retrieves pull requests with branch details, commit counts, and merge status.</li>
                  <li>Verifies PR authenticity and stores provenance records in SQLite database.</li>
                  <li>Zero client token exposure: OAuth and API credentials remain isolated on backend.</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                >
                  {importLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{importLoading ? 'Validating & Importing...' : 'Import & Synchronize'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
