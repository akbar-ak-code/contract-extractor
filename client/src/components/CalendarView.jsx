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

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Distinct colors per date source so it's clear at a glance what kind of date it is,
// independent of the urgency coloring used for expiry dates.
const SOURCE_COLORS = {
  lapse_expiry_date: null, // uses urgency-based getDeadlineColor instead
  effective_date: '#3b82f6',
  deadline: '#f59e0b',
};

const CalendarView = ({ onSelectEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 25));
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
        padding: '2px 6px',
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
      }
    };
  };

  return (
    <div
      className="h-full rounded-2xl border border-white/5 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-white/5 animate-in fade-in duration-300"
      style={{ height: '100%' }}
    >
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
  );
};

export default CalendarView;
