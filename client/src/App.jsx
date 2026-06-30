// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText, LayoutList, Settings2, Bell, Settings, Sun, Search as SearchIcon, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import ExtractionView from './components/ExtractionView';
import SourceSidebar from './components/SourceSidebar';
import AllPOsView from './components/AllPOsView';
import SchemaManager from './components/SchemaManager';

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

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null); setActiveSource(null);
    const formData = new FormData();
    formData.append('file', file);
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
    padding: '7px 18px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    background: active
      ? 'linear-gradient(135deg, #7B61FF 0%, #4F8CFF 100%)'
      : 'transparent',
    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
    boxShadow: active ? '0 4px 14px rgba(123, 97, 255, 0.35)' : 'none',
  });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#030207', color: '#ffffff', boxSizing: 'border-box' }}>
      
      {/* Background Animated Gradient Blobs */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'fixed', top: '-10%', left: '-10%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,97,255,0.12) 0%, rgba(123,97,255,0) 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }}
      />
      <motion.div
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 30, -40, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'fixed', bottom: '-15%', right: '-15%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,140,255,0.08) 0%, rgba(79,140,255,0) 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Main App Frame: Padding to create Apple Floating Layout */}
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: '24px', boxSizing: 'border-box', gap: '20px', zIndex: 1, position: 'relative' }}>
        
        {/* Left Floating Sidebar */}
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

        {/* Right Section holding Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minWidth: 480 }}>

          {/* Main Floating Content Area */}
          <div className="mac-glass-panel" style={{
            flex: 1, overflowY: 'auto', padding: '24px 28px',
            boxSizing: 'border-box', display: 'flex', flexDirection: 'column'
          }}>
            <header style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h1 style={{
                  margin: 0, marginBottom: 4, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em',
                  background: 'linear-gradient(to right, #ffffff, rgba(255,255,255,0.6))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Workspace
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Enterprise Hybrid Pipeline</p>
              </div>

              {/* Tab switcher Segmented Control */}
              <div style={{
                display: 'flex', gap: 3, borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)', padding: 4,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}>
                {TABS.map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} style={tabBtn(activeTab === id)}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </header>

            {/* View container with cross-fade slide transitions */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {activeTab === 'calendar' && (
                    <CalendarView history={history} onSelectEvent={loadPastPO} />
                  )}
                  {activeTab === 'all' && (
                    <AllPOsView
                      history={history}
                      onLoadPO={loadPastPO}
                      onDeletePO={handleDeletePO}
                    />
                  )}
                  {activeTab === 'schema' && (
                    <SchemaManager
                      poCount={history.length}
                    />
                  )}
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
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Right source sidebar overlay */}
      {activeSource && dbId && (
        <>
          <div
            onClick={() => setActiveSource(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
              animation: 'fadeIn 0.25s ease',
            }}
          />
          <div style={{
            position: 'fixed', top: '24px', right: '24px', bottom: '24px',
            zIndex: 50, width: '600px',
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
