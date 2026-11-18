import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../ui/Modal';
import type { User } from '../../types';
import { appointmentService, clockTime, localDay, type DaySlots, type DoctorOption } from '../../services/appointmentService';

/** Front desk books a patient into one of the chosen doctor's free 15-minute slots. */
export default function BookAppointmentModal({ isOpen, onClose, onBooked, presetPatientId }: {
  isOpen: boolean; onClose: () => void; onBooked: () => void; presetPatientId?: string;
}) {
  const [patients, setPatients] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [patientId, setPatientId] = useState(presetPatientId ?? '');
  const [doctorId, setDoctorId] = useState('');
  const [day, setDay] = useState(localDay());
  const [slots, setSlots] = useState<DaySlots | null>(null);
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPatientId(presetPatientId ?? '');
    Promise.all([api.get('/patients', { params: { per_page: 100 } }), appointmentService.doctors()])
      .then(([p, d]) => { setPatients(p.data); setDoctors(d); if (d.length && !doctorId) setDoctorId(d[0].id); })
      .catch(() => toast.error('Could not load patients or doctors.'));
  }, [isOpen, presetPatientId]);

  useEffect(() => {
    setSlot('');
    setSlots(null);
    if (!isOpen || !doctorId || !day) return;
    appointmentService.slots(doctorId, day).then(setSlots).catch(() => setSlots(null));
  }, [isOpen, doctorId, day]);

  const free = slots?.slots.filter((s) => s.available).length ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    try {
      setSaving(true);
      const a = await appointmentService.book({ patient_id: patientId, doctor_id: doctorId, scheduled_at: slot, reason: reason.trim() });
      toast.success(`Booked ${a.patient?.first_name} with Dr. ${a.doctor?.last_name} at ${clockTime(a.scheduled_at)} — the doctor has been notified`);
      setReason('');
      onBooked();
      onClose();
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Could not book the appointment.');
      if (err.response?.status === 409) appointmentService.slots(doctorId, day).then(setSlots);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book appointment" maxWidth="xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Patient</label>
            <select required className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} · {p.email}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Doctor</label>
            <select required className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}{d.specialization ? ` · ${d.specialization}` : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input required type="date" className="input" min={localDay()} value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="text-xs text-text-secondary dark:text-slate-400 sm:pt-7">
            Working hours: Mon–Sat, 9:00–1:00 and 2:00–5:00 · 15-minute slots
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Free slots</label>
            {slots?.working_day && <span className="text-[11px] text-text-secondary dark:text-slate-400">{free} free</span>}
          </div>
          {!slots ? (
            <p className="text-xs text-text-secondary dark:text-slate-400">Loading…</p>
          ) : !slots.working_day ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">The clinic is closed on Sundays — pick another day.</p>
          ) : free === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">No free slots left on this day — try another day or doctor.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {slots.slots.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  disabled={!s.available}
                  onClick={() => setSlot(s.time)}
                  className={`slot-btn ${slot === s.time ? 'is-picked' : ''}`}
                  title={s.available ? 'Free' : 'Taken or already past'}
                >
                  {clockTime(s.time)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Reason for visit</label>
          <input required minLength={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever for 3 days, BP follow-up" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving || !slot || !patientId} className="btn-primary">{saving ? 'Booking…' : slot ? `Book ${clockTime(slot)}` : 'Pick a slot'}</button>
        </div>
      </form>
    </Modal>
  );
}
