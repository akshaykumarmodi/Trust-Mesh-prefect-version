import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Cpu,
  CheckCircle,
  AlertCircle,
  Shield,
  Copy,
  Layers,
} from 'lucide-react';

export default function SettingsView({ aiStatus }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await api.getProjects();
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      } catch (e) {
        console.error('Error fetching projects:', e);
      }
    }
    fetchProjects();
  }, []);

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const bundle = await api.exportFederationBundle(selectedProjectId);
      setExportedJson(JSON.stringify(bundle, null, 2));
    } catch (err) {
      console.error('Failed to export bundle:', err);
    }
  };

  const handleImport = async () => {
    try {
      setImportStatus('Importing...');
      const parsed = JSON.parse(importJson);
      const res = await api.importFederationBundle(parsed);
      setImportStatus(`Success: ${res.message}`);
    } catch (err) {
      setImportStatus(`Import Error: ${err.message}`);
    }
  };

  const handleCopyExport = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset the TrustMesh database back to its synthetic seed state?')) return;
    try {
      setResetting(true);
      await api.resetDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
          Settings & Decentralized Federation
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Export cryptographic bundles, peer with external trust nodes, and manage local AI intelligence configurations.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Demo database successfully reset to clean synthetic seed state.</span>
        </div>
      )}

      {/* AI MODEL STATUS */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm">
          <Cpu className="w-5 h-5" />
          <span>AI Architecture & Model Runtime</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block">Selected Open-Weight Model</span>
            <span className="text-white text-sm font-bold mt-1 block">
              {aiStatus?.model_name || 'GPT-OSS-120B'}
            </span>
            <span className="text-slate-400 text-[11px] mt-0.5 block">Apache 2.0 Open-Weight Model</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block">Runtime Mode</span>
            <span className="text-cyan-400 text-sm font-bold mt-1 block">
              {aiStatus?.mode || 'Deterministic Engine'}
            </span>
            <span className="text-slate-400 text-[11px] mt-0.5 block">
              {aiStatus?.is_live_configured
                ? 'OpenRouter API Connected'
                : 'Deterministic Fallback Active (Offline Safe)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-light">
          Trust scores and policy evaluations are calculated deterministically by the Python FastAPI backend. The AI model is strictly dedicated to summarizing multi-repository PR diffs and providing natural language explanations to maintainers.
        </p>
      </div>

      {/* FEDERATION EXPORT */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-white font-bold text-sm">
          <Download className="w-5 h-5 text-cyan-400" />
          <span>Export Repository Trust Bundle</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-light">
          Generate an attributable, signed JSON bundle containing your repository's vouches, denouncements, and peering edges to share with partner organizations.
        </p>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors"
          >
            Generate Bundle
          </button>
        </div>

        {exportedJson && (
          <div className="space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Signed Federation JSON Payload</span>
              <button
                onClick={handleCopyExport}
                className="text-xs text-cyan-400 hover:underline font-mono flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black/70 border border-slate-800 font-mono text-[11px] text-cyan-300 max-h-48 overflow-y-auto">
              {exportedJson}
            </pre>
          </div>
        )}
      </div>

      {/* FEDERATION IMPORT */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-white font-bold text-sm">
          <Upload className="w-5 h-5 text-indigo-400" />
          <span>Import External Peer Bundle</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-light">
          Paste a signed federation bundle from an external node to merge its trust signals into your local mesh.
        </p>

        <textarea
          rows="3"
          placeholder='{"version": "1.0.0", "source_project": { ... }, "vouches": [ ... ]}'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={handleImport}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Import Peer Bundle
          </button>
          {importStatus && (
            <span className="text-xs font-mono text-cyan-300">{importStatus}</span>
          )}
        </div>
      </div>

      {/* DEMO STATE UTILITIES */}
      <div className="glass-panel p-6 rounded-2xl border border-rose-950/40 bg-rose-950/10 space-y-3">
        <div className="text-rose-400 font-bold text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>Reset Demonstration Database</span>
        </div>
        <p className="text-xs text-slate-400">
          Restore all projects, contributors, vouches, denouncements, and coordinated campaign scenarios back to the clean synthetic demo baseline.
        </p>
        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors flex items-center gap-2"
        >
          {resetting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          <span>Reset to Clean Synthetic Demo State</span>
        </button>
      </div>
    </div>
  );
}
