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
} from 'lucide-react';

export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editPolicy, setEditPolicy] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  useEffect(() => {
    loadProjects();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Federated Open-Source Projects
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Each project defines autonomous trust policies, peer weighting, and evidence criteria.
        </p>
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
                        <span className="text-[10px] text-slate-500 block mb-1 font-mono">PEER WEIGHTS:</span>
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

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
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

                  <button
                    onClick={() => handleStartEdit(proj)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Tune Policy</span>
                  </button>
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
    </div>
  );
}
