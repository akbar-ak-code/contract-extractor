import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Shield, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SourceSidebar = ({ activeSource, onClose, dbId }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [matches, setMatches] = useState([]);       // [{quote, page}, ...] resolved chunks
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const prevLabelRef = useRef(null);

  // Resolve the quote into one or more locatable chunks whenever the source changes.
  // The quote itself is untouched — this only changes how we search for it in the PDF.
  useEffect(() => {
    if (!activeSource?.quote || !dbId) return;
    if (activeSource.quote === "No source quote extracted.") return;

    if (prevLabelRef.current !== activeSource.label) {
      setNumPages(null);
      setMatches([]);
      setActiveMatchIdx(0);
      prevLabelRef.current = activeSource.label;
    }

    fetch(`http://localhost:8000/api/pos/${dbId}/find-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote: activeSource.quote })
    })
      .then(res => res.json())
      .then(data => {
        const found = data.matches || [];
        setMatches(found);
        setActiveMatchIdx(0);
        setPageNumber(found.length > 0 ? found[0].page : (data.page || 1));
      })
      .catch(() => { setMatches([]); setPageNumber(1); });
  }, [activeSource, dbId]);

  const activeMatch = matches[activeMatchIdx];

  function goToMatch(idx) {
    if (idx < 0 || idx >= matches.length) return;
    setActiveMatchIdx(idx);
    setPageNumber(matches[idx].page);
  }

  // Highlights the currently active match's short chunk on the current page — far more
  // reliable than searching for the entire original quote, since each chunk has already
  // been confirmed to exist on this specific page by the backend.
  const textRenderer = useCallback(
    (textItem) => {
      const quote = activeMatch?.quote;
      if (!quote) return textItem.str;

      const itemStr = textItem.str;
      const lowerItem = itemStr.toLowerCase();

      const quoteWords = quote.trim().toLowerCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);

      const MIN_WINDOW = 3;
      const MAX_WINDOW = Math.min(quoteWords.length, 12);

      for (let winLen = MAX_WINDOW; winLen >= MIN_WINDOW; winLen--) {
        for (let start = 0; start <= quoteWords.length - winLen; start++) {
          const phrase = quoteWords.slice(start, start + winLen).join(' ');
          const idx = lowerItem.indexOf(phrase);
          if (idx !== -1) {
            const before = itemStr.slice(0, idx);
            const matched = itemStr.slice(idx, idx + phrase.length);
            const after = itemStr.slice(idx + phrase.length);
            return `${before}<mark style="background:rgba(250,204,21,0.80);color:#111;padding:0 2px;border-radius:2px;font-weight:600;">${matched}</mark>${after}`;
          }
        }
      }

      return itemStr;
    },
    [activeMatch]
  );

  if (!activeSource || !dbId) return null;

  const pdfUrl = `http://localhost:8000/api/pos/${dbId}/pdf`;

  return (
    // ── Sidebar shell: fixed width, full height, flex column, NO overflow on the shell itself
    <aside
      className="animate-in slide-in-from-right duration-300 z-50"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '600px',
        height: '100%',         // fill parent height
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        background: '#121212',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.8)',
        overflow: 'hidden',     // prevent the shell from scrolling
      }}
    >
      {/* ── Header: fixed height ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#181818', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', letterSpacing: '0.03em' }}>Source Verification</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Field: {activeSource.label}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 6, borderRadius: 6 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#71717a'; }}>
          <X size={18} />
        </button>
      </div>

      {/* ── Quote panel: scrollable, capped at 32% of sidebar height ── */}
      <div style={{
        flexShrink: 0,
        maxHeight: '32%',
        overflowY: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#1a1a1a',
        padding: '16px 24px',
      }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', fontWeight: 600, marginBottom: 8 }}>
          AI Extracted Passage
        </div>
        <div style={{
          whiteSpace: 'pre-wrap',
          borderLeft: '4px solid #0ea5e9',
          background: 'rgba(0,0,0,0.4)',
          padding: '12px 16px',
          fontFamily: 'monospace',
          fontSize: 12.5,
          lineHeight: 1.7,
          color: '#d4d4d8',
          borderRadius: '0 8px 8px 0',
        }}>
          "{activeSource.quote}"
        </div>
      </div>

      {/* ── Match navigation: only shown when the quote resolved to more than one
           locatable excerpt (e.g. a long composite field spread across the PDF) ── */}
      {matches.length > 1 && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px', background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 11, color: '#93c5fd', fontFamily: 'monospace' }}>
            Excerpt {activeMatchIdx + 1} of {matches.length} (page {activeMatch?.page})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              disabled={activeMatchIdx <= 0}
              onClick={() => goToMatch(activeMatchIdx - 1)}
              style={{ background: 'none', border: 'none', cursor: activeMatchIdx <= 0 ? 'default' : 'pointer', color: activeMatchIdx <= 0 ? '#3f3f46' : '#93c5fd', padding: 4 }}
            ><ChevronLeft size={16} /></button>
            <button
              disabled={activeMatchIdx >= matches.length - 1}
              onClick={() => goToMatch(activeMatchIdx + 1)}
              style={{ background: 'none', border: 'none', cursor: activeMatchIdx >= matches.length - 1 ? 'default' : 'pointer', color: activeMatchIdx >= matches.length - 1 ? '#3f3f46' : '#93c5fd', padding: 4 }}
            ><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Page controls: fixed height ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: '#181818', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(p => p - 1)}
            style={{ background: 'none', border: 'none', cursor: pageNumber <= 1 ? 'default' : 'pointer', color: pageNumber <= 1 ? '#3f3f46' : '#a1a1aa', padding: 4 }}
          ><ChevronLeft size={20} /></button>
          <span style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>Page {pageNumber} of {numPages || '--'}</span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(p => p + 1)}
            style={{ background: 'none', border: 'none', cursor: pageNumber >= numPages ? 'default' : 'pointer', color: pageNumber >= numPages ? '#3f3f46' : '#a1a1aa', padding: 4 }}
          ><ChevronRight size={20} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 6, borderRadius: 4 }}><ZoomOut size={15} /></button>
          <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'monospace', width: 44, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 6, borderRadius: 4 }}><ZoomIn size={15} /></button>
        </div>
      </div>

      {/* ── PDF area: takes ALL remaining space, scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#0a0a0a', display: 'flex', justifyContent: 'center', padding: '24px' }}>
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div style={{ color: '#60a5fa', fontSize: 13, marginTop: 80 }}>Loading PDF...</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            renderMode="canvas" // 🛠️ Crucial for rendering stability on long PDFs
            customTextRenderer={textRenderer}
            className="shadow-2xl shadow-black ring-1 ring-white/10"
          />
        </Document>
      </div>
    </aside>
  );
};

export default SourceSidebar;