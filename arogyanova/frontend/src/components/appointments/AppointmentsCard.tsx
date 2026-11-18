import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { appointmentService, clockTime, dayLabel, localDay, type Appointment } from '../../services/appointmentService';

const DOT: Record<string, string> = { booked: '#7DB9DE', checked_in: '#E6B566', completed: '#4FA67A', cancelled: '#E08E8E', no_show: '#94A3B8' };
const LABEL: Record<string, string> = { booked: 'Booked', checked_in: 'Waiting', completed: 'Seen', cancelled: 'Cancelled', no_show: 'No-show' };

/** Dashboard card: today's appointments (doctor / front desk) or the next upcoming visit (patient). */
export default function AppointmentsCard({ role }: { role?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const isPatient = role === 'patient';

  useEffect(() => {
    (async () => {
      try {
        if (isPatient) {
          const [today, later] = await Promise.all([appointmentService.list({ day: localDay() }), appointmentService.list({ when: 'upcoming' })]);
          setItems([...today, ...later].filter((a) => a.status === 'booked' || a.status === 'checked_in').slice(0, 3));
        } else {
          setItems(await appointmentService.list({ day: localDay() }));
        }
      } catch {
        setItems([]);
      }
    })();
  }, [isPatient]);

  const active = (items ?? []).filter((a) => a.status !== 'cancelled');
  const waiting = active.filter((a) => a.status === 'checked_in').length;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
            <CalendarClock className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text dark:text-white">{isPatient ? 'Your next appointments' : "Today's appointments"}</h3>
            {!isPatient && items && (
              <p className="text-[11px] text-text-secondary dark:text-slate-400">{active.length} booked{waiting ? ` · ${waiting} waiting now` : ''}</p>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/appointments')} className="text-xs font-semibold text-primary dark:text-emerald-400 flex items-center gap-1">
          Open <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {items === null ? (
        <p className="text-xs text-text-secondary dark:text-slate-400">Loading…</p>
      ) : active.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-slate-400">
          {isPatient ? 'No upcoming visits. Reception can book one for you.' : 'No appointments today.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {active.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-xs">
              <span className="w-16 font-bold text-text dark:text-white">{clockTime(a.scheduled_at)}</span>
              <span className="flex-1 min-w-0 truncate text-text dark:text-slate-200">
                {isPatient ? `${dayLabel(a.scheduled_at)} · Dr. ${a.doctor?.first_name} ${a.doctor?.last_name}` : `${a.patient?.first_name} ${a.patient?.last_name}`}
                {role === 'receptionist' || role === 'administrator' ? <span className="text-text-secondary dark:text-slate-400"> · Dr. {a.doctor?.last_name}</span> : null}
                <span className="text-text-secondary dark:text-slate-400"> — {a.reason}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-text-secondary dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOT[a.status] }} />
                {LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
