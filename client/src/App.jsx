// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText, LayoutList, Settings2 } from 'lucide-react';

import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import ExtractionView from './components/ExtractionView';
import SourceSidebar from './components/SourceSidebar';
import AllPOsView from './components/AllPOsView';
// import SchemaManager from './components/SchemaManager';

const App = () => {
  const [dbId, setDbId] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [scrollToField, setScrollToField] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => { fetchHistory(); fetchCustomFields(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pos');
      if (res.ok) setHistory(await res.json());
    } catch (err) { console.error("Failed to load history", err); }
  };

  const fetchCustomFields = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/schema');
      if (res.ok) setCustomFields(await res.json());
    } catch (err) { console.error("Failed to load schema", err); }
  };

  const loadPastPO = async (id, fieldKey = null) => {
    setLoading(true);
    setResult(null);
    setActiveSource(null);
    setActiveTab('extraction');
    setScrollToField(null);
    try {
      const res = await fetch(`http://localhost:8000/api/pos/${id}`);
      const data = await res.json();
      setResult(data.extraction_result.profile);
      setFile({ name: data.filename });
      setDbId(data.db_id);
      // Set after the new result has rendered so ExtractionView has the row to scroll to.
      if (fieldKey) setScrollToField(fieldKey);
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
        // If the deleted PO was currently open, reset the view
        if (dbId === id) {
          setResult(null);
          setFile(null);
          setActiveSource(null);
          setDbId(null);
        }
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
        setResult(prev => {
          // _deep_analysis isn't a {value, source_quote, history} field like the rest of
          // the profile - it's the raw deadlines/anomalies/metadata object itself, saved
          // directly on the backend (see main.py's update_po_field). Wrapping it in the
          // same {value, history} shape as a normal field corrupts it: deepAnalysis.deadlines
          // would end up nested under deepAnalysis.value.deadlines instead, which silently
          // breaks every read of result._deep_analysis.deadlines/anomalies until reload.
          if (field === "_deep_analysis") {
            return { ...prev, _deep_analysis: value };
          }
          const oldVal = prev[field].value;
          const currentHistory = prev[field].history || [];
          return {
            ...prev,
            [field]: {
              ...prev[field],
              value,
              history: [...currentHistory, {
                old_value: oldVal,
                new_value: value,
                timestamp: new Date().toISOString()
              }]
            }
          };
        });
        fetchHistory(); // sidebar updates immediately after expiry date edits
      }
    } catch (err) {
      console.error("Network error during update", err);
    }
  };

  const handleAnalyze = async (extractionMode = 'primary') => {
    if (!file) return;
    setLoading(true); setError(null); setActiveSource(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('extraction_mode', extractionMode); // 'primary' | 'deep'
    try {
      const response = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok && data.extraction_result.status === "success") {
        setResult(data.extraction_result.profile);
        setDbId(data.db_id);
        fetchHistory(); // sidebar updates immediately after upload
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

  const TABS = [
    { id: 'calendar',   label: 'Deadlines',  Icon: CalendarIcon },
    { id: 'all',        label: 'All POs',    Icon: LayoutList   },
    { id: 'extraction', label: 'Extraction', Icon: FileText     },
    { id: 'schema',     label: 'Schema',     Icon: Settings2    },
  ];

  const tabBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, transition: 'all 0.18s',
    background: active
      ? 'linear-gradient(to bottom, #404040, #303030)'
      : 'transparent',
    color: active ? '#fff' : '#737373',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Left sidebar */}
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

      {/* Main content — min-width prevents collapse when right sidebar opens */}
      <main style={{
        flex: 1, minWidth: 480,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        background: 'linear-gradient(135deg, #101012 0%, #0d0d0f 50%, #0a0a0c 100%)',
        padding: '28px 40px',
      }}>
        <header style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{
              margin: 0, marginBottom: 4, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em',
              background: 'linear-gradient(to right, #fff, #a3a3a3)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Workspace
            </h1>
            <p style={{ margin: 0, fontSize: 12.5, color: '#737373' }}>Enterprise Hybrid Pipeline</p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 3, borderRadius: 11,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(18,18,18,0.7)', padding: 4,
          }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={tabBtn(activeTab === id)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </header>

        <div style={{ flex: 1 }}>
          {activeTab === 'calendar' && (
            <CalendarView onSelectEvent={loadPastPO} />
          )}
          {activeTab === 'all' && (
            <AllPOsView
              history={history}
              onLoadPO={loadPastPO}
              onDeletePO={handleDeletePO}
            />
          )}
          {/* {activeTab === 'schema' && (
            <SchemaManager
              poCount={history.length}
            />
          )} */}
          {activeTab === 'extraction' && (
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
              customFields={customFields}
              scrollToField={scrollToField}
              onScrollToFieldDone={() => setScrollToField(null)}
            />
          )}
        </div>
      </main>

      {/* Right source sidebar — fixed overlay, never compresses main */}
      {activeSource && dbId && (
        <>
          <div
            onClick={() => setActiveSource(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)',
              animation: 'fadeIn 0.2s ease',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            zIndex: 50, width: 600,
            display: 'flex', flexDirection: 'column',
          }}>
            <SourceSidebar
              activeSource={activeSource}
              onClose={() => setActiveSource(null)}
              dbId={dbId}
            />
          </div>
        </>
      )}

      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
};

export default App;
