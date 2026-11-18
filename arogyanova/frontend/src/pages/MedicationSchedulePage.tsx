import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, CheckCircle2, Clock, Pill, TrendingUp, X, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { ScheduleEntry } from '../types';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';

type DoseState = 'taken' | 'skipped' | 'missed' | 'due' | 'upcoming';
type Tab = 'today' | 'upcoming' | 'history';

/** A dose can be logged only on its own day; past unlogged doses are missed. */
function stateOf(entry: ScheduleEntry, now = new Date()): DoseState {
  if (entry.logged_action === 'taken' || entry.logged_action === 'skipped') return entry.logged_action;
  const day = new Date(entry.scheduled_at).toDateString();
  if (day === now.toDateString()) return 'due';
  return new Date(entry.scheduled_at) < now ? 'missed' : 'upcoming';
}

const BADGE: Record<Exclude<DoseState, 'due'>, { label: string; cls: string; icon: React.ElementType }> = {
  taken: { label: 'Taken', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40', icon: Check },
  skipped: { label: 'Skipped', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40', icon: X },
  missed: { label: 'Missed', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40', icon: XCircle },
  upcoming: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.04] dark:text-slate-400 dark:border-[#24352C]', icon: Clock },
};

export default function MedicationSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/schedule');
      setSchedule(res.data || []);
    } catch {
      toast.error('Failed to load medication schedule.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { fetchSchedule(); }, []);

  const handleLogAction = async (id: string, action: 'taken' | 'skipped') => {
    try {
      await api.post(`/schedule/${id}/log`, { action });
      toast.success(`Dose marked as ${action}`);
      fetchSchedule();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to log dose.');
    }
  };

  const withState = useMemo(() => {
    const now = new Date();
    return schedule
      .map((e) => ({ ...e, state: stateOf(e, now) }))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [schedule]);

  const today = withState.filter((e) => new Date(e.scheduled_at).toDateString() === new Date().toDateString());
  const upcoming = withState.filter((e) => e.state === 'upcoming');
  const history = withState.filter((e) => new Date(e.scheduled_at) < new Date(new Date().toDateString())).reverse();

  const counted = withState.filter((e) => ['taken', 'skipped', 'missed'].includes(e.state));
  const taken = counted.filter((e) => e.state === 'taken').length;
  const missed = counted.filter((e) => e.state === 'missed').length;
  const rate = counted.length ? Math.round((taken / counted.length) * 100) : null;
  const dueNow = today.filter((e) => e.state === 'due').length;

  const lists: Record<Tab, typeof withState> = { today, upcoming, history };
  const shown = lists[tab];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-text dark:text-white">Medication schedule</h2>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
          Log each dose on its day. Doses not logged by the end of their day count as missed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Adherence" value={rate != null ? `${rate}%` : '—'} subtitle="Taken out of all past doses" icon={TrendingUp} color="success" />
        <StatCard title="Due today" value={dueNow} subtitle={`${today.length} scheduled today`} icon={CalendarCheck} color="primary" />
        <StatCard title="Taken" value={taken} subtitle="Doses logged as taken" icon={CheckCircle2} color="secondary" />
        <StatCard title="Missed" value={missed} subtitle="Past doses never logged" icon={XCircle} color="warning" />
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="sched-tabs" role="tablist">
            {([['today', `Today (${today.length})`], ['upcoming', `Upcoming (${upcoming.length})`], ['history', `History (${history.length})`]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? 'is-active' : ''}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'today' && dueNow > 0 && (
            <span className="text-xs text-text-secondary dark:text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {dueNow} dose{dueNow === 1 ? '' : 's'} still to log today
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={tab === 'today' ? 'Nothing scheduled today' : tab === 'upcoming' ? 'No upcoming doses' : 'No past doses yet'}
            description={tab === 'today' ? 'Doses appear here when your doctor finalizes a prescription.' : ''}
          />
        ) : (
          <div key={tab} className="space-y-3 card-swap-right">
            {shown.map((entry) => {
              const dt = new Date(entry.scheduled_at);
              const badge = entry.state !== 'due' ? BADGE[entry.state] : null;
              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    entry.state === 'due'
                      ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-950/20'
                      : 'border-border dark:border-[#24352C] bg-slate-50/50 dark:bg-[#121B17]/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="icon-tile p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-primary dark:text-emerald-400 mt-0.5">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-text dark:text-white">{entry.medication_name} — {entry.dosage}</h4>
                      <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
                        {dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {entry.instructions && <p className="text-[11px] text-text-light dark:text-slate-400 mt-1 italic">{entry.instructions}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {badge ? (
                      <span className={`text-xs px-3 py-1.5 rounded-full border font-medium inline-flex items-center gap-1.5 ${badge.cls}`}>
                        <badge.icon className="w-3.5 h-3.5" /> {badge.label}
                      </span>
                    ) : (
                      <>
                        <button onClick={() => handleLogAction(entry.id, 'taken')} className="btn-primary text-xs !py-1.5">
                          <Check className="w-3.5 h-3.5" /> Taken
                        </button>
                        <button onClick={() => handleLogAction(entry.id, 'skipped')} className="btn-secondary text-xs !py-1.5">
                          <X className="w-3.5 h-3.5" /> Skip
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
