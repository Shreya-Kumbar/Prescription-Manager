import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from './Modal';

type StaffRole = 'doctor' | 'pharmacist';

/** Admin-only form for creating doctor and pharmacist accounts. */
export default function AddStaffModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const empty = { first_name: '', last_name: '', email: '', password: '', license_number: '', specialization: '' };
  const [role, setRole] = useState<StaffRole>('doctor');
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/admin/users', {
        ...form,
        role,
        specialization: role === 'doctor' ? form.specialization || undefined : undefined,
      });
      toast.success(`${role === 'doctor' ? 'Doctor' : 'Pharmacist'} account created for ${form.email}`);
      setForm(empty);
      onCreated();
      onClose();
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Could not create the account. Check the details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add staff account" maxWidth="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['doctor', 'pharmacist'] as StaffRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                role === r
                  ? 'border-primary bg-primary/10 text-primary dark:text-emerald-300'
                  : 'border-border dark:border-[#24352C] text-text-secondary dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name</label><input required className="input" value={form.first_name} onChange={set('first_name')} /></div>
          <div><label className="label">Last name</label><input required className="input" value={form.last_name} onChange={set('last_name')} /></div>
        </div>
        <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={set('email')} placeholder="name@hospital.com" /></div>
        <div>
          <label className="label">Temporary password</label>
          <input required type="text" className="input" value={form.password} onChange={set('password')} placeholder="8+ chars, upper, lower, number" />
          <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">Share it with them privately. They can change it in Settings or use Forgot password.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">License number</label>
            <input required className="input" value={form.license_number} onChange={set('license_number')} placeholder={role === 'doctor' ? 'MCI-2026-0001' : 'PH-2026-0001'} />
          </div>
          {role === 'doctor' && (
            <div><label className="label">Specialization</label><input className="input" value={form.specialization} onChange={set('specialization')} placeholder="General Medicine" /></div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}
