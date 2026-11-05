import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Flame,
  ShieldAlert,
  FolderGit2,
  Users,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Cpu,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [aiExplanations, setAiExplanations] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [cmps, anl] = await Promise.all([
        api.getCampaigns(),
        api.getCampaignAnalytics(),
      ]);
      setCampaigns(cmps);
      setAnalytics(anl);
      if (cmps.length > 0 && !expandedId) {
        setExpandedId(cmps[0].id);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      setScanMessage(null);
      const res = await api.scanCampaigns();
      setScanMessage(
        res.message ||
          `Deterministic scan complete: ${res.campaigns_detected || 0} coordinated clusters identified across ${res.events_evaluated || 0} events.`
      );
      await loadData();
    } catch (err) {
      console.error('Failed to run campaign scan:', err);
      setScanMessage('Failed to run scanner: ' + err.message);
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 6000);
    }
  };

  const handleUpdateStatus = async (campaignId, newStatus) => {
    try {
      await api.updateCampaignStatus(campaignId, newStatus);
      // Update local state
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: newStatus } : c))
      );
      const anl = await api.getCampaignAnalytics();
      setAnalytics(anl);
    } catch (err) {
      console.error('Failed to update campaign status:', err);
    }
  };

  const handleFetchAIExplanation = async (campaignId) => {
    try {
      setAiLoading((prev) => ({ ...prev, [campaignId]: true }));
      const result = await api.explainWithAI('campaign', campaignId);
      setAiExplanations((prev) => ({ ...prev, [campaignId]: result }));
    } catch (err) {
      console.error('Failed to get AI campaign explanation:', err);
    } finally {
      setAiLoading((prev) => ({ ...prev, [campaignId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <span>Coordinated Campaign Detection</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Real-Time Radar
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic correlation of multi-repository PR bursts, templated AI docstring slop swarms, and sybil accounts.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300">
            REAL-TIME CORRELATION ENGINE
          </div>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="px-3.5 py-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-cyan-950/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning Network...' : 'Run Forensic Scan'}</span>
          </button>
        </div>
      </div>

      {/* Scan Feedback Banner */}
      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-cyan-400 hover:text-white font-mono text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Fairness Warning */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">Investigation Signal, Not Final Guilt: </span>
          A detected pattern flags synchronized activity for human maintainer inspection. Final moderation decisions always require human review and corroborating evidence.
        </div>
      </div>

      {/* Analytics Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-400">Total Detected Campaigns</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {analytics.total_campaigns}
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-amber-500/30">
            <div className="text-xs text-amber-300">Active Investigations</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {analytics.active_investigations_count}
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-rose-500/30">
            <div className="text-xs text-rose-300">Confirmed Coordinated Abuse</div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {analytics.confirmed_campaigns_count}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <Flame className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No suspicious campaigns detected.</h3>
          <p className="text-xs text-slate-400 mt-1">Ecosystem topology is currently clean.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((cmp) => {
            const isExpanded = expandedId === cmp.id;
            const explanation = aiExplanations[cmp.id];
            const isAiBusy = aiLoading[cmp.id];

            return (
              <div
                key={cmp.id}
                className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : cmp.id)}
                  className="p-5 cursor-pointer hover:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-display font-bold text-white text-base">
                        {cmp.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {cmp.campaign_code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {cmp.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-4">
                      <span>Pattern: <strong className="text-slate-200">{cmp.pattern_type}</strong></span>
                      <span>&bull;</span>
                      <span>Detected: {new Date(cmp.detected_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-amber-400">
                        {Math.round(cmp.signal_strength * 100)}% Match
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Signal Strength</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800/80 bg-slate-950/50 space-y-5 text-xs animate-in fade-in">
                    <p className="text-slate-300 leading-relaxed font-light">{cmp.description}</p>

                    {/* Why This Pattern Was Flagged */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" /> Why Pattern Was Flagged (Deterministic Criteria)
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">Heuristic Engine</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <div className="text-[10px] text-slate-500">Cross-Repo Scope</div>
                          <div className="text-white font-bold">{cmp.affected_projects?.length || 0} Repositories</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <div className="text-[10px] text-slate-500">Correlated Identities</div>
                          <div className="text-white font-bold">{cmp.contributor_usernames?.length || 0} Accounts</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <div className="text-[10px] text-slate-500">Signal Confidence</div>
                          <div className="text-amber-400 font-bold">{Math.round(cmp.signal_strength * 100)}% Heuristic Match</div>
                        </div>
                      </div>
                    </div>

                    {/* Human Review Triage Bar */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-white">Human Review Status</div>
                        <div className="text-[11px] text-slate-400">
                          Suspicious patterns must be vetted by maintainers prior to ecosystem moderation.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {[
                          { label: 'Active Investigation', val: 'Active Investigation', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
                          { label: 'Confirmed Abuse', val: 'Confirmed Coordinated Abuse', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
                          { label: 'Dismiss', val: 'Dismissed', bg: 'bg-slate-700 text-slate-300 border-slate-600' },
                        ].map((st) => (
                          <button
                            key={st.val}
                            onClick={() => handleUpdateStatus(cmp.id, st.val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                              cmp.status === st.val ? `${st.bg} font-bold ring-1 ring-cyan-400` : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Affected Entities Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Affected Projects */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-2">
                          <FolderGit2 className="w-3.5 h-3.5" />
                          <span>Affected Repositories ({cmp.affected_projects?.length || 0})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                          {cmp.affected_projects?.map((pid, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700"
                            >
                              {pid}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Associated Contributors */}
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-2 text-rose-400 font-semibold mb-2">
                          <Users className="w-3.5 h-3.5" />
                          <span>Associated Identities ({cmp.contributor_usernames?.length || 0})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                          {cmp.contributor_usernames?.map((u, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            >
                              @{u}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Evidence Records & Diff Snippets */}
                    {cmp.evidence_records?.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          Forensic Evidence Records & Diffs
                        </div>
                        <div className="space-y-2">
                          {cmp.evidence_records.map((ev, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200 font-mono text-[11px]">
                                  {ev.repo}
                                </span>
                                <a
                                  href={ev.pr_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[10px]"
                                >
                                  <span>View Diff on GitHub</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <p className="text-slate-400 text-[11px]">{ev.pattern}</p>
                              {ev.diff_sample && (
                                <pre className="p-2 rounded bg-black/60 font-mono text-[10px] text-cyan-300 overflow-x-auto border border-slate-800">
                                  {ev.diff_sample}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI / Deterministic Explanation Trigger */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-400">
                        Need synthesized multi-repo supply chain summary?
                      </span>
                      <button
                        onClick={() => handleFetchAIExplanation(cmp.id)}
                        disabled={isAiBusy}
                        className="px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2 transition-colors self-start sm:self-auto"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${isAiBusy ? 'animate-spin' : ''}`} />
                        <span>{isAiBusy ? 'Analyzing Pattern...' : 'Synthesize with GPT-OSS-120B'}</span>
                      </button>
                    </div>

                    {/* AI Explanation Box */}
                    {explanation && (
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-xs space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between font-mono text-[11px] text-cyan-400">
                          <span>{explanation.ai_model}</span>
                          <span>{explanation.confidence_assessment}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{explanation.summary}</p>
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase font-mono text-slate-400">Key Pattern Findings:</div>
                          {explanation.key_findings?.map((f, idx) => (
                            <div key={idx} className="text-slate-300 pl-2 border-l border-cyan-500 text-[11px]">
                              {f}
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 text-cyan-300 font-mono text-[11px] border-t border-slate-800">
                          <strong>Maintainer Guidance: </strong>{explanation.recommended_maintainer_action}
                        </div>
                      </div>
                    )}
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
