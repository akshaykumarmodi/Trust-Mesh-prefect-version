import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

const stateStyles = {
  ESTABLISHED: {
    border: 'border-emerald-500/50',
    selectedBorder: 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  NEWCOMER: {
    border: 'border-cyan-500/50',
    selectedBorder: 'border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.4)]',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  'INSUFFICIENT EVIDENCE': {
    border: 'border-slate-600',
    selectedBorder: 'border-slate-400 shadow-[0_0_20px_rgba(148,163,184,0.3)]',
    badge: 'bg-slate-700/40 text-slate-300 border-slate-600',
    dot: 'bg-slate-400',
  },
  'UNDER REVIEW': {
    border: 'border-amber-500/50',
    selectedBorder: 'border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.4)]',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
};

export default memo(function ContributorNode({ data, selected }) {
  const currentStyle = stateStyles[data.reputation_state] || stateStyles['NEWCOMER'];

  return (
    <div
      className={`contributor-node min-w-[190px] rounded-xl p-3 transition-all duration-200 ${
        selected
          ? `bg-slate-900/95 border-2 ${currentStyle.selectedBorder} scale-105`
          : `bg-slate-900/85 border ${currentStyle.border} hover:border-slate-500 shadow-md`
      } backdrop-blur-md`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-slate-400 !border-slate-900"
      />
      <Handle
        type="target"
        id="c-left"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-400 !border-slate-900"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
          {data.avatar_url ? (
            <img
              src={data.avatar_url}
              alt={data.username}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <User className="w-4 h-4" />
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${currentStyle.dot} ring-1 ring-slate-900`}
          />
        </div>

        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-white tracking-wide truncate">
            @{data.username}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {data.display_name}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${currentStyle.badge}`}
        >
          {data.reputation_state}
        </span>
        <div className="flex items-center gap-1.5 text-slate-400 font-mono">
          <span className="flex items-center text-emerald-400" title="Vouches">
            +{data.vouches_count || 0}
          </span>
          <span className="flex items-center text-rose-400" title="Denouncements">
            -{data.denouncements_count || 0}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !border-slate-900"
      />
      <Handle
        type="source"
        id="c-right"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-400 !border-slate-900"
      />
    </div>
  );
});
