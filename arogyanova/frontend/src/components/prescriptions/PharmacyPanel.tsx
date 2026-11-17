import React, { useState } from 'react';
import { CheckCircle2, Flag, PackageCheck, ShieldCheck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { PrescriptionDetail } from '../../types';

const STATUS = {
  pending: { label: 'Awaiting pharmacist review', tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:border-amber-400/20', icon: Clock },
  verified: { label: 'Verified — ready to dispense', tone: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-200 dark:border-sky-400/20', icon: ShieldCheck },
  flagged: { label: 'Flagged by pharmacist', tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:border-rose-400/20', icon: Flag },
  dispensed: { label: 'Dispensed to patient', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20', icon: PackageCheck },
} as const;

const ACTION_TEXT: Record<string, string> = { verify: 'Verified', flag: 'Flagged', dispense: 'Dispensed' };

/** Pharmacy status + history for everyone; verify / flag / dispense buttons for pharmacists. */
export default function PharmacyPanel({ prescription, role, onUpdated }: {
  prescription: PrescriptionDetail;
  role?: string;
  onUpdated: (p: PrescriptionDetail) => void;
}) {
  const [reason, setReason] = useState('');
  const [showFlag, setShowFlag] = useState(false);
  const [busy, setBusy] = useState(false);

  if (prescription.status === 'draft') return null;
  const ps = (prescription.pharmacy_status ?? 'pending') as keyof typeof STATUS;
  const meta = STATUS[ps] ?? STATUS.pending;
  const Icon = meta.icon;
  const isPharmacist = role === 'pharmacist';
  const active = prescription.status === 'active';

  const act = async (action: 'verify' | 'flag' | 'dispense', notes?: string) => {
    try {
      setBusy(true);
      const res = await api.post(`/prescriptions/${prescription.id}/pharmacy`, { action, notes });
      onUpdated(res.data);
      toast.success(action === 'verify' ? 'Prescription verified' : action === 'flag' ? 'Flagged — the doctor has been notified' : 'Marked as dispensed — the patient has been notified');
      setShowFlag(false);
      setReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text dark:text-white">Pharmacy</h3>
          <p className="text-xs text-text-secondary dark:text-slate-400">Verification and dispensing</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${meta.tone}`}>
          <Icon className="w-3.5 h-3.5" /> {meta.label}
        </span>
      </div>

      {isPharmacist && active && ps !== 'dispensed' && (
        <div className="flex flex-wrap gap-2">
          {(ps === 'pending' || ps === 'flagged') && (
            <button disabled={busy} onClick={() => act('verify')} className="btn-primary text-sm">
              <CheckCircle2 className="w-4 h-4" /> Verify
            </button>
          )}
          {ps === 'verified' && (
            <button disabled={busy} onClick={() => act('dispense')} className="btn-primary text-sm">
              <PackageCheck className="w-4 h-4" /> Dispense
            </button>
          )}
          {(ps === 'pending' || ps === 'verified') && (
            <button disabled={busy} onClick={() => setShowFlag((v) => !v)} className="btn-secondary text-sm">
              <Flag className="w-4 h-4" /> Flag a problem
            </button>
          )}
        </div>
      )}

      {showFlag && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What's wrong? e.g. Dose too high, interaction with current medicine, unclear instructions"
            className="input"
          />
          <div className="flex gap-2">
            <button disabled={busy || !reason.trim()} onClick={() => act('flag', reason)} className="btn-danger text-sm">Send flag to doctor</button>
            <button onClick={() => setShowFlag(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {prescription.pharmacy_history?.length > 0 && (
        <ol className="relative border-l border-border dark:border-[#24352C] ml-1.5 space-y-3">
          {prescription.pharmacy_history.map((h, i) => (
            <li key={i} className="ml-4">
              <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${h.action === 'flag' ? 'bg-rose-400' : h.action === 'dispense' ? 'bg-emerald-500' : 'bg-sky-400'}`} />
              <p className="text-sm text-text dark:text-slate-100">
                <span className="font-semibold">{ACTION_TEXT[h.action] ?? h.action}</span> by {h.pharmacist_name}
                <span className="text-xs text-text-secondary dark:text-slate-400"> · {new Date(h.created_at).toLocaleString()}</span>
              </p>
              {h.notes && <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">“{h.notes}”</p>}
            </li>
          ))}
        </ol>
      )}

      {!active && ps !== 'dispensed' && (
        <p className="text-xs text-text-secondary dark:text-slate-400">This prescription is {prescription.status}, so it can no longer be dispensed.</p>
      )}
    </div>
  );
}
