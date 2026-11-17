import React, { useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/** Lets a patient keep their own contact and medical details up to date. */
export default function MyHealthProfile({ userId }: { userId: string }) {
  const [form, setForm] = useState({ phone: '', address: '', blood_group: '', emergency_contact: '', allergies: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/patients/${userId}`)
      .then((r) => {
        const p = r.data.patient_profile ?? {};
        setForm({
          phone: p.phone ?? '', address: p.address ?? '', blood_group: p.blood_group ?? '',
          emergency_contact: p.emergency_contact ?? '', allergies: p.allergies ?? '',
        });
      })
      .catch(() => toast.error('Could not load your health profile.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/patients/${userId}/profile`, form);
      toast.success('Health profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text dark:text-white flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-primary" /> My health profile
        </h3>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">Your doctor sees these details when writing your prescriptions. Keep allergies up to date.</p>
      </div>
      {loading ? (
        <div className="skeleton h-40 rounded-xl" />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
            <div>
              <label className="label">Blood group</label>
              <select className="input" value={form.blood_group} onChange={set('blood_group')}>
                <option value="">Not set</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><label className="label">Emergency contact</label><input className="input" value={form.emergency_contact} onChange={set('emergency_contact')} placeholder="Name and phone" /></div>
          </div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
          <div><label className="label">Known drug allergies</label><textarea className="input" rows={2} value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" /></div>
          <div className="flex justify-end"><button disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      )}
    </div>
  );
}
