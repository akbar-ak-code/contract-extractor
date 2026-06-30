// src/components/CalendarView.jsx
import React, { useState } from 'react';
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

const CalendarView = ({ history, onSelectEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 25));
  const [currentView, setCurrentView] = useState('month');

  const events = history.map(po => {
    const parsedDate = parseAiDate(po.lapse_expiry_date);
    if (!parsedDate) return null;
    return {
      id: po.id,
      title: `Expiry: ${po.po_number || po.filename.substring(0, 10)}`,
      start: parsedDate,
      end: parsedDate,
      allDay: true,
      resource: po
    };
  }).filter(e => e !== null);

  const eventStyleGetter = (event) => {
    const daysLeft = getDaysLeft(event.start);
    
    // Elegant translucent glassmorphic badge colors depending on urgency
    let glowColor = 'rgba(59, 130, 246, 0.08)';
    let textColor = '#60a5fa';
    let borderColor = 'rgba(59, 130, 246, 0.35)';
    
    if (daysLeft < 0) {
      glowColor = 'rgba(239, 68, 68, 0.08)';
      textColor = '#f87171';
      borderColor = 'rgba(239, 68, 68, 0.35)';
    } else if (daysLeft <= 30) {
      glowColor = 'rgba(251, 146, 60, 0.08)';
      textColor = '#fb923c';
      borderColor = 'rgba(251, 146, 60, 0.35)';
    } else {
      glowColor = 'rgba(52, 211, 153, 0.08)';
      textColor = '#34d399';
      borderColor = 'rgba(52, 211, 153, 0.35)';
    }

    return {
      style: {
        backgroundColor: glowColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '3px 8px',
        fontWeight: 600,
        fontSize: '11.5px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        display: 'block',
        transition: 'all 0.2s ease'
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
        onSelectEvent={(event) => onSelectEvent(event.id)}
      />
    </div>
  );
};

export default CalendarView;