import React, { useState, useEffect, useRef } from 'react';
import { Shield, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Splits text into lowercase word tokens, same convention used on the backend
// (whitespace/punctuation-insensitive) so word boundaries match consistently.
const wordize = (s) => (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];

const SourceSidebar = ({ activeSource, onClose, dbId }) => {
  const [pdfDoc, setPdfDoc] = useState(null);        // raw pdf.js PDFDocumentProxy
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [matches, setMatches] = useState([]);       // [{quote, page}, ...] resolved chunks
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [highlights, setHighlights] = useState([]); // [{x,y,w,h}, ...] CSS-px overlay rects
  const prevLabelRef = useRef(null);
  const firstHighlightElRef = useRef(null);

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
        // activeSource.page is an optional direct hint (e.g. anomalies, which only have a
        // page number from the AI's assessment, not a verbatim quote to search for). Prefer
        // a real text match when one was found; otherwise fall back to the hint over a blind page 1.
        setPageNumber(found.length > 0 ? found[0].page : (activeSource.page || data.page || 1));
      })
      .catch(() => { setMatches([]); setPageNumber(activeSource.page || 1); });
  }, [activeSource, dbId]);

  const activeMatch = matches[activeMatchIdx];

  function goToMatch(idx) {
    if (idx < 0 || idx >= matches.length) return;
    setActiveMatchIdx(idx);
    setPageNumber(matches[idx].page);
  }

  // Computes highlight rectangles by matching the active chunk's WORDS against the page's
  // text items as a sequence — not constrained to a single fragment. PDF text layers
  // routinely split one sentence across several adjacent fragments (e.g. "To" and
  // "WAISL LIMITED" as two separate items), so searching within one fragment at a time
  // (the old approach) frequently found nothing, or matched a much shorter, unrelated
  // phrase. This walks the page's text items as one continuous word stream instead.
  useEffect(() => {
    if (!pdfDoc || !activeMatch?.quote) { setHighlights([]); return; }
    let cancelled = false;

    async function compute() {
      const page = await pdfDoc.getPage(pageNumber);
      const tc = await page.getTextContent();
      const items = tc.items.filter(i => typeof i.str === "string" && i.str.length > 0);

      const searchWords = wordize(activeMatch.quote);
      if (!searchWords.length) { if (!cancelled) setHighlights([]); return; }

      const viewport = page.getViewport({ scale });
      const [vA, vB, vC, vD, vE, vF] = viewport.transform;

      const pdfWords = [];
      for (const item of items) {
        wordize(item.str).forEach(word => pdfWords.push({ word, item }));
      }

      let seqLen = 0, seqItems = [];
      for (let sw = 0; sw < searchWords.length; sw++) {
        for (let pi = 0; pi < pdfWords.length; pi++) {
          if (pdfWords[pi].word !== searchWords[sw]) continue;
          let len = 0;
          while (sw + len < searchWords.length && pi + len < pdfWords.length &&
                 pdfWords[pi + len].word === searchWords[sw + len]) len++;
          if (len > seqLen) { seqLen = len; seqItems = pdfWords.slice(pi, pi + len).map(w => w.item); }
          if (seqLen >= 20) break;
        }
        if (seqLen >= 20) break;
      }

      if (cancelled || seqLen < 2) { if (!cancelled) setHighlights([]); return; }

      const highlightItems = new Set(seqItems);
      const rects = [];
      for (const item of items) {
        if (!highlightItems.has(item)) continue;
        const cssX = vA * item.transform[4] + vC * item.transform[5] + vE;
        const cssY = vB * item.transform[4] + vD * item.transform[5] + vF;
        const fontSizePx = Math.hypot(item.transform[0], item.transform[1]) * scale;
        const h = fontSizePx * 1.25;
        rects.push({
          x: cssX,
          y: cssY - h * 0.85,
          w: Math.max((item.width || 0) * scale, 4),
          h: Math.max(h, 8),
        });
      }
      if (!cancelled) setHighlights(rects);
    }

    compute().catch(() => { if (!cancelled) setHighlights([]); });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, activeMatch, scale]);

  // Scroll the highlight into view once it's actually in the DOM. Using scrollIntoView
  // on the real rendered element (rather than computing a scrollTop offset by hand)
  // avoids coordinate-space mismatches between the highlight's position-within-page and
  // the scroll container's own coordinate system. Runs as an effect (not inside the
  // compute() above) so it fires only after React has committed highlights to the DOM
  // and the ref is guaranteed to be attached - critical for excerpts that land on the
  // same page as the previous one, where nothing else would trigger a re-scroll.
  useEffect(() => {
    if (highlights.length === 0) return;
    firstHighlightElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlights]);

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
          onLoadSuccess={(pdf) => { setPdfDoc(pdf); setNumPages(pdf.numPages); }}
          loading={<div style={{ color: '#60a5fa', fontSize: 13, marginTop: 80 }}>Loading PDF...</div>}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              renderMode="canvas" // 🛠️ Crucial for rendering stability on long PDFs
              className="shadow-2xl shadow-black ring-1 ring-white/10"
            />
            {/* Highlight overlay: absolutely-positioned rects computed from the page's
                real text-item coordinates, independent of fragment boundaries. */}
            {highlights.map((r, i) => (
              <div
                key={i}
                ref={i === 0 ? firstHighlightElRef : null}
                style={{
                  position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
                  background: 'rgba(250,204,21,0.55)', mixBlendMode: 'multiply',
                  borderRadius: 2, pointerEvents: 'none',
                }}
              />
            ))}
          </div>
        </Document>
      </div>
    </aside>
  );
};

export default SourceSidebar;
