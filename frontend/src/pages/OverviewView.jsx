import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Shield,
  Users,
  FolderGit2,
  CheckCircle,
  AlertTriangle,
  Flame,
  Activity,
  ArrowUpRight,
  Sparkles,
  Layers,
  Clock,
  ExternalLink,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

export default function OverviewView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [refreshWarning, setRefreshWarning] = useState(null);
  const reqSeq = useRef(0);

  const loadData = async (isManualRefresh = false) => {
    const seq = ++reqSeq.current;
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!data) {
      setLoading(true);
    }

    try {
      const [overview, cmps] = await Promise.all([
        api.getOverview(),
        api.getCampaigns(),
      ]);
      if (seq !== reqSeq.current) return;
      setData(overview);
      setCampaigns(cmps);
      setError(null);
      setRefreshWarning(null);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      console.error('Failed to load overview:', err);
      if (!data) {
        setError(err.message || 'Failed to connect to TrustMesh network.');
      } else {
        setRefreshWarning(err.message || 'Background network refresh temporarily failed.');
      }
    } finally {
      if (seq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-800/60 rounded-xl w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 rounded-2xl border border-slate-800/80" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-900/60 rounded-2xl" />
          <div className="h-96 bg-slate-900/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-12 text-center rounded-2xl glass-panel border border-rose-500/30 bg-rose-950/10 space-y-4 max-w-xl mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">TrustMesh API Connection Issue</h2>
        <p className="text-xs text-rose-200/80 leading-relaxed">{error}</p>
        <button
          onClick={() => loadData(false)}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-rose-950/50"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const dist = data?.reputation_distribution || {};
  const activity = data?.recent_activity || [];

  const totalDist =
    (dist.ESTABLISHED || 0) +
    (dist.NEWCOMER || 0) +
    (dist.INSUFFICIENT_EVIDENCE || 0) +
    (dist.UNDER_REVIEW || 0) || 1;

  return (
    <div className="space-y-8">
      {/* Header with Title, Live Network status and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Trust Intelligence Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time supply chain signals, peer vouches, and coordinated campaign detection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE FEDERATED MESH</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Refresh metrics from backend"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Background Refresh Warning Banner (preserving state without wiping) */}
      {refreshWarning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{refreshWarning} Displaying current verified state.</span>
          </div>
          <button
            onClick={() => setRefreshWarning(null)}
            className="text-amber-400 hover:text-white text-xs font-mono px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Connected Projects',
            value: metrics.connected_projects || 0,
            icon: FolderGit2,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10 border-cyan-500/20',
            action: () => onNavigate('projects'),
          },
          {
            label: 'Tracked Contributors',
            value: metrics.tracked_contributors || 0,
            icon: Users,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
            action: () => onNavigate('contributors'),
          },
          {
            label: 'Active Vouches',
            value: metrics.active_vouches || 0,
            icon: CheckCircle,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
            action: () => onNavigate('vouches'),
          },
          {
            label: 'Open Reports',
            value: metrics.open_denouncements || 0,
            icon: AlertTriangle,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/20',
            action: () => onNavigate('denouncements'),
          },
          {
            label: 'Suspicious Campaigns',
            value: metrics.suspicious_campaigns || 0,
            icon: Flame,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
            action: () => onNavigate('campaigns'),
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={card.action}
              className="glass-panel p-4 rounded-2xl glass-panel-hover border border-slate-800 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">{card.label}</span>
                <div className={`p-1.5 rounded-lg border ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white">{card.value}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:text-cyan-400">
                  Inspect <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Activity Timeline & Campaigns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Campaigns Alert Box */}
          {campaigns.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Active Coordinated Spam Signal</span>
                </div>
                <button
                  onClick={() => onNavigate('campaigns')}
                  className="text-xs text-amber-300 hover:text-white font-mono flex items-center gap-1"
                >
                  View All Investigations <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2.5">
                {campaigns.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onNavigate('campaigns')}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{c.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {c.campaign_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{c.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-amber-400">
                        {Math.round(c.signal_strength * 100)}% Match
                      </div>
                      <div className="text-[10px] text-slate-500">{c.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Stream */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-base text-white">Trust Activity Stream</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Live Provenance Log</span>
            </div>

            <div className="space-y-3">
              {activity.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/80">
                  No recent trust activity recorded. Connect a repository or record endorsements to populate the live provenance log.
                </div>
              ) : (
                activity.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === 'VOUCH'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {item.type === 'VOUCH' ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.reason}</div>
                      <div className="text-[10px] text-cyan-400/80 font-mono mt-1">
                        Source: {item.project_name}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Right Column: Signal Distribution & Fairness Spotlight */}
        <div className="space-y-6">
          {/* Reputation Distribution */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Contributor State Distribution
            </h3>

            <div className="space-y-3.5">
              {[
                {
                  label: 'ESTABLISHED',
                  count: dist.ESTABLISHED || 0,
                  color: 'bg-emerald-400',
                  desc: 'Multiple verified peer vouches',
                },
                {
                  label: 'NEWCOMER',
                  count: dist.NEWCOMER || 0,
                  color: 'bg-cyan-400',
                  desc: 'Clean slate (fair neutral baseline)',
                },
                {
                  label: 'INSUFFICIENT EVIDENCE',
                  count: dist.INSUFFICIENT_EVIDENCE || 0,
                  color: 'bg-slate-400',
                  desc: 'Needs further corroboration',
                },
                {
                  label: 'UNDER REVIEW',
                  count: dist.UNDER_REVIEW || 0,
                  color: 'bg-amber-400',
                  desc: 'Pending allegations / conflicts',
                },
              ].map((item, i) => {
                const pct = Math.round((item.count / totalDist) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-300 font-medium">
                        {item.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts & Fairness Box */}
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-900/60">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core Ethics Spotlight</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              "A newcomer is not suspicious. An allegation is not proof." TrustMesh computes subjective confidence from your repository's chosen trust policy.
            </p>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
              <button
                onClick={() => onNavigate('vouches')}
                className="w-full py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold text-center transition-colors"
              >
                + Endorse a Contributor (Vouch)
              </button>
              <button
                onClick={() => onNavigate('network')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold text-center transition-colors"
              >
                Open React Flow Graph View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
