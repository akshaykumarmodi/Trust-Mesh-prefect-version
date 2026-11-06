import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import ProjectNode from './ProjectNode';
import ContributorNode from './ContributorNode';
import { api } from '../services/api';
import {
  Search,
  Filter,
  Eye,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  X,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Share2,
  Maximize2,
  Grid,
} from 'lucide-react';

const nodeTypes = {
  projectNode: ProjectNode,
  contributorNode: ContributorNode,
};

// Physics relaxation ensuring ZERO node overlap across all zoom and screen sizes
export function resolveNodeOverlaps(nodes, minXDist = 260, minYDist = 140) {
  if (!nodes || nodes.length <= 1) return nodes;
  const list = nodes.map((n) => ({
    ...n,
    position: {
      x: typeof n.position?.x === 'number' ? n.position.x : 0,
      y: typeof n.position?.y === 'number' ? n.position.y : 0,
    },
  }));

  // Iterative relaxation algorithm
  for (let step = 0; step < 35; step++) {
    let hadCollision = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < minXDist && absY < minYDist) {
          hadCollision = true;
          const pushX = Math.max(14, (minXDist - absX) * 0.52) * (dx >= 0 ? 1 : -1);
          const pushY = Math.max(10, (minYDist - absY) * 0.52) * (dy >= 0 ? 1 : -1);

          b.position.x += pushX;
          b.position.y += pushY;
          a.position.x -= pushX;
          a.position.y -= pushY;
        }
      }
    }
    if (!hadCollision) break;
  }
  return list;
}

export default function TrustNetworkGraph({ onSelectContributor, onSelectProject }) {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, VOUCH, DENOUNCEMENT, HIGH_CONFIDENCE
  const [viewFilter, setViewFilter] = useState('ALL'); // ALL, PROJECTS, CONTRIBUTORS
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);

  // Fetch graph data
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNetworkGraph();

      // Style edges for cybersecurity intelligence aesthetic
      const styledEdges = data.edges.map((e) => {
        const edgeType = e.data?.edge_type;
        if (edgeType === 'VOUCH') {
          return {
            ...e,
            style: { stroke: '#10b981', strokeWidth: 2, opacity: 0.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
          };
        } else if (edgeType === 'DENOUNCEMENT') {
          return {
            ...e,
            style: { stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '4 4', opacity: 0.85 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' },
          };
        } else {
          // Federation / Peering
          return {
            ...e,
            style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '2 2', opacity: 0.6 },
          };
        }
      });

      // Apply collision-free relaxation to backend positions
      const relaxedNodes = resolveNodeOverlaps(data.nodes);
      setRawNodes(relaxedNodes);
      setRawEdges(styledEdges);
    } catch (err) {
      console.error('Failed to load network graph:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Apply filters
  useEffect(() => {
    let filteredNodes = [...rawNodes];
    let filteredEdges = [...rawEdges];

    // Filter by view toggle (All, Projects, Contributors)
    if (viewFilter === 'PROJECTS') {
      filteredNodes = filteredNodes.filter((n) => n.type === 'projectNode');
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'FEDERATION');
    } else if (viewFilter === 'CONTRIBUTORS') {
      filteredNodes = filteredNodes.filter((n) => n.type === 'contributorNode');
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type !== 'FEDERATION');
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) =>
          n.data?.name?.toLowerCase().includes(term) ||
          n.data?.username?.toLowerCase().includes(term) ||
          n.data?.slug?.toLowerCase().includes(term)
      );
    }

    // Filter by relationship type
    if (filterType === 'VOUCH') {
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'VOUCH');
    } else if (filterType === 'DENOUNCEMENT') {
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'DENOUNCEMENT');
    } else if (filterType === 'HIGH_CONFIDENCE') {
      filteredEdges = filteredEdges.filter((e) => (e.data?.confidence || 0) >= 0.9);
    }

    // Highlight selected node connections
    if (selectedNode) {
      filteredEdges = filteredEdges.map((e) => {
        const isConnected = e.source === selectedNode.id || e.target === selectedNode.id;
        return {
          ...e,
          animated: isConnected,
          style: {
            ...e.style,
            opacity: isConnected ? 1 : 0.15,
            strokeWidth: isConnected ? 3 : 1,
          },
        };
      });
    }

    // Ensure filtered nodes have zero overlap
    const finalNodes = resolveNodeOverlaps(filteredNodes);
    setNodes(finalNodes);
    setEdges(filteredEdges);
  }, [rawNodes, rawEdges, searchTerm, filterType, viewFilter, selectedNode, setNodes, setEdges]);

  // Auto-fit view when graph loads
  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.2, duration: 400 });
      }, 150);
    }
  }, [rfInstance, viewFilter]);

  // Handle node selection
  const onNodeClick = useCallback(async (_, node) => {
    setSelectedNode(node);
    setSelectedDetails(node.data);
    setEvaluationData(null);

    if (node.type === 'contributorNode') {
      try {
        setEvalLoading(true);
        const evalResult = await api.evaluateTrust(node.data.id || node.data.username);
        setEvaluationData(evalResult);
      } catch (e) {
        console.error('Failed to evaluate selected node trust:', e);
      } finally {
        setEvalLoading(false);
      }
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedDetails(null);
    setEvaluationData(null);
  }, []);

  const handleTidyLayout = () => {
    setNodes((currentNodes) => resolveNodeOverlaps(currentNodes, 280, 160));
    if (rfInstance) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.2, duration: 500 });
      }, 80);
    }
  };

  const handleFitView = () => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  };

  return (
    <div className="relative w-full h-[740px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#05070a] shadow-2xl">
      {/* Top Filter & Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search & View Toggles */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search nodes in mesh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 w-52 sm:w-60 backdrop-blur-md shadow-md"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Filter Pill */}
          <div className="flex bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 backdrop-blur-md text-xs shadow-md">
            {['ALL', 'PROJECTS', 'CONTRIBUTORS'].map((v) => (
              <button
                key={v}
                onClick={() => setViewFilter(v)}
                className={`px-3 py-1.5 rounded-lg font-mono text-[11px] transition-colors ${
                  viewFilter === v
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Relationship Filters & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="hidden sm:flex bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 backdrop-blur-md text-xs shadow-md">
            {[
              { id: 'ALL', label: 'All Signals' },
              { id: 'VOUCH', label: 'Vouches (+)' },
              { id: 'DENOUNCEMENT', label: 'Reports (!)' },
              { id: 'HIGH_CONFIDENCE', label: 'High Trust' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  filterType === f.id
                    ? 'bg-slate-800 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tidy / Anti-Overlap Button */}
          <button
            onClick={handleTidyLayout}
            title="Untangle & Tidy Topology (Auto-Separate Overlaps)"
            className="px-3 py-2 bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 rounded-xl text-slate-300 hover:text-cyan-300 backdrop-blur-md text-xs font-mono flex items-center gap-1.5 shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Tidy Graph</span>
          </button>

          {/* Fit View Button */}
          <button
            onClick={handleFitView}
            title="Center and Fit Graph"
            className="p-2 bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 rounded-xl text-slate-300 hover:text-cyan-300 backdrop-blur-md transition-all shadow-md"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={loadGraph}
            title="Reload Network Topology"
            className="p-2 bg-slate-900/90 border border-slate-700/80 hover:border-slate-500 rounded-xl text-slate-300 hover:text-white backdrop-blur-md transition-colors shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Empty State Overlay */}
      {!loading && nodes.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm pointer-events-none">
          <div className="p-8 text-center rounded-2xl glass-panel border border-slate-800 max-w-md pointer-events-auto shadow-2xl">
            <Share2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No verified trust relationships available yet.</h3>
            <p className="text-xs text-slate-400 mt-1">Connect repositories or configure peering trust edges to visualize the mesh topology.</p>
          </div>
        </div>
      )}

      {/* Main React Flow Graph Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
        onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.12}
        maxZoom={2.4}
      >
        <Background color="#1e293b" gap={28} size={1.2} />
        <Controls className="!bottom-4 !left-4" showInteractive={false} />
      </ReactFlow>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-20 z-10 hidden sm:flex items-center gap-4 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[11px] text-slate-400 shadow-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full" /> Vouch (Peer Endorsement)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-rose-400 border-b border-dashed border-rose-400" /> Allegation (Report)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-indigo-400" /> Cross-Project Peering
        </span>
      </div>

      {/* Detail Inspector Side Drawer */}
      {selectedNode && (
        <div className="absolute top-20 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] z-30 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-5 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {selectedNode.type === 'projectNode' ? 'Repository Node' : 'Contributor Identity'}
              </span>
              <h3 className="text-base font-bold text-white mt-1.5 truncate">
                {selectedDetails?.name || `@${selectedDetails?.username}`}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* PROJECT NODE DETAILS */}
          {selectedNode.type === 'projectNode' && (
            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                {selectedDetails?.description || 'Active open-source project participating in TrustMesh.'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400">Category</div>
                  <div className="font-semibold text-white mt-0.5">{selectedDetails?.category}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400">GitHub Stars</div>
                  <div className="font-semibold text-amber-400 mt-0.5">
                    {selectedDetails?.stars?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Trust Policy Section */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configured Trust Policy</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Strictness:</span>
                    <span className="capitalize">{selectedDetails?.trust_policy?.strictness || 'Balanced'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Min Confidence:</span>
                    <span>{selectedDetails?.trust_policy?.min_confidence || '0.60'}</span>
                  </div>
                </div>
              </div>

              {selectedDetails?.repo_url && (
                <a
                  href={selectedDetails.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View GitHub Repository
                </a>
              )}
            </div>
          )}

          {/* CONTRIBUTOR NODE DETAILS */}
          {selectedNode.type === 'contributorNode' && (
            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-cyan-500/40 shrink-0">
                  <img
                    src={selectedDetails?.avatar_url || `https://github.com/${selectedDetails?.username}.png`}
                    alt={selectedDetails?.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    {selectedDetails?.display_name || selectedDetails?.username}
                  </h4>
                  <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                    @{selectedDetails?.username}
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {selectedDetails?.reputation_state}
                  </span>
                </div>
              </div>

              {/* Real-time Explainable Evaluation Engine Output */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Decentralized Perspective
                  </span>
                  {evalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                </div>

                {evaluationData ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Trust Confidence:</span>
                      <span className="font-bold text-cyan-400">
                        {Math.round(evaluationData.confidence * 100)}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                        style={{ width: `${Math.round(evaluationData.confidence * 100)}%` }}
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                      {evaluationData.explanation?.[0] || 'Computed from peer mesh graph topology.'}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Click to run live decentralized trust equation evaluation.
                  </div>
                )}
              </div>

              {selectedDetails?.github_url && (
                <a
                  href={selectedDetails.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  GitHub Profile
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
