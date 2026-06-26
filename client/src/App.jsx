// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText } from 'lucide-react';


import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import ExtractionView from './components/ExtractionView';
import SourceSidebar from './components/SourceSidebar';

const App = () => {
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
    } catch (err) {
      setError("Failed to load PO details.");
    } finally {
      setLoading(false);
    }
  };
const handleDeletePO = async (id, e) => {
    e.stopPropagation(); // Stops the row click from triggering loadPastPO
    if (!window.confirm("Are you sure you want to permanently delete this document?")) return;

    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory(); // Instantly update the sidebar and calendar
        setResult(null); // Clear the screen to avoid showing deleted data
        setFile(null);
        setActiveSource(null);
        setActiveTab('extraction');
      } else {
        console.error("Failed to delete the file.");
      }
    } catch (err) {
      console.error("Network error during deletion:", err);
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
    setFile(selectedFile); setError(null); setResult(null); setActiveSource(null); setActiveTab('extraction');
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
        onNewUpload={() => {setResult(null); setFile(null); setActiveSource(null); setActiveTab('extraction');}} 
        onLoadPO={loadPastPO} 
        onDeletePO={handleDeletePO} // 🆕 Add this new prop!
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
            />
          )}
        </div>
      </main>

      <SourceSidebar activeSource={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
};

export default App;
