// src/components/CalendarView.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import { parseAiDate, getDaysLeft, getDeadlineColor } from '../utils/helpers.js';

// ── FEATURE 2: WEEK VIEW & MONTH VIEW UI FIXES ─────────────────────────────
// Yahan humne Week view ki lines ko soft kiya hai aur borders hataye hain
const CALENDAR_CUSTOM_CSS = `
  /* Month View Fixes */
  .rbc-month-view { min-height: 600px; border: none !important; }
  .rbc-month-row { overflow: visible; min-height: 90px; }
  .rbc-row-content { overflow: visible; }
  .rbc-event { overflow: visible; }

  /* Week View Premium Fixes */
  .rbc-time-view {
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    border-radius: 12px !important;
    background: rgba(18, 18, 20, 0.4) !important;
  }
  .rbc-time-header-content {
    border-left: 1px solid rgba(255,255,255,0.05) !important;
  }
  .rbc-time-content {
    border-top: 1px solid rgba(255,255,255,0.08) !important;
  }
  .rbc-timeslot-group {
    border-bottom: 1px solid rgba(255,255,255,0.03) !important;
  }
  .rbc-day-slot .rbc-time-slot {
    border-top: 1px dashed rgba(255,255,255,0.02) !important;
  }
  .rbc-time-column .rbc-timeslot-group {
    border-right: 1px solid rgba(255,255,255,0.03) !important;
  }
  /* Current Time Line Indicator */
  .rbc-current-time-indicator {
    background-color: #ef4444 !important;
    height: 2px !important;
    box-shadow: 0 0 4px rgba(239, 68, 68, 0.8);
  }
  /* Make events look like floating pills in week view */
  .rbc-time-view .rbc-event {
    border-radius: 6px !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important;
  }
`;

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ── FEATURE 1: CATEGORY COLOR CODING ───────────────────────────────────────
// Red, Amber, aur Green ko strict exclude kiya gaya hai taaki wo Expiry ke saath clash na karein.
const SOURCE_COLORS = {
  lapse_expiry_date: null,   // Ye helper file ke urgency logic (Red/Amber/Green) se color lega
  effective_date: '#2563eb', // Blue
  payment: '#8b5cf6',        // Purple (Payment milestones)
  delivery: '#06b6d4',       // Cyan/Teal (Delivery/Dispatch dates)
  warranty: '#d946ef',       // Pink/Magenta (Warranty/DLP periods)
  deadline: '#6366f1',       // Indigo (General deadlines fallback)
};

const CalendarView = ({ onSelectEvent }) => {
  // Demo dataset ke according default date set (July 2026)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1));
  const [currentView, setCurrentView] = useState('month');
  const [rawEvents, setRawEvents] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/calendar-events')
      .then(res => res.json())
      .then(data => setRawEvents(Array.isArray(data) ? data : []))
      .catch(() => setRawEvents([]));
  }, []);

  const events = rawEvents.map((e, i) => {
    const parsedDate = parseAiDate(e.date);
    if (!parsedDate) return null;
    return {
      id: i,
      poId: e.po_id,
      fieldKey: e.field_key,
      source: e.source,
      title: e.label,
      start: parsedDate,
      end: parsedDate,
      allDay: true,
    };
  }).filter(Boolean);

  const eventStyleGetter = (event) => {
    // Agar expiry date hai, toh getDeadlineColor function urgency check karke color dega.
    // Warna hum upar define kiye gaye distinctly alag colors assign karenge.
    const backgroundColor = event.source === 'lapse_expiry_date'
      ? getDeadlineColor(getDaysLeft(event.start))
      : (SOURCE_COLORS[event.source] || '#6b7280'); 

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.95,
        color: '#fff',
        border: 'none',
        display: 'block',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 600,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }
    };
  };

  return (
    <div
      className="h-full rounded-2xl border border-white/5 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/5 animate-in fade-in duration-300"
      style={{ height: '100%', minHeight: '650px', display: 'flex', flexDirection: 'column' }}
    >
      <style>{CALENDAR_CUSTOM_CSS}</style>
      
      {/* ── VISUAL LEGEND (Key) ── */}
      <div className="flex flex-wrap items-center gap-5 mb-4 pb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
           <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span> Urgent Expiry
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
           <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: SOURCE_COLORS.effective_date}}></span> Effective Dates
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
           <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: SOURCE_COLORS.payment}}></span> Payments
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
           <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: SOURCE_COLORS.delivery}}></span> Deliveries
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
           <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: SOURCE_COLORS.warranty}}></span> Warranty
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', color: '#e5e5e5' }}
          views={['month', 'week', 'agenda']}
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          view={currentView}
          onView={(newView) => setCurrentView(newView)}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => onSelectEvent(event.poId, event.fieldKey)}
        />
      </div>
    </div>
  );
};

export default CalendarView;