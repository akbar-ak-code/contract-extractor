import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Clock, Shield, DollarSign, Building, MapPin, List, Edit3, Hash, X } from 'lucide-react';
import './App.css'; 

const App = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // 🆕 New States for Panel A
  const [history, setHistory] = useState([]);
  const [activeSource, setActiveSource] = useState(null); // Controls the Right Sidebar
  
  const fileInputRef = useRef(null);

  // 🆕 Load history on startup
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
          fetchHistory(); // Refresh sidebar after new upload
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
  };

  // 🆕 Updated ProfileRow with the View Source (#) Button
  const ProfileRow = ({ icon, label, data }) => {
      const val = data?.value || "Not found";
      const quote = data?.source_quote || "No source quote extracted.";
      const isMissing = val === "Not found" || val === "N/A" || val === "";

      return (
        <div className="profile-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #333' }}>
            <div className="row-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '30%' }}>
                {icon} <span style={{ fontWeight: '500', color: '#aaa' }}>{label}</span>
            </div>
            <div className={`row-value ${isMissing ? 'is-missing' : ''}`} style={{ width: '60%', color: isMissing ? '#ff6b6b' : '#fff' }}>
                {val}
            </div>
            
            {/* The Magic "#" Button */}
            <button 
                onClick={() => setActiveSource({ label, quote })}
                style={{ background: 'transparent', border: '1px solid #555', color: '#4da6ff', cursor: 'pointer', padding: '6px', borderRadius: '4px' }}
                title="View Source in PDF"
            >
                <Hash size={16} />
            </button>
        </div>
      );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      
      {/* LEFT SIDEBAR: PO History */}
      <aside style={{ width: '280px', borderRight: '1px solid #333', padding: '20px', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20}/> PO Library
        </h2>
        <button onClick={() => {setResult(null); setFile(null); setActiveSource(null);}} style={{ width: '100%', padding: '10px', marginBottom: '20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Upload New PO
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(po => (
                <div key={po.id} onClick={() => loadPastPO(po.id)} style={{ padding: '12px', background: '#252525', borderRadius: '6px', cursor: 'pointer', border: '1px solid #333' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{po.filename}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Status: {po.status}</div>
                </div>
            ))}
        </div>
      </aside>

      {/* CENTER PANEL: Main Content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <header style={{ marginBottom: '40px' }}>
           <h1 style={{ fontSize: '2rem', margin: 0 }}>Extraction View</h1>
           <p style={{ color: '#888' }}>Enterprise Hybrid Pipeline</p>
        </header>

        {/* Upload Dropzone */}
        {!result && (
            <div style={{ border: '2px dashed #444', borderRadius: '8px', padding: '60px', textAlign: 'center', backgroundColor: '#1e1e1e' }}>
              <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => handleFileSelection(e.target.files[0])} />
              <UploadCloud size={48} style={{ color: '#888', marginBottom: '16px' }} onClick={() => fileInputRef.current.click()} />
              <h3>{file ? file.name : "Drag and drop PO PDF here"}</h3>
              
              {file && !loading && (
                  <button onClick={handleAnalyze} style={{ marginTop: '20px', padding: '12px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Extract Data
                  </button>
              )}
              {loading && <p style={{ color: '#4da6ff', marginTop: '20px' }}>Processing via Gemini 3.5 Flash...</p>}
              {error && <p style={{ color: '#ef4444', marginTop: '20px' }}>{error}</p>}
            </div>
        )}

        {/* Extraction Results */}
        {result && (
            <div style={{ animation: 'fadeIn 0.5s' }}>
                
                {/* 1. Document Headers Card */}
                <div style={{ background: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>Document Headers</h2>
                    <ProfileRow icon={<Hash size={16}/>} label="PO Number" data={result.po_number} />
                    <ProfileRow icon={<Building size={16}/>} label="Vendor Name" data={result.vendor_name} />
                    <ProfileRow icon={<MapPin size={16}/>} label="Contact & Address" data={result.vendor_contact_address} />
                    <ProfileRow icon={<Clock size={16}/>} label="Effective Date" data={result.effective_date} />
                    <ProfileRow icon={<AlertTriangle size={16}/>} label="Lapse / Expiry" data={result.lapse_expiry_date} />
                    <ProfileRow icon={<DollarSign size={16}/>} label="Total Value" data={result.total_value} />
                </div>

                {/* 2. Terms & Conditions Card */}
                <div style={{ background: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>Terms & Conditions</h2>
                    <ProfileRow icon={<Shield size={16}/>} label="Conditions of Agreement" data={result.conditions_of_agreement} />
                    <ProfileRow icon={<DollarSign size={16}/>} label="Payment Conditions" data={result.conditions_of_payment} />
                </div>

                {/* 3. Signatures Card */}
                <div style={{ background: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>Signatures</h2>
                    <ProfileRow icon={<Edit3 size={16}/>} label="Authorising Signatory" data={result.authorising_signatory} />
                </div>

                {/* 4. Line Items Table */}
                <div style={{ background: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
                        <List size={20} style={{display: 'inline', marginRight: '8px', verticalAlign: 'middle'}}/> Line Items
                    </h2>
                    
                    {result.line_items?.status === "found" && result.line_items.value.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e0e0e0', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Description</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.line_items.value.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                                        <td style={{ padding: '10px' }}>{item.description}</td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>${item.unit_price?.toFixed(2) || "0.00"}</td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => setActiveSource({ label: `Line Item ${idx + 1}`, quote: item.source_quote || "No quote found." })}
                                                style={{ background: 'transparent', border: '1px solid #555', color: '#4da6ff', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                                                title="View Source"
                                            >
                                                <Hash size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ color: '#ff6b6b', padding: '10px 0' }}>No line items parsed or found.</div>
                    )}
                </div>

            </div>
        )}
      </main>

      {/* RIGHT SIDEBAR: Source Quote Viewer */}
      {activeSource && (
          <aside style={{ width: '350px', background: '#1a1a1a', borderLeft: '1px solid #333', padding: '20px', boxShadow: '-5px 0 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#4da6ff' }}>PDF Source Proof</h3>
                  <button onClick={() => setActiveSource(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>Extracted Field:</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '24px' }}>{activeSource.label}</div>
              
              <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>Literal Quote from PDF:</div>
              <div style={{ background: '#2d2d2d', padding: '16px', borderRadius: '6px', borderLeft: '4px solid #f59e0b', fontSize: '0.95rem', lineHeight: '1.5', fontFamily: 'monospace', color: '#e0e0e0', whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto' }}>
                  "{activeSource.quote}"
              </div>
          </aside>
      )}

    </div>
  );
};

export default App;