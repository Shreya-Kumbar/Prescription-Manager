import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      if (patRes.data?.length > 0) {
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
    const names = items
      .map((i) => i.medication_name.trim())
      .filter((n) => n.length > 0);

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/prescriptions')}
            className="p-2 rounded-lg border border-border dark:border-[#233044] bg-white dark:bg-[#162238] text-text-secondary dark:text-slate-300 hover:text-text dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-text dark:text-white">New Clinical Prescription</h2>
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

      {/* 1. Patient Selection */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-teal-400 border-b border-border dark:border-[#233044] pb-2">
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
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-border dark:border-[#233044] text-xs flex flex-wrap gap-4 text-text-secondary dark:text-slate-300">
            <span><strong className="text-text dark:text-white">Name:</strong> {selectedPatient.first_name} {selectedPatient.last_name}</span>
            <span><strong className="text-text dark:text-white">DOB:</strong> {selectedPatient.patient_profile?.date_of_birth || 'Not recorded'}</span>
            <span><strong className="text-text dark:text-white">Blood Group:</strong> {selectedPatient.patient_profile?.blood_group || 'O+'}</span>
            <span><strong className="text-text dark:text-white">Known Allergies:</strong> <span className="text-rose-600 dark:text-rose-400 font-medium">{selectedPatient.patient_profile?.allergies || 'None recorded'}</span></span>
          </div>
        )}
      </div>

      {/* 2. Clinical Evaluation */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-teal-400 border-b border-border dark:border-[#233044] pb-2">
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
        <div className="flex items-center justify-between border-b border-border dark:border-[#233044] pb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-teal-400">
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
              className="p-4 rounded-xl border border-border dark:border-[#233044] bg-slate-50/40 dark:bg-[#0F172A]/60 space-y-3 relative"
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
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-border dark:border-[#233044]">
            <p className="font-semibold text-text dark:text-white text-sm">
              Patient: {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Not selected'}
            </p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">Issue Date: {issueDate}</p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">Diagnosis: {diagnosis || 'Not specified'}</p>
          </div>

          <table className="w-full text-left">
            <thead className="border-b border-border dark:border-[#233044] text-text-secondary dark:text-slate-400">
              <tr>
                <th className="py-2">Medication</th>
                <th className="py-2">Dosage &amp; Frequency</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-[#233044]">
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

          <div className="flex justify-end gap-2 pt-4 border-t border-border dark:border-[#233044]">
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
