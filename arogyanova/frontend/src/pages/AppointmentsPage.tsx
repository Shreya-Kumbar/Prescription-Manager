import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, CalendarPlus, FilePlus2, UserCheck, CheckCircle2, XCircle, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import BookAppointmentModal from '../components/appointments/BookAppointmentModal';
import {
  appointmentService, clockTime, dayLabel, localDay,
  type Appointment, type AppointmentStatus, type DoctorOption,
} from '../services/appointmentService';

type Tab = 'today' | 'upcoming' | 'past';

const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  booked: { label: 'Booked', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200' },
  checked_in: { label: 'Waiting', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200' },
  completed: { label: 'Seen', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200' },
  no_show: { label: 'No-show', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300' },
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = user?.role;
  const frontDesk = role === 'receptionist' || role === 'administrator';

  const [tab, setTab] = useState<Tab>('today');
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [bookOpen, setBookOpen] = useState(params.get('book') === '1');
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const q = tab === 'today' ? { day: localDay() } : { when: tab };
      setItems(await appointmentService.list({ ...q, doctor_id: doctorFilter || undefined }));
    } catch {
      toast.error('Could not load appointments.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tab, doctorFilter]);
  useEffect(() => { if (frontDesk) appointmentService.doctors().then(setDoctors).catch(() => {}); }, [frontDesk]);

  const act = async (a: Appointment, action: 'check_in' | 'complete' | 'no_show' | 'cancel', why?: string) => {
    try {
      await appointmentService.act(a.id, action, why);
      toast.success({ check_in: 'Checked in — the doctor has been told', complete: 'Marked as seen', no_show: 'Marked as no-show', cancel: 'Appointment cancelled' }[action]);
      setCancelling(null);
      setReason('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action failed.');
    }
  };

  const now = new Date();
  const isPast = (a: Appointment) => new Date(a.scheduled_at) < now;
  const waiting = items.filter((a) => a.status === 'checked_in').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text dark:text-white">
            {role === 'doctor' ? 'My appointments' : role === 'patient' ? 'My appointments' : 'Appointments'}
          </h2>
          <p className="text-xs text-text-secondary dark:text-slate-400">
            {role === 'doctor' ? 'Patients booked with you. "Waiting" means they have checked in at reception.'
              : role === 'patient' ? 'Visits booked for you at reception. Arrive 10 minutes early.'
              : 'Book patients into a doctor\'s free slots, check them in when they arrive.'}
          </p>
        </div>
        {frontDesk && (
          <button onClick={() => setBookOpen(true)} className="btn-primary text-sm">
            <CalendarPlus className="w-4 h-4" /> Book appointment
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="sched-tabs" role="tablist">
          {([['today', 'Today'], ['upcoming', 'Upcoming'], ['past', 'Past']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? 'is-active' : ''}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {tab === 'today' && waiting > 0 && role !== 'patient' && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              {waiting} waiting
            </span>
          )}
          {frontDesk && (
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="input text-xs py-2 w-52">
              <option value="">All doctors</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm text-text-secondary dark:text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarClock} title={tab === 'today' ? 'No appointments today' : tab === 'upcoming' ? 'Nothing upcoming' : 'No past appointments'}
          description={frontDesk ? 'Use "Book appointment" to give a patient a slot.' : 'Appointments are booked at reception.'} />
      ) : (
        <div className="card overflow-hidden divide-y divide-border dark:divide-[#24352C]">
          {items.map((a) => {
            const st = STATUS[a.status];
            const sameDay = a.scheduled_at.slice(0, 10) === localDay();
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-24 shrink-0">
                  <p className="text-base font-bold text-text dark:text-white">{clockTime(a.scheduled_at)}</p>
                  <p className="text-[11px] text-text-secondary dark:text-slate-400">{dayLabel(a.scheduled_at)}</p>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-text dark:text-white">
                    {role === 'patient'
                      ? `Dr. ${a.doctor?.first_name} ${a.doctor?.last_name}`
                      : `${a.patient?.first_name} ${a.patient?.last_name}`}
                    {role !== 'patient' && role !== 'doctor' && (
                      <span className="font-normal text-text-secondary dark:text-slate-400"> · Dr. {a.doctor?.first_name} {a.doctor?.last_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400">{a.reason}</p>
                  {a.status === 'cancelled' && a.cancellation_reason && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">Cancelled: {a.cancellation_reason}</p>
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>

                <div className="flex flex-wrap gap-2 justify-end">
                  {frontDesk && a.status === 'booked' && sameDay && (
                    <button onClick={() => act(a, 'check_in')} className="btn-primary text-xs"><UserCheck className="w-3.5 h-3.5" /> Check in</button>
                  )}
                  {frontDesk && a.status === 'booked' && isPast(a) && (
                    <button onClick={() => act(a, 'no_show')} className="btn-secondary text-xs"><UserX className="w-3.5 h-3.5" /> No-show</button>
                  )}
                  {role === 'doctor' && (a.status === 'checked_in' || (a.status === 'booked' && sameDay)) && (
                    <button onClick={() => navigate(`/prescriptions/new?patient=${a.patient?.id}`)} className="btn-secondary text-xs">
                      <FilePlus2 className="w-3.5 h-3.5" /> Prescribe
                    </button>
                  )}
                  {role === 'doctor' && a.status === 'checked_in' && (
                    <button onClick={() => act(a, 'complete')} className="btn-primary text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Mark seen</button>
                  )}
                  {(a.status === 'booked' || (a.status === 'checked_in' && role !== 'patient')) && !(role === 'patient' && isPast(a)) && (
                    <button onClick={() => setCancelling(a)} className="btn-ghost text-xs text-rose-600 dark:text-rose-300"><XCircle className="w-3.5 h-3.5" /> Cancel</button>
                  )}
                  {frontDesk && (
                    <button onClick={() => navigate(`/patients/${a.patient?.id}`)} className="btn-ghost text-xs">Patient</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {frontDesk && (
        <BookAppointmentModal
          isOpen={bookOpen}
          presetPatientId={params.get('patient') ?? undefined}
          onClose={() => { setBookOpen(false); if (params.get('book')) setParams({}); }}
          onBooked={() => { if (tab !== 'today') setTab('upcoming'); load(); }}
        />
      )}

      <Modal isOpen={!!cancelling} onClose={() => setCancelling(null)} title="Cancel appointment" maxWidth="md">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary dark:text-slate-300">
            {cancelling && `${clockTime(cancelling.scheduled_at)}, ${dayLabel(cancelling.scheduled_at)}. `}
            The slot is freed and the {role === 'patient' ? 'doctor is' : 'patient and doctor are'} notified.
          </p>
          <label className="label">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient feeling better / doctor on leave" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCancelling(null)} className="btn-secondary">Keep it</button>
            <button disabled={reason.trim().length < 3} onClick={() => cancelling && act(cancelling, 'cancel', reason.trim())} className="btn-danger">Cancel appointment</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
