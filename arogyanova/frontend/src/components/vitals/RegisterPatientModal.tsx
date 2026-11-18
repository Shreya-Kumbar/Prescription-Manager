import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../ui/Modal';

/** Front desk registers a walk-in patient (server allows role "patient" only for receptionists). */
export default function RegisterPatientModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean; onClose: () => void; onCreated: (id: string) => void;
}) {
  const empty = { first_name: '', last_name: '', email: '', password: '', date_of_birth: '', phone: '', blood_group: '', allergies: '' };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.post('/admin/users', {
        ...f, role: 'patient',
        date_of_birth: f.date_of_birth || undefined,
        blood_group: f.blood_group || undefined,
        allergies: f.allergies.trim() || undefined,
      });
      toast.success(`${f.first_name} ${f.last_name} registered`);
      setF(empty);
      onCreated(res.data.id);
      onClose();
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register walk-in patient" maxWidth="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name</label><input required className="input" value={f.first_name} onChange={set('first_name')} /></div>
          <div><label className="label">Last name</label><input required className="input" value={f.last_name} onChange={set('last_name')} /></div>
        </div>
        <div><label className="label">Email</label><input required type="email" className="input" value={f.email} onChange={set('email')} placeholder="patient@example.com" /></div>
        <div>
          <label className="label">Temporary password</label>
          <input required type="text" className="input" value={f.password} onChange={set('password')} placeholder="8+ chars, upper, lower, number" />
          <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1">Give it to the patient; they can change it later or use Forgot password.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date of birth</label><input type="date" className="input" value={f.date_of_birth} onChange={set('date_of_birth')} /></div>
          <div><label className="label">Phone</label><input type="tel" className="input" value={f.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Blood group</label>
            <select className="input" value={f.blood_group} onChange={set('blood_group')}>
              <option value="">Not known yet</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Registration date</label>
            <input className="input" value={today} readOnly title="Set automatically when the patient is registered" />
          </div>
        </div>
        <div>
          <label className="label">Known allergies</label>
          <input className="input" value={f.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin, peanuts — leave empty if none" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving} className="btn-primary">{saving ? 'Registering…' : 'Register patient'}</button>
        </div>
      </form>
    </Modal>
  );
}
