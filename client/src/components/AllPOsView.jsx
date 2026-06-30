// src/components/AllPOsView.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Trash2, Search, Calendar, Hash, Building, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { parseAiDate, getDaysLeft, getDeadlineColor } from '../utils/helpers.js';

const StatusPill = ({ daysLeft, hasDate }) => {
  if (!hasDate) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5,
        background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)',
        padding: '3px 10px', borderRadius: '99px', fontWeight: 600,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
      }}>
        <Clock size={10} /> No expiry found
      </span>
    );
  }
  
  const color = getDeadlineColor(daysLeft);
  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 30;
  const bg = isExpired ? 'rgba(239,68,68,0.1)' : isUrgent ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
  const border = isExpired ? 'rgba(239,68,68,0.2)' : isUrgent ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)';
  const Icon = isExpired ? AlertTriangle : isUrgent ? Clock : CheckCircle;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5,
      background: bg, color, padding: '3px 10px', borderRadius: '99px',
      fontWeight: 700, border: `1px solid ${border}`,
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
    }}>
      <Icon size={10} />
      {isExpired ? `Expired ${Math.abs(daysLeft)}d` : `${daysLeft}d left`}
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
    onDeletePO(confirmDeleteId, { stopPropagation: () => {} });
    setConfirmDeleteId(null);
  };

  // Stats
  const totalCount = history.length;
  const expiredCount = enriched.filter(p => p.hasDate && p.daysLeft < 0).length;
  const urgentCount = enriched.filter(p => p.hasDate && p.daysLeft >= 0 && p.daysLeft <= 30).length;
  const unknownCount = enriched.filter(p => !p.hasDate).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Total POs', value: totalCount, color: '#7B61FF' },
          { label: 'Expired', value: expiredCount, color: '#EF4444' },
          { label: 'Urgent (≤30d)', value: urgentCount, color: '#F59E0B' },
          { label: 'No Expiry', value: unknownCount, color: 'rgba(255, 255, 255, 0.45)' },
        ].map(s => (
          <div key={s.label} className="mac-glass-card" style={{
            padding: '14px 18px',
            borderLeft: `3px solid ${s.color}`,
            borderRadius: 16
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1, fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search filter input */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)', pointerEvents: 'none', zIndex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter contracts by PO number, vendor name, or filename..."
          className="mac-glass-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            paddingLeft: '38px',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 2
          }}>×</button>
        )}
      </div>

      {/* Glass Table list wrapper */}
      <div className="mac-glass-card" style={{
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
      }}>
        {/* Column Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1.5fr 1.2fr 1.2fr 1.2fr 80px',
          padding: '14px 20px', gap: 16,
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          {['', 'PO / Vendor', 'Effective Date', 'Expiry Date', 'Status', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.45)' }}>{h}</div>
          ))}
        </div>

        {/* Empty state list */}
        {filtered.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <FileText size={32} style={{ color: 'rgba(255, 255, 255, 0.2)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
              {search ? `No POs match "${search}"` : 'No purchase orders uploaded yet'}
            </div>
            {!search && <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.3)', marginTop: 6 }}>Upload a contract PDF to populate the workspace</div>}
          </div>
        )}

        {/* Table rows list container */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((po, idx) => {
            const isDeleting = confirmDeleteId === po.id;
            return (
              <motion.div
                key={po.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                onClick={() => !isDeleting && onLoadPO(po.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1.5fr 1.2fr 1.2fr 1.2fr 80px',
                  padding: '14px 20px', gap: 16, alignItems: 'center',
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                  cursor: isDeleting ? 'default' : 'pointer',
                  background: isDeleting ? 'rgba(239,68,68,0.06)' : 'transparent',
                  transition: 'background 0.25s ease',
                }}
                onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Index */}
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.25)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* PO Number / Vendor */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {po.po_number || <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>No PO number</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {po.vendor_name || po.filename}
                  </div>
                </div>

                {/* Effective date */}
                <div style={{ fontSize: 12.5, color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'monospace' }}>
                  {po.effective_date || <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>—</span>}
                </div>

                {/* Expiry date */}
                <div style={{ fontSize: 12.5, color: po.hasDate ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)', fontFamily: 'monospace' }}>
                  {po.lapse_expiry_date || '—'}
                </div>

                {/* Status indicator */}
                <div>
                  <StatusPill daysLeft={po.daysLeft} hasDate={po.hasDate} />
                </div>

                {/* Delete trigger */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  {isDeleting ? (
                    <>
                      <button
                        onClick={confirmDelete}
                        className="mac-btn-danger"
                        style={{ padding: '3px 10px', fontSize: 11, borderRadius: 8 }}
                      >Yes</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="mac-btn-secondary"
                        style={{ padding: '3px 10px', fontSize: 11, borderRadius: 8 }}
                      >No</button>
                    </>
                  ) : (
                    <button
                      onClick={e => handleDeleteClick(po.id, e)}
                      title="Delete"
                      style={{ width: 28, height: 28, borderRadius: 8, background: 'none', border: '1px solid transparent', color: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center', marginTop: 4 }}>
          Showing {filtered.length} of {totalCount} contracts · Sorted by most recent upload
        </div>
      )}
    </div>
  );
};

export default AllPOsView;