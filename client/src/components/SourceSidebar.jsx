// src/components/SourceSidebar.jsx
import React from 'react';
import { Shield, X } from 'lucide-react';

const SourceSidebar = ({ activeSource, onClose }) => {
  if (!activeSource) return null;

  return (
    <aside className="flex w-[380px] flex-col border-l border-white/5 bg-neutral-950/95 p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in slide-in-from-right duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Shield size={16} className="text-emerald-400" />
          </div>
          <h3 className="m-0 text-sm font-semibold tracking-wide text-emerald-400">
            Source Verification
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
        Field Reference
      </div>
      <div className="mb-8 text-xl font-semibold text-neutral-100">
        {activeSource.label}
      </div>

      <div className="mb-3 text-xs uppercase tracking-wider text-neutral-500">
        Extracted Document Passage
      </div>
      <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/5 border-l-4 border-l-sky-500 bg-neutral-900/60 p-5 font-mono text-[0.92rem] leading-relaxed text-neutral-300 shadow-inner">
        "{activeSource.quote}"
      </div>
    </aside>
  );
};

export default SourceSidebar;
