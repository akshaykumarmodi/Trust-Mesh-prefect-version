import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { playGlobalCinemaAudio } from '../components/ExplodingLoader';
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
  FileJson,
  Network,
  Share2,
  Key,
  Globe,
  ExternalLink,
  Check,
  Trash2,
  FileText,
  Sparkles
} from 'lucide-react';

const SAMPLE_PEER_BUNDLE = {
  version: "1.0.0",
  exported_at: new Date().toISOString(),
  source_project: {
    id: "proj-peer-mesh-alpha",
    name: "Decentralized Trust Core / Alpha",
    slug: "peer-mesh-alpha",
    description: "Federated peer node from Open Research Mesh",
    repo_url: "https://github.com/peer-mesh/trust-core",
    category: "Federation",
    stars: 520,
    trust_policy: {
      strictness: "strict",
      min_confidence: 0.75,
      peer_weights: { "proj-akshay": 0.9 }
    }
  },
  vouches: [
    {
      id: `vouch-peer-sample-${Date.now().toString().slice(-4)}`,
      contributor_id: "contrib-helena-voss",
      contributor_username: "helena_voss",
      source_project_id: "proj-peer-mesh-alpha",
      source_project_name: "Decentralized Trust Core / Alpha",
      reason: "Cryptographic consensus & zk-SNARK proof verification module",
      confidence: 0.96,
      provenance_hash: "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      id: `vouch-peer-sample-${(Date.now() + 1).toString().slice(-4)}`,
      contributor_id: "contrib-marcus-dev",
      contributor_username: "marcus_dev",
      source_project_id: "proj-peer-mesh-alpha",
      source_project_name: "Decentralized Trust Core / Alpha",
      reason: "Byzantine fault tolerance and peer gossip synchronization",
      confidence: 0.92,
      provenance_hash: "sha256-4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
    }
  ],
  denouncements: [],
  peer_edges: [
    {
      target_project_id: "proj-akshay",
      weight: 0.85,
      notes: "Decentralized peering edge verified via SHA256 signature envelope"
    }
  ],
  signature_envelope: {
    algorithm: "SHA256-ED25519-SIM",
    signer_pubkey: "tm_pk_peer_mesh_alpha",
    signature: "8f48a129d2f6d21398bb9a3f91da68d4081c7e937d2f93cb71c4c95f190d7963"
  }
};

export default function SettingsView({ aiStatus, theme, onReplayIntro }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [exportBundle, setExportBundle] = useState(null);
  const [exportedJson, setExportedJson] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');

  const [importJson, setImportJson] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { success: boolean, message: string, projectName?: string, vouchesCount?: number }

  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const fileInputRef = useRef(null);

  const nodePublicKey = "tm_pk_trustmesh_federation_2026_main";

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const data = await api.getProjects();
      const valid = Array.isArray(data) ? data : [];
      setProjects(valid);
      if (valid.length > 0) {
        const initialId = valid[0].id;
        setSelectedProjectId(initialId);
        // Automatically generate initial bundle for convenience
        generateBundle(initialId, valid);
      }
    } catch (e) {
      console.error('Error fetching projects for federation:', e);
      setExportError('Unable to load projects. Please verify backend connection.');
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const generateBundle = async (projId, projectList) => {
    const list = projectList || projects;
    const targetId = projId || selectedProjectId || (list.length > 0 ? list[0].id : null);
    if (!targetId) {
      setExportError('Please select a repository to generate its trust bundle.');
      return;
    }

    setSelectedProjectId(targetId);
    setExportLoading(true);
    setExportError(null);
    setExportSuccessMessage('');

    try {
      const bundle = await api.exportFederationBundle(targetId);
      setExportBundle(bundle);
      setExportedJson(JSON.stringify(bundle, null, 2));
      const targetProj = list.find((p) => p.id === targetId);
      const projName = targetProj ? targetProj.name : targetId;
      setExportSuccessMessage(`Cryptographic trust bundle successfully generated & signed for ${projName}!`);
    } catch (err) {
      console.error('Failed to export federation bundle:', err);
      setExportError(err.message || 'Failed to generate federation bundle.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleProjectSelect = (e) => {
    const newId = e.target.value;
    setSelectedProjectId(newId);
    generateBundle(newId);
  };

  const handleCopyExport = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    if (!exportedJson) return;
    const currentProj = projects.find((p) => p.id === selectedProjectId);
    const slug = currentProj?.slug || 'bundle';
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustmesh-federation-${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(nodePublicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleLoadSample = () => {
    setImportJson(JSON.stringify(SAMPLE_PEER_BUNDLE, null, 2));
    setImportResult(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (text) {
          JSON.parse(text);
          setImportJson(text);
          setImportResult(null);
        }
      } catch (err) {
        setImportResult({
          success: false,
          message: 'The uploaded file does not contain valid JSON syntax.'
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      setImportResult({
        success: false,
        message: 'Please paste a federation JSON bundle or click "Load Sample Peer Bundle" to test.'
      });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch (err) {
      setImportResult({
        success: false,
        message: `Invalid JSON syntax: ${err.message}`
      });
      return;
    }

    if (!parsed.source_project || !parsed.source_project.name) {
      setImportResult({
        success: false,
        message: 'Invalid federation bundle schema: missing required "source_project" object.'
      });
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await api.importFederationBundle(parsed);
      setImportResult({
        success: true,
        message: res.message || 'Federation bundle imported successfully into local mesh!',
        projectName: res.imported_from_project || parsed.source_project.name,
        vouchesCount: res.vouches_imported ?? (parsed.vouches?.length || 0),
      });
      fetchProjects();
    } catch (err) {
      console.error('Import failed:', err);
      setImportResult({
        success: false,
        message: err.message || 'Federation import failed. Please check bundle signatures and schema.'
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleClearImport = () => {
    setImportJson('');
    setImportResult(null);
  };

  const selectedProj = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header Banner */}
      <div className="fed-banner relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0c1322] via-[#080d18] to-[#04070d] p-6 lg:p-7 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                FEDERATION NODE ACTIVE
              </span>
              <span className="fed-muted text-xs text-slate-400 font-mono">TrustMesh Protocol v1.0.0</span>
              {onReplayIntro && (
                <button
                  onClick={() => {
                    playGlobalCinemaAudio();
                    onReplayIntro();
                  }}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all cursor-pointer shadow-sm ml-auto sm:ml-0"
                  title="Replay Netflix-style TrustMesh brand intro animation with sound"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Replay Intro Animation</span>
                </button>
              )}
            </div>
            <h1 className="fed-title text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Settings & Decentralized Federation
            </h1>
            <p className="fed-muted text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Export cryptographic trust bundles signed with ed25519 envelopes, peer with external TrustMesh nodes, and inspect local AI model runtime parameters with zero centralized gatekeepers.
            </p>
          </div>

          {/* Node Identity Card */}
          <div className="fed-subcard bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shrink-0 lg:w-84">
            <div className="flex items-center justify-between">
              <span className="fed-muted text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                Node Public Key
              </span>
              <button
                onClick={handleCopyPublicKey}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                title="Copy public key"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="fed-key-box text-xs font-mono text-cyan-300 truncate p-2 rounded-lg border border-slate-800">
              {nodePublicKey}
            </div>
            <div className="fed-border-t flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span className="fed-muted">Consensus Engine:</span>
              <span className="font-mono font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                SHA256-ED25519-SIM
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: FEDERATION EXPORT */}
      <div className="fed-card bg-[#090e1a]/85 border border-slate-800/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-lg">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="fed-title text-lg font-bold text-white tracking-tight">Export Repository Trust Bundle</h2>
              <p className="fed-muted text-xs sm:text-sm text-slate-400 mt-1">
                Generate an attributable, signed JSON bundle containing your repository's vouches, denouncements, and peering edges.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Verifiable Envelope: SHA256-ED25519-SIM
            </span>
          </div>
        </div>

        {/* Repository Selector and Primary Generate Button Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-slate-950/40 p-4 sm:p-5 rounded-xl border border-slate-800/60">
          <div className="lg:col-span-7 space-y-2">
            <label className="fed-title text-xs font-semibold text-slate-200 block uppercase tracking-wider font-mono">
              Target Repository for Cryptographic Bundle
            </label>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Loading active repositories...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex items-center justify-between text-xs text-amber-400 font-mono py-1">
                <span>No repositories detected.</span>
                <button
                  onClick={fetchProjects}
                  className="text-cyan-400 underline hover:text-cyan-300"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={handleProjectSelect}
                className="fed-select w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug}) &bull; {p.category || 'Infrastructure'}
                  </option>
                ))}
              </select>
            )}
            {selectedProj && (
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 pt-0.5">
                <span>ID: <span className="text-cyan-400">{selectedProj.id}</span></span>
                {selectedProj.repo_url && (
                  <a
                    href={selectedProj.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline flex items-center gap-1 text-slate-400 hover:text-cyan-300"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                <span>Category: <span className="text-slate-300">{selectedProj.category || 'General'}</span></span>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => generateBundle()}
              disabled={exportLoading || projectsLoading || projects.length === 0}
              className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${exportLoading ? 'animate-spin' : ''}`} />
              <span>{exportLoading ? 'Generating Attributable Bundle...' : 'Generate Attributable, Signed JSON Bundle'}</span>
            </button>
          </div>
        </div>

        {/* Live Feedback Messages */}
        {exportSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
        )}

        {exportError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* Export Metadata Summary Pills */}
        {exportBundle && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="fed-subcard p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="fed-muted text-[10px] uppercase text-slate-500 block">Protocol Version</span>
              <span className="fed-title text-sm font-bold text-white mt-1 block">{exportBundle.version || '1.0.0'}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">TrustMesh Canonical</span>
            </div>
            <div className="fed-subcard p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="fed-muted text-[10px] uppercase text-slate-500 block">Signed Vouches</span>
              <span className="text-sm font-bold text-emerald-400 mt-1 block">{exportBundle.vouches?.length ?? 0}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Attributable signals</span>
            </div>
            <div className="fed-subcard p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="fed-muted text-[10px] uppercase text-slate-500 block">Denouncements</span>
              <span className="text-sm font-bold text-rose-400 mt-1 block">{exportBundle.denouncements?.length ?? 0}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Adversarial flags</span>
            </div>
            <div className="fed-subcard p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="fed-muted text-[10px] uppercase text-slate-500 block">Peer Edges</span>
              <span className="text-sm font-bold text-cyan-400 mt-1 block">{exportBundle.peer_edges?.length ?? 0}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Federated nodes</span>
            </div>
          </div>
        )}

        {/* Exported JSON payload viewer */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="fed-muted text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              Signed Federation JSON Payload
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyExport}
                disabled={!exportedJson}
                className="fed-button-alt px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{copied ? 'Copied' : 'Copy Payload'}</span>
              </button>

              <button
                onClick={handleDownloadExport}
                disabled={!exportedJson}
                className="fed-button-alt px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download .json</span>
              </button>
            </div>
          </div>

          <pre className="fed-pre p-4 rounded-xl bg-[#03060c] border border-slate-800/80 font-mono text-[11px] text-cyan-300 max-h-72 overflow-y-auto leading-relaxed select-all">
            {exportLoading ? (
              <span className="text-slate-500">Generating attributable, signed cryptographic bundle...</span>
            ) : exportedJson ? (
              exportedJson
            ) : (
              <span className="text-slate-500">Select a project above and click "Generate Attributable, Signed JSON Bundle".</span>
            )}
          </pre>
        </div>
      </div>

      {/* SECTION 2: FEDERATION IMPORT */}
      <div className="fed-card bg-[#090e1a]/85 border border-slate-800/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="fed-title text-lg font-bold text-white tracking-tight">Import External Peer Bundle</h2>
              <p className="fed-muted text-xs sm:text-sm text-slate-400 mt-1">
                Merge verifiable cryptographic trust signals and vouches from an external peer node directly into your local TrustMesh.
              </p>
            </div>
          </div>

          {/* Quick Helper Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLoadSample}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Load Sample Peer Bundle</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="fed-button-alt px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Upload File</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Textarea for JSON bundle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="fed-muted text-[11px] font-mono text-slate-400">
              Paste Signed JSON Bundle Envelope:
            </label>
            {importJson && (
              <button
                onClick={handleClearImport}
                className="fed-muted text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <textarea
            rows="6"
            placeholder='{"version": "1.0.0", "source_project": { "id": "proj-peer", "name": "Peer Node" }, "vouches": [ ... ]}'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            className="fed-input w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400 leading-relaxed"
          />
        </div>

        {/* Action Button & Status Feedback */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <button
            onClick={handleImport}
            disabled={importLoading || !importJson.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-all disabled:opacity-50 cursor-pointer"
          >
            {importLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>{importLoading ? 'Verifying & Merging...' : 'Import Peer Bundle'}</span>
          </button>

          {/* Import Result Alert */}
          {importResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs max-w-xl ${
                importResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {importResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold">{importResult.message}</span>
                {importResult.projectName && (
                  <span className="block text-[11px] text-emerald-400 mt-0.5 font-mono">
                    Node: {importResult.projectName} &bull; {importResult.vouchesCount} vouches merged
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: AI RUNTIME & ARCHITECTURE */}
      <div className="fed-card bg-[#090e1a]/85 border border-slate-800/80 rounded-2xl p-6 sm:p-7 space-y-4 shadow-lg">
        <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm">
          <Cpu className="w-5 h-5" />
          <span>AI Architecture & Model Runtime Intelligence</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="fed-subcard p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="fed-muted text-slate-500 text-[10px] uppercase block">Selected Open-Weight Model</span>
            <span className="fed-title text-white text-sm font-bold mt-1 block">
              {aiStatus?.model_name || 'GPT-OSS-120B'}
            </span>
            <span className="fed-muted text-slate-400 text-[11px] mt-0.5 block">Apache 2.0 Open-Weight Model</span>
          </div>

          <div className="fed-subcard p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="fed-muted text-slate-500 text-[10px] uppercase block">Runtime Verification Mode</span>
            <span className="text-cyan-400 text-sm font-bold mt-1 block">
              {aiStatus?.mode || 'Deterministic Engine'}
            </span>
            <span className="fed-muted text-slate-400 text-[11px] mt-0.5 block">
              {aiStatus?.is_live_configured
                ? 'OpenRouter API Connected'
                : 'Deterministic Fallback Active (Offline Safe)'}
            </span>
          </div>
        </div>

        <p className="fed-muted text-xs text-slate-400 leading-relaxed font-light">
          Trust scores, reputation decay, and policy evaluations are strictly calculated deterministically by our Python FastAPI backend. The AI model is strictly dedicated to summarizing multi-repository PR diffs and providing natural language explanations to maintainers without altering raw consensus data.
        </p>
      </div>

      {/* SECTION 4: PRODUCTION PERSISTENCE & CENTRALIZED MESH GOVERNANCE */}
      <div className="fed-persistence-card p-6 rounded-2xl border border-emerald-950/50 bg-emerald-950/15 space-y-3">
        <div className="text-emerald-400 font-bold text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Production Persistence & Centralized Governance</span>
        </div>
        <p className="fed-muted text-xs text-slate-300 leading-relaxed">
          TrustMesh records all contributors, cryptographic vouches, denouncements, and activity logs persistently to your production database. Automated backups, forensic audit integrity, and cross-peer consensus synchronization are active.
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Production Database Synchronization Active &bull; Single Authoritative Ledger</span>
        </div>
      </div>
    </div>
  );
}
