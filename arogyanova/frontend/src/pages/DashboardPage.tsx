import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  HeartPulse,
  History,
  Pill,
  PieChart as PieIcon,
  PlusCircle,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatCard from '../components/ui/StatCard';
import {
  ActivityList,
  BarCard,
  DonutCard,
  PageHeader,
  ProgressList,
  STATUS_COLORS,
  lastSixMonths,
  timeAgo,
} from '../components/dashboard/widgets';

const fullName = (u: any) => (u ? `${u.first_name} ${u.last_name}` : 'Unknown');
const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const statusSlices = (dist: Record<string, number>) =>
  ['active', 'completed', 'draft', 'cancelled', 'expired']
    .map((s) => ({ name: s[0].toUpperCase() + s.slice(1), value: dist[s] ?? 0, color: STATUS_COLORS[s] }))
    .filter((d) => d.value > 0 || ['active', 'completed', 'draft', 'cancelled'].includes(d.name.toLowerCase()));
const countBy = <T,>(arr: T[], key: (x: T) => string) =>
  arr.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});

/** Loads several endpoints in parallel; a failing optional endpoint never breaks the page. */
function useDashboardData(role?: string) {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const wanted: Record<string, string> = { dash: '/dashboard', rx: '/prescriptions?per_page=100' };
    if (role === 'doctor' || role === 'administrator') wanted.analytics = '/analytics/overview?days=365';
    if (role === 'patient') wanted.schedule = '/schedule';
    if (role === 'pharmacist') wanted.meds = '/medications?per_page=200';
    if (role === 'administrator') wanted.audits = '/admin/audit-logs';

    const entries = await Promise.all(
      Object.entries(wanted).map(async ([k, url]) => {
        try {
          const r = await api.get(url);
          return [k, Array.isArray(r.data) ? r.data : r.data?.items ?? r.data] as const;
        } catch {
          return [k, null] as const;
        }
      }),
    );
    const next = Object.fromEntries(entries);
    if (!next.dash) toast.error('Failed to load dashboard.');
    setData(next);
    setLoading(false);
  };

  useEffect(() => { if (role) load(); }, [role]);
  return { data, loading, reload: load };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role;
  const { data, loading, reload } = useDashboardData(role);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-80 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-80 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const props = { user, data, reload };
  if (role === 'doctor') return <DoctorDashboard {...props} />;
  if (role === 'patient') return <PatientDashboard {...props} />;
  if (role === 'pharmacist') return <PharmacistDashboard {...props} />;
  if (role === 'administrator') return <AdminDashboard {...props} />;
  return null;
}

type DashProps = { user: any; data: Record<string, any>; reload: () => void };

/* ===================================================================== */
/*  DOCTOR                                                               */
/* ===================================================================== */
function DoctorDashboard({ user, data }: DashProps) {
  const navigate = useNavigate();
  const stats = data.dash?.stats ?? {};
  const rx: any[] = data.rx ?? [];
  const a = data.analytics ?? {};
  const adherence = a.adherence_rate;

  const perPatient = useMemo(() => {
    const counts = countBy(rx, (p) => fullName(p.patient));
    const max = Math.max(1, ...Object.values(counts));
    const active = countBy(rx.filter((p) => p.status === 'active'), (p) => fullName(p.patient));
    const palette = ['#4FA67A', '#7DB9DE', '#E6B566', '#B7A6E0', '#F2A98C'];
    return Object.entries(counts)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([label, value], i) => ({ label, value, max, sub: `${active[label] ?? 0} active · ${value} total`, color: palette[i % palette.length] }));
  }, [rx]);

  const exportCsv = () => {
    const rows = [['Prescription', 'Patient', 'Status', 'Issue date', 'Medicines'], ...rx.map((p) => [p.id.slice(0, 8), fullName(p.patient), p.status, p.issue_date, p.item_count])];
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((r) => r.join(',')).join('\n'));
    link.download = `ArogyaNova_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Report exported');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, Dr. ${user?.last_name ?? ''}`}
        subtitle="Here's what's happening with your patients and prescriptions."
        chips={[
          ...(stats.draft_prescriptions ? [{ label: `${stats.draft_prescriptions} drafts pending`, color: '#E6B566' }] : []),
          { label: `${stats.active_prescriptions ?? 0} active treatments`, color: '#4FA67A' },
          ...(adherence != null ? [{ label: `Adherence ${adherence}%` }] : []),
        ]}
        action={<button onClick={exportCsv} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Export CSV</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Patients" value={stats.total_patients ?? 0} subtitle="Under your care" icon={Users} color="primary" />
        <StatCard title="Prescriptions" value={stats.total_prescriptions ?? 0} subtitle="Authored by you" icon={FileText} color="secondary" />
        <StatCard title="Active" value={stats.active_prescriptions ?? 0} subtitle={`${stats.total_prescriptions ? Math.round((stats.active_prescriptions / stats.total_prescriptions) * 100) : 0}% of total`} icon={Activity} color="success" />
        <StatCard title="Adherence" value={adherence != null ? `${adherence}%` : '—'} subtitle={`${a.doses_taken ?? 0} of ${a.doses_logged ?? 0} doses taken`} icon={HeartPulse} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard title="By status" icon={PieIcon} tone="amber" data={statusSlices(a.status_distribution ?? countBy(rx, (p) => p.status))} centerLabel="prescriptions" />
        <div className="lg:col-span-2">
          <BarCard title="Prescriptions per month" icon={BarChart3} tone="blue" data={lastSixMonths(rx.map((p) => p.issue_date))} xKey="month" yKey="count" right={<span className="text-xs text-text-secondary dark:text-slate-400">Last 6 months</span>} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarCard title="Dose adherence, last 7 days" icon={HeartPulse} tone="teal" color="#7DB9DE" unit="%" yMax={100}
          data={(a.adherence_by_day ?? []).map((d: any) => ({ ...d, rate: d.rate ?? 0 }))} xKey="day" yKey="rate"
          empty="No doses logged this week" />
        <ProgressList title="Patient load" icon={Users} tone="violet" note="Prescriptions per patient" items={perPatient} empty="No patients yet" />
      </div>

      <ActivityList
        title="Recent prescriptions"
        icon={Clock}
        tone="blue"
        onViewAll={() => navigate('/prescriptions')}
        items={rx.slice(0, 6).map((p) => ({
          key: p.id,
          title: p.diagnosis || 'Prescription',
          sub: `${fullName(p.patient)} · ${p.item_count} medicine${p.item_count === 1 ? '' : 's'} · ${fmtDate(p.issue_date)}`,
          status: p.status,
          onClick: () => navigate(`/prescriptions/${p.id}`),
        }))}
        empty="No prescriptions yet"
      />
    </div>
  );
}

/* ===================================================================== */
/*  PATIENT                                                              */
/* ===================================================================== */
function PatientDashboard({ user, data, reload }: DashProps) {
  const navigate = useNavigate();
  const stats = data.dash?.stats ?? {};
  const schedule: any[] = data.schedule ?? [];
  const rx: any[] = data.rx ?? [];

  const logDose = async (id: string, action: 'taken' | 'skipped') => {
    try {
      await api.post(`/schedule/${id}/log`, { action });
      toast.success(`Dose marked as ${action}`);
      reload();
    } catch {
      toast.error('Could not log that dose.');
    }
  };

  const today = new Date().toDateString();
  const todays = schedule.filter((s) => new Date(s.scheduled_at).toDateString() === today);
  const taken = todays.filter((s) => s.logged_action === 'taken').length;
  const skipped = todays.filter((s) => s.logged_action === 'skipped').length;
  const logged = schedule.filter((s) => s.logged_action);
  const adherence = logged.length ? Math.round((logged.filter((s) => s.logged_action === 'taken').length / logged.length) * 100) : null;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const day = schedule.filter((s) => new Date(s.scheduled_at).toDateString() === d.toDateString() && s.logged_action);
    const t = day.filter((s) => s.logged_action === 'taken').length;
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), rate: day.length ? Math.round((t / day.length) * 100) : 0 };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user?.first_name ?? ''}`}
        subtitle="Your medicines and progress for today."
        chips={[
          { label: `${todays.length - taken - skipped} doses left today`, color: '#E6B566' },
          ...(adherence != null ? [{ label: `Adherence ${adherence}%`, color: '#7DB9DE' }] : []),
        ]}
        action={<button onClick={() => navigate('/schedule')} className="btn-primary text-xs"><Calendar className="w-3.5 h-3.5" /> Full schedule</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active prescriptions" value={stats.active_prescriptions ?? 0} subtitle={`${stats.total_prescriptions ?? 0} in total`} icon={FileText} color="primary" />
        <StatCard title="Doses today" value={todays.length} subtitle="Scheduled for today" icon={Pill} color="secondary" />
        <StatCard title="Taken today" value={taken} subtitle={todays.length ? `${Math.round((taken / todays.length) * 100)}% done` : 'Nothing scheduled'} icon={CheckCircle2} color="success" />
        <StatCard title="Adherence" value={adherence != null ? `${adherence}%` : '—'} subtitle={`${logged.length} doses logged`} icon={HeartPulse} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard title="Today's doses" icon={PieIcon} tone="teal" centerLabel="doses today" data={[
          { name: 'Taken', value: taken, color: '#7DB9DE' },
          { name: 'Pending', value: todays.length - taken - skipped, color: '#4FA67A' },
          { name: 'Skipped', value: skipped, color: '#E08E8E' },
        ]} />
        <div className="lg:col-span-2">
          <BarCard title="Your adherence, last 7 days" icon={HeartPulse} tone="blue" color="#4FA67A" unit="%" yMax={100} data={week} xKey="day" yKey="rate" empty="Log your doses to see your progress" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityList
          title="Today's medicines"
          icon={Clock}
          tone="amber"
          onViewAll={() => navigate('/schedule')}
          empty="No medicines scheduled today"
          items={todays.map((s) => ({
            key: s.id,
            title: s.medication_name,
            sub: `${s.dosage} · ${new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            dot: s.logged_action === 'taken' ? '#7DB9DE' : s.logged_action === 'skipped' ? '#E08E8E' : '#4FA67A',
            actions: s.logged_action ? (
              <span className="text-xs font-medium capitalize text-text-secondary dark:text-slate-400">{s.logged_action}</span>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => logDose(s.id, 'taken')} className="btn-primary !px-2.5 !py-1 text-xs">Taken</button>
                <button onClick={() => logDose(s.id, 'skipped')} className="btn-secondary !px-2.5 !py-1 text-xs">Skip</button>
              </div>
            ),
          }))}
        />
        <ActivityList
          title="My prescriptions"
          icon={FileText}
          tone="blue"
          onViewAll={() => navigate('/prescriptions')}
          empty="No prescriptions yet"
          items={rx.slice(0, 6).map((p) => ({
            key: p.id,
            title: p.diagnosis || 'Prescription',
            sub: `Dr. ${p.doctor?.last_name ?? ''} · ${p.item_count} medicine${p.item_count === 1 ? '' : 's'} · ${fmtDate(p.issue_date)}`,
            status: p.status,
            onClick: () => navigate(`/prescriptions/${p.id}`),
          }))}
        />
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  PHARMACIST                                                           */
/* ===================================================================== */
function PharmacistDashboard({ user, data }: DashProps) {
  const navigate = useNavigate();
  const stats = data.dash?.stats ?? {};
  const rx: any[] = data.rx ?? [];
  const activeRx = rx.filter((p) => p.status === 'active');
  const queue = (state: string) => activeRx.filter((p) => (p.pharmacy_status ?? 'pending') === state);

  const byDoctor = useMemo(() => {
    const counts = countBy(rx, (p) => `Dr. ${fullName(p.doctor)}`);
    const max = Math.max(1, ...Object.values(counts));
    const palette = ['#B7A6E0', '#4FA67A', '#7DB9DE', '#E6B566'];
    return Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([label, value], i) => ({ label, value, max, sub: `${value} prescription${value === 1 ? '' : 's'}`, color: palette[i % palette.length] }));
  }, [rx]);

  const row = (p: any) => ({
    key: p.id,
    title: fullName(p.patient),
    sub: `${p.diagnosis || 'Prescription'} · Dr. ${p.doctor?.last_name ?? ''} · ${p.item_count} medicine${p.item_count === 1 ? '' : 's'}`,
    dot: p.pharmacy_status === 'verified' ? '#7DB9DE' : p.pharmacy_status === 'flagged' ? '#E08E8E' : '#E6B566',
    onClick: () => navigate(`/prescriptions/${p.id}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.first_name ?? ''}`}
        subtitle="Verify prescriptions, flag problems to the doctor and dispense medicines."
        chips={[
          { label: `${stats.prescriptions_pending_review ?? 0} to review`, color: '#E6B566' },
          { label: `${stats.ready_to_dispense ?? 0} ready to dispense`, color: '#7DB9DE' },
        ]}
        action={<button onClick={() => navigate('/ai-review')} className="btn-primary text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Check interactions</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="To review" value={stats.prescriptions_pending_review ?? 0} subtitle="Awaiting verification" icon={ClipboardCheck} color="warning" />
        <StatCard title="Ready to dispense" value={stats.ready_to_dispense ?? 0} subtitle="Verified, not yet handed out" icon={CheckCircle2} color="secondary" />
        <StatCard title="Flagged" value={stats.flagged ?? 0} subtitle="Sent back to the doctor" icon={Activity} color="success" />
        <StatCard title="Dispensed" value={stats.dispensed ?? 0} subtitle="Medicines handed out" icon={Pill} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard title="Pharmacy queue" icon={PieIcon} tone="amber" centerLabel="active prescriptions" data={[
          { name: 'To review', value: stats.prescriptions_pending_review ?? 0, color: '#E6B566' },
          { name: 'Ready', value: stats.ready_to_dispense ?? 0, color: '#7DB9DE' },
          { name: 'Flagged', value: stats.flagged ?? 0, color: '#E08E8E' },
          { name: 'Dispensed', value: stats.dispensed ?? 0, color: '#4FA67A' },
        ]} />
        <div className="lg:col-span-2">
          <BarCard title="Prescriptions per month" icon={BarChart3} tone="blue" data={lastSixMonths(rx.map((p) => p.issue_date))} xKey="month" yKey="count" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActivityList title="To review" icon={ClipboardCheck} tone="amber" empty="Nothing waiting for review"
          onViewAll={() => navigate('/prescriptions')} items={[...queue('pending'), ...queue('flagged')].slice(0, 6).map(row)} />
        <ActivityList title="Ready to dispense" icon={Pill} tone="teal" empty="Nothing verified yet"
          onViewAll={() => navigate('/prescriptions')} items={queue('verified').slice(0, 6).map(row)} />
        <ProgressList title="Prescribers" icon={Stethoscope} tone="violet" note="By volume" items={byDoctor} empty="No prescriptions yet" />
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  ADMINISTRATOR                                                        */
/* ===================================================================== */
function AdminDashboard({ user, data }: DashProps) {
  const navigate = useNavigate();
  const stats = data.dash?.stats ?? {};
  const roles = stats.users_by_role ?? {};
  const rx: any[] = data.rx ?? [];
  const audits: any[] = data.audits ?? [];
  const totalUsers = Object.values(roles).reduce((s: number, v: any) => s + v, 0) as number;
  const failedLogins = audits.filter((a) => a.action?.includes('fail')).length;

  const byDoctor = useMemo(() => {
    const counts = countBy(rx, (p) => `Dr. ${fullName(p.doctor)}`);
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([label, value], i) => ({ label, value, max, sub: `${value} prescription${value === 1 ? '' : 's'}`, color: ['#4FA67A', '#7DB9DE', '#B7A6E0', '#E6B566'][i % 4] }));
  }, [rx]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.first_name ?? ''}`}
        subtitle="System health, users and security activity."
        chips={[
          ...(failedLogins ? [{ label: `${failedLogins} failed logins`, color: '#E08E8E' }] : []),
          { label: `${totalUsers} users`, color: '#4FA67A' },
        ]}
        action={<button onClick={() => navigate('/users')} className="btn-primary text-xs"><Users className="w-3.5 h-3.5" /> Manage users</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Users" value={totalUsers} subtitle="Registered accounts" icon={Users} color="primary" />
        <StatCard title="Doctors" value={roles.doctor ?? 0} subtitle="Licensed prescribers" icon={Stethoscope} color="secondary" />
        <StatCard title="Patients" value={roles.patient ?? 0} subtitle="Patient records" icon={HeartPulse} color="success" />
        <StatCard title="Prescriptions" value={stats.total_prescriptions ?? 0} subtitle={`${stats.active_prescriptions ?? 0} active`} icon={FileText} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard title="Users by role" icon={PieIcon} tone="violet" centerLabel="users" data={[
          { name: 'Doctors', value: roles.doctor ?? 0, color: '#4FA67A' },
          { name: 'Patients', value: roles.patient ?? 0, color: '#7DB9DE' },
          { name: 'Pharmacists', value: roles.pharmacist ?? 0, color: '#E6B566' },
          { name: 'Admins', value: roles.administrator ?? 0, color: '#B7A6E0' },
        ]} />
        <div className="lg:col-span-2">
          <BarCard title="Prescriptions per month" icon={BarChart3} tone="blue" data={lastSixMonths(rx.map((p) => p.issue_date))} xKey="month" yKey="count" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityList
          title="Security audit log"
          icon={History}
          tone="coral"
          onViewAll={() => navigate('/users')}
          empty="No activity yet"
          items={audits.slice(0, 7).map((a) => ({
            key: a.id,
            title: a.action.replace(/[._]/g, ' '),
            sub: `${a.resource_type} · ${a.ip_address || 'local'} · ${timeAgo(a.created_at)}`,
            dot: a.action.includes('fail') ? '#E08E8E' : a.action.includes('login') ? '#7DB9DE' : '#4FA67A',
          }))}
        />
        <ProgressList title="Prescriptions by doctor" icon={Stethoscope} tone="blue" note="All time" items={byDoctor} empty="No prescriptions yet" />
      </div>
    </div>
  );
}
