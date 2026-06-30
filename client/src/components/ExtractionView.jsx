// src/components/ExtractionView.jsx
import React, { useState } from 'react';
import { 
  UploadCloud, Hash, Building, MapPin, Clock, AlertTriangle, 
  DollarSign, Shield, List, Edit3, FileText, Sparkles, Check, X, 
  Edit2, History, ChevronDown, ChevronUp, Calendar, Zap, ArrowRight, Save, RefreshCw
} from 'lucide-react';

// ── TIME MATH HELPERS ──────────────────────────────────────────────────────
const parseAnchor = (text) => {
  if (!text) return null;
  // Looks for e.g., "15 days", "2 months", "5 weeks"
  const match = text.match(/(\d+)\s*(day|week|month|year)s?/i);
  if (!match) return null;
  return { amount: parseInt(match[1]), unit: match[2].toLowerCase() };
};

const addTime = (baseDateStr, offset) => {
  if (!baseDateStr || !offset) return null;
  const d = new Date(baseDateStr);
  if (isNaN(d)) return null;

  if (offset.unit.startsWith('day')) d.setDate(d.getDate() + offset.amount);
  if (offset.unit.startsWith('week')) d.setDate(d.getDate() + (offset.amount * 7));
  if (offset.unit.startsWith('month')) d.setMonth(d.getMonth() + offset.amount);
  if (offset.unit.startsWith('year')) d.setFullYear(d.getFullYear() + offset.amount);

  return d.toISOString().split('T')[0];
};
// ───────────────────────────────────────────────────────────────────────────

const ProfileRow = ({ icon, label, fieldKey, data, dbId, onUpdate, setActiveSource }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(data?.value || "");
  const [showHistory, setShowHistory] = useState(false);

  const val = data?.value || "Not found";
  const quote = data?.source_quote || "No source quote extracted.";
  const isMissing = !val || val === "Not found" || val === "N/A" || val === "not_found" || val === "";
  const historyLog = data?.history || [];
  const hasHistory = historyLog.length > 0;

  const handleSave = async () => {
    if (tempVal !== val) await onUpdate(dbId, fieldKey, tempVal);
    setIsEditing(false);
  };

  return (
    <div
      className="group border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.02]"
      style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 20px', gap: 0 }}
    >
      <div style={{ flexShrink: 0, width: 156, display: 'flex', alignItems: 'flex-start', gap: 9, paddingTop: 1 }}>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 7,
          background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
          boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa', lineHeight: 1.4, paddingTop: 6 }}>{label}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingLeft: 12, paddingTop: 2 }}>
        {isEditing ? (
          <textarea
            value={tempVal}
            onChange={e => setTempVal(e.target.value)}
            autoFocus
            style={{
              width: '100%', minHeight: 56, background: '#242424',
              border: '1px solid rgba(59,130,246,0.5)', borderRadius: 6,
              padding: '7px 11px', fontSize: 13, color: '#fff',
              outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box'
            }}
          />
        ) : isMissing ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5,
            background: 'rgba(239,68,68,0.1)', color: '#f87171', fontStyle: 'italic',
            padding: '2px 8px', borderRadius: 5, boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.2)'
          }}>
            <AlertTriangle size={11} /> Not found
          </span>
        ) : (
          <span style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.65, wordBreak: 'break-word', display: 'block' }}>{val}</span>
        )}

        {hasHistory && !isEditing && (
          <div style={{ marginTop: 7 }}>
            <button
              onClick={() => setShowHistory(s => !s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5,
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: 'none',
                padding: '2px 9px', borderRadius: 999, cursor: 'pointer', fontWeight: 500
              }}
            >
              <History size={10} /> Edited ({historyLog.length}) {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showHistory && (
              <div style={{ marginTop: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                {historyLog.slice().reverse().map((entry, idx) => (
                  <div key={idx} style={{ padding: '9px 13px', borderBottom: idx < historyLog.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 3 }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#d4d4d8' }}>
                      <span style={{ color: '#f87171', textDecoration: 'line-through', marginRight: 5 }}>{entry.old_value || 'Empty'}</span>
                      →
                      <span style={{ color: '#34d399', marginLeft: 5 }}>{entry.new_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 5, paddingLeft: 10, paddingTop: 1 }}>
        {isEditing ? (
          <>
            <button onClick={handleSave} title="Save"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(52,211,153,0.1)', border: 'none', color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={14} />
            </button>
            <button onClick={() => { setTempVal(val); setIsEditing(false); }} title="Cancel"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} title="Edit"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => setActiveSource({ label, quote })} title="View Source"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}>
              <Hash size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const DateProfileRow = ({ icon, label, fieldKey, data, dbId, onUpdate, setActiveSource }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(data?.value || "");

  const val = data?.value || "Not found";
  const quote = data?.source_quote || "No source quote extracted.";
  const isMissing = !val || val === "Not found" || val === "N/A" || val === "not_found" || val === "";

  const handleSave = async () => {
    if (tempVal !== val) await onUpdate(dbId, fieldKey, tempVal);
    setIsEditing(false);
  };

  const toInputDate = (str) => {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d)) return "";
    return d.toISOString().split("T")[0];
  };

  const handleCalendarChange = (e) => {
    const raw = e.target.value;
    if (!raw) return;
    const [y, m, d] = raw.split("-");
    setTempVal(`${d}/${m}/${y}`);
  };

  return (
    <div
      className="group border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.02]"
      style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 20px', gap: 0 }}
    >
      <div style={{ flexShrink: 0, width: 156, display: 'flex', alignItems: 'flex-start', gap: 9, paddingTop: 1 }}>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 7,
          background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa', lineHeight: 1.4, paddingTop: 6 }}>{label}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingLeft: 12, paddingTop: 2 }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={tempVal}
              onChange={e => setTempVal(e.target.value)}
              autoFocus
              placeholder="Type a date manually…"
              style={{
                width: '100%', minHeight: 40, background: '#242424',
                border: '1px solid rgba(59,130,246,0.5)', borderRadius: 6,
                padding: '7px 11px', fontSize: 13, color: '#fff', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#71717a' }}>Or pick:</span>
              <input
                type="date" value={toInputDate(tempVal)} onChange={handleCalendarChange}
                style={{ background: '#242424', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 6, padding: '4px 9px', fontSize: 12, color: '#a1a1aa', outline: 'none', colorScheme: 'dark' }}
              />
            </div>
          </div>
        ) : isMissing ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '2px 8px', borderRadius: 5 }}>
            <AlertTriangle size={11} /> Not found
          </span>
        ) : (
          <span style={{ fontSize: 13, color: '#e4e4e7', display: 'block' }}>{val}</span>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 5, paddingLeft: 10, paddingTop: 1 }}>
        {isEditing ? (
          <>
            <button onClick={handleSave} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(52,211,153,0.1)', border: 'none', color: '#34d399', cursor: 'pointer' }}><Check size={14} /></button>
            <button onClick={() => { setTempVal(val); setIsEditing(false); }} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={14} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer' }}><Edit2 size={12} /></button>
            <button onClick={() => setActiveSource({ label, quote })} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer' }}><Hash size={12} /></button>
          </>
        )}
      </div>
    </div>
  );
};

const Card = ({ title, icon, children, borderColor = 'border-white/[0.06]', headerBg = 'bg-white/[0.02]' }) => (
  <section className={`overflow-hidden rounded-2xl border ${borderColor} bg-gradient-to-b from-[#1a1a1d] to-[#141416] shadow-2xl shadow-black/40 backdrop-blur-xl`}>
    <header className={`flex items-center gap-2.5 border-b ${borderColor} ${headerBg} px-5 py-3.5`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
        {icon}
      </span>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</h2>
    </header>
    <div>{children}</div>
  </section>
);

const ExtractionView = ({ file, loading, error, result, fileInputRef, handleFileSelection, handleAnalyze, setActiveSource, dbId, onUpdate, customFields = [] }) => {
  const deepAnalysis = result?._deep_analysis || null;
  const hasRawFields = deepAnalysis?.raw_fields && Object.keys(deepAnalysis.raw_fields).length > 0;
  const hasDeadlines = deepAnalysis?.deadlines && deepAnalysis.deadlines.length > 0;
  const hasAnomalies = deepAnalysis?.anomalies && deepAnalysis.anomalies.length > 0;

  // ── TRIGGER STATE & AUTO-SYNC LOGIC ──
  const [triggerDates, setTriggerDates] = useState({});
  const [savingIdx, setSavingIdx] = useState(null);

  const handleTriggerChange = (idx, dateStr, description) => {
    const newDates = { ...triggerDates, [idx]: dateStr };
    
    const lowerDesc = (description || "").toLowerCase();
    const keywords = ['invoice', 'delivery', 'dispatch', 'completion', 'receipt'];
    const matchedKeyword = keywords.find(k => lowerDesc.includes(k));

    if (matchedKeyword && deepAnalysis?.deadlines) {
      deepAnalysis.deadlines.forEach((dl, i) => {
        const isPending = !dl.computed_date || String(dl.computed_date).toLowerCase() === 'null';
        // Auto-sync if the other field is pending or currently being edited
        if (i !== idx && (isPending || newDates[i + "_edit"]) && dl.anchor_description?.toLowerCase().includes(matchedKeyword)) {
          newDates[i] = dateStr;
        }
      });
    }
    setTriggerDates(newDates);
  };

  const handleSaveDeadline = async (idx, calculatedResult) => {
    if (!calculatedResult) return;
    setSavingIdx(idx);

    const updatedDeepAnalysis = JSON.parse(JSON.stringify(deepAnalysis));
    updatedDeepAnalysis.deadlines[idx].computed_date = calculatedResult;

    try {
      await onUpdate(dbId, "_deep_analysis", updatedDeepAnalysis);
      result._deep_analysis.deadlines[idx].computed_date = calculatedResult;
      // Clear the edit state upon successful save
      setTriggerDates(prev => ({ ...prev, [idx + "_edit"]: false }));
    } catch (e) {
      console.error("Failed to save deadline", e);
    }
    
    setSavingIdx(null);
  };

  // ── EXTRACTION MODE SELECTION ──
  const [extractionMode, setExtractionMode] = useState('primary'); // 'primary' | 'deep'

  return (
    <div className="animate-in fade-in duration-500">
      {!result ? (
        <div onClick={() => !loading && fileInputRef.current.click()} className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-gradient-to-b from-[#1a1a1d] to-[#141416] px-10 py-24 text-center cursor-pointer">
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileSelection(e.target.files[0])} />
          <div className="relative">
            <UploadCloud size={36} className="mx-auto mb-6 text-blue-400" />
            <h3 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-100">{file ? file.name : "Upload Purchase Order"}</h3>

            {file && !loading && (
              <div onClick={(e) => e.stopPropagation()} className="mt-8 flex flex-col items-center gap-5">

                {/* Extraction mode selector */}
                <div className="flex w-full max-w-md gap-3">
                  <button
                    type="button"
                    onClick={() => setExtractionMode('primary')}
                    className={`flex-1 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      extractionMode === 'primary'
                        ? 'border-blue-500/60 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className={extractionMode === 'primary' ? 'text-blue-400' : 'text-zinc-500'} />
                      <span className={`text-sm font-semibold ${extractionMode === 'primary' ? 'text-blue-300' : 'text-zinc-300'}`}>
                        Extract Primary Fields
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                      Pulls only the 10 core fields (PO number, vendor, dates, value, terms…). Fast & cheap.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExtractionMode('deep')}
                    className={`flex-1 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      extractionMode === 'deep'
                        ? 'border-purple-500/60 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className={extractionMode === 'deep' ? 'text-purple-400' : 'text-zinc-500'} />
                      <span className={`text-sm font-semibold ${extractionMode === 'deep' ? 'text-purple-300' : 'text-zinc-300'}`}>
                        Primary Fields + Deep Analysis
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                      Adds deadline chains, anomaly detection & dynamic raw fields. Slower, more thorough.
                    </p>
                  </button>
                </div>

                <button
                  onClick={() => handleAnalyze(extractionMode)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  <Sparkles size={16} /> Run {extractionMode === 'deep' ? 'Deep' : 'Primary'} Extraction
                </button>
              </div>
            )}

            {loading && (
              <div className="mt-8 text-blue-400 text-sm animate-pulse">
                {extractionMode === 'deep' ? 'Processing via Gemini Cascade + Deep Analysis...' : 'Processing via Gemini Cascade...'}
              </div>
            )}
            {error && <div className="mt-6 text-red-400 text-sm">{error}</div>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          
          {/* ── 1. Document Headers ── */}
          <Card title="Document Headers" icon={<FileText size={13} />}>
            <ProfileRow icon={<Hash size={14} />} label="PO Number" fieldKey="po_number" data={result.po_number} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <ProfileRow icon={<Building size={14} />} label="Vendor Name" fieldKey="vendor_name" data={result.vendor_name} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <ProfileRow icon={<MapPin size={14} />} label="Contact & Address" fieldKey="vendor_contact_address" data={result.vendor_contact_address} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <DateProfileRow icon={<Clock size={14} />} label="Effective Date" fieldKey="effective_date" data={result.effective_date} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <DateProfileRow icon={<AlertTriangle size={14}/>} label="Lapse / Expiry" fieldKey="lapse_expiry_date" data={result.lapse_expiry_date} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <ProfileRow icon={<DollarSign size={14} />} label="Total Value" fieldKey="total_value" data={result.total_value} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          </Card>

          {/* ── 2. Terms & Conditions ── */}
          <Card title="Terms & Conditions" icon={<Shield size={13} />}>
            <ProfileRow icon={<Shield size={14} />} label="Conditions" fieldKey="conditions_of_agreement" data={result.conditions_of_agreement} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
            <ProfileRow icon={<DollarSign size={14} />} label="Payment Terms" fieldKey="conditions_of_payment" data={result.conditions_of_payment} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          </Card>

          {/* ── 3. Signatures ── */}
          <Card title="Signatures" icon={<Edit3 size={13} />}>
            <ProfileRow icon={<Edit3 size={14} />} label="Signatory" fieldKey="authorising_signatory" data={result.authorising_signatory} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          </Card>

          {/* ── 4. Global Custom Fields ── */}
          {customFields && customFields.length > 0 && (
            <Card title="Global Custom Fields" icon={<Sparkles size={13} />}>
              {customFields.map(cf => (
                <ProfileRow key={cf.key} icon={<Sparkles size={14} />} label={cf.name} fieldKey={cf.key} data={result[cf.key]} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
              ))}
            </Card>
          )}

          {/* ── 5. PO-Specific Attributes ── */}
          {hasRawFields && (
            <Card title="PO-Specific Attributes" icon={<Zap size={13} className="text-yellow-400"/>}>
              <div className="flex flex-col">
                {Object.entries(deepAnalysis.raw_fields).map(([key, val], idx) => (
                   <div key={key} className={`flex gap-4 p-4 ${idx !== Object.keys(deepAnalysis.raw_fields).length - 1 ? 'border-b border-white/[0.04]' : ''} hover:bg-white/[0.02] transition-colors`}>
                      <div className="w-1/3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</div>
                      <div className="w-2/3 text-sm text-zinc-200">{String(val)}</div>
                   </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── 6. Line Items ── */}
          <Card title="Line Items" icon={<List size={13} />}>
            <div className="p-5">
              {(() => {
                const raw = result.line_items;
                const lineItemsArray = Array.isArray(raw) ? raw : (raw?.status === "found" && Array.isArray(raw.value) ? raw.value : []);
                return lineItemsArray.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <table className="w-full border-collapse text-sm text-zinc-100">
                    <thead>
                      <tr className="bg-white/[0.03] text-left">
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Description</th>
                        <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Qty</th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Unit Price</th>
                        <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Src</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItemsArray.map((item, idx) => (
                        <tr key={idx} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                          <td className="px-4 py-3 leading-relaxed text-sm">{item.description}</td>
                          <td className="px-4 py-3 text-center font-mono text-zinc-300 text-sm">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400 text-sm">{Number(item.unit_price || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => setActiveSource({ label: `Line Item ${idx + 1}`, quote: item.source_quote || "No quote found." })} className="w-[26px] h-[26px] rounded-md bg-white/[0.03] border border-white/[0.06] text-blue-400 inline-flex items-center justify-center">
                              <Hash size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                ) : <div className="text-zinc-500 italic text-sm py-8 text-center border border-dashed border-white/5 rounded-lg">No line items parsed.</div>;
              })()}
            </div>
          </Card>

          {/* ── 7. Detected Anomalies & Risks ── */}
          {hasAnomalies && (
            <Card title="Detected Anomalies & Risks" icon={<AlertTriangle size={13} className="text-red-400"/>} borderColor="border-red-500/30" headerBg="bg-red-500/10">
              <div className="p-4 flex flex-col gap-3">
                {deepAnalysis.anomalies.map((an, i) => (
                  <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-red-200 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1 text-red-400">{an.type}</div>
                      <div className="text-sm opacity-90">{an.description} <span className="opacity-75 text-xs ml-1">(Page {an.page})</span></div>
                    </div>
                    {an.page && (
                      <button
                        onClick={() => setActiveSource({ label: an.type, quote: an.source_clause || an.description, page: an.page })}
                        title="View Source"
                        className="p-1 rounded bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-blue-400 hover:border-blue-500/40 transition-colors shrink-0"
                      >
                        <Hash size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── 8. Contract Deadlines & Milestones ── */}
          {hasDeadlines && (
            <Card title="Contract Deadlines & Milestones" icon={<Calendar size={13} className="text-orange-400"/>}>
              <div className="p-4 flex flex-col gap-3">
                {deepAnalysis.deadlines.map((dl, i) => {
                  const isNull = !dl.computed_date || String(dl.computed_date).toLowerCase() === 'null';
                  const isEditing = triggerDates[i + "_edit"];
                  const showCalculator = isNull || isEditing;
                  const baseDateInput = triggerDates[i] || '';
                  const offset = showCalculator ? parseAnchor(dl.anchor_description) : null;
                  const calculatedResult = offset ? addTime(baseDateInput, offset) : null;

                  return (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-3">
                      
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-zinc-200 text-sm">{dl.label}</div>
                        
                        {!isNull && !isEditing ? (
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]">
                              {dl.computed_date}
                            </div>
                            <button 
                              onClick={() => setTriggerDates(prev => ({...prev, [i + "_edit"]: true}))}
                              className="p-1 text-zinc-500 hover:text-blue-400 transition-colors"
                              title="Edit Date"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {isEditing ? "Editing Trigger..." : "Awaiting Trigger"}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <span className="uppercase tracking-wider text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">
                          {dl.anchor_type}
                        </span>
                        {dl.anchor_description}
                        {dl.reasoning_chain?.length > 0 && (
                          <button
                            onClick={() => setActiveSource({
                              label: dl.label,
                              quote: dl.reasoning_chain.map(s => s.source_clause).filter(Boolean).join('\n')
                            })}
                            title="View Source"
                            className="ml-auto p-1 rounded bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                          >
                            <Hash size={11} />
                          </button>
                        )}
                      </div>

                      {/* Interactive Calculator UI */}
                      {showCalculator && (
                        <div className="mt-2 flex items-center gap-3 p-3 rounded-md bg-black/40 border border-white/[0.03]">
                          <div className="flex flex-col gap-1 w-[160px]">
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Trigger Date</label>
                            <input 
                              type="date" 
                              value={baseDateInput}
                              onChange={(e) => handleTriggerChange(i, e.target.value, dl.anchor_description)}
                              className="bg-[#1a1a1d] border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>

                          <ArrowRight size={14} className="text-zinc-600 mt-4" />

                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                              Calculated Offset {offset ? `(+${offset.amount} ${offset.unit}s)` : '(Manual)'}
                            </label>
                            <div className="flex items-center gap-2">
                              <div className={`px-3 py-1.5 rounded text-xs font-mono border ${calculatedResult ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                                {calculatedResult || 'YYYY-MM-DD'}
                              </div>
                              
                              {calculatedResult && (
                               <button 
                                  onClick={() => handleSaveDeadline(i, calculatedResult)}
                                  disabled={savingIdx === i}
                                  title="Save this calculated date"
                                  className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                >
                                  {savingIdx === i ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                </button>
                              )}
                              
                              {isEditing && (
                                <button 
                                  onClick={() => setTriggerDates(prev => ({...prev, [i + "_edit"]: false}))}
                                  title="Cancel Editing"
                                  className="p-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ExtractionView;