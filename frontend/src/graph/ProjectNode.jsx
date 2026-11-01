import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FolderGit2, Star, ShieldCheck, AlertTriangle } from 'lucide-react';

export default memo(function ProjectNode({ data, selected }) {
  return (
    <div
      className={`min-w-[210px] rounded-xl p-3.5 transition-all duration-200 ${
        selected
          ? 'bg-slate-900/95 border-2 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.4)] scale-105'
          : 'bg-slate-900/80 border border-slate-700/70 hover:border-cyan-500/50 shadow-lg'
      } backdrop-blur-md`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-slate-900"
      />

      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <FolderGit2 className="w-4 h-4" />
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-white tracking-wide truncate">
            {data.name}
          </div>
          <div className="text-[10px] text-cyan-400/80 font-mono truncate">
            {data.slug}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800 text-slate-400">
        <div className="flex items-center gap-1 text-amber-400/90 font-mono">
          <Star className="w-3 h-3 fill-amber-400/80 stroke-none" />
          <span>{data.stars ? data.stars.toLocaleString() : '0'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-emerald-400 font-mono text-[10px]" title="Vouches Given">
            <ShieldCheck className="w-3 h-3" />
            {data.vouches_given || 0}
          </span>
          <span className="flex items-center gap-0.5 text-rose-400 font-mono text-[10px]" title="Reports Made">
            <AlertTriangle className="w-3 h-3" />
            {data.reports_made || 0}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-slate-900"
      />
    </div>
  );
});
