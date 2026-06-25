import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Clock, Shield, DollarSign, Building, MapPin, List, Edit3, Hash, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';
import './App.css';

const App = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // States for Panel Navigation and Features
  const [history, setHistory] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'extraction'
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pos');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const loadPastPO = async (id) => {
    setLoading(true);
    setResult(null);
    setActiveSource(null);
    setActiveTab('extraction'); // Auto-switch to extraction view when loading a PO
    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}`);
      const data = await res.json();
      setResult(data.extraction_result.profile);
      setFile({ name: data.filename });
    } catch (err) {
      setError("Failed to load PO details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setActiveSource(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok && data.extraction_result.status === "success") {
          setResult(data.extraction_result.profile);
          fetchHistory();
      } else {
          setError(data.extraction_result?.message || "Failed to process PO.");
      }
    } catch (err) {
      setError("An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = (selectedFile) => {
    if (selectedFile.type !== "application/pdf") return setError("Valid PDF required.");
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setActiveSource(null);
    setActiveTab('extraction'); // Switch to extraction view on drop
  };

  const ProfileRow = ({ icon, label, data }) => {
      const val = data?.value || "Not found";
      const quote = data?.source_quote || "No source quote extracted.";
      const isMissing = val === "Not found" || val === "N/A" || val === "";

      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #2d2d2d', transition: 'background 0.2s', ':hover': { background: '#252525' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '30%', color: '#a0a0a0' }}>
                <span style={{ color: '#5c9ce6' }}>{icon}</span>
                <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{label}</span>
            </div>
            <div style={{ width: '60%', color: isMissing ? '#ef4444' : '#e0e0e0', fontSize: '0.95rem', lineHeight: '1.4' }}>
                {val}
            </div>
            <button 
                onClick={() => setActiveSource({ label, quote })}
                style={{ background: '#2d2d2d', border: '1px solid #404040', color: '#5c9ce6', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: 'all 0.2s' }}
                title="View Source in PDF"
                onMouseOver={(e) => e.currentTarget.style.background = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.background = '#2d2d2d'}
            >
                <Hash size={16} />
            </button>
        </div>
      );
  };

  // --- UI COMPONENTS ---

  const CalendarView = () => {
    const days = ['6 Mon', '7 Tue', '8 Wed', '9 Thu', '10 Fri'];
    const times = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1c1c1c', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden' }}>
        
        {/* Calendar Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #333', background: '#242424' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>July 6–10, 2026</span>
            <div style={{ display: 'flex', gap: '8px', color: '#a0a0a0' }}>
              <ChevronLeft size={20} style={{ cursor: 'pointer' }} />
              <ChevronRight size={20} style={{ cursor: 'pointer' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #444', color: '#e0e0e0', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
               Work week
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #444', color: '#e0e0e0', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              <Filter size={14} /> Filter applied
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#5c9ce6', border: 'none', color: '#121212', fontWeight: '600', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              <Plus size={16} /> New
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'flex', flex: 1, overflowY: 'auto' }}>
          {/* Time Column */}
          <div style={{ width: '60px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '50px', borderBottom: '1px solid #333' }}></div> {/* Empty corner */}
            {times.map(time => (
              <div key={time} style={{ height: '80px', borderBottom: '1px solid #333', color: '#888', fontSize: '0.75rem', padding: '8px', textAlign: 'right' }}>
                {time}
              </div>
            ))}
          </div>
          
          {/* Days Columns */}
          <div style={{ display: 'flex', flex: 1 }}>
            {days.map((day, idx) => (
              <div key={day} style={{ flex: 1, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '50px', borderBottom: '1px solid #333', padding: '8px 12px', color: idx === 0 ? '#5c9ce6' : '#e0e0e0', fontWeight: '500' }}>
                  <div style={{ fontSize: '1.2rem' }}>{day.split(' ')[0]}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{day.split(' ')[1]}</div>
                </div>
                {times.map(time => (
                  <div key={`${day}-${time}`} style={{ height: '80px', borderBottom: '1px solid #2a2a2a', position: 'relative' }}>
                     {/* Mock Event - you will dynamically populate this later! */}
                     {idx === 2 && time === '10 AM' && (
                        <div style={{ position: 'absolute', top: '10px', left: '4px', right: '4px', background: 'rgba(92, 156, 230, 0.15)', borderLeft: '3px solid #5c9ce6', padding: '4px 8px', borderRadius: '2px', fontSize: '0.75rem', color: '#5c9ce6' }}>
                           PO Expiry: 4800181485
                        </div>
                     )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ExtractionView = () => (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {!result ? (
        <div style={{ border: '2px dashed #333', borderRadius: '12px', padding: '80px 40px', textAlign: 'center', backgroundColor: '#1c1c1c', transition: 'all 0.3s' }}>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => handleFileSelection(e.target.files[0])} />
          <UploadCloud size={56} style={{ color: '#5c9ce6', marginBottom: '24px', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px', fontWeight: '500' }}>{file ? file.name : "Upload Purchase Order"}</h3>
          <p style={{ color: '#888', marginBottom: '32px' }}>Drag and drop a PDF, or click to browse files</p>
          
          {file && !loading && (
              <button onClick={handleAnalyze} style={{ padding: '14px 32px', background: '#5c9ce6', color: '#121212', fontWeight: '600', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 12px rgba(92, 156, 230, 0.2)' }}>
                  Run Enterprise Extraction
              </button>
          )}
          {loading && (
            <div style={{ color: '#5c9ce6', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid rgba(92, 156, 230, 0.3)', borderTopColor: '#5c9ce6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              Processing via Gemini 3.5 Flash...
            </div>
          )}
          {error && <p style={{ color: '#ef4444', marginTop: '24px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '6px' }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#1c1c1c', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <div style={{ background: '#242424', padding: '16px 24px', borderBottom: '1px solid #333' }}>
                  <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600', color: '#e0e0e0' }}>Document Headers</h2>
                </div>
                <ProfileRow icon={<Hash size={18}/>} label="PO Number" data={result.po_number} />
                <ProfileRow icon={<Building size={18}/>} label="Vendor Name" data={result.vendor_name} />
                <ProfileRow icon={<MapPin size={18}/>} label="Contact & Address" data={result.vendor_contact_address} />
                <ProfileRow icon={<Clock size={18}/>} label="Effective Date" data={result.effective_date} />
                <ProfileRow icon={<AlertTriangle size={18}/>} label="Lapse / Expiry" data={result.lapse_expiry_date} />
                <ProfileRow icon={<DollarSign size={18}/>} label="Total Value" data={result.total_value} />
            </div>

            <div style={{ background: '#1c1c1c', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <div style={{ background: '#242424', padding: '16px 24px', borderBottom: '1px solid #333' }}>
                  <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600', color: '#e0e0e0' }}>Terms & Conditions</h2>
                </div>
                <ProfileRow icon={<Shield size={18}/>} label="Conditions of Agreement" data={result.conditions_of_agreement} />
                <ProfileRow icon={<DollarSign size={18}/>} label="Payment Conditions" data={result.conditions_of_payment} />
            </div>
            
            {/* Keeping it clean: You can drop the line_items table back in here easily! */}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #121212; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
      
      {/* LEFT SIDEBAR: PO History */}
      <aside style={{ width: '280px', borderRight: '1px solid #2a2a2a', padding: '24px 16px', overflowY: 'auto', backgroundColor: '#181818', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', paddingLeft: '8px' }}>
            <FileText size={20} color="#5c9ce6" /> PO Library
        </h2>
        <button 
            onClick={() => {setResult(null); setFile(null); setActiveSource(null); setActiveTab('extraction');}} 
            style={{ width: '100%', padding: '12px', marginBottom: '24px', background: '#252525', color: '#e0e0e0', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = '#252525'}
        >
            <Plus size={18} /> New Upload
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', fontWeight: '600', textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '4px' }}>Recent Documents</div>
            {history.map(po => (
                <div key={po.id} onClick={() => loadPastPO(po.id)} style={{ padding: '12px', background: 'transparent', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s', ':hover': { background: '#222' } }}
                     onMouseOver={(e) => {e.currentTarget.style.background = '#222'; e.currentTarget.style.borderColor = '#333';}}
                     onMouseOut={(e) => {e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent';}}
                >
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#d0d0d0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{po.filename}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div> {po.status}
                    </div>
                </div>
            ))}
        </div>
      </aside>

      {/* CENTER PANEL: Main Content with Tabs */}
      <main style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#141414' }}>
        
        {/* Top Navigation Tabs */}
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div>
             <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', fontWeight: '600' }}>Workspace</h1>
             <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Enterprise Hybrid Pipeline</p>
           </div>
           
           <div style={{ display: 'flex', background: '#1c1c1c', padding: '4px', borderRadius: '8px', border: '1px solid #333' }}>
              <button 
                onClick={() => setActiveTab('calendar')}
                style={{ padding: '8px 24px', background: activeTab === 'calendar' ? '#333' : 'transparent', color: activeTab === 'calendar' ? '#fff' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CalendarIcon size={16} /> Deadlines
              </button>
              <button 
                onClick={() => setActiveTab('extraction')}
                style={{ padding: '8px 24px', background: activeTab === 'extraction' ? '#333' : 'transparent', color: activeTab === 'extraction' ? '#fff' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FileText size={16} /> Extraction
              </button>
           </div>
        </header>

        {/* Dynamic View Rendering */}
        <div style={{ flex: 1 }}>
          {activeTab === 'calendar' ? <CalendarView /> : <ExtractionView />}
        </div>
      </main>

      {/* RIGHT SIDEBAR: Source Quote Viewer */}
      {activeSource && (
          <aside style={{ width: '380px', background: '#181818', borderLeft: '1px solid #2a2a2a', padding: '24px', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} color="#10b981" />
                    <h3 style={{ fontSize: '1rem', margin: 0, color: '#10b981', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source Verification</h3>
                  </div>
                  <button onClick={() => setActiveSource(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#252525'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}><X size={20} /></button>
              </div>
              
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Field Reference</div>
              <div style={{ fontWeight: '600', fontSize: '1.2rem', marginBottom: '32px', color: '#e0e0e0' }}>{activeSource.label}</div>
              
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Extracted Document Passage</div>
              <div style={{ background: '#1c1c1c', padding: '20px', borderRadius: '8px', border: '1px solid #333', borderLeft: '4px solid #5c9ce6', fontSize: '0.95rem', lineHeight: '1.6', fontFamily: 'monospace', color: '#d0d0d0', whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
                  "{activeSource.quote}"
              </div>
          </aside>
      )}

    </div>
  );
};

export default App;