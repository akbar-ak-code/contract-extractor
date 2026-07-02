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

// ── FEATURE 2: PREMIUM WEEK VIEW UI ─────────────────────────────
const CALENDAR_CUSTOM_CSS = `
  /* Month View Fixes */
  .rbc-month-view { min-height: 600px; border: none !important; }
  .rbc-month-row { overflow: visible; min-height: 90px; }
  .rbc-row-content { overflow: visible; }
  .rbc-event { overflow: visible; }

  /* --- 🔥 PREMIUM WEEK VIEW FIXES --- */
  .rbc-time-view {
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 16px !important;
    background: rgba(10, 10, 12, 0.6) !important;
    overflow: hidden;
  }
  
  /* The Top Header Area (Where our All-Day deadlines sit) */
  .rbc-allday-cell {
    background: rgba(255, 255, 255, 0.02) !important;
    min-height: 120px !important; /* Gives deadlines a lot of room to breathe */
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  }
  
  /* Day Column Headers */
  .rbc-time-header {
    background: rgba(0, 0, 0, 0.2);
  }
  .rbc-time-header.rbc-overflowing {
    border-right: none !important;
  }
  .rbc-header {
    border: none !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    font-size: 13px !important;
    padding: 12px 0 !important;
    color: #a1a1aa !important;
    font-weight: 600 !important;
  }
  .rbc-time-header-content {
    border-left: 1px solid rgba(255,255,255,0.03) !important;
  }

  /* Clean up the Empty Time Grid Below */
  .rbc-time-content {
    border-top: none !important;
  }
  .rbc-timeslot-group {
    border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
    min-height: 60px !important; /* Taller, cleaner rows */
  }
  .rbc-day-slot .rbc-time-slot {
    border-top: none !important; /* Removes the confusing mid-hour dashed lines */
  }
  .rbc-time-column {
    border-right: 1px solid rgba(255, 255, 255, 0.03) !important;
  }
  .rbc-time-gutter .rbc-time-slot {
    color: rgba(255, 255, 255, 0.3) !important;
    font-size: 11px !important;
    font-weight: 500;
    padding-right: 12px !important;
  }

  /* Today Highlight Setup */
  .rbc-day-bg.rbc-today {
    background: rgba(123, 97, 255, 0.03) !important;
  }
  .rbc-time-header-cell.rbc-today .rbc-header {
    color: #ffffff !important;
    background: rgba(123, 97, 255, 0.15) !important;
    border-bottom: 2px solid #7B61FF !important;
  }
  
  /* Make week view events look like 3D floating cards */
  .rbc-time-view .rbc-event {
    border-radius: 8px !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    margin: 2px 4px !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .rbc-time-view .rbc-event:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 20px rgba(0,0,0,0.5) !important;
    z-index: 10 !important;
    filter: brightness(1.1);
  }
`;

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ── FEATURE 1: CATEGORY COLOR CODING ───────────────────────────────────────
const SOURCE_COLORS = {
  lapse_expiry_date: null,   // Controlled by Urgency (Red/Amber/Green)
  effective_date: '#2563eb', // Blue
  payment: '#8b5cf6',        // Purple (Payment milestones)
  delivery: '#06b6d4',       // Cyan/Teal (Delivery/Dispatch dates)
  warranty: '#d946ef',       // Pink/Magenta (Warranty/DLP periods)
  deadline: '#6366f1',       // Indigo (General deadlines fallback)
};

const CalendarView = ({ onSelectEvent }) => {
  // Demo dataset default date
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
      allDay: true, // Deadlines render in the top All-Day header
    };
  }).filter(Boolean);

  const eventStyleGetter = (event) => {
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
        padding: '4px 8px',
        fontSize: '11.5px',
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
      
      {/* ── VISUAL LEGEND ── */}
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
          step={60}       // Ensures only 1 line per hour (Removes clutter)
          timeslots={1}   // Removes intermediate dashed lines
        />
      </div>
    </div>
  );
};

export default CalendarView;