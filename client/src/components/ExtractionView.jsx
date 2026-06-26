// src/components/ExtractionView.jsx

import React from 'react';
import { UploadCloud, Hash, Building, MapPin, Clock, AlertTriangle, DollarSign, Shield, List, Edit3, FileText, Sparkles } from 'lucide-react';

const ProfileRow = ({ icon, label, data, setActiveSource }) => {
  const val = data?.value || "Not found";
  const quote = data?.source_quote || "No source quote extracted.";
  const isMissing = val === "Not found" || val === "N/A" || val === "";

  return (
    <div className="group grid grid-cols-12 items-start gap-4 border-b border-white/[0.04] px-6 py-4 transition-colors hover:bg-white/[0.02] last:border-b-0">
      <div className="col-span-12 sm:col-span-4 flex items-center gap-3 text-zinc-400">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
          {icon}
        </span>
        <span className="text-sm font-medium tracking-tight">{label}</span>
      </div>

      <div className={`col-span-10 sm:col-span-7 text-sm leading-relaxed ${isMissing ? 'text-red-400/90 italic' : 'text-zinc-100'}`}>
        {isMissing ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-red-500/20">
            <AlertTriangle size={12} /> {val}
          </span>
        ) : (
          val
        )}
      </div>

      <div className="col-span-2 sm:col-span-1 flex justify-end">
        <button
          onClick={() => setActiveSource({ label, quote })}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-blue-400 opacity-60 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:opacity-100 hover:shadow-lg hover:shadow-blue-500/20 group-hover:opacity-100"
          title="View Source in PDF"
        >
          <Hash size={14} />
        </button>
      </div>
    </div>
  );
};

const Card = ({ title, icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#1a1a1d] to-[#141416] shadow-2xl shadow-black/40 backdrop-blur-xl">
    <header className="flex items-center gap-2.5 border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
        {icon}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">{title}</h2>
    </header>
    <div>{children}</div>
  </section>
);

const ExtractionView = ({ file, loading, error, result, fileInputRef, handleFileSelection, handleAnalyze, setActiveSource }) => (
  <div className="animate-in fade-in duration-500">
    {!result ? (
      <div
        onClick={() => !loading && fileInputRef.current.click()}
        className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-gradient-to-b from-[#1a1a1d] to-[#141416] px-10 py-24 text-center shadow-2xl shadow-black/40 transition-all hover:border-blue-500/40 hover:from-[#1c1c22] cursor-pointer"
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl opacity-50 transition-opacity group-hover:opacity-80" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files[0])}
        />

        <div className="relative">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-500/5 ring-1 ring-inset ring-blue-500/30 transition-transform group-hover:scale-110">
            <UploadCloud size={36} className="text-blue-400" />
          </div>

          <h3 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-100">
            {file ? file.name : "Upload Purchase Order"}
          </h3>
          <p className="text-sm text-zinc-500">
            {file ? "Ready to extract" : "Drop a PDF here or click to browse"}
          </p>

          {file && !loading && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 ring-1 ring-inset ring-white/10 transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-blue-500/50 active:scale-[0.98]"
            >
              <Sparkles size={16} />
              Run Enterprise Extraction
            </button>
          )}

          {loading && (
            <div className="mt-8 flex flex-col items-center gap-3 text-blue-400">
              <div className="spinner h-8 w-8 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
              <p className="text-sm font-medium tracking-tight">Processing via Gemini 3.5 Flash...</p>
            </div>
          )}

          {error && (
            <div className="mx-auto mt-6 inline-flex max-w-md items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        <Card title="Document Headers" icon={<FileText size={14} />}>
          <ProfileRow icon={<Hash size={16} />} label="PO Number" data={result.po_number} setActiveSource={setActiveSource} />
          <ProfileRow icon={<Building size={16} />} label="Vendor Name" data={result.vendor_name} setActiveSource={setActiveSource} />
          <ProfileRow icon={<MapPin size={16} />} label="Contact & Address" data={result.vendor_contact_address} setActiveSource={setActiveSource} />
          <ProfileRow icon={<Clock size={16} />} label="Effective Date" data={result.effective_date} setActiveSource={setActiveSource} />
          <ProfileRow icon={<AlertTriangle size={16} />} label="Lapse / Expiry" data={result.lapse_expiry_date} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={16} />} label="Total Value" data={result.total_value} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Terms & Conditions" icon={<Shield size={14} />}>
          <ProfileRow icon={<Shield size={16} />} label="Conditions of Agreement" data={result.conditions_of_agreement} setActiveSource={setActiveSource} />
          <ProfileRow icon={<DollarSign size={16} />} label="Payment Conditions" data={result.conditions_of_payment} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Signatures" icon={<Edit3 size={14} />}>
          <ProfileRow icon={<Edit3 size={16} />} label="Authorising Signatory" data={result.authorising_signatory} setActiveSource={setActiveSource} />
        </Card>

        <Card title="Line Items" icon={<List size={14} />}>
          <div className="p-6">
            {result.line_items?.status === "found" && result.line_items.value.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full border-collapse text-sm text-zinc-100">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Description</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Qty</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Unit Price</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.line_items.value.map((item, idx) => (
                      <tr key={idx} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 leading-relaxed">{item.description}</td>
                        <td className="px-4 py-3.5 text-center font-mono text-zinc-300">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-400">
                          ${item.unit_price?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => setActiveSource({ label: `Line Item ${idx + 1}`, quote: item.source_quote || "No quote found." })}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/5 bg-white/[0.03] text-blue-400 transition-all hover:border-blue-500/40 hover:bg-blue-500/10"
                            title="View Source in PDF"
                          >
                            <Hash size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/5 py-8 text-sm italic text-zinc-500">
                <List size={16} /> No line items parsed or found in this document.
              </div>
            )}
          </div>
        </Card>
      </div>
    )}
  </div>
);

export default ExtractionView;
