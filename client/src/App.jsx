import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, XCircle, Clock, Shield, DollarSign, Building } from 'lucide-react';
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
    // 🛠️ Removed the manual 'engine' append since backend is now fully automated

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
          setError(data.extraction_result.message || "Failed to process contract.");
      }
      
    } catch (err) {
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const getExpirationStatus = (dateString) => {
      if (!dateString || dateString === "Not found in contract") return null;
      try {
          const targetDate = new Date(dateString);
          if (isNaN(targetDate.getTime())) return null;

          const daysLeft = differenceInDays(targetDate, new Date());

          if (daysLeft < 30 && daysLeft >= 0) {
              return { text: 'Expires in < 30 Days', class: 'badge-red', icon: <XCircle size={16} /> };
          } else if (daysLeft < 90 && daysLeft >= 0) {
              return { text: 'Expires in < 90 Days', class: 'badge-amber', icon: <AlertTriangle size={16} /> };
          } else if (daysLeft < 0) {
               return { text: 'Contract Expired', class: 'badge-red', icon: <XCircle size={16} /> };
          }
          return { text: 'Active', class: 'badge-green', icon: <CheckCircle size={16} /> };
      } catch (e) {
          return null;
      }
  };

  const ProfileRow = ({ icon, label, data }) => {
      const val = data?.value || "Not found in contract";
      // 🛠️ Updated to read "model_used" from the backend instead of "source"
      const modelUsed = data?.model_used || "Unknown";
      const isMissing = val === "Not found in contract" || val === "N/A";

      return (
        <div className="profile-row">
            <div className="row-label">
                {icon}
                <span>{label}</span>
            </div>
            <div className={`row-value ${isMissing ? 'is-missing' : ''}`}>
                {val}
                
                {!isMissing && (
                    <span className={`source-badge ${modelUsed === 'Gemini-2.5-Flash' ? 'source-gemini' : 'source-local'}`}>
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
         <h1 className="header-title">Legal Contract AI Analyzer</h1>
         <p className="header-subtitle">Enterprise Combined Profiling Pipeline</p>
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
                      {file ? file.name : "Drag and drop PDF contract here"}
                  </h3>
                  <p className="drop-subtitle">or click to browse local files</p>
              </div>

              {/* 🛠️ Dropdown has been completely removed to enforce the combined smart pipeline */}

              {file && !loading && (
                  <div className="action-container">
                       <button onClick={(e) => { e.stopPropagation(); handleAnalyze(); }} className="btn-primary">
                           <FileText size={18} /> Run Smart Extraction
                       </button>
                  </div>
              )}

              {loading && (
                  <div className="loading-container">
                     <div className="spinner"></div>
                     <p className="loading-text">Executing Combined Smart Pipeline...</p>
                     <p className="loading-subtext">Routing fields to optimal models...</p>
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
                        <span>Smart Extraction Complete</span>
                    </div>
                    <button onClick={() => { setResult(null); setFile(null); }} className="btn-secondary">
                        Analyze Another Contract
                    </button>
                </div>

                <div className="cards-grid">
                    
                    <div className="profile-card card-full">
                        <div className="card-header">
                            <h2 className="card-title">Contracting Parties</h2>
                        </div>
                        {/* 🛠️ Updated to handle the unified "party_names" field */}
                        <ProfileRow icon={<Building size={16}/>} label="Party Names" data={result.party_names} />
                    </div>

                    <div className="profile-card">
                        <div className="card-header flex-between">
                             <h2 className="card-title">Term & Timeline</h2>
                             {(() => {
                                 const status = getExpirationStatus(result.expiration_date?.value);
                                 if (status) {
                                     return (
                                         <div className={`badge ${status.class}`}>
                                             {status.icon} {status.text}
                                         </div>
                                     )
                                 }
                                 return null;
                             })()}
                        </div>
                        <ProfileRow icon={<Clock size={16}/>} label="Effective Date" data={result.effective_date} />
                        <ProfileRow icon={<Clock size={16}/>} label="Expiration Date" data={result.expiration_date} />
                        <ProfileRow icon={<Clock size={16}/>} label="Renewal Conditions" data={result.renewal} />
                    </div>

                    <div className="profile-card">
                        <div className="card-header">
                             <h2 className="card-title">Commercial Terms</h2>
                        </div>
                        <ProfileRow icon={<DollarSign size={16}/>} label="Payment Terms" data={result.payment_terms} />
                        <ProfileRow icon={<AlertTriangle size={16}/>} label="Penalties / Late Fees" data={result.penalties} />
                    </div>

                    <div className="profile-card card-full">
                        <div className="card-header">
                            <h2 className="card-title">Legal Framework & Conditions</h2>
                        </div>
                        <ProfileRow icon={<Shield size={16}/>} label="Governing Law" data={result.governing_law} />
                        <ProfileRow icon={<XCircle size={16}/>} label="Termination for Cause" data={result.termination_for_cause} />
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;