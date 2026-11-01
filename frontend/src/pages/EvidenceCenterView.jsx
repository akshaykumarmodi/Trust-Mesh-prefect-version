import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

export default function EvidenceCenterView() {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const loadEvidence = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter !== 'ALL') params.type = typeFilter.toLowerCase();
      const data = await api.getEvidence(params);
      setEvidence(data);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
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
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : evidence.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Evidence Records Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting the filter or search keywords.</p>
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
