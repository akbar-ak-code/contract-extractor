// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText } from 'lucide-react';

import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import ExtractionView from './components/ExtractionView';
import SourceSidebar from './components/SourceSidebar';

const App = () => {
  const [dbId, setDbId] = useState(null); 
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');

  const fileInputRef = useRef(null);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pos');
      if (res.ok) setHistory(await res.json());
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const loadPastPO = async (id) => {
    setLoading(true);
    setResult(null);
    setActiveSource(null);
    setActiveTab('extraction');
    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}`);
      const data = await res.json();
      setResult(data.extraction_result.profile);
      setFile({ name: data.filename });
      setDbId(data.db_id);
    } catch (err) {
      setError("Failed to load PO details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePO = async (id, e) => {
    e.stopPropagation(); 
    if (!window.confirm("Are you sure you want to permanently delete this document?")) return;

    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory(); 
        setResult(null); 
        setFile(null);
        setActiveSource(null);
        setActiveTab('extraction');
        setDbId(null);
      } else {
        console.error("Failed to delete the file.");
      }
    } catch (err) {
      console.error("Network error during deletion:", err);
    }
  };

  const handleFieldUpdate = async (id, field, value) => {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}/field`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value })
      });

      if (res.ok) {
        // 🚀 Optimistic UI Update: Update value AND push to history array!
        setResult(prev => {
          const oldVal = prev[field].value;
          const currentHistory = prev[field].history || [];
          
          return {
            ...prev,
            [field]: { 
              ...prev[field], 
              value: value,
              // Instantly add the new edit to the local state so the dropdown shows it
              history: [...currentHistory, { 
                old_value: oldVal, 
                new_value: value, 
                timestamp: new Date().toISOString() 
              }]
            }
          };
        });
        fetchHistory(); 
      } else {
        console.error("Failed to update field in database.");
      }
    } catch (err) {
      console.error("Network error during update", err);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null); setActiveSource(null);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok && data.extraction_result.status === "success") {
        setResult(data.extraction_result.profile);
        setDbId(data.db_id);
        fetchHistory();
      } else {
        setError(data.extraction_result?.message || "Failed to process.");
      }
    } catch (err) {
      setError("Unexpected error occurred.");
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
    setActiveTab('extraction');
    setDbId(null);
  };

  const tabBtn = (active) =>
    `flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-gradient-to-b from-neutral-700 to-neutral-800 text-white shadow-md shadow-black/40 ring-1 ring-white/10'
        : 'bg-transparent text-neutral-400 hover:text-neutral-200'
    }`;

  return (
    <div className="flex h-screen bg-[#0a0a0a] font-sans text-neutral-200 antialiased">
      <Sidebar 
        history={history} 
        onNewUpload={() => {
          setResult(null); 
          setFile(null); 
          setActiveSource(null); 
          setActiveTab('extraction'); 
          setDbId(null);
        }} 
        onLoadPO={loadPastPO} 
        onDeletePO={handleDeletePO}
      />

      <main className="flex flex-1 flex-col overflow-y-auto bg-gradient-to-br from-[#101012] via-[#0d0d0f] to-[#0a0a0c] px-12 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="m-0 mb-1.5 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              Workspace
            </h1>
            <p className="m-0 text-sm text-neutral-500">Enterprise Hybrid Pipeline</p>
          </div>

          <div className="flex gap-1 rounded-xl border border-white/5 bg-neutral-900/60 p-1 shadow-inner backdrop-blur-sm">
            <button onClick={() => setActiveTab('calendar')} className={tabBtn(activeTab === 'calendar')}>
              <CalendarIcon size={15} /> Deadlines
            </button>
            <button onClick={() => setActiveTab('extraction')} className={tabBtn(activeTab === 'extraction')}>
              <FileText size={15} /> Extraction
            </button>
          </div>
        </header>

        <div className="flex-1">
          {activeTab === 'calendar' ? (
            <CalendarView history={history} onSelectEvent={loadPastPO} />
          ) : (
            <ExtractionView
              file={file}
              loading={loading}
              error={error}
              result={result}
              fileInputRef={fileInputRef}
              handleFileSelection={handleFileSelection}
              handleAnalyze={handleAnalyze}
              setActiveSource={setActiveSource}
              dbId={dbId}
              onUpdate={handleFieldUpdate}
            />
          )}
        </div>
      </main>

      <SourceSidebar activeSource={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
};

export default App;