// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { Clock, Plus, Trash2, ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react';
import { parseAiDate, getDaysLeft, getDeadlineColor } from '../utils/helpers.js';

// Individual card with its own hover state for trash visibility
const DeadlineCard = ({ po, onLoadPO, onDeletePO }) => {
  const [hovered, setHovered] = useState(false);
  const color = getDeadlineColor(po.daysLeft);

  return (
    <div
      onClick={() => onLoadPO(po.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '11px 10px 11px 16px', borderRadius: 10,
        background: hovered ? '#252525' : '#1c1c1c',
        border: `1px solid ${hovered ? '#444' : '#2a2a2a'}`,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Left color accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: color, borderRadius: '10px 0 0 10px',
      }} />

      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {po.po_number || po.filename}
        </div>
        <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color }}>
          {po.daysLeft < 0
            ? `Expired ${Math.abs(po.daysLeft)} days ago`
            : `Expires in ${po.daysLeft} days`}
        </div>
      </div>

      <button
        onClick={e => onDeletePO(po.id, e)}
        title="Delete"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, borderRadius: 6, flexShrink: 0,
          opacity: hovered ? 1 : 0,
          color: '#71717a', transition: 'opacity 0.15s, color 0.15s, background 0.15s',
          display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = 'none'; }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const Sidebar = ({ history, onNewUpload, onLoadPO, onDeletePO }) => {
  const [collapsed, setCollapsed] = useState(false);

  const upcomingDeadlines = history
    .map(po => {
      const parsedDate = parseAiDate(po.lapse_expiry_date, po.effective_date);
      if (!parsedDate) return null;
      const daysLeft = getDaysLeft(parsedDate);
      return { ...po, parsedDate, daysLeft };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Urgent = expired OR ≤30 days left
  const urgentCount = upcomingDeadlines.filter(po => po.daysLeft <= 30).length;

  // ── COLLAPSED: slim icon strip ──────────────────────────────────────────
  if (collapsed) {
    return (
      <aside style={{
        width: 56, flexShrink: 0, height: '100%',
        background: '#141414', borderRight: '1px solid #2a2a2a',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, gap: 10, overflow: 'hidden',
      }}>
        {/* Expand */}
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'rgba(92,156,230,0.1)', border: '1px solid rgba(92,156,230,0.2)',
            color: '#5c9ce6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <ChevronRight size={15} />
        </button>

        {/* Clock + urgent badge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'rgba(92,156,230,0.07)', border: '1px solid rgba(92,156,230,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5c9ce6',
          }}>
            <Clock size={15} />
          </div>
          {urgentCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 15, height: 15, borderRadius: 8,
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 700, lineHeight: '15px',
              textAlign: 'center', padding: '0 3px',
              boxShadow: '0 0 0 2px #141414',
            }}>
              {urgentCount > 9 ? '9+' : urgentCount}
            </span>
          )}
        </div>

        {/* New PO (icon only) */}
        <button
          onClick={onNewUpload}
          title="New PO Upload"
          style={{
            width: 34, height: 34, borderRadius: 9, background: '#5c9ce6',
            border: 'none', color: '#121212', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>

        {/* Dot indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', overflowY: 'auto', flex: 1, paddingBottom: 12 }}>
          {upcomingDeadlines.slice(0, 14).map(po => (
            <button
              key={po.id}
              onClick={() => onLoadPO(po.id)}
              title={`${po.po_number || po.filename} · ${po.daysLeft < 0 ? `Expired ${Math.abs(po.daysLeft)}d ago` : `${po.daysLeft}d left`}`}
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: getDeadlineColor(po.daysLeft),
                border: 'none', cursor: 'pointer', padding: 0,
                boxShadow: `0 0 6px ${getDeadlineColor(po.daysLeft)}70`,
              }}
            />
          ))}
        </div>
      </aside>
    );
  }

  // ── EXPANDED ────────────────────────────────────────────────────────────
  return (
    <aside style={{
      width: 280, flexShrink: 0, height: '100%',
      background: '#141414', borderRight: '1px solid #2a2a2a',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Top section (non-scrolling) */}
      <div style={{ padding: '18px 14px 14px', flexShrink: 0 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Clock size={16} color="#5c9ce6" />
            Upcoming Expiries
            {urgentCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: '#ef4444', color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {urgentCount > 99 ? '99+' : urgentCount}
              </span>
            )}
          </h2>

          <button
            onClick={() => setCollapsed(true)}
            title="Collapse"
            style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              color: '#71717a', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(92,156,230,0.12)'; e.currentTarget.style.color = '#5c9ce6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#71717a'; }}
          >
            <ChevronLeft size={13} />
          </button>
        </div>

        {/* New PO button */}
        <button
          onClick={onNewUpload}
          style={{
            width: '100%', padding: '9px 14px',
            background: '#5c9ce6', color: '#121212',
            fontWeight: 700, fontSize: 13, borderRadius: 10, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 0 16px rgba(92,156,230,0.18)', transition: 'background 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4b8bcf'; e.currentTarget.style.boxShadow = '0 0 22px rgba(92,156,230,0.32)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#5c9ce6'; e.currentTarget.style.boxShadow = '0 0 16px rgba(92,156,230,0.18)'; }}
        >
          <Plus size={15} strokeWidth={2.5} /> New PO Upload
        </button>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px' }}>

        {/* Empty state */}
        {upcomingDeadlines.length === 0 && (
          <div style={{ padding: '36px 12px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, margin: '0 auto 12px',
              background: 'rgba(92,156,230,0.07)', border: '1px solid rgba(92,156,230,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UploadCloud size={20} color="#5c9ce6" />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#52525b', lineHeight: 1.5 }}>
              No expiry dates detected
            </div>
            <div style={{ fontSize: 11, color: '#3f3f46', marginTop: 5, lineHeight: 1.7 }}>
              Upload a PO, or manually<br />edit the Lapse / Expiry field
            </div>
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {upcomingDeadlines.map(po => (
            <DeadlineCard key={po.id} po={po} onLoadPO={onLoadPO} onDeletePO={onDeletePO} />
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
