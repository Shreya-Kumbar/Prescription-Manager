import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Stethoscope,
  Calendar,
  Pill,
  FileText,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { prescriptionService } from '../services/prescriptionService';
import type { PrescriptionDetail } from '../types';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import PharmacyPanel from '../components/prescriptions/PharmacyPanel';
import { rxNo } from '../utils/rxNumber';
import EditDraftModal from '../components/prescriptions/EditDraftModal';

export default function PrescriptionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrescription = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await prescriptionService.get(id);
      setPrescription(res);
    } catch {
      toast.error('Failed to load prescription record.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescription();
  }, [id]);

  const handleFinalize = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to finalize this prescription?')) return;
    try {
      await prescriptionService.finalize(id);
      toast.success('Prescription finalized and published.');
      fetchPrescription();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to finalize.');
    }
  };

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const handleCancel = async () => {
    if (!id || cancelReason.trim().length < 3) return;
    try {
      await prescriptionService.cancel(id, cancelReason.trim());
      toast.success('Prescription cancelled — the patient has been told to stop the remaining doses.');
      setCancelOpen(false);
      setCancelReason('');
      fetchPrescription();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="card p-8 space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <AlertCircle className="w-12 h-12 text-error mx-auto mb-3" />
        <h3 className="text-base font-bold text-text dark:text-white">Prescription Not Found</h3>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-1 mb-4">
          This prescription record does not exist or you do not have permission to view it.
        </p>
        <button onClick={() => navigate('/prescriptions')} className="btn-secondary text-xs">
          Back to Prescriptions
        </button>
      </div>
    );
  }

  // Only the prescribing doctor can change it; other doctors see it read-only as medical history
  const isAuthor = user?.role === 'doctor' && prescription.doctor?.id === user?.id;
  const otherDoctorView = user?.role === 'doctor' && !isAuthor;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {otherDoctorView && (
        <div className="no-print rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-400/20 dark:bg-sky-400/10 px-4 py-3 text-xs text-sky-800 dark:text-sky-200">
          Read-only — written by {prescription.doctor ? `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}` : 'another doctor'}. Shown as part of the patient's medication history; only the prescribing doctor can change or cancel it.
        </div>
      )}
      {prescription.status === 'cancelled' && (
        <div className="no-print rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/10 px-4 py-3 text-xs text-rose-800 dark:text-rose-200 flex flex-wrap items-center justify-between gap-2">
          <span><b>Cancelled</b>{prescription.cancellation_reason ? ` — ${prescription.cancellation_reason}` : ''}</span>
          {prescription.replaced_by_id && (
            <button onClick={() => navigate(`/prescriptions/${prescription.replaced_by_id}`)} className="font-semibold underline">
              Open the corrected prescription {rxNo(prescription.replaced_by_id)} →
            </button>
          )}
        </div>
      )}
      {prescription.replaces_id && (
        <div className="no-print rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
          <span>Corrected version of {rxNo(prescription.replaces_id)}{prescription.status === 'draft' ? ' — the original stays active until you issue this one.' : ', which was flagged by the pharmacy.'}</span>
          <button onClick={() => navigate(`/prescriptions/${prescription.replaces_id}`)} className="font-semibold underline">
            View original {rxNo(prescription.replaces_id)} →
          </button>
        </div>
      )}
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex items-center justify-between">
        <button
          onClick={() => navigate('/prescriptions')}
          className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-slate-300 hover:text-text dark:hover:text-white p-2 rounded-lg border border-border dark:border-[#24352C] bg-white dark:bg-[#1C2922] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Prescriptions
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="btn-secondary text-xs"
            title="Print Prescription Slip"
          >
            <Printer className="w-3.5 h-3.5" /> Print Prescription
          </button>

          {isAuthor && prescription.status === 'draft' && (
            <button onClick={() => setEditingDraft(true)} className="btn-secondary text-xs">
              Edit draft
            </button>
          )}

          {isAuthor && prescription.status === 'draft' && (
            <button
              onClick={handleFinalize}
              className="btn-primary text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Prescription
            </button>
          )}

          {isAuthor && prescription.status !== 'cancelled' && prescription.status !== 'completed' && prescription.pharmacy_status !== 'dispensed' && (
            <button
              onClick={() => setCancelOpen(true)}
              className="btn-danger text-xs"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Prescription
            </button>
          )}
        </div>
      </div>

      {/* Main Prescription Card (Printable) */}
      <div className="card p-8 bg-white dark:bg-[#16201B] border border-border dark:border-[#24352C] shadow-sm print:border-none print:shadow-none space-y-6">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b border-border dark:border-[#24352C] pb-6">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold text-text dark:text-white tracking-tight">ArogyaNova</h1>
              <p className="text-[11px] text-text-secondary dark:text-slate-400">
                Intelligent Healthcare &amp; Prescription Management
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="mb-1">
              <Badge status={prescription.status} />
            </div>
            <p className="font-mono text-xs text-text-secondary dark:text-slate-400">
              ID: {prescription.id}
            </p>
          </div>
        </div>

        {/* Clinical Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-[#121B17]/70 border border-border dark:border-[#24352C] text-xs">
          <div>
            <span className="text-[10px] font-bold text-primary dark:text-emerald-400 uppercase tracking-wider block mb-1">
              PATIENT DETAILS
            </span>
            <p className="font-bold text-sm text-text dark:text-white">
              {prescription.patient
                ? `${prescription.patient.first_name} ${prescription.patient.last_name}`
                : 'Authorized Patient'}
            </p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">
              Email: {prescription.patient?.email || 'Confidential'}
            </p>
            {prescription.patient?.patient_profile?.date_of_birth && (
              <p className="text-text-secondary dark:text-slate-400">
                DOB: {prescription.patient.patient_profile.date_of_birth}
              </p>
            )}
            {prescription.patient?.patient_profile?.blood_group && (
              <p className="text-text-secondary dark:text-slate-400">
                Blood Group: {prescription.patient.patient_profile.blood_group}
              </p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-primary dark:text-emerald-400 uppercase tracking-wider block mb-1">
              PRESCRIBER DETAILS
            </span>
            <p className="font-bold text-sm text-text dark:text-white">
              {prescription.doctor
                ? `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}`
                : 'Staff Physician'}
            </p>
            <p className="text-text-secondary dark:text-slate-400 mt-0.5">
              License: {prescription.doctor?.doctor_profile?.license_number || 'MCI-VERIFIED'}
            </p>
            <p className="text-text-secondary dark:text-slate-400">
              Specialization: {prescription.doctor?.doctor_profile?.specialization || 'Clinical Medicine'}
            </p>
            <p className="text-text-secondary dark:text-slate-400">
              Hospital: {prescription.doctor?.doctor_profile?.hospital_affiliation || 'Apollo Hospital'}
            </p>
          </div>
        </div>

        {/* Diagnosis & Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs border-b border-border dark:border-[#24352C] pb-4">
          <div>
            <span className="text-text-secondary dark:text-slate-400 block">Issue Date</span>
            <span className="font-semibold text-text dark:text-white">{prescription.issue_date}</span>
          </div>
          <div>
            <span className="text-text-secondary dark:text-slate-400 block">Follow-up Date</span>
            <span className="font-semibold text-text dark:text-white">
              {prescription.follow_up_date || 'As required / PRN'}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-text-secondary dark:text-slate-400 block">Clinical Diagnosis</span>
            <span className="font-semibold text-text dark:text-white">
              {prescription.diagnosis || 'General Clinical Evaluation'}
            </span>
          </div>
        </div>

        {/* Medication Table */}
        <div>
          <h3 className="text-xs font-bold text-text dark:text-white uppercase tracking-wider mb-3">
            Rx — Prescribed Medications ({prescription.items?.length || 0})
          </h3>
          <div className="overflow-x-auto border border-border dark:border-[#24352C] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#121B17] text-text-secondary dark:text-slate-400 border-b border-border dark:border-[#24352C] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Medication &amp; Strength</th>
                  <th className="py-2.5 px-3">Dosage &amp; Route</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Duration &amp; Qty</th>
                  <th className="py-2.5 px-3">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-[#24352C]">
                {prescription.items?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-[#1C2922] transition-colors">
                    <td className="py-3 px-3 text-text-secondary dark:text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-semibold text-text dark:text-white">
                      {item.medication?.generic_name || 'Medication'}{' '}
                      {item.medication?.brand_name && (
                        <span className="text-text-secondary dark:text-slate-400 font-normal">
                          ({item.medication.brand_name})
                        </span>
                      )}{' '}
                      <span className="text-primary dark:text-emerald-400 font-mono text-[11px] block sm:inline">
                        {item.strength}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text dark:text-white">
                      {item.dosage} <span className="text-text-secondary dark:text-slate-400 capitalize">({item.route})</span>
                    </td>
                    <td className="py-3 px-3 text-text dark:text-white">{item.frequency}</td>
                    <td className="py-3 px-3 text-text dark:text-white">
                      {item.duration_days} days ({item.quantity})
                    </td>
                    <td className="py-3 px-3 text-text-secondary dark:text-slate-400 italic">
                      {item.instructions || 'As directed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clinical Notes */}
        {prescription.clinical_notes && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121B17] border border-border dark:border-[#24352C] text-xs">
            <span className="font-semibold text-text dark:text-white block mb-1">Clinical Notes &amp; Advice</span>
            <p className="text-text-secondary dark:text-slate-400 whitespace-pre-wrap">{prescription.clinical_notes}</p>
          </div>
        )}

        {/* Doctor Signature & Legal Notice */}
        <div className="pt-8 border-t border-border dark:border-[#24352C] flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="text-[10px] text-text-light dark:text-slate-500 max-w-sm">
            <p>
              * Electronic prescription issued through ArogyaNova by the doctor named below.
              Every change to it is recorded in the system's audit log. Quote the prescription ID to verify it.
            </p>
          </div>
          <div className="text-right sm:min-w-48 border-t border-slate-300 dark:border-slate-700 pt-2">
            <p className="font-semibold text-xs text-text dark:text-white">
              {prescription.doctor ? `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}` : 'Authorized Medical Officer'}
            </p>
            <p className="text-[10px] text-text-secondary dark:text-slate-400">Authorized Digital Signature</p>
          </div>
        </div>
      </div>
      {/* Pharmacy verification & dispensing */}
      {/* Pharmacy panel: pharmacists/admins always; doctors only when the pharmacist flagged a problem */}
      {(user?.role === 'pharmacist' || user?.role === 'administrator' || (isAuthor && (prescription.pharmacy_status === 'flagged' || prescription.pharmacy_history?.some((h) => h.action === 'flag')))) && (
        <PharmacyPanel prescription={prescription} role={user?.role} onUpdated={setPrescription} />
      )}
      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel prescription" maxWidth="md">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary dark:text-slate-300">
            The patient is notified and the remaining doses are removed from their schedule. This can't be undone.
          </p>
          <label className="label">Reason</label>
          <textarea rows={3} className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Wrong dose entered / patient allergic / pharmacist flagged an interaction" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCancelOpen(false)} className="btn-secondary">Keep prescription</button>
            <button disabled={cancelReason.trim().length < 3} onClick={handleCancel} className="btn-danger">Cancel prescription</button>
          </div>
        </div>
      </Modal>
      {editingDraft && (
        <EditDraftModal prescription={prescription} isOpen={editingDraft} onClose={() => setEditingDraft(false)} onSaved={setPrescription} />
      )}
    </div>
  );
}
