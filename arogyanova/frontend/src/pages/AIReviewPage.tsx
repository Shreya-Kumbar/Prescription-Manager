import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  HelpCircle,
  FileSearch,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { InteractionCheckResult, OCRResult } from '../types';

export default function AIReviewPage() {
  const [activeTab, setActiveTab] = useState<'ocr' | 'interactions'>('interactions');

  // OCR State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // Interaction State
  const [medicinesToCheck, setMedicinesToCheck] = useState<string[]>([
    'Aspirin',
    'Warfarin',
  ]);
  const [newMedName, setNewMedName] = useState('');
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionResult, setInteractionResult] = useState<InteractionCheckResult | null>(null);

  // Handlers for OCR
  const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOcrFile(e.target.files[0]);
    }
  };

  const handleRunOcr = async () => {
    if (!ocrFile) {
      toast.error('Please select an image file first.');
      return;
    }

    try {
      setOcrLoading(true);
      const formData = new FormData();
      formData.append('file', ocrFile);

      const res = await api.post('/ai/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setOcrResult(res.data);
      toast.success('Prescription image processed successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'OCR extraction failed.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Handlers for Interactions
  const addMedicine = () => {
    if (!newMedName.trim()) return;
    if (medicinesToCheck.includes(newMedName.trim())) {
      toast.error('Medicine already in the list.');
      return;
    }
    setMedicinesToCheck([...medicinesToCheck, newMedName.trim()]);
    setNewMedName('');
  };

  const removeMedicine = (name: string) => {
    setMedicinesToCheck(medicinesToCheck.filter((m) => m !== name));
  };

  const handleCheckInteractions = async () => {
    if (medicinesToCheck.length < 2) {
      toast.error('Please add at least 2 medications to check for drug interactions.');
      return;
    }

    try {
      setInteractionLoading(true);
      const res = await api.post('/ai/interaction-check', {
        medicines: medicinesToCheck,
      });
      setInteractionResult(res.data);
      if (res.data.has_interactions) {
        toast('Drug interactions detected. Please review carefully.', { icon: '⚠️' });
      } else {
        toast.success('No major interactions detected among selected medications.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Interaction check service unavailable.');
    } finally {
      setInteractionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-primary dark:text-teal-400">
            <Sparkles className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-text dark:text-white">AI Clinical Review &amp; Safety</h2>
        </div>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
          Decision-support tools for prescription digitization and pharmaceutical interaction screening
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border dark:border-[#233044] text-xs font-medium">
        <button
          onClick={() => setActiveTab('interactions')}
          className={`py-3 px-5 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'interactions'
              ? 'border-primary text-primary dark:text-teal-400 font-bold'
              : 'border-transparent text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Drug-Drug Interaction Checker
        </button>
        <button
          onClick={() => setActiveTab('ocr')}
          className={`py-3 px-5 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ocr'
              ? 'border-primary text-primary dark:text-teal-400 font-bold'
              : 'border-transparent text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-white'
          }`}
        >
          <FileSearch className="w-4 h-4" /> Prescription OCR Extraction
        </button>
      </div>

      {/* TAB 1: INTERACTION CHECKER */}
      {activeTab === 'interactions' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text dark:text-white">Select Medications for Screening</h3>
              <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                Screen combinations for contraindications, pharmacokinetic interactions, and synergistic risks
              </p>
            </div>

            {/* Input & Add */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMedicine()}
                placeholder="Enter medication name (e.g. Metformin, Lisinopril, Atorvastatin, Warfarin)..."
                className="input text-xs"
              />
              <button
                type="button"
                onClick={addMedicine}
                className="btn-secondary text-xs shrink-0 py-2.5"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Selected Pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {medicinesToCheck.map((med) => (
                <span
                  key={med}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40"
                >
                  {med}
                  <button
                    onClick={() => removeMedicine(med)}
                    className="p-0.5 hover:text-rose-600 dark:hover:text-rose-400 rounded-full"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="pt-3 border-t border-border dark:border-[#233044] flex justify-end">
              <button
                onClick={handleCheckInteractions}
                disabled={interactionLoading || medicinesToCheck.length < 2}
                className="btn-primary text-xs shadow-xs"
              >
                {interactionLoading ? 'Analyzing...' : 'Run Interaction Analysis'}
              </button>
            </div>
          </div>

          {/* Results Display */}
          {interactionResult && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border dark:border-[#233044] pb-4">
                <div className="flex items-center gap-2">
                  {interactionResult.has_interactions ? (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-text dark:text-white">
                      {interactionResult.has_interactions
                        ? `${interactionResult.interactions.length} Clinical Interaction(s) Flagged`
                        : 'No Adverse Interactions Detected'}
                    </h4>
                    <p className="text-xs text-text-secondary dark:text-slate-400">
                      Checked at {new Date(interactionResult.checked_at).toLocaleTimeString()} via{' '}
                      {interactionResult.source}
                    </p>
                  </div>
                </div>
              </div>

              {interactionResult.interactions.length > 0 && (
                <div className="space-y-3">
                  {interactionResult.interactions.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-border dark:border-[#233044] bg-slate-50/70 dark:bg-[#0F172A]/70 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text dark:text-white text-sm capitalize">
                          {item.drug_a} + {item.drug_b}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            item.severity === 'contraindicated'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : item.severity === 'major'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {item.severity} Severity
                        </span>
                      </div>
                      <p className="text-text-secondary dark:text-slate-400 leading-relaxed">{item.description}</p>
                      <p className="text-[10px] text-text-light dark:text-slate-500 pt-1">Source: {item.source}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-border dark:border-[#233044] text-[11px] text-text-secondary dark:text-slate-400 italic">
                * {interactionResult.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OCR EXTRACTION */}
      {activeTab === 'ocr' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text dark:text-white">Prescription Document OCR</h3>
              <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                Upload scanned prescription slip (JPEG, PNG, WebP) to extract structured clinical fields
              </p>
            </div>

            <div className="border-2 border-dashed border-border dark:border-[#233044] rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-text-light dark:text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-text dark:text-white">
                {ocrFile ? ocrFile.name : 'Select or drop a prescription image'}
              </p>
              <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1 mb-4">
                Supported formats: PNG, JPG, WebP (Max 10 MB)
              </p>
              <label className="btn-secondary text-xs cursor-pointer inline-flex">
                <span>Browse Local Files</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleOcrFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunOcr}
                disabled={!ocrFile || ocrLoading}
                className="btn-primary text-xs shadow-xs"
              >
                {ocrLoading ? 'Extracting Text...' : 'Run OCR Extraction'}
              </button>
            </div>
          </div>

          {/* OCR Result Review */}
          {ocrResult && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border dark:border-[#233044] pb-3">
                <h4 className="text-sm font-bold text-text dark:text-white">Extracted Prescription Fields</h4>
                <span className="text-xs text-text-secondary dark:text-slate-400">
                  Provider: {ocrResult.provider}
                </span>
              </div>

              {ocrResult.medicines?.length > 0 ? (
                <div className="overflow-x-auto border border-border dark:border-[#233044] rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0F172A] text-text-secondary dark:text-slate-400 border-b border-border dark:border-[#233044] uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Candidate Medication</th>
                        <th className="py-2.5 px-3">Extracted Strength</th>
                        <th className="py-2.5 px-3">Confidence Status</th>
                        <th className="py-2.5 px-3">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-[#233044]">
                      {ocrResult.medicines.map((med, i) => (
                        <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-[#162238] transition-colors">
                          <td className="py-3 px-3 font-semibold text-text dark:text-white">{med.name}</td>
                          <td className="py-3 px-3 font-mono text-text dark:text-white">
                            {med.strength || 'Not detected'}
                          </td>
                          <td className="py-3 px-3">
                            {med.is_uncertain ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                                Requires Doctor Verification
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                High Confidence
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-text-secondary dark:text-slate-400">
                            Confirmed in Clinical Form
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-text-secondary dark:text-slate-400">
                  Raw text extracted: {ocrResult.raw_text || 'No structured medications identified.'}
                </p>
              )}

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200">
                <strong>Medical Safeguard:</strong> All AI-extracted candidate fields must be manually
                reviewed and authorized by a licensed prescriber before issuing a final prescription.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
