import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  FileText,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Hash,
  Filter,
  RefreshCw,
} from 'lucide-react';

export default function EvidenceCenterView() {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncWarning, setSyncWarning] = useState(null);
  const reqSeq = useRef(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const loadEvidence = async () => {
    const seq = ++reqSeq.current;
    if (evidence.length === 0) setLoading(true);

    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter !== 'ALL') params.type = typeFilter.toLowerCase();
      const data = await api.getEvidence(params);
      if (seq !== reqSeq.current) return;
      setEvidence(Array.isArray(data) ? data : []);
      setError(null);
      setSyncWarning(null);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      console.error('Failed to load evidence:', err);
      if (evidence.length === 0) {
        setError(err.message || 'Unable to connect to TrustMesh forensic evidence API.');
      } else {
        setSyncWarning(err.message || 'Network refresh failed. Preserving current evidence log.');
      }
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadEvidence();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Evidence Center & Supply Chain Ledger
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Immutable records of pull request diffs, security audits, and forensic correlation hashes.
        </p>
      </div>

      {/* Sync Warning Banner */}
      {syncWarning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{syncWarning} Displaying current ledger.</span>
          </div>
          <button
            onClick={() => setSyncWarning(null)}
            className="text-amber-400 hover:text-white text-xs font-mono px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contributor, title, or evidence URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex items-center gap-2">
          {['ALL', 'VOUCH', 'DENOUNCEMENT', 'CAMPAIGN'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono transition-colors ${
                typeFilter === t
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Items */}
      {loading && evidence.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : error && evidence.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-rose-500/30 bg-rose-950/10 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Unable to Load Evidence Ledger</h3>
          <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadEvidence}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-lg shadow-rose-950/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : evidence.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No evidence records available.</h3>
          <p className="text-xs text-slate-400 mt-1">Submit vouches or denouncements with linked pull request evidence to populate this forensic log.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evidence.map((item) => (
            <div
              key={item.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all space-y-2 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      item.type === 'VOUCH'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : item.type === 'DENOUNCEMENT'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="font-bold text-white text-sm">{item.title}</span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(item.timestamp).toLocaleDateString()}
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed font-light">{item.details}</p>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-4">
                  <span>Source: <strong className="text-slate-200">{item.source_project}</strong></span>
                  <span>Target: <strong className="text-slate-200">@{item.contributor_username}</strong></span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {item.provenance_hash}
                  </span>

                  <a
                    href={item.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Inspect Target Evidence</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
