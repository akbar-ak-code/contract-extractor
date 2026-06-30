// src/components/AllPOsView.jsx
import React, { useState } from 'react';
import { FileText, Trash2, Search, Calendar, Hash, Building, AlertTriangle, CheckCircle, Clock, SortDesc } from 'lucide-react';
import { parseAiDate, getDaysLeft, getDeadlineColor } from '../utils/helpers.js';

const StatusPill = ({ daysLeft, hasDate }) => {
  if (!hasDate) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
        background: 'rgba(113,113,122,0.15)', color: '#71717a',
        padding: '2px 9px', borderRadius: 999, fontWeight: 500,
        boxShadow: 'inset 0 0 0 1px rgba(113,113,122,0.2)'
      }}>
        <Clock size={10} /> No expiry found
      </span>
    );
  }
  const color = getDeadlineColor(daysLeft);
  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 30;
  const bg = isExpired ? 'rgba(239,68,68,0.12)' : isUrgent ? 'rgba(251,146,60,0.12)' : 'rgba(52,211,153,0.12)';
  const shadow = isExpired ? 'inset 0 0 0 1px rgba(239,68,68,0.25)' : isUrgent ? 'inset 0 0 0 1px rgba(251,146,60,0.25)' : 'inset 0 0 0 1px rgba(52,211,153,0.25)';
  const Icon = isExpired ? AlertTriangle : isUrgent ? Clock : CheckCircle;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
      background: bg, color, padding: '2px 9px', borderRadius: 999,
      fontWeight: 600, boxShadow: shadow
    }}>
      <Icon size={10} />
      {isExpired ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
    </span>
  );
};

const AllPOsView = ({ history, onLoadPO, onDeletePO }) => {
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Enrich with parsed date info
  const enriched = history.map(po => {
    const parsedDate = parseAiDate(po.lapse_expiry_date, po.effective_date);
    const daysLeft = parsedDate ? getDaysLeft(parsedDate) : null;
    return { ...po, parsedDate, daysLeft, hasDate: parsedDate !== null };
  });

  // Sort: most recently uploaded first (descending id)
  const sorted = [...enriched].sort((a, b) => b.id - a.id);

  // Filter by search
  const filtered = sorted.filter(po => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (po.po_number || '').toLowerCase().includes(q) ||
      (po.vendor_name || '').toLowerCase().includes(q) ||
      (po.filename || '').toLowerCase().includes(q)
    );
  });

  const handleDeleteClick = (id, e) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const confirmDelete = (e) => {
    e.stopPropagation();
    // Build a fake event with stopPropagation for the existing handler
    onDeletePO(confirmDeleteId, { stopPropagation: () => {} });
    setConfirmDeleteId(null);
  };

  // Stats
  const totalCount = history.length;
  const expiredCount = enriched.filter(p => p.hasDate && p.daysLeft < 0).length;
  const urgentCount = enriched.filter(p => p.hasDate && p.daysLeft >= 0 && p.daysLeft <= 30).length;
  const unknownCount = enriched.filter(p => !p.hasDate).length;

  return (
    <div className="animate-in fade-in duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total POs', value: totalCount, color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
          { label: 'Expired', value: expiredCount, color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)' },
          { label: 'Urgent (≤30d)', value: urgentCount, color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.15)' },
          { label: 'No Expiry', value: unknownCount, color: '#71717a', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.15)' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888', pointerEvents: 'none', zIndex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by PO number, vendor, or filename…"
          className="glass-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            paddingLeft: '38px',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2
          }}>×</button>
        )}
      </div>

      {/* ── Table header ── */}
      <div className="glass-card" style={{
        overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 160px 160px 120px 64px',
          padding: '12px 18px', gap: 12,
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['', 'PO / Vendor', 'Effective Date', 'Expiry Date', 'Status', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888888' }}>{h}</div>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <FileText size={32} style={{ color: '#3f3f46', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: '#52525b', fontWeight: 500 }}>
              {search ? `No POs match "${search}"` : 'No purchase orders uploaded yet'}
            </div>
            {!search && <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 6 }}>Upload a PDF to get started</div>}
          </div>
        )}

        {/* Rows */}
        {filtered.map((po, idx) => {
          const isDeleting = confirmDeleteId === po.id;
          return (
            <div
              key={po.id}
              onClick={() => !isDeleting && onLoadPO(po.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 160px 160px 120px 64px',
                padding: '14px 18px', gap: 12, alignItems: 'center',
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: isDeleting ? 'default' : 'pointer',
                background: isDeleting ? 'rgba(239,68,68,0.08)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Index */}
              <div style={{ fontSize: 11, color: '#3f3f46', fontWeight: 600, fontFamily: 'monospace' }}>
                {String(idx + 1).padStart(2, '0')}
              </div>

              {/* PO + Vendor */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {po.po_number || <span style={{ color: '#52525b', fontStyle: 'italic' }}>No PO number</span>}
                </div>
                <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {po.vendor_name || po.filename}
                </div>
              </div>

              {/* Effective date */}
              <div style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>
                {po.effective_date || <span style={{ color: '#3f3f46' }}>—</span>}
              </div>

              {/* Expiry date */}
              <div style={{ fontSize: 12, color: po.hasDate ? '#a1a1aa' : '#3f3f46', fontFamily: 'monospace' }}>
                {po.lapse_expiry_date || '—'}
              </div>

              {/* Status pill */}
              <div>
                <StatusPill daysLeft={po.daysLeft} hasDate={po.hasDate} />
              </div>

              {/* Delete */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                {isDeleting ? (
                  <>
                    <button
                      onClick={confirmDelete}
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer' }}
                    >Yes</button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa', cursor: 'pointer' }}
                    >No</button>
                  </>
                ) : (
                  <button
                    onClick={e => handleDeleteClick(po.id, e)}
                    title="Delete"
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: '1px solid transparent', color: '#52525b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#52525b'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 11.5, color: '#3f3f46', textAlign: 'center' }}>
          Showing {filtered.length} of {totalCount} purchase orders · sorted by most recent upload
        </div>
      )}
    </div>
  );
};

export default AllPOsView;
