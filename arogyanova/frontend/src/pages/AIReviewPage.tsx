import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { InteractionCheckResult } from '../types';

export default function AIReviewPage() {
  // Interaction State
  const [medicinesToCheck, setMedicinesToCheck] = useState<string[]>([
    'Aspirin',
    'Warfarin',
  ]);
  const [newMedName, setNewMedName] = useState('');
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionResult, setInteractionResult] = useState<InteractionCheckResult | null>(null);

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
          <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-primary dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-text dark:text-white">AI drug-interaction check</h2>
        </div>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
          Check a list of medicines for dangerous combinations before prescribing or dispensing
        </p>
      </div>

      {/* TAB 1: INTERACTION CHECKER */}
      {(
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
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
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

            <div className="pt-3 border-t border-border dark:border-[#24352C] flex justify-end">
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
              <div className="flex items-center justify-between border-b border-border dark:border-[#24352C] pb-4">
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
                      className="p-4 rounded-xl border border-border dark:border-[#24352C] bg-slate-50/70 dark:bg-[#121B17]/70 text-xs space-y-1.5"
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
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
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

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#121B17] border border-border dark:border-[#24352C] text-[11px] text-text-secondary dark:text-slate-400 italic">
                * {interactionResult.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
