import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Pill,
  Calendar as CalendarIcon,
  Check,
  X,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { ScheduleEntry } from '../types';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';

export default function MedicationSchedulePage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adherenceStats, setAdherenceStats] = useState<any>(null);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/schedule');
      setSchedule(res.data || []);

      // Calculate statistics
      const total = res.data.length;
      const taken = res.data.filter((s: ScheduleEntry) => s.logged_action === 'taken').length;
      const skipped = res.data.filter((s: ScheduleEntry) => s.logged_action === 'skipped').length;
      const logged = taken + skipped;
      const rate = logged > 0 ? Math.round((taken / logged) * 100) : 100;

      setAdherenceStats({
        total,
        taken,
        skipped,
        rate,
        pending: total - logged,
      });
    } catch {
      toast.error('Failed to load medication schedule.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleLogAction = async (id: string, action: 'taken' | 'skipped') => {
    try {
      await api.post(`/schedule/${id}/log`, { action });
      toast.success(`Dose marked as ${action}!`);
      fetchSchedule();
    } catch {
      toast.error('Failed to log dose activity.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text">Medication Schedule & Adherence</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Patient medication schedule generated from active prescriptions
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Adherence Score"
          value={`${adherenceStats?.rate ?? 100}%`}
          subtitle="User-reported adherence rate"
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Scheduled Doses"
          value={adherenceStats?.total ?? 0}
          subtitle="Total schedule entries"
          icon={CalendarCheck}
          color="primary"
        />
        <StatCard
          title="Doses Taken"
          value={adherenceStats?.taken ?? 0}
          subtitle="Reported as taken"
          icon={CheckCircle2}
          color="secondary"
        />
        <StatCard
          title="Doses Skipped"
          value={adherenceStats?.skipped ?? 0}
          subtitle="Reported as skipped"
          icon={XCircle}
          color="warning"
        />
      </div>

      {/* Advisory Banner */}
      <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs flex items-center gap-2.5 text-teal-900">
        <AlertCircle className="w-4 h-4 text-primary shrink-0" />
        <span>
          <strong>Clinical Note:</strong> ArogyaNova tracks user-reported medication compliance.
          Doses marked as taken provide decision-support analytics for your healthcare team.
        </span>
      </div>

      {/* Schedule Entries */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-text mb-4">Daily Dosing Schedule</h3>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : schedule.length > 0 ? (
          <div className="space-y-3">
            {schedule.map((entry) => {
              const dt = new Date(entry.scheduled_at);
              const formattedDate = dt.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = dt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl border border-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-teal-50 text-primary mt-0.5">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-text">
                        {entry.medication_name} — {entry.dosage}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                        <span className="flex items-center gap-1 font-medium text-text">
                          <CalendarIcon className="w-3.5 h-3.5 text-text-light" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-text-light" />
                          {formattedTime}
                        </span>
                      </div>
                      {entry.instructions && (
                        <p className="text-[11px] text-text-light mt-1 italic">
                          Instructions: {entry.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {entry.logged_action ? (
                      <span
                        className={`text-xs px-3 py-1.5 rounded-full font-medium inline-flex items-center gap-1.5 ${
                          entry.logged_action === 'taken'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {entry.logged_action === 'taken' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        Marked as {entry.logged_action}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleLogAction(entry.id, 'taken')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Take Dose
                        </button>
                        <button
                          onClick={() => handleLogAction(entry.id, 'skipped')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Skip
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No Scheduled Doses"
            description="There are currently no active medication schedules. Finalize an active prescription to automatically populate doses."
          />
        )}
      </div>
    </div>
  );
}
