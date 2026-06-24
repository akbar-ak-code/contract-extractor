import React, { useState, useRef } from 'react';
// Added Hash icon to imports
import { UploadCloud, FileText, CheckCircle, AlertTriangle, XCircle, Clock, Shield, DollarSign, Building, MapPin, List, Edit3, Hash } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import './App.css'; 

const App = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileSelection = (selectedFile) => {
    if (selectedFile.type !== "application/pdf") {
        setError("Please upload a valid PDF document.");
        setFile(null);
        return;
    }
    setFile(selectedFile);
    setError(null);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.extraction_result && data.extraction_result.status === "success") {
          setResult(data.extraction_result.profile);
      } else {
          setError(data.extraction_result.message || "Failed to process Purchase Order.");
      }
      
    } catch (err) {
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const ProfileRow = ({ icon, label, data }) => {
      const val = data?.value || "not_found";
      const modelUsed = data?.model_used || "Unknown";
      const isMissing = val === "not_found" || val === "N/A" || val === "";

      return (
        <div className="profile-row">
            <div className="row-label">
                {icon}
                <span>{label}</span>
            </div>
            <div className={`row-value ${isMissing ? 'is-missing' : ''}`}>
                {val}
                
                {!isMissing && (
                    <span className={`source-badge ${modelUsed === 'Gemini-3.5-Flash' ? 'source-gemini' : 'source-local'}`}>
                        ⚡ {modelUsed}
                    </span>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="app-container">
      <header className="app-header">
         <h1 className="header-title">Purchase Order AI Analyzer</h1>
         <p className="header-subtitle">Enterprise Hybrid Extraction Pipeline</p>
      </header>

      <main className="app-main">
        {!result && (
            <div className="upload-card">
              <div 
                className={`drop-zone ${dragActive ? "active" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
              >
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden-input" onChange={handleChange} />
                  <UploadCloud size={48} className="drop-icon" />
                  <h3 className="drop-title">
                      {file ? file.name : "Drag and drop PO PDF here"}
                  </h3>
                  <p className="drop-subtitle">or click to browse local files</p>
              </div>

              {file && !loading && (
                  <div className="action-container">
                       <button onClick={(e) => { e.stopPropagation(); handleAnalyze(); }} className="btn-primary">
                           <FileText size={18} /> Process Purchase Order
                       </button>
                  </div>
              )}

              {loading && (
                  <div className="loading-container">
                     <div className="spinner"></div>
                     <p className="loading-text">Executing Page-Based Chunking & Extraction...</p>
                     <p className="loading-subtext">Routing fields to LLM...</p>
                  </div>
              )}

              {error && (
                  <div className="error-banner">
                      <AlertTriangle size={18} /> {error}
                  </div>
              )}
            </div>
        )}

        {result && (
            <div className="results-container animate-fade-in">
                
                <div className="top-action-bar">
                    <div className="success-status">
                        <CheckCircle size={20} className="success-icon" />
                        <span>PO Extraction Complete</span>
                    </div>
                    <button onClick={() => { setResult(null); setFile(null); }} className="btn-secondary">
                        Analyze Another PO
                    </button>
                </div>

                <div className="cards-grid">
                    
                    <div className="profile-card card-full">
                        <div className="card-header">
                            <h2 className="card-title">Vendor Information</h2>
                        </div>
                        {/* New PO Number Row Here */}
                        <ProfileRow icon={<Hash size={16}/>} label="PO Number" data={result.po_number} />
                        <ProfileRow icon={<Building size={16}/>} label="Vendor Name" data={result.vendor_name} />
                        <ProfileRow icon={<MapPin size={16}/>} label="Contact & Address" data={result.vendor_contact_address} />
                    </div>

                    <div className="profile-card">
                        <div className="card-header">
                             <h2 className="card-title">Dates & Value</h2>
                        </div>
                        <ProfileRow icon={<Clock size={16}/>} label="Effective Date" data={result.effective_date} />
                        <ProfileRow icon={<AlertTriangle size={16}/>} label="Lapse / Expiry" data={result.lapse_expiry_date} />
                        <ProfileRow icon={<DollarSign size={16}/>} label="Total Value" data={result.total_value} />
                    </div>

                    <div className="profile-card">
                        <div className="card-header">
                             <h2 className="card-title">Terms & Conditions</h2>
                        </div>
                        <ProfileRow icon={<Shield size={16}/>} label="Conditions of Agreement" data={result.conditions_of_agreement} />
                        <ProfileRow icon={<DollarSign size={16}/>} label="Payment Conditions" data={result.conditions_of_payment} />
                    </div>

                    <div className="profile-card card-full">
                        <div className="card-header">
                            <h2 className="card-title"><List size={20} style={{display: 'inline', marginRight: '8px', verticalAlign: 'middle'}}/> Line Items</h2>
                        </div>
                        
                        {result.line_items?.status === "found" && result.line_items.value.length > 0 ? (
                            <div className="table-container">
                                <table className="line-items-table">
                                    <thead>
                                        <tr>
                                            <th>Description</th>
                                            <th style={{textAlign: 'center'}}>Qty</th>
                                            <th style={{textAlign: 'right'}}>Unit Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.line_items.value.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.description}</td>
                                                <td style={{textAlign: 'center'}}>{item.quantity}</td>
                                                <td style={{textAlign: 'right'}}>${item.unit_price?.toFixed(2) || "0.00"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="source-badge source-gemini" style={{marginTop: '12px', display: 'inline-block'}}>
                                    ⚡ {result.line_items.model_used}
                                </div>
                            </div>
                        ) : (
                            <div className="profile-row">
                                <div className="row-value is-missing">No line items parsed or found.</div>
                            </div>
                        )}
                    </div>

                    <div className="profile-card card-full">
                        <div className="card-header">
                            <h2 className="card-title">Signatures</h2>
                        </div>
                        <ProfileRow icon={<Edit3 size={16}/>} label="Authorising Signatory" data={result.authorising_signatory} />
                    </div>

                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;