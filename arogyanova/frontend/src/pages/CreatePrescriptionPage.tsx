import { VitalAlerts, VitalTiles } from '../components/vitals/VitalsPanel';
import type { Vitals } from '../types';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Save,
  Send,
  Eye,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { prescriptionService } from '../services/prescriptionService';
import type { Medication, User, InteractionCheckResult } from '../types';
import Modal from '../components/ui/Modal';
import { rxNo } from '../utils/rxNumber';

interface PrescItemState {
  medication_id: string;
  medication_name: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration_days: number;
  quantity: string;
  instructions: string;
}

export default function CreatePrescriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromId = searchParams.get('from'); // rewriting a flagged prescription
  const [flagNote, setFlagNote] = useState('');

  // Master Data
  const [patients, setPatients] = useState<User[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Form State
  const [patientId, setPatientId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpDate, setFollowUpDate] = useState('');

  // Medication Items State
  const [items, setItems] = useState<PrescItemState[]>([
    {
      medication_id: '',
      medication_name: '',
      strength: '500mg',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'Twice daily',
      duration_days: 7,
      quantity: '14 tablets',
      instructions: 'Take after meals with water.',
    },
  ]);

  // AI Interaction Check state
  const [interactionResult, setInteractionResult] = useState<InteractionCheckResult | null>(null);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);

  // Preview Modal
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [patRes, medRes] = await Promise.all([
        api.get('/patients'),
        api.get('/medications'),
      ]);
      setPatients(patRes.data || []);
      setMedications(medRes.data || []);
      if (fromId) {
        // Start from the flagged prescription so the doctor only fixes what the pharmacist raised
        const old = await prescriptionService.get(fromId);
        setFlagNote([...(old.pharmacy_history ?? [])].reverse().find((h) => h.action === 'flag')?.notes ?? '');
        if (old.patient?.id) setPatientId(old.patient.id);
        setDiagnosis(old.diagnosis ?? '');
        setClinicalNotes(old.clinical_notes ?? '');
        if (old.items?.length) {
          setItems(old.items.map((it) => ({
            medication_id: it.medication_id,
            medication_name: it.medication?.generic_name ?? '',
            strength: it.strength,
            dosage: it.dosage,
            route: it.route,
            frequency: it.frequency,
            duration_days: it.duration_days,
            quantity: it.quantity,
            instructions: it.instructions ?? '',
          })));
        }
      } else if (searchParams.get('patient')) {
        setPatientId(searchParams.get('patient') as string);
      } else if (patRes.data?.length > 0) {
        setPatientId(patRes.data[0].id);
      }
    } catch {
      toast.error('Could not load patients or medication catalogue.');
    }
  };

  const handleMedicationChange = (index: number, medId: string) => {
    const selected = medications.find((m) => m.id === medId);
    const updated = [...items];
    updated[index].medication_id = medId;
    if (selected) {
      updated[index].medication_name = selected.generic_name;
      updated[index].strength = selected.strength;
    }
    setItems(updated);
  };

  const handleItemFieldChange = (index: number, field: keyof PrescItemState, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        medication_id: '',
        medication_name: '',
        strength: '500mg',
        dosage: '1 tablet',
        route: 'oral',
        frequency: 'Once daily',
        duration_days: 5,
        quantity: '5 tablets',
        instructions: 'Take after breakfast.',
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('A prescription must include at least one medication line.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Run AI Drug Interaction Check
  const runInteractionCheck = async () => {
    // Check the new medicines together with what the patient is already taking
    const names = Array.from(new Set([
      ...items.map((i) => i.medication_name.trim()),
      ...currentMeds.map((m) => m.name),
    ].filter((n) => n.length > 0)));

    if (names.length < 2) {
      toast.error('Add at least two medications to check for potential drug-drug interactions.');
      return;
    }

    try {
      setIsCheckingInteractions(true);
      const res = await api.post('/ai/interaction-check', { medicines: names });
      setInteractionResult(res.data);
      if (res.data.has_interactions) {
        toast('Potential drug interactions flagged. Please review.', { icon: '⚠️' });
      } else {
        toast.success('No major drug interactions detected in local dataset.');
      }
    } catch {
      toast.error('Interaction checking service is currently unavailable.');
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  const handleSubmit = async (finalizeNow: boolean) => {
    if (!patientId) {
      toast.error('Please select an authorized patient.');
      return;
    }

    for (const item of items) {
      if (!item.medication_id) {
        toast.error('Please select a medication for each line.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        patient_id: patientId,
        issue_date: issueDate,
        follow_up_date: followUpDate || undefined,
        diagnosis,
        clinical_notes: clinicalNotes,
        replaces_id: fromId || undefined,
        items: items.map((i) => ({
          medication_id: i.medication_id,
          strength: i.strength,
          dosage: i.dosage,
          route: i.route,
          frequency: i.frequency,
          duration_days: Number(i.duration_days),
          quantity: i.quantity,
          instructions: i.instructions,
        })),
      };

      const created = await prescriptionService.create(payload);

      if (finalizeNow) {
        await prescriptionService.finalize(created.id);
        toast.success('Prescription created and finalized successfully!');
      } else {
        toast.success('Prescription draft saved successfully!');
      }

      navigate(`/prescriptions/${created.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save prescription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === patientId);
  const [latestVitals, setLatestVitals] = useState<Vitals | null>(null);
  useEffect(() => {
    setLatestVitals(null);
    if (!patientId) return;
    api.get(`/patients/${patientId}/vitals`, { params: { limit: 1 } })
      .then((r) => setLatestVitals(r.data[0] ?? null))
      .catch(() => setLatestVitals(null));
  }, [patientId]);

  // Medicines the patient is currently on — from ANY doctor — so nothing is prescribed blind
  const [currentMeds, setCurrentMeds] = useState<{ name: string; detail: string; doctor: string; rxId: string }[]>([]);
  useEffect(() => {
    setCurrentMeds([]);
    if (!patientId) return;
    (async () => {
      try {
        const list = await prescriptionService.list({ patient_id: patientId, status: 'active', per_page: 20 });
        const details = await Promise.all(list.items.filter((p) => p.id !== fromId).map((p) => prescriptionService.get(p.id)));
        setCurrentMeds(details.flatMap((d) => d.items.map((it) => ({
          name: it.medication?.generic_name ?? 'Medicine',
          detail: `${it.strength} · ${it.dosage} · ${it.frequency}`,
          doctor: d.doctor ? `Dr. ${d.doctor.first_name} ${d.doctor.last_name}` : '',
          rxId: d.id,
        }))));
      } catch {
        setCurrentMeds([]);
      }
    })();
  }, [patientId, fromId]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/prescriptions')}
            className="p-2 rounded-lg border border-border dark:border-[#24352C] bg-white dark:bg-[#1C2922] text-text-secondary dark:text-slate-300 hover:text-text dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-text dark:text-white">{fromId ? `Corrected version of ${rxNo(fromId)}` : 'New Clinical Prescription'}</h2>
            <p className="text-xs text-text-secondary dark:text-slate-400">
              Author an auditable digital prescription for an authorized patient
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="btn-secondary text-xs"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="btn-secondary text-xs text-text dark:text-white font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="btn-primary text-xs shadow-xs"
          >
            <Send className="w-3.5 h-3.5" /> Finalize &amp; Issue
          </button>
        </div>

      </div>

      {fromId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
          <p className="font-semibold">Correcting a flagged prescription ({rxNo(fromId)})</p>
          {flagNote && <p className="mt-0.5">Pharmacist's concern: “{flagNote}”</p>}
          <p className="mt-0.5 opacity-80">Fix the problem below. When you click <b>Finalize &amp; Issue</b>, {rxNo(fromId)} is cancelled automatically, the patient is told to follow this one, and the pharmacist gets it in their queue.</p>
        </div>
      )}

      {/* 1. Patient Selection */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-emerald-400 border-b border-border dark:border-[#24352C] pb-2">
          1. Patient Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Select Authorized Patient *</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="input text-xs"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Issue Date *</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>

        {selectedPatient && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#121B17] border border-border dark:border-[#24352C] text-xs flex flex-wrap gap-4 text-text-secondary dark:text-slate-300">
            <span><strong className="text-text dark:text-white">Name:</strong> {selectedPatient.first_name} {selectedPatient.last_name}</span>
            <span><strong className="text-text dark:text-white">DOB:</strong> {selectedPatient.patient_profile?.date_of_birth || 'Not recorded'}</span>
            <span><strong className="text-text dark:text-white">Blood Group:</strong> {selectedPatient.patient_profile?.blood_group || 'Not recorded'}</span>
            <span><strong className="text-text dark:text-white">Known Allergies:</strong> <span className="text-rose-600 dark:text-rose-400 font-medium">{selectedPatient.patient_profile?.allergies || 'None recorded'}</span></span>
          </div>
        )}
        {selectedPatient && latestVitals && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-secondary dark:text-slate-400">
              Latest vitals · {new Date(latestVitals.recorded_at).toLocaleString()} · by {latestVitals.recorded_by_name}
            </p>
            <VitalTiles v={latestVitals} />
            <VitalAlerts vitals={latestVitals} />
          </div>
        )}
        {selectedPatient && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-secondary dark:text-slate-400">
              Currently taking (active prescriptions from all doctors)
            </p>
            {currentMeds.length === 0 ? (
              <p className="text-xs text-text-secondary dark:text-slate-400">No active medicines.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {currentMeds.map((m, i) => (
                  <li key={i} className="rounded-lg border border-border dark:border-[#24352C] px-3 py-2 text-xs">
                    <span className="font-semibold text-text dark:text-white">{m.name}</span>
                    <span className="text-text-secondary dark:text-slate-400"> · {m.detail}</span>
                    <span className="block text-[11px] text-text-secondary dark:text-slate-500">{m.doctor}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 2. Clinical Evaluation */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-emerald-400 border-b border-border dark:border-[#24352C] pb-2">
          2. Clinical Information &amp; Diagnosis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Primary Diagnosis</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute upper respiratory infection, Type 2 DM"
              className="input text-xs"
            />
          </div>

          <div>
            <label className="label">Follow-up Date (Optional)</label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>

        <div>
          <label className="label">Clinical Notes &amp; Instructions</label>
          <textarea
            rows={2}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Dietary precautions, hydration advice, or clinical observations..."
            className="input text-xs"
          />
        </div>
      </div>

      {/* 3. Medication Builder */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border dark:border-[#24352C] pb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-emerald-400">
            3. Medication Builder ({items.length} line items)
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runInteractionCheck}
              disabled={isCheckingInteractions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {isCheckingInteractions ? 'Checking...' : 'Check Drug Interactions'}
            </button>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary text-xs py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Medicine
            </button>
          </div>
        </div>

        {/* Interaction results display */}
        {interactionResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              interactionResult.has_interactions
                ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {interactionResult.has_interactions ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {interactionResult.has_interactions
                  ? `Identified ${interactionResult.interactions.length} potential interaction(s):`
                  : 'No known adverse drug interactions detected.'}
              </span>
            </div>

            {interactionResult.interactions.map((inter, i) => (
              <div key={i} className="pl-6 border-l-2 border-amber-400 dark:border-amber-500 mt-2">
                <p className="font-semibold capitalize">
                  {inter.drug_a} + {inter.drug_b} ({inter.severity} severity)
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">{inter.description}</p>
              </div>
            ))}

            <p className="text-[10px] text-text-light dark:text-slate-500 pt-1 italic">
              * {interactionResult.disclaimer}
            </p>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-border dark:border-[#24352C] bg-slate-50/40 dark:bg-[#121B17]/60 space-y-3 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-secondary dark:text-slate-400">
                  Line #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded"
                  title="Remove medicine line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Medication Catalogue Entry *</label>
                  <select
                    value={item.medication_id}
                    onChange={(e) => handleMedicationChange(idx, e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">Select Medication...</option>
                    {medications.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.generic_name} {m.brand_name ? `(${m.brand_name})` : ''} — {m.strength} ({m.dosage_form})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Strength</label>
                  <input
                    type="text"
                    value={item.strength}
                    onChange={(e) => handleItemFieldChange(idx, 'strength', e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Dosage</label>
                  <input
                    type="text"
                    value={item.dosage}
                    onChange={(e) => handleItemFieldChange(idx, 'dosage', e.target.value)}
                    placeholder="e.g. 1 tablet"
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Route</label>
                  <select
                    value={item.route}
                    onChange={(e) => handleItemFieldChange(idx, 'route', e.target.value)}
                    className="input text-xs"
                  >
                    <option value="oral">Oral</option>
                    <option value="topical">Topical</option>
                    <option value="inhalation">Inhalation</option>
                    <option value="intravenous">Intravenous</option>
                    <option value="ophthalmic">Ophthalmic</option>
                  </select>
                </div>

                <div>
                  <label className="label">Frequency</label>
                  <input
                    type="text"
                    value={item.frequency}
                    onChange={(e) => handleItemFieldChange(idx, 'frequency', e.target.value)}
                    placeholder="e.g. Twice daily"
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="label">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={item.duration_days}
                    onChange={(e) => handleItemFieldChange(idx, 'duration_days', e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                    placeholder="e.g. 14 tablets"
                    className="input text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Instructions for Patient</label>
                  <input
                    type="text"
                    value={item.instructions}
                    onChange={(e) => handleItemFieldChange(idx, 'instructions', e.target.value)}
                    placeholder="e.g. Take with water after lunch"
                    className="input text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Dialog */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Prescription Preview"
        maxWidth="xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121B17] border border-border dark:border-[#24352C]">
            <p className="font-semibold text-text dark:text-white text-sm">
              Patient: {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Not selected'}
            </p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">Issue Date: {issueDate}</p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">Diagnosis: {diagnosis || 'Not specified'}</p>
          </div>

          <table className="w-full text-left">
            <thead className="border-b border-border dark:border-[#24352C] text-text-secondary dark:text-slate-400">
              <tr>
                <th className="py-2">Medication</th>
                <th className="py-2">Dosage &amp; Frequency</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-[#24352C]">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-medium text-text dark:text-white">
                    {item.medication_name || 'Unspecified'} ({item.strength})
                  </td>
                  <td className="py-2 text-text-secondary dark:text-slate-400">
                    {item.dosage} — {item.frequency}
                  </td>
                  <td className="py-2 text-text-secondary dark:text-slate-400">
                    {item.duration_days} days ({item.quantity})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-2 pt-4 border-t border-border dark:border-[#24352C]">
            <button onClick={() => setShowPreview(false)} className="btn-secondary text-xs">
              Close Preview
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                handleSubmit(true);
              }}
              className="btn-primary text-xs"
            >
              Confirm &amp; Issue Prescription
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
