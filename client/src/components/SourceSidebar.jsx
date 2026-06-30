import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Shield, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Reusable toast notification matching application theme
const Toast = ({ msg, onClose }) => {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [msg, onClose]);

  if (!msg) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 28,
      zIndex: 9999,
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 10,
      padding: '11px 18px',
      color: '#f87171',
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'fadeIn 0.2s ease',
    }}>
      {msg}
    </div>
  );
};

const SourceSidebar = ({ activeSource, onClose, dbId }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfIndex, setPdfIndex] = useState(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [matchedRawItems, setMatchedRawItems] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [pageObject, setPageObject] = useState(null);

  const prevLabelRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const pageWrapperRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const indexedDbIdRef = useRef(null);
  const pendingSearchRef = useRef(null);

  // Helper: Normalize query/source quote
  const normalizeQueryStr = (q) => {
    return (q || "")
      .toLowerCase()
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
      .trim();
  };

  // Helper: Find text items that match normalized indices on a page
  const getMatchedItemsForPage = (pageData, startNormIdx, endNormIdx) => {
    const startFullIdx = pageData.normToFullMap[startNormIdx];
    const endFullIdx = pageData.normToFullMap[endNormIdx];
    if (startFullIdx === undefined || endFullIdx === undefined) return [];
    
    const startItemInfo = pageData.charMap[startFullIdx];
    const endItemInfo = pageData.charMap[endFullIdx];
    if (!startItemInfo || !endItemInfo) return [];

    const matchedItems = [];
    for (let i = startItemInfo.itemIndex; i <= endItemInfo.itemIndex; i++) {
      matchedItems.push(pageData.textItems[i]);
    }
    return matchedItems;
  };

  // Indexing logic
  const indexPdf = async (pdfDoc) => {
    setIsIndexing(true);
    try {
      const index = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        const textItems = textContent.items.map(item => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height
        }));

        let fullText = '';
        const charMap = [];
        textItems.forEach((item, itemIdx) => {
          const str = item.str;
          for (let j = 0; j < str.length; j++) {
            charMap.push({ itemIndex: itemIdx, charOffset: j });
          }
          fullText += str;
          fullText += ' ';
          charMap.push({ itemIndex: itemIdx, charOffset: str.length });
        });

        let normalizedText = '';
        const normToFullMap = [];
        for (let j = 0; j < fullText.length; j++) {
          const char = fullText[j];
          if (char === '\n' || char === '\r' || char === ' ') {
            if (normalizedText[normalizedText.length - 1] !== ' ') {
              normalizedText += ' ';
              normToFullMap.push(j);
            }
          } else if (/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g.test(char)) {
            // ignore punctuation
          } else {
            normalizedText += char.toLowerCase();
            normToFullMap.push(j);
          }
        }

        index.push({
          pageNumber: i,
          textItems,
          fullText,
          normalizedText,
          normToFullMap,
          charMap
        });
      }
      setPdfIndex(index);
      indexedDbIdRef.current = dbId;

      // Run pending search if there is one
      if (pendingSearchRef.current) {
        runSearch(pendingSearchRef.current, index);
        pendingSearchRef.current = null;
      }
    } catch (err) {
      console.error("Failed to index PDF:", err);
    } finally {
      setIsIndexing(false);
    }
  };

  // Search logic
  const runSearch = (quote, indexData = pdfIndex) => {
    if (!indexData) return;
    const normQuery = normalizeQueryStr(quote);
    if (!normQuery) return;

    let found = null;

    // 1. Exact / Case-insensitive match on text layer
    for (let pageIdx = 0; pageIdx < indexData.length; pageIdx++) {
      const pageData = indexData[pageIdx];
      const startNormIdx = pageData.normalizedText.indexOf(normQuery);
      if (startNormIdx !== -1) {
        found = {
          pageNumber: pageData.pageNumber,
          matchedItems: getMatchedItemsForPage(pageData, startNormIdx, startNormIdx + normQuery.length - 1)
        };
        break;
      }
    }

    // 2. Fuzzy fallback: match subsequence of words
    if (!found) {
      const words = normQuery.split(' ').filter(w => w.length > 2);
      if (words.length >= 2) {
        let maxWordLenMatch = 0;
        // Try searching for word windows from size 5 down to 2
        for (let len = Math.min(words.length, 5); len >= 2; len--) {
          for (let start = 0; start <= words.length - len; start++) {
            const subQuery = words.slice(start, start + len).join(' ');
            for (let pageIdx = 0; pageIdx < indexData.length; pageIdx++) {
              const pageData = indexData[pageIdx];
              const idx = pageData.normalizedText.indexOf(subQuery);
              if (idx !== -1 && len > maxWordLenMatch) {
                found = {
                  pageNumber: pageData.pageNumber,
                  matchedItems: getMatchedItemsForPage(pageData, idx, idx + subQuery.length - 1)
                };
                maxWordLenMatch = len;
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
      }
    }

    if (found) {
      setMatchedRawItems(found.matchedItems);
      setPageNumber(found.pageNumber);
      setScale(1.35); // Zoom to 135%
      shouldScrollRef.current = true;
    } else {
      setToastMsg("Source location could not be found in this document.");
    }
  };

  // Reset index and highlights when dbId changes
  useEffect(() => {
    if (dbId && indexedDbIdRef.current !== dbId) {
      setPdfIndex(null);
      setHighlights([]);
      setMatchedRawItems(null);
      setPageObject(null);
    }
  }, [dbId]);

  // Perform search / navigation when a field changes or when locate requested
  useEffect(() => {
    if (!activeSource?.quote || !dbId) return;
    if (activeSource.quote === "No source quote extracted.") {
      setMatchedRawItems(null);
      setHighlights([]);
      return;
    }

    // Reset page if switching labels
    if (prevLabelRef.current !== activeSource.label) {
      prevLabelRef.current = activeSource.label;
      setHighlights([]);
      setMatchedRawItems(null);
    }

    // Bounding Box Support
    if (activeSource.x !== undefined && activeSource.y !== undefined && activeSource.width !== undefined && activeSource.height !== undefined) {
      const targetPage = activeSource.pageNumber || activeSource.page || 1;
      setMatchedRawItems([{
        isBoundingBox: true,
        x: activeSource.x,
        y: activeSource.y,
        width: activeSource.width,
        height: activeSource.height
      }]);
      setPageNumber(targetPage);
      setScale(1.35);
      shouldScrollRef.current = true;
      return;
    }

    // If PDF index is ready, search immediately, else queue it
    if (pdfIndex && indexedDbIdRef.current === dbId) {
      runSearch(activeSource.quote);
    } else {
      pendingSearchRef.current = activeSource.quote;
    }
  }, [activeSource, dbId, pdfIndex]);

  // Recalculate highlighted coordinates when page scale or matched raw items change
  useEffect(() => {
    if (!pageObject || !matchedRawItems) {
      setHighlights([]);
      return;
    }

    const viewport = pageObject.getViewport({ scale });
    const rects = [];

    matchedRawItems.forEach(item => {
      if (item.isBoundingBox) {
        // Convert bounding box points
        const x = item.x;
        const y = item.y;
        const w = item.width;
        const h = item.height;
        
        const isNormalized = (x <= 1 && y <= 1 && w <= 1 && h <= 1);
        if (isNormalized) {
          rects.push({
            left: x * viewport.width,
            top: y * viewport.height,
            width: w * viewport.width,
            height: h * viewport.height
          });
        } else {
          const [x1, y1] = viewport.convertToViewportPoint(x, y);
          const [x2, y2] = viewport.convertToViewportPoint(x + w, y + h);
          rects.push({
            left: Math.min(x1, x2),
            top: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1)
          });
        }
      } else {
        // Convert text item transform to viewport points
        const [x, y] = [item.transform[4], item.transform[5]];
        const height = item.height || item.transform[3];
        
        const [x1, y1] = viewport.convertToViewportPoint(x, y);
        const [x2, y2] = viewport.convertToViewportPoint(x + item.width, y + height);

        rects.push({
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1)
        });
      }
    });

    setHighlights(rects);

    // Scroll to center target once rendering is ready
    if (shouldScrollRef.current && rects.length > 0) {
      setTimeout(() => {
        const container = pdfContainerRef.current;
        const wrapper = pageWrapperRef.current;
        if (!container || !wrapper) return;

        // Find average bounding box center
        let minTop = Infinity, maxBottom = -Infinity;
        let minLeft = Infinity, maxRight = -Infinity;
        rects.forEach(r => {
          if (r.top < minTop) minTop = r.top;
          if (r.top + r.height > maxBottom) maxBottom = r.top + r.height;
          if (r.left < minLeft) minLeft = r.left;
          if (r.left + r.width > maxRight) maxRight = r.left + r.width;
        });

        const centerH = minTop + (maxBottom - minTop) / 2;
        const centerW = minLeft + (maxRight - minLeft) / 2;

        const targetY = wrapper.offsetTop + centerH - container.clientHeight / 2;
        const targetX = wrapper.offsetLeft + centerW - container.clientWidth / 2;

        container.scrollTo({
          left: Math.max(0, targetX),
          top: Math.max(0, targetY),
          behavior: 'smooth'
        });
        shouldScrollRef.current = false;
      }, 100);
    }
  }, [pageObject, scale, matchedRawItems]);

  const handleLocateQuote = () => {
    if (activeSource?.quote) {
      runSearch(activeSource.quote);
    }
  };

  if (!activeSource || !dbId) return null;

  const pdfUrl = `http://localhost:8000/api/pos/${dbId}/pdf`;

  return (
    <aside
      className="animate-in slide-in-from-right duration-300 z-50"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '600px',
        height: '100%',
        borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(18, 18, 20, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="#34d399" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399', letterSpacing: '0.03em' }}>Source Verification</span>
              {isIndexing && (
                <span className="animate-pulse" style={{ fontSize: 10, color: '#60a5fa' }}>(Indexing PDF...)</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Field: {activeSource.label}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 6, borderRadius: 6 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#71717a'; }}>
          <X size={18} />
        </button>
      </div>

      {/* Quote panel with View in PDF button */}
      <div style={{
        flexShrink: 0,
        maxHeight: '32%',
        overflowY: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'transparent',
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
        {activeSource.quote !== "No source quote extracted." && (
          <div style={{ display: 'flex', marginTop: 12 }}>
            <button
              onClick={handleLocateQuote}
              title="Open source location"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '2px 0',
                transition: 'all 0.15s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#93c5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#60a5fa'; }}
            >
              <span>🔗</span> View in PDF
            </button>
          </div>
        )}
      </div>

      {/* Page controls */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            disabled={pageNumber <= 1}
            onClick={() => { setPageNumber(p => p - 1); setHighlights([]); setMatchedRawItems(null); }}
            style={{ background: 'none', border: 'none', cursor: pageNumber <= 1 ? 'default' : 'pointer', color: pageNumber <= 1 ? '#3f3f46' : '#a1a1aa', padding: 4 }}
          ><ChevronLeft size={20} /></button>
          <span style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>Page {pageNumber} of {numPages || '--'}</span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => { setPageNumber(p => p + 1); setHighlights([]); setMatchedRawItems(null); }}
            style={{ background: 'none', border: 'none', cursor: pageNumber >= numPages ? 'default' : 'pointer', color: pageNumber >= numPages ? '#3f3f46' : '#a1a1aa', padding: 4 }}
          ><ChevronRight size={20} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 6, borderRadius: 4 }}><ZoomOut size={15} /></button>
          <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'monospace', width: 44, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 6, borderRadius: 4 }}><ZoomIn size={15} /></button>
        </div>
      </div>

      {/* PDF viewport area */}
      <div 
        ref={pdfContainerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#0a0a0a', display: 'flex', justifyContent: 'center', padding: '24px', position: 'relative' }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={(pdf) => {
            setNumPages(pdf.numPages);
            if (indexedDbIdRef.current !== dbId) {
              indexPdf(pdf);
            }
          }}
          loading={<div style={{ color: '#60a5fa', fontSize: 13, marginTop: 80 }}>Loading PDF...</div>}
        >
          <div style={{ position: 'relative' }} ref={pageWrapperRef}>
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              renderMode="canvas"
              onLoadSuccess={setPageObject}
              className="shadow-2xl shadow-black ring-1 ring-white/10"
            />
            {highlights.map((h, index) => (
              <div
                key={index}
                className="pdf-source-highlight"
                style={{
                  left: h.left,
                  top: h.top,
                  width: h.width,
                  height: h.height,
                }}
              />
            ))}
          </div>
        </Document>
      </div>

      <Toast msg={toastMsg} onClose={() => setToastMsg('')} />
    </aside>
  );
};

export default SourceSidebar;