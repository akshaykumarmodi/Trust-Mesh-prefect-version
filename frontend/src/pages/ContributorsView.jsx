import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  Sliders,
  X,
  FileText,
  Cpu,
  Clock,
  GitPullRequest,
} from 'lucide-react';

export default function ContributorsView() {
  const [contributors, setContributors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncWarning, setSyncWarning] = useState(null);
  const reqSeq = useRef(0);

  // Detail Modal State
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [viewingProjectId, setViewingProjectId] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activityTimeline, setActivityTimeline] = useState([]);

  // Add Contributor Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    display_name: '',
    bio: '',
    skills: '',
    github_url: '',
    avatar_url: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const loadContributors = async () => {
    const seq = ++reqSeq.current;
    if (contributors.length === 0) setLoading(true);

    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (stateFilter !== 'ALL') params.reputation_state = stateFilter;

      const [data, projList] = await Promise.all([
        api.getContributors(params),
        api.getProjects(),
      ]);

      if (seq !== reqSeq.current) return; // Stale response discarded

      setContributors(Array.isArray(data) ? data : []);
      setProjects(Array.isArray(projList) ? projList : []);
      setError(null);
      setSyncWarning(null);

      if (projList.length > 0 && !viewingProjectId) {
        setViewingProjectId(projList[0].id);
      }
    } catch (err) {
      if (seq !== reqSeq.current) return;
      console.error('Failed to load contributors:', err);

      if (contributors.length === 0) {
        setError(err.message || 'Unable to retrieve contributors from network.');
      } else {
        setSyncWarning(err.message || 'Network refresh failed. Displaying cached contributors.');
      }
    } finally {
      if (seq === reqSeq.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadContributors();
  }, [stateFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadContributors();
  };

  const handleOpenDetail = async (contrib) => {
    setSelectedContributor(contrib);
    setEvaluation(null);
    setAiExplanation(null);
    setActivityTimeline([]);

    // Load both evaluation and full activity timeline
    await Promise.all([
      runEvaluation(contrib.id, viewingProjectId),
      (async () => {
        try {
          const act = await api.getContributorActivity(contrib.id);
          setActivityTimeline(act.timeline || []);
        } catch (e) {
          console.error('Error fetching activity:', e);
        }
      })(),
    ]);
  };

  const runEvaluation = async (contribId, projId) => {
    try {
      setEvalLoading(true);
      const res = await api.evaluateTrust(contribId, projId || undefined);
      setEvaluation(res);
    } catch (e) {
      console.error('Error running trust evaluation:', e);
    } finally {
      setEvalLoading(false);
    }
  };

  const handleViewingProjectChange = async (newProjId) => {
    setViewingProjectId(newProjId);
    if (selectedContributor) {
      await runEvaluation(selectedContributor.id, newProjId);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    if (!addForm.username.trim()) {
      setAddError('Username is required.');
      return;
    }

    try {
      setAddLoading(true);
      const skillList = addForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const newContrib = await api.createContributor({
        username: addForm.username.trim(),
        display_name: addForm.display_name.trim() || addForm.username.trim(),
        bio: addForm.bio.trim(),
        skills: skillList,
        github_url: addForm.github_url.trim() || `https://github.com/${addForm.username.trim()}`,
        avatar_url: addForm.avatar_url.trim() || `https://github.com/${addForm.username.trim()}.png`,
      });

      setAddSuccess(`Contributor @${newContrib.username} successfully registered with NEWCOMER status.`);
      setAddForm({
        username: '',
        display_name: '',
        bio: '',
        skills: '',
        github_url: '',
        avatar_url: '',
      });
      setShowAddModal(false);
      await loadContributors();
    } catch (err) {
      setAddError(err.message || 'Failed to register contributor.');
    } finally {
      setAddLoading(false);
    }
  };

  const fetchAIExplanation = async () => {
    if (!selectedContributor) return;
    try {
      setAiLoading(true);
      const res = await api.explainWithAI('contributor', selectedContributor.id, viewingProjectId);
      setAiExplanation(res);
    } catch (err) {
      console.error('Failed to fetch AI explanation:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const stateBadges = {
    ESTABLISHED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    NEWCOMER: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    'INSUFFICIENT EVIDENCE': 'bg-slate-700/40 text-slate-300 border-slate-600',
    'UNDER REVIEW': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Add Contributor Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Contributor Trust Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fairness-first reputation profiles with transparent signal provenance and zero blackbox scoring.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <span>+ Register Contributor</span>
        </button>
      </div>

      {addSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{addSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by username, real name, or skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'ESTABLISHED', 'NEWCOMER', 'INSUFFICIENT EVIDENCE', 'UNDER REVIEW'].map((st) => (
            <button
              key={st}
              onClick={() => setStateFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono whitespace-nowrap transition-colors ${
                stateFilter === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Background Refresh Warning Banner */}
      {syncWarning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{syncWarning} Displaying currently loaded contributors.</span>
          </div>
          <button
            onClick={() => setSyncWarning(null)}
            className="text-amber-400 hover:text-white text-xs font-mono px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Contributors Grid */}
      {loading && contributors.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 rounded-2xl border border-slate-800" />
          ))}
        </div>
      ) : error && contributors.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-rose-500/30 bg-rose-950/10 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Unable to Load Contributors</h3>
          <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadContributors}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-lg shadow-rose-950/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : contributors.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800">
          <HelpCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {search || stateFilter !== 'ALL'
              ? 'No contributors match your filter'
              : 'No contributors yet. Connect a GitHub repository to start tracking contributors.'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {search || stateFilter !== 'ALL'
              ? 'Try relaxing the search query or state selector.'
              : 'Import a public GitHub repository or sync pull requests to start tracking contributors.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contributors.map((contrib) => {
            const badgeClass = stateBadges[contrib.reputation_state] || stateBadges['NEWCOMER'];
            return (
              <div
                key={contrib.id}
                onClick={() => handleOpenDetail(contrib)}
                className="glass-panel p-5 rounded-2xl glass-panel-hover border border-slate-800 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                        <img
                          src={contrib.avatar_url || `https://github.com/${contrib.username}.png`}
                          alt={contrib.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-white text-sm truncate">
                          @{contrib.username}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {contrib.display_name}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badgeClass} shrink-0`}>
                      {contrib.reputation_state}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {contrib.bio || 'Open source software contributor.'}
                  </p>

                  {/* Skills tags */}
                  {contrib.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {contrib.skills.slice(0, 3).map((sk, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-300 font-mono"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80 text-slate-400 font-mono">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {contrib.vouches?.length || 0}
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {contrib.denouncements?.length || 0}
                    </span>
                  </div>
                  <span className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]">
                    Inspect Assessment &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL & EXPLAINABILITY DRAWER */}
      {selectedContributor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl my-8 bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-500/40 shrink-0">
                  <img
                    src={selectedContributor.avatar_url || `https://github.com/${selectedContributor.username}.png`}
                    alt={selectedContributor.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">@{selectedContributor.username}</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        stateBadges[selectedContributor.reputation_state]
                      }`}
                    >
                      {selectedContributor.reputation_state}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{selectedContributor.display_name}</div>
                  <a
                    href={selectedContributor.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline font-mono mt-1"
                  >
                    <span>View GitHub Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <button
                onClick={() => setSelectedContributor(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              {/* Viewing Project Selector (Demonstrating Decentralized Perspectives) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>Viewing Repository Perspective</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Trust is decentralized. Each project computes confidence using its own peer policy.
                    </p>
                  </div>
                  <select
                    value={viewingProjectId}
                    onChange={(e) => handleViewingProjectChange(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Explainable Trust Assessment Output */}
              {evalLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                  <span>Computing decentralized trust equation...</span>
                </div>
              ) : evaluation ? (
                <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-cyan-400 tracking-wider">
                        Evaluated for {evaluation.viewing_project_name}
                      </span>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        Explainable Trust Summary
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-cyan-300">
                        {Math.round(evaluation.trust_confidence * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">Confidence Level</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    {evaluation.summary_explanation}
                  </p>

                  {/* Conflicting Signals Warning if detected */}
                  {evaluation.conflicting_signals_detected && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300">Conflicting Signals Detected</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          This contributor has positive endorsements alongside active reports. By Principle #5, conflicting signals remain transparent for human review rather than being arbitrarily silenced.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Applied Policy Rules */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      Applied Policy Rules
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300 font-mono">
                      {evaluation.applied_policy_rules?.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-cyan-400">&bull;</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* AI Explain Button */}
                  <div className="pt-2 flex items-center justify-between border-t border-cyan-900/40">
                    <span className="text-[11px] text-slate-400">Need AI-assisted supply chain synthesis?</span>
                    <button
                      onClick={fetchAIExplanation}
                      disabled={aiLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                      <span>{aiLoading ? 'Synthesizing...' : 'Summarize Evidence (GPT-OSS-120B)'}</span>
                    </button>
                  </div>

                  {/* AI Explanation Result Box */}
                  {aiExplanation && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/40 text-xs space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-indigo-400 font-mono text-[11px]">
                        <span>Model: {aiExplanation.ai_model}</span>
                        <span>{aiExplanation.confidence_assessment}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{aiExplanation.summary}</p>
                      <div className="space-y-1 pt-1">
                        <div className="text-[10px] uppercase font-mono text-slate-400">Key Findings:</div>
                        {aiExplanation.key_findings?.map((f, i) => (
                          <div key={i} className="text-slate-300 pl-2 border-l border-indigo-500/50 text-[11px]">
                            {f}
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 text-[11px] text-cyan-300 font-mono">
                        Recommendation: {aiExplanation.recommended_maintainer_action}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Vouches Received List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Verified Vouches ({selectedContributor.vouches?.length || 0})
                </h4>

                {selectedContributor.vouches?.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No endorsements yet.
                  </div>
                ) : (
                  selectedContributor.vouches.map((v) => (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-300">{v.source_project_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-300">{v.reason}</p>
                      {v.context && <p className="text-slate-400 text-[11px]">{v.context}</p>}
                      <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                        <a
                          href={v.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          PR Evidence <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="text-slate-500">Hash: {v.provenance_hash}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Denouncements Received List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Allegations & Reports ({selectedContributor.denouncements?.length || 0})
                </h4>

                {selectedContributor.denouncements?.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No reports have been submitted.
                  </div>
                ) : (
                  selectedContributor.denouncements.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-rose-500/20 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-300">{d.reporting_project_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                          Status: {d.status}
                        </span>
                      </div>
                      <p className="text-slate-300">{d.reason}</p>
                      {d.details && <p className="text-slate-400 text-[11px]">{d.details}</p>}
                      <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                        <a
                          href={d.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-rose-400 hover:underline flex items-center gap-1"
                        >
                          Evidence Link <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="text-slate-500">Report ID: {d.id}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Project Participation & Trust Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Project Participation & Trust History ({activityTimeline.length} events)
                </h4>

                {activityTimeline.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    No cross-project activity events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activityTimeline.map((ev, idx) => {
                      const isPr = ev.type === 'GITHUB_PR';
                      const isVouch = ev.type === 'VOUCH_RECEIVED';
                      const dotColor = isPr
                        ? 'bg-purple-400'
                        : isVouch
                        ? 'bg-emerald-400'
                        : 'bg-rose-400';

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                              {isPr && ev.pr_url ? (
                                <a
                                  href={ev.pr_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white hover:text-cyan-300 flex items-center gap-1 transition-colors"
                                >
                                  <span>{ev.title}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                              ) : (
                                <span>{ev.title}</span>
                              )}
                              {isPr && ev.verification_status && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                  {ev.verification_status === 'VERIFIED_GITHUB'
                                    ? '✓ Verified'
                                    : ev.verification_status}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{ev.description}</div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER CONTRIBUTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Register Contributor Identity</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Username *</label>
                  <input
                    type="text"
                    placeholder="e.g. janesmith-core"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Smith"
                    value={addForm.display_name}
                    onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Primary Skills (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Rust, Concurrency, eBPF, Cryptography"
                  value={addForm.skills}
                  onChange={(e) => setAddForm({ ...addForm, skills: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Bio & Engineering Background</label>
                <textarea
                  rows="2"
                  placeholder="Senior distributed systems architect interested in memory-safe asynchronous runtimes."
                  value={addForm.bio}
                  onChange={(e) => setAddForm({ ...addForm, bio: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-cyan-300 font-mono">
                Fairness Rule: Newly registered contributors automatically start with NEWCOMER status and a neutral baseline (0.50). Lack of history is never treated as suspicious.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Identity</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
