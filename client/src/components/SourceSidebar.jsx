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
  const prevLabelRef = useRef(null);

  // Auto-jump to the page containing the quote whenever the source changes
  useEffect(() => {
    if (!activeSource?.quote || !dbId) return;
    if (activeSource.quote === "No source quote extracted.") return;

    // Reset on new field open
    if (prevLabelRef.current !== activeSource.label) {
      setPageNumber(1);
      setNumPages(null);
      prevLabelRef.current = activeSource.label;
    }

    const encodedQuote = encodeURIComponent(activeSource.quote);
    fetch(`http://localhost:8000/api/pos/${dbId}/find-page?quote=${encodedQuote}`)
      .then(res => res.json())
      .then(data => { if (data.page) setPageNumber(data.page); })
      .catch(() => setPageNumber(1));
  }, [activeSource, dbId]);

  // ── Highlight fix: slide a window of N words across the ENTIRE quote
  // so we can match any sub-phrase, not just the beginning.
  // react-pdf gives us one small text span at a time — often just a line —
  // so we try windows of decreasing length until we find a match.
  const textRenderer = useCallback(
    (textItem) => {
      const quote = activeSource?.quote;
      if (!quote || quote === "No source quote extracted.") return textItem.str;

      const itemStr = textItem.str;
      const lowerItem = itemStr.toLowerCase();

      // Normalize the quote: collapse all whitespace to single spaces
      const quoteWords = quote.trim().toLowerCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);

      // Try windows from large → small (min 3 words) sliding across the whole quote
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
    [activeSource]
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

      {/* ── Quote panel: scrollable, capped at 35% of sidebar height ── */}
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
            customTextRenderer={textRenderer}
            className="shadow-2xl shadow-black ring-1 ring-white/10"
          />
        </Document>
      </div>
    </aside>
  );
};

export default SourceSidebar;
