// src/components/SchemaManager.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit2, Check, X, RefreshCw, Sparkles,
  AlertTriangle, Tag, Info, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

// ── Colours / tokens ──────────────────────────────────────────────────────
const C = {
  bg:      'transparent',
  card:    'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.1)',
  borderH: 'rgba(123,97,255,0.25)',
  text:    '#ffffff',
  muted:   'rgba(255,255,255,0.65)',
  faint:   'rgba(255,255,255,0.4)',
  blue:    '#4F8CFF',
  blueB:   'rgba(79,140,255,0.1)',
  green:   '#10b981',
  greenB:  'rgba(16,185,129,0.1)',
  red:     '#ef4444',
  redB:    'rgba(239,68,68,0.1)',
  orange:  '#f59e0b',
};

const BUILT_IN = [
  { key: 'po_number',              name: 'PO Number' },
  { key: 'vendor_name',            name: 'Vendor Name' },
  { key: 'vendor_contact_address', name: 'Contact & Address' },
  { key: 'effective_date',         name: 'Effective Date' },
  { key: 'lapse_expiry_date',      name: 'Lapse / Expiry' },
  { key: 'total_value',            name: 'Total Value' },
  { key: 'conditions_of_agreement',name: 'Conditions of Agreement' },
  { key: 'conditions_of_payment',  name: 'Payment Conditions' },
  { key: 'authorising_signatory',  name: 'Authorising Signatory' },
  { key: 'line_items',             name: 'Line Items' },
];

// ── Small reusable input ──────────────────────────────────────────────────
const Field = ({ label, value, onChange, placeholder, multiline, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}>
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={3}
        className="mac-glass-input"
        style={{
          resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', width: '100%',
          padding: '10px 14px', fontSize: 13.5
        }}
      />
    ) : (
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mac-glass-input"
        style={{
          boxSizing: 'border-box', width: '100%', padding: '10px 14px', fontSize: 13.5
        }}
      />
    )}
    {hint && <p style={{ margin: 0, fontSize: 11, color: C.faint, lineHeight: 1.5 }}>{hint}</p>}
  </div>
);

// ── Toast notification ────────────────────────────────────────────────────
const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const icon = type === 'error' ? '❌' : '✅';
  return (
    <div className="mac-glass-panel animate-in fade-in slide-in-from-bottom duration-300" style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      borderRadius: 16,
      padding: '12px 20px', color: '#ffffff', fontSize: 13.5, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
      border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
    }}>
      <span>{icon}</span>
      <span>{msg}</span>
    </div>
  );
};

// ── Custom field card (view + inline edit) ────────────────────────────────
const CustomFieldCard = ({ field, onDelete, onUpdate, poCount }) => {
  const [editing, setEditing]     = useState(false);
  const [name, setName]           = useState(field.name);
  const [desc, setDesc]           = useState(field.description);
  const [example, setExample]     = useState(field.example || '');
  const [rerun, setRerun]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [expanded, setExpanded]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(field.key, { name, description: desc, example, rerun });
    setSaving(false);
    setEditing(false);
    setRerun(false);
  };

  const handleCancel = () => {
    setName(field.name); setDesc(field.description); setExample(field.example || '');
    setRerun(false); setEditing(false);
  };

  return (
    <motion.div
      layout
      className="mac-glass-card"
      style={{
        overflow: 'hidden',
        border: `1px solid ${editing ? 'rgba(123, 97, 255, 0.45)' : C.border}`,
        boxShadow: editing ? '0 0 0 4px rgba(123, 97, 255, 0.08)' : '0 10px 30px rgba(0, 0, 0, 0.15)',
        borderRadius: 20
      }}
    >
      {/* Card header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(123,97,255,0.15) 0%, rgba(79,140,255,0.15) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(123,97,255,0.25)'
        }}>
          <Tag size={14} color="#7B61FF" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)}
              className="mac-glass-input"
              style={{ padding: '6px 10px', fontSize: 13.5, fontWeight: 700, width: '100%', boxSizing: 'border-box', minHeight: 'unset' }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.name}</div>
          )}
          <div style={{ fontSize: 11, color: C.faint, fontFamily: 'monospace', marginTop: 2 }}>{field.key}</div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} title="Save" className="mac-btn-primary"
                style={{ width: 30, height: 30, padding: 0, borderRadius: 8, background: C.greenB, border: `1px solid rgba(16,185,129,0.3)`, color: C.green }}>
                {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
              </button>
              <button onClick={handleCancel} title="Cancel" className="mac-btn-secondary"
                style={{ width: 30, height: 30, padding: 0, borderRadius: 8, color: C.red, borderColor: 'rgba(239,68,68,0.2)' }}>
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'} className="mac-btn-secondary"
                style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button onClick={() => { setEditing(true); setExpanded(true); }} title="Edit" className="mac-btn-secondary"
                style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,97,255,0.4)'; e.currentTarget.style.color = '#7B61FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}>
                <Edit2 size={13} />
              </button>
              {confirmDel ? (
                <>
                  <button onClick={() => onDelete(field.key)} className="mac-btn-danger"
                    style={{ padding: '0 12px', height: 30, borderRadius: 8, fontSize: 11, fontWeight: 700 }}>Delete</button>
                  <button onClick={() => setConfirmDel(false)} className="mac-btn-secondary"
                    style={{ padding: '0 12px', height: 30, borderRadius: 8, fontSize: 11 }}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(true)} title="Delete" className="mac-btn-secondary"
                  style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = C.red; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded / edit body */}
      {expanded && (
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.06)`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Extraction Description / Prompt"
            value={desc} onChange={setDesc} multiline
            placeholder="Describe what this field contains so Gemini knows what to find…"
            hint="Gemini uses this as its extraction instruction."
          />
          <Field label="Example (optional)"
            value={example} onChange={setExample}
            placeholder="e.g. '24 months from date of completion'"
            hint="Helps Gemini understand the expected format."
          />

          {editing && poCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)', marginTop: 4
            }}>
              <input type="checkbox" id="rerun-chk" checked={rerun} onChange={e => setRerun(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#7B61FF' }} />
              <label htmlFor="rerun-chk" style={{ fontSize: 12, color: C.orange, fontWeight: 600, cursor: 'pointer' }}>
                Re-run extraction immediately on all uploaded POs ({poCount})
              </label>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ── Add field form card ───────────────────────────────────────────────────
const AddFieldForm = ({ onAdd, onCancel }) => {
  const [name, setName]       = useState('');
  const [key, setKey]         = useState('');
  const [desc, setDesc]       = useState('');
  const [example, setExample] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [saving, setSaving]   = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    if (!keyManual) {
      const autoKey = val.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      setKey(autoKey);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !key.trim() || !desc.trim()) return;
    setSaving(true);
    await onAdd({ name, key, description: desc, example });
    setSaving(false);
  };

  const valid = name.trim() && key.trim() && desc.trim();

  return (
    <div className="mac-glass-card animate-in fade-in duration-300" style={{ border: `1px solid rgba(123,97,255,0.35)`, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 0 0 4px rgba(123,97,255,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, rgba(123,97,255,0.15) 0%, rgba(79,140,255,0.15) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(123,97,255,0.25)' }}>
          <Plus size={14} color="#7B61FF" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>New Custom Field</span>
      </div>

      <Field label="Field Name" value={name} onChange={handleNameChange} placeholder="e.g. Warranty Period" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}>
          Field Key <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(auto-generated, must be unique)</span>
        </label>
        <input value={key}
          onChange={e => { setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setKeyManual(true); }}
          placeholder="warranty_period"
          className="mac-glass-input"
          style={{ fontFamily: 'monospace', boxSizing: 'border-box', width: '100%', color: '#a78bfa', minHeight: 'unset', padding: '8px 12px' }}
        />
      </div>

      <Field label="Extraction Description" value={desc} onChange={setDesc} multiline
        placeholder="What text should Gemini look for? e.g. 'The warranty or defect liability period duration'"
        hint="This is passed directly to Gemini as the extraction prompt — be specific."
      />

      <Field label="Example (optional)" value={example} onChange={setExample}
        placeholder="e.g. '24 months from date of commissioning'"
        hint="An example value helps Gemini understand the expected format."
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="mac-btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!valid || saving}
          className={valid ? "mac-btn-primary" : ""}
          style={{
            padding: '8px 22px', fontSize: 13, fontWeight: 600, cursor: valid && !saving ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
          {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
          {saving ? 'Extracting from all POs…' : 'Add & Extract'}
        </button>
      </div>
    </div>
  );
};

// ── Main SchemaManager ────────────────────────────────────────────────────
const SchemaManager = ({ poCount }) => {
  const [customFields, setCustomFields] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [toast,        setToast]        = useState({ msg: '', type: 'success' });

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  };

  const fetchSchema = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/schema');
      if (res.ok) setCustomFields(await res.json());
    } catch (e) { notify('Failed to load schema', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSchema(); }, []);

  const handleAdd = async (payload) => {
    try {
      const res = await fetch('http://localhost:8000/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.detail || 'Failed to add field', 'error'); return; }
      notify(`"${payload.name}" added and extracted from ${data.backfilled} PO(s)`);
      setShowAdd(false);
      fetchSchema();
    } catch (e) { notify('Network error', 'error'); }
  };

  const handleUpdate = async (key, payload) => {
    try {
      const res = await fetch(`http://localhost:8000/api/schema/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.detail || 'Failed to update', 'error'); return; }
      notify(payload.rerun
        ? `Updated & re-extracted from ${data.rerun_count} PO(s)`
        : 'Field updated');
      fetchSchema();
    } catch (e) { notify('Network error', 'error'); }
  };

  const handleDelete = async (key) => {
    try {
      const res = await fetch(`http://localhost:8000/api/schema/${key}`, { method: 'DELETE' });
      if (!res.ok) { notify('Failed to delete', 'error'); return; }
      notify('Field deleted');
      fetchSchema();
    } catch (e) { notify('Network error', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, flex: 1 }}>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: 6, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Schema Management</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 520 }}>
            Extend the extraction schema with custom fields. Gemini will extract them from every PO automatically — no code changes needed.
          </p>
        </div>
        <button onClick={() => setShowAdd(s => !s)}
          className={showAdd ? "mac-btn-secondary" : "mac-btn-primary"}
          style={{
            flexShrink: 0, padding: '9px 18px', fontSize: 13, fontWeight: 600,
          }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Custom Field'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && <AddFieldForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}

      {/* Built-in fields (read-only) */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Layers size={14} color={C.faint} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.faint }}>
            Built-in Fields ({BUILT_IN.length})
          </span>
          <span style={{ fontSize: 11, color: C.faint }}>— protected, cannot be deleted</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {BUILT_IN.map(f => (
            <div key={f.key} className="mac-glass-card" style={{
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              borderRadius: 12,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.faint, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>{f.name}</div>
                <div style={{ fontSize: 10, color: C.faint, fontFamily: 'monospace', marginTop: 1 }}>{f.key}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom fields */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Tag size={14} color="#7B61FF" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7B61FF' }}>
            Custom Fields ({customFields.length})
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.faint, fontSize: 13.5 }}>Loading schema…</div>
        )}

        {!loading && customFields.length === 0 && !showAdd && (
          <div className="mac-glass-card" style={{ padding: '40px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blueB, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color={C.blue} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, marginBottom: 6 }}>No custom fields yet</div>
            <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>
              Add a field above — Gemini will extract it<br />from all your existing and future POs automatically.
            </div>
          </div>
        )}

        <motion.div layout style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {customFields.map(f => (
            <CustomFieldCard
              key={f.key} field={f}
              poCount={poCount}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </motion.div>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
};

export default SchemaManager;
