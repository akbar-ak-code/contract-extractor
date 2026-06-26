import React from 'react';
import { Clock, Plus } from 'lucide-react';
import { parseAiDate, getDaysLeft, getDeadlineColor } from '../utils/helpers.js';

const Sidebar = ({ history, onNewUpload, onLoadPO }) => {
  const upcomingDeadlines = history
    .map(po => {
      const parsedDate = parseAiDate(po.lapse_expiry_date);
      if (!parsedDate) return null;
      const daysLeft = getDaysLeft(parsedDate);
      return { ...po, parsedDate, daysLeft };
    })
    .filter(po => po !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <aside className="w-[280px] border-r border-[#2a2a2a] p-6 overflow-y-auto bg-[#141414] flex flex-col shrink-0 h-full">
      <h2 className="text-lg mb-6 flex items-center gap-3 font-semibold pl-2 text-[#e0e0e0]">
          <Clock size={20} className="text-[#5c9ce6]" /> Upcoming Expiries
      </h2>
      
      <button 
          onClick={onNewUpload} 
          className="w-full py-3 px-4 mb-8 bg-[#5c9ce6] text-[#121212] font-semibold rounded-lg shadow-[0_0_15px_rgba(92,156,230,0.15)] flex justify-center items-center gap-2 hover:bg-[#4b8bcf] hover:shadow-[0_0_20px_rgba(92,156,230,0.3)] transition-all cursor-pointer"
      >
          <Plus size={18} strokeWidth={2.5} /> New PO Upload
      </button>
      
      <div className="flex flex-col gap-3">
          {upcomingDeadlines.map(po => {
            const color = getDeadlineColor(po.daysLeft);
            return (
              <div 
                key={po.id} 
                onClick={() => onLoadPO(po.id)} 
                className="p-4 bg-[#1c1c1c] rounded-lg cursor-pointer border border-[#2a2a2a] hover:border-[#444] hover:bg-[#252525] transition-all group relative overflow-hidden"
              >
                  {/* Left color bar indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }}></div>
                  
                  <div className="text-[0.95rem] font-medium text-[#e0e0e0] truncate pl-2">
                      {po.po_number || po.filename}
                  </div>
                  <div className="text-xs mt-1.5 pl-2 font-semibold" style={{ color: color }}>
                     {po.daysLeft < 0 ? `Expired ${Math.abs(po.daysLeft)} days ago` : `Expires in ${po.daysLeft} days`}
                  </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
};

export default Sidebar;