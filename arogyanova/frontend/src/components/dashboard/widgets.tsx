/**
 * Reusable dashboard widgets shared by every role's dashboard.
 * OOP note: each widget is a small, encapsulated component with a typed props
 * interface (its "public API"); dashboards compose them instead of duplicating markup.
 */
import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../context/ThemeContext';

export const STATUS_COLORS: Record<string, string> = {
  active: '#4FA67A',
  completed: '#7DB9DE',
  draft: '#E6B566',
  cancelled: '#E08E8E',
  expired: '#A3AFA8',
};

const tone = {
  blue: { bg: '#4FA67A1F', fg: '#4FA67A' },
  amber: { bg: '#E6B5661F', fg: '#C9963F' },
  teal: { bg: '#7DB9DE1F', fg: '#5A9EC4' },
  coral: { bg: '#E08E8E1F', fg: '#C46E6E' },
  slate: { bg: '#A3AFA81F', fg: '#7F8C85' },
  violet: { bg: '#B7A6E01F', fg: '#8C79C9' },
};
export type Tone = keyof typeof tone;

/* ---------- Page header: greeting + status chips + action ---------- */
export function PageHeader({ title, subtitle, chips = [], action }: {
  title: string;
  subtitle: string;
  chips?: { label: string; color?: string }[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-text dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-text-secondary dark:text-slate-400 mt-1">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span key={c.label} className="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border dark:border-[#24352C] bg-white/70 dark:bg-white/[0.03] text-text dark:text-slate-200">
            {c.color && <span className="dot-live w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />}
            {c.label}
          </span>
        ))}
        {action}
      </div>
    </div>
  );
}

/* ---------- Card with title + icon tile on the right ---------- */
export function WidgetCard({ title, icon: Icon, tone: t = 'blue', right, children, className = '' }: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-5 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text dark:text-white">{title}</h3>
        <div className="flex items-center gap-3">
          {right}
          <span className="icon-tile w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tone[t].bg, color: tone[t].fg }}>
            <Icon className="w-4 h-4" />
          </span>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function useChartColors() {
  const { isDark } = useTheme();
  return {
    grid: isDark ? '#24352C' : '#E8EEF5',
    axis: isDark ? '#7C8CA3' : '#8293A7',
    tooltip: {
      backgroundColor: isDark ? '#1C2922' : '#FFFFFF',
      border: `1px solid ${isDark ? '#2E4538' : '#E5EAF0'}`,
      borderRadius: 10,
      color: isDark ? '#E2E8F0' : '#172B3A',
      fontSize: 12,
      boxShadow: '0 8px 20px -10px rgba(15,23,42,0.35)',
    },
  };
}

/* ---------- Donut chart with total in the middle; slice grows on hover ---------- */
export function DonutCard({ title, icon, tone: t, data, centerLabel }: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  data: { name: string; value: number; color: string }[];
  centerLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const c = useChartColors();
  const shown = data.filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const focus = active !== null ? shown[active] : null;

  return (
    <WidgetCard title={title} icon={icon} tone={t}>
      {total === 0 ? (
        <p className="text-sm text-text-secondary dark:text-slate-400 py-16 text-center">No data yet</p>
      ) : (
        <>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="88%"
                  paddingAngle={shown.length > 1 ? 3 : 0}
                  cornerRadius={6}
                  stroke="none"
                  activeIndex={active ?? undefined}
                  activeShape={(p: any) => <Sector {...p} outerRadius={p.outerRadius + 6} />}
                  onMouseEnter={(_, i) => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  animationDuration={900}
                >
                  {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={c.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-text dark:text-white transition-all">{focus ? focus.value : total}</span>
              <span className="text-xs text-text-secondary dark:text-slate-400">{focus ? focus.name : centerLabel}</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
            {data.map((d, i) => (
              <button
                key={d.name}
                type="button"
                onMouseEnter={() => setActive(shown.findIndex((s) => s.name === d.name))}
                onMouseLeave={() => setActive(null)}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${active !== null && shown[active]?.name !== d.name ? 'opacity-40' : ''} text-text-secondary dark:text-slate-300`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} <span className="font-semibold text-text dark:text-white">{d.value}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}

/* ---------- Bar chart with soft gradient bars and hover highlight ---------- */
export function BarCard({ title, icon, tone: t, data, xKey, yKey, color = '#4FA67A', unit = '', yMax, right, empty = 'No data yet' }: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  unit?: string;
  yMax?: number;
  right?: React.ReactNode;
  empty?: string;
}) {
  const c = useChartColors();
  const id = `grad-${title.replace(/\W/g, '')}`;
  const hasData = data.some((d) => (d[yKey] ?? 0) > 0);
  return (
    <WidgetCard title={title} icon={icon} tone={t} right={right}>
      {!hasData ? (
        <p className="text-sm text-text-secondary dark:text-slate-400 py-16 text-center">{empty}</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 4" stroke={c.grid} />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} stroke={c.axis} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke={c.axis} fontSize={11} allowDecimals={false} domain={[0, yMax ?? 'auto']} />
              <Tooltip
                cursor={{ fill: color, fillOpacity: 0.08, radius: 8 } as any}
                contentStyle={c.tooltip}
                formatter={(v: any) => [`${v}${unit}`, '']}
                separator=""
              />
              <Bar dataKey={yKey} fill={`url(#${id})`} radius={[8, 8, 3, 3]} maxBarSize={44} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}

/* ---------- Progress list (e.g. patient load, prescriptions per doctor) ---------- */
export function ProgressList({ title, icon, tone: t, items, note, empty = 'No data yet' }: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  items: { label: string; sub: string; value: number; max: number; color?: string }[];
  note?: string;
  empty?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setReady(true), 80); return () => clearTimeout(id); }, []);
  return (
    <WidgetCard title={title} icon={icon} tone={t} right={note ? <span className="text-xs text-text-secondary dark:text-slate-400">{note}</span> : undefined}>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary dark:text-slate-400 py-10 text-center">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((it, i) => {
            const pct = it.max ? Math.round((it.value / it.max) * 100) : 0;
            const color = it.color ?? '#4FA67A';
            return (
              <li key={it.label} className="group flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold transition-transform group-hover:scale-110" style={{ backgroundColor: `${color}22`, color }}>
                  {it.label.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text dark:text-slate-100 truncate">{it.label}</span>
                    <span className="text-xs text-text-secondary dark:text-slate-400 shrink-0 ml-2">{it.sub}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-1000 ease-out"
                      style={{ width: ready ? `${pct}%` : '0%', backgroundColor: color, transitionDelay: `${i * 90}ms` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ---------- Activity / recent items list ---------- */
export function ActivityList({ title, icon, tone: t, items, onViewAll, empty = 'Nothing here yet' }: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  items: { key: string; title: string; sub: string; status?: string; dot?: string; onClick?: () => void; actions?: React.ReactNode }[];
  onViewAll?: () => void;
  empty?: string;
}) {
  return (
    <WidgetCard
      title={title}
      icon={icon}
      tone={t}
      right={onViewAll && (
        <button onClick={onViewAll} className="group text-xs font-medium text-primary dark:text-emerald-400 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    >
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary dark:text-slate-400 py-10 text-center">{empty}</p>
      ) : (
        <ul className="-mx-2">
          {items.map((it) => (
            <li
              key={it.key}
              onClick={it.onClick}
              className={`list-row flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${it.onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04]' : ''}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: it.dot ?? STATUS_COLORS[it.status ?? ''] ?? '#A3AFA8' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text dark:text-slate-100 truncate">{it.title}</p>
                <p className="text-xs text-text-secondary dark:text-slate-400 truncate">{it.sub}</p>
              </div>
              {it.actions}
              {it.status && (
                <span
                  className="badge-anim shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: `${STATUS_COLORS[it.status] ?? '#A3AFA8'}22`, color: STATUS_COLORS[it.status] ?? '#A3AFA8' }}
                >
                  {it.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ---------- Helpers ---------- */
export function lastSixMonths(dates: string[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, month: d.toLocaleString('en', { month: 'short' }), count: 0 };
  });
  dates.forEach((iso) => {
    const m = months.find((x) => iso?.startsWith(x.key));
    if (m) m.count += 1;
  });
  return months;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
