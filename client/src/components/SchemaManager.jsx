// src/components/SchemaManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, Check, X, RefreshCw, Sparkles,
  AlertTriangle, Tag, FileText, Info, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

// ── Colours / tokens ──────────────────────────────────────────────────────
const C = {
  bg:      'transparent',
  card:    'rgba(255,255,255,0.02)',
  border:  'rgba(255,255,255,0.08)',
  borderH: 'rgba(99,102,241,0.25)',
  text:    '#e4e4e7',
  muted:   '#888888',
  faint:   '#52525b',
  blue:    '#6366F1',
  blueB:   'rgba(99,102,241,0.1)',
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
    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888888' }}>
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={3}
        className="glass-input"
        style={{
          resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', width: '100%'
        }}
      />
    ) : (
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="glass-input"
        style={{
          boxSizing: 'border-box', width: '100%'
        }}
      />
    )}
    {hint && <p style={{ margin: 0, fontSize: 11, color: '#52525b', lineHeight: 1.5 }}>{hint}</p>}
  </div>
);

// ── Toast notification ────────────────────────────────────────────────────
const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const icon = type === 'error' ? '❌' : '✅';
  return (
    <div className="glass-panel animate-in fade-in slide-in-from-bottom duration-300" style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      borderRadius: 12,
      padding: '12px 20px', color: '#ffffff', fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
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
    <div className="glass-card" style={{
      overflow: 'hidden',
      borderColor: editing ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)',
      boxShadow: editing ? '0 0 0 3px rgba(99, 102, 241, 0.08)' : 'none',
    }}>
      {/* Card header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          background: C.blueB, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.2)',
        }}>
          <Tag size={14} color={C.blue} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)}
              className="glass-input"
              style={{ padding: '4px 8px', fontSize: 14, outline: 'none', fontWeight: 600, width: '100%', boxSizing: 'border-box', minHeight: 'unset' }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.name}</div>
          )}
          <div style={{ fontSize: 11, color: C.faint, fontFamily: 'monospace', marginTop: 2 }}>{field.key}</div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} title="Save"
                style={{ width: 30, height: 30, borderRadius: 7, background: C.greenB, border: `1px solid rgba(52,211,153,0.3)`, color: C.green, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
              </button>
              <button onClick={handleCancel} title="Cancel"
                style={{ width: 30, height: 30, borderRadius: 7, background: C.redB, border: `1px solid rgba(239,68,68,0.3)`, color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}
                style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button onClick={() => { setEditing(true); setExpanded(true); }} title="Edit"
                style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.blueB; e.currentTarget.style.color = C.blue; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = C.muted; }}>
                <Edit2 size={13} />
              </button>
              {confirmDel ? (
                <>
                  <button onClick={() => onDelete(field.key)}
                    style={{ padding: '0 10px', height: 30, borderRadius: 7, background: C.redB, border: `1px solid rgba(239,68,68,0.4)`, color: C.red, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Delete</button>
                  <button onClick={() => setConfirmDel(false)}
                    style={{ padding: '0 10px', height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(true)} title="Delete"
                  style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.redB; e.currentTarget.style.color = C.red; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = C.muted; }}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded / edit body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          {editing && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={rerun} onChange={e => setRerun(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.blue, width: 14, height: 14, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                <span style={{ color: C.text, fontWeight: 500 }}>Re-run extraction</span> across all {poCount} stored POs using the updated description
                <span style={{ display: 'block', fontSize: 11, color: C.faint, marginTop: 2 }}>
                  This calls Gemini once per PO and may take a moment.
                </span>
              </span>
            </label>
          )}
          {!editing && (
            <div style={{ fontSize: 11.5, color: C.faint }}>
              Created {new Date(field.created_at).toLocaleDateString()} · Active on all POs
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Add field form ────────────────────────────────────────────────────────
const AddFieldForm = ({ onAdd, onCancel }) => {
  const [name,    setName]    = useState('');
  const [key,     setKey]     = useState('');
  const [desc,    setDesc]    = useState('');
  const [example, setExample] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [keyManual, setKeyManual] = useState(false);

  // Auto-derive key from name unless manually overridden
  const handleNameChange = (v) => {
    setName(v);
    if (!keyManual) {
      setKey(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !key.trim() || !desc.trim()) return;
    setSaving(true);
    await onAdd({ name, key, description: desc, example });
    setSaving(false);
  };

  return (
    <div className="glass-card" style={{ border: `1px solid rgba(99,102,241,0.35)`, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 0 0 4px rgba(99,102,241,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: C.blueB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={14} color={C.blue} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>New Custom Field</span>
      </div>

      <Field label="Field Name" value={name} onChange={handleNameChange} placeholder="e.g. Warranty Period" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted }}>
          Field Key <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(auto-generated, must be unique)</span>
        </label>
        <input value={key}
          onChange={e => { setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setKeyManual(true); }}
          placeholder="warranty_period"
          className="glass-input"
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
        <button onClick={onCancel} className="glass-btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={!valid || saving}
          className={valid ? "glass-btn-primary" : ""}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: 6, fontSize: 18, fontWeight: 700, color: C.text }}>Schema Management</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 520 }}>
            Extend the extraction schema with custom fields. Gemini will extract them from every PO automatically — no code changes needed.
          </p>
        </div>
        <button onClick={() => setShowAdd(s => !s)}
          className={showAdd ? "glass-btn-secondary" : "glass-btn-primary"}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Layers size={14} color={C.faint} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.faint }}>
            Built-in Fields ({BUILT_IN.length})
          </span>
          <span style={{ fontSize: 11, color: C.faint }}>— protected, cannot be deleted</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {BUILT_IN.map(f => (
            <div key={f.key} className="glass-card" style={{
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              borderRadius: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.faint, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.muted }}>{f.name}</div>
                <div style={{ fontSize: 10, color: C.faint, fontFamily: 'monospace', marginTop: 1 }}>{f.key}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom fields */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Tag size={14} color={C.blue} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.blue }}>
            Custom Fields ({customFields.length})
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.faint, fontSize: 13 }}>Loading schema…</div>
        )}

        {!loading && customFields.length === 0 && !showAdd && (
          <div style={{ borderRadius: 12, border: `2px dashed ${C.border}`, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blueB, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color={C.blue} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginBottom: 6 }}>No custom fields yet</div>
            <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>
              Add a field above — Gemini will extract it<br />from all your existing and future POs automatically.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {customFields.map(f => (
            <CustomFieldCard
              key={f.key} field={f}
              poCount={poCount}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
};

export default SchemaManager;
