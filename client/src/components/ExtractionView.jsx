// src/components/ExtractionView.jsx
import React, { useState } from 'react';
import { UploadCloud, Hash, Building, MapPin, Clock, AlertTriangle, DollarSign, Shield, List, Edit3, FileText, Sparkles, Check, X, Edit2, History, ChevronDown, ChevronUp } from 'lucide-react';

const ProfileRow = ({ icon, label, fieldKey, data, dbId, onUpdate, setActiveSource }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(data?.value || "");
  const [showHistory, setShowHistory] = useState(false);

  const val = data?.value || "Not found";
  const quote = data?.source_quote || "No source quote extracted.";
  const isMissing = val === "Not found" || val === "N/A" || val === "";
  
  const historyLog = data?.history || [];
  const hasHistory = historyLog.length > 0;

  const handleSave = async () => {
    if (tempVal !== val) {
      await onUpdate(dbId, fieldKey, tempVal);
    }
    setIsEditing(false);
  };

  return (
    <div className="group grid grid-cols-12 items-start gap-4 border-b border-white/[0.04] px-6 py-4 transition-colors hover:bg-white/[0.02] last:border-b-0">
      
      {/* 1. Icon & Label */}
      <div className="col-span-12 sm:col-span-3 flex items-center gap-3 text-zinc-400 mt-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
          {icon}
        </span>
        <span className="text-sm font-medium tracking-tight">{label}</span>
      </div>

      {/* 2. Value Input / Display & History Dropdown */}
      <div className={`col-span-10 sm:col-span-7 flex flex-col gap-2 ${isMissing && !isEditing ? 'text-red-400/90 italic' : 'text-zinc-100'}`}>
        
        {/* Main Text / Input Area */}
        <div className="text-sm leading-relaxed">
          {isEditing ? (
             <textarea
               value={tempVal}
               onChange={(e) => setTempVal(e.target.value)}
               className="w-full min-h-[40px] bg-[#242424] border border-blue-500/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 resize-y"
               autoFocus
             />
          ) : (
            isMissing ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-red-500/20">
                <AlertTriangle size={12} /> {val}
              </span>
            ) : (
              val
            )
          )}
        </div>

        {/* History Dropdown */}
        {hasHistory && !isEditing && (
          <div className="mt-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
            >
              <History size={12} />
              Edited ({historyLog.length})
              {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            
            {showHistory && (
              <div className="mt-3 overflow-hidden rounded-lg border border-white/5 bg-black/40 p-1 shadow-inner animate-in slide-in-from-top-2 duration-200">
                {historyLog.slice().reverse().map((entry, idx) => ( 
                  <div key={idx} className="flex flex-col gap-1 border-b border-white/5 p-3 last:border-0">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <div className="text-xs text-zinc-300">
                      Changed from <span className="text-red-400 line-through mr-1">{entry.old_value || "Empty"}</span> 
                      to <span className="text-emerald-400 ml-1">{entry.new_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Buttons */}
      <div className="col-span-2 sm:col-span-2 flex justify-end gap-2 mt-1">
        {isEditing ? (
          <>
            <button onClick={handleSave} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer" title="Save">
              <Check size={16} />
            </button>
            <button onClick={() => { setTempVal(val); setIsEditing(false); }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer" title="Cancel">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-zinc-400 opacity-60 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
              title="Edit Field"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => setActiveSource({ label, quote })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-zinc-400 opacity-60 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
              title="View Source in PDF"
            >
              <Hash size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Card = ({ title, icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#1a1a1d] to-[#141416] shadow-2xl shadow-black/40 backdrop-blur-xl">
    <header className="flex items-center gap-2.5 border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
        {icon}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">{title}</h2>
    </header>
    <div>{children}</div>
  </section>
);

const ExtractionView = ({ file, loading, error, result, fileInputRef, handleFileSelection, handleAnalyze, setActiveSource, dbId, onUpdate }) => (
  <div className="animate-in fade-in duration-500">
    {!result ? (
      <div
        onClick={() => !loading && fileInputRef.current.click()}
        className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-gradient-to-b from-[#1a1a1d] to-[#141416] px-10 py-24 text-center shadow-2xl shadow-black/40 transition-all hover:border-blue-500/40 hover:from-[#1c1c22] cursor-pointer"
      >
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl opacity-50 transition-opacity group-hover:opacity-80" />
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileSelection(e.target.files[0])} />
        <div className="relative">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-500/5 ring-1 ring-inset ring-blue-500/30 transition-transform group-hover:scale-110">
            <UploadCloud size={36} className="text-blue-400" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-100">{file ? file.name : "Upload Purchase Order"}</h3>
          <p className="text-sm text-zinc-500">{file ? "Ready to extract" : "Drop a PDF here or click to browse"}</p>
          {file && !loading && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 ring-1 ring-inset ring-white/10 transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-blue-500/50 active:scale-[0.98]"
            >
              <Sparkles size={16} /> Run Enterprise Extraction
            </button>
          )}
          {loading && (
            <div className="mt-8 flex flex-col items-center gap-3 text-blue-400">
              <div className="spinner h-8 w-8 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
              <p className="text-sm font-medium tracking-tight">Processing via Gemini 3.5 Flash...</p>
            </div>
          )}
          {error && (
            <div className="mx-auto mt-6 inline-flex max-w-md items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        <Card title="Document Headers" icon={<FileText size={14} />}>
          <ProfileRow icon={<Hash size={16} />} label="PO Number" fieldKey="po_number" data={result.po_number} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<Building size={16} />} label="Vendor Name" fieldKey="vendor_name" data={result.vendor_name} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<MapPin size={16} />} label="Contact & Address" fieldKey="vendor_contact_address" data={result.vendor_contact_address} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<Clock size={16} />} label="Effective Date" fieldKey="effective_date" data={result.effective_date} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<AlertTriangle size={16} />} label="Lapse / Expiry" fieldKey="lapse_expiry_date" data={result.lapse_expiry_date} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={16} />} label="Total Value" fieldKey="total_value" data={result.total_value} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Terms & Conditions" icon={<Shield size={14} />}>
          <ProfileRow icon={<Shield size={16} />} label="Conditions of Agreement" fieldKey="conditions_of_agreement" data={result.conditions_of_agreement} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={16} />} label="Payment Conditions" fieldKey="conditions_of_payment" data={result.conditions_of_payment} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Signatures" icon={<Edit3 size={14} />}>
          <ProfileRow icon={<Edit3 size={16} />} label="Authorising Signatory" fieldKey="authorising_signatory" data={result.authorising_signatory} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Line Items" icon={<List size={14} />}>
          <div className="p-6">
            {result.line_items?.status === "found" && result.line_items.value.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full border-collapse text-sm text-zinc-100">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Description</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Qty</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Unit Price</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.line_items.value.map((item, idx) => (
                      <tr key={idx} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 leading-relaxed">{item.description}</td>
                        <td className="px-4 py-3.5 text-center font-mono text-zinc-300">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-400">${item.unit_price?.toFixed(2) || "0.00"}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => setActiveSource({ label: `Line Item ${idx + 1}`, quote: item.source_quote || "No quote found." })}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/5 bg-white/[0.03] text-blue-400 transition-all hover:border-blue-500/40 hover:bg-blue-500/10"
                            title="View Source in PDF"
                          >
                            <Hash size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/5 py-8 text-sm italic text-zinc-500">
                <List size={16} /> No line items parsed or found in this document.
              </div>
            )}
          </div>
        </Card>
      </div>
    )}
  </div>
);

export default ExtractionView;