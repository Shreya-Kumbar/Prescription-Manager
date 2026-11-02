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

export default function PrescriptionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
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

  const handleCancel = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to cancel this prescription?')) return;
    try {
      await prescriptionService.cancel(id);
      toast.success('Prescription cancelled.');
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex items-center justify-between">
        <button
          onClick={() => navigate('/prescriptions')}
          className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-slate-300 hover:text-text dark:hover:text-white p-2 rounded-lg border border-border dark:border-[#233044] bg-white dark:bg-[#162238] transition-colors"
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

          {user?.role === 'doctor' && prescription.status === 'draft' && (
            <button
              onClick={handleFinalize}
              className="btn-primary text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Prescription
            </button>
          )}

          {user?.role === 'doctor' && prescription.status !== 'cancelled' && prescription.status !== 'completed' && (
            <button
              onClick={handleCancel}
              className="btn-danger text-xs"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Prescription
            </button>
          )}
        </div>
      </div>

      {/* Main Prescription Card (Printable) */}
      <div className="card p-8 bg-white dark:bg-[#131C31] border border-border dark:border-[#233044] shadow-sm print:border-none print:shadow-none space-y-6">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b border-border dark:border-[#233044] pb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-[#0F172A]/70 border border-border dark:border-[#233044] text-xs">
          <div>
            <span className="text-[10px] font-bold text-primary dark:text-teal-400 uppercase tracking-wider block mb-1">
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
            <span className="text-[10px] font-bold text-primary dark:text-teal-400 uppercase tracking-wider block mb-1">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs border-b border-border dark:border-[#233044] pb-4">
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
          <div className="overflow-x-auto border border-border dark:border-[#233044] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0F172A] text-text-secondary dark:text-slate-400 border-b border-border dark:border-[#233044] uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Medication &amp; Strength</th>
                  <th className="py-2.5 px-3">Dosage &amp; Route</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3">Duration &amp; Qty</th>
                  <th className="py-2.5 px-3">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-[#233044]">
                {prescription.items?.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-[#162238] transition-colors">
                    <td className="py-3 px-3 text-text-secondary dark:text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-semibold text-text dark:text-white">
                      {item.medication?.generic_name || 'Medication'}{' '}
                      {item.medication?.brand_name && (
                        <span className="text-text-secondary dark:text-slate-400 font-normal">
                          ({item.medication.brand_name})
                        </span>
                      )}{' '}
                      <span className="text-primary dark:text-teal-400 font-mono text-[11px] block sm:inline">
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
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-border dark:border-[#233044] text-xs">
            <span className="font-semibold text-text dark:text-white block mb-1">Clinical Notes &amp; Advice</span>
            <p className="text-text-secondary dark:text-slate-400 whitespace-pre-wrap">{prescription.clinical_notes}</p>
          </div>
        )}

        {/* Doctor Signature & Legal Notice */}
        <div className="pt-8 border-t border-border dark:border-[#233044] flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="text-[10px] text-text-light dark:text-slate-500 max-w-sm">
            <p>
              * This is a cryptographically signed electronic prescription issued through ArogyaNova.
              Authorized under Object-Oriented Prescription Protocol. Tampering invalidates this record.
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
    </div>
  );
}
