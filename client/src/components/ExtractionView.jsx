// src/components/ExtractionView.jsx
import React, { useState } from 'react';
import { UploadCloud, Hash, Building, MapPin, Clock, AlertTriangle, DollarSign, Shield, List, Edit3, FileText, Sparkles, Check, X, Edit2, History, ChevronDown, ChevronUp } from 'lucide-react';

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
      {/* 1. Icon + Label — fixed width, never wraps awkwardly */}
      <div style={{ flexShrink: 0, width: 156, display: 'flex', alignItems: 'flex-start', gap: 9, paddingTop: 1 }}>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 7,
          background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
          boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa', lineHeight: 1.4, paddingTop: 6 }}>{label}</span>
      </div>

      {/* 2. Value — grows to fill space, wraps naturally */}
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

      {/* 3. Buttons — fixed width, never squish */}
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
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#71717a'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => setActiveSource({ label, quote })} title="View Source"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#71717a'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; }}>
              <Hash size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Date fields: same as ProfileRow but with an extra calendar picker when editing ──
const DateProfileRow = ({ icon, label, fieldKey, data, dbId, onUpdate, setActiveSource }) => {
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

  // Convert whatever string the AI extracted into YYYY-MM-DD for the date input's value.
  // If it can't be parsed we just leave the picker blank — the textarea still works.
  const toInputDate = (str) => {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d)) return "";
    return d.toISOString().split("T")[0];
  };

  // When the user picks from the calendar, format it as DD/MM/YYYY and push into the textarea.
  const handleCalendarChange = (e) => {
    const raw = e.target.value; // "YYYY-MM-DD"
    if (!raw) return;
    const [y, m, d] = raw.split("-");
    setTempVal(`${d}/${m}/${y}`);
  };

  return (
    <div
      className="group border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.02]"
      style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 20px', gap: 0 }}
    >
      {/* Icon + Label */}
      <div style={{ flexShrink: 0, width: 156, display: 'flex', alignItems: 'flex-start', gap: 9, paddingTop: 1 }}>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 7,
          background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
          boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#a1a1aa', lineHeight: 1.4, paddingTop: 6 }}>{label}</span>
      </div>

      {/* Value / edit area */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 12, paddingTop: 2 }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Manual text input — unchanged behaviour */}
            <textarea
              value={tempVal}
              onChange={e => setTempVal(e.target.value)}
              autoFocus
              placeholder="Type a date manually…"
              style={{
                width: '100%', minHeight: 40, background: '#242424',
                border: '1px solid rgba(59,130,246,0.5)', borderRadius: 6,
                padding: '7px 11px', fontSize: 13, color: '#fff',
                outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box'
              }}
            />
            {/* Calendar picker row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap' }}>Or pick:</span>
              <input
                type="date"
                value={toInputDate(tempVal)}
                onChange={handleCalendarChange}
                style={{
                  background: '#242424', border: '1px solid rgba(59,130,246,0.35)',
                  borderRadius: 6, padding: '4px 9px', fontSize: 12, color: '#a1a1aa',
                  outline: 'none', cursor: 'pointer', colorScheme: 'dark'
                }}
              />
            </div>
          </div>
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

      {/* Save / Cancel / Edit / Source buttons — identical to ProfileRow */}
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
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#71717a'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => setActiveSource({ label, quote })} title="View Source"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.12)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#71717a'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; }}>
              <Hash size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Card = ({ title, icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#1a1a1d] to-[#141416] shadow-2xl shadow-black/40 backdrop-blur-xl">
    <header className="flex items-center gap-2.5 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
        {icon}
      </span>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</h2>
    </header>
    <div>{children}</div>
  </section>
);

const ExtractionView = ({ file, loading, error, result, fileInputRef, handleFileSelection, handleAnalyze, setActiveSource, dbId, onUpdate, customFields = [] }) => (
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
              <div className="h-8 w-8 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
              <p className="text-sm font-medium tracking-tight">Processing via Gemini Flash...</p>
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
      <div className="flex flex-col gap-5">
        <Card title="Document Headers" icon={<FileText size={13} />}>
          <ProfileRow icon={<Hash size={14} />}        label="PO Number"         fieldKey="po_number"               data={result.po_number}               dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<Building size={14} />}    label="Vendor Name"       fieldKey="vendor_name"             data={result.vendor_name}             dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<MapPin size={14} />}      label="Contact & Address" fieldKey="vendor_contact_address"  data={result.vendor_contact_address}  dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <DateProfileRow icon={<Clock size={14} />}       label="Effective Date"    fieldKey="effective_date"          data={result.effective_date}          dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <DateProfileRow icon={<AlertTriangle size={14}/>}label="Lapse / Expiry"   fieldKey="lapse_expiry_date"       data={result.lapse_expiry_date}       dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={14} />}  label="Total Value"       fieldKey="total_value"             data={result.total_value}             dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Terms & Conditions" icon={<Shield size={13} />}>
          <ProfileRow icon={<Shield size={14} />}      label="Conditions"        fieldKey="conditions_of_agreement" data={result.conditions_of_agreement} dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={14} />}  label="Payment Terms"     fieldKey="conditions_of_payment"   data={result.conditions_of_payment}   dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Signatures" icon={<Edit3 size={13} />}>
          <ProfileRow icon={<Edit3 size={14} />}       label="Signatory"         fieldKey="authorising_signatory"   data={result.authorising_signatory}   dbId={dbId} onUpdate={onUpdate} setActiveSource={setActiveSource} />
        </Card>

        {/* ── Dynamic Custom Fields ── */}
        {customFields && customFields.length > 0 && (
          <Card title="Custom Fields" icon={<Sparkles size={13} />}>
            {customFields.map(cf => (
              <ProfileRow
                key={cf.key}
                icon={<Sparkles size={14} />}
                label={cf.name}
                fieldKey={cf.key}
                data={result[cf.key]}
                dbId={dbId}
                onUpdate={onUpdate}
                setActiveSource={setActiveSource}
              />
            ))}
          </Card>
        )}

        <Card title="Line Items" icon={<List size={13} />}>
          <div className="p-5">
            {(() => {
              // Groq returns line_items as a flat array; Gemini wraps it in { status, value }.
              // Normalise both shapes into a single array so the table always renders.
              const raw = result.line_items;
              const lineItemsArray = Array.isArray(raw)
                ? raw
                : (raw?.status === "found" && Array.isArray(raw.value) ? raw.value : []);
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
                          <button
                            onClick={() => setActiveSource({ label: `Line Item ${idx + 1}`, quote: item.source_quote || "No quote found." })}
                            style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Hash size={11} />
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
              );
            })()}
          </div>
        </Card>
      </div>
    )}
  </div>
);

export default ExtractionView;
