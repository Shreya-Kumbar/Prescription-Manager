import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Droplets, HeartPulse, Plus, Ruler, Scale, Thermometer, Wind } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { Vitals } from '../../types';
import Modal from '../ui/Modal';

const ALERT_TONE: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:border-rose-400/20',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:border-amber-400/20',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-200 dark:border-sky-400/20',
};

export function VitalAlerts({ vitals }: { vitals: Vitals }) {
  if (!vitals.alerts?.length) {
    return <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">All readings in normal range</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {vitals.alerts.map((a) => (
        <span key={a.message} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${ALERT_TONE[a.level]}`}>
          <AlertTriangle className="w-3 h-3" /> {a.message}
        </span>
      ))}
    </div>
  );
}

/** Compact tiles for the latest reading (used on patient page, new prescription, dashboards). */
export function VitalTiles({ v }: { v: Vitals }) {
  const tiles = [
    { icon: HeartPulse, label: 'Blood pressure', value: v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—', unit: 'mmHg', color: '#E08E8E' },
    { icon: Activity, label: 'Pulse', value: v.pulse ?? '—', unit: 'bpm', color: '#F2A98C' },
    { icon: Droplets, label: 'SpO₂', value: v.spo2 ?? '—', unit: '%', color: '#7DB9DE' },
    { icon: Thermometer, label: 'Temperature', value: v.temperature_c ?? '—', unit: '°C', color: '#E6B566' },
    { icon: Wind, label: 'Resp. rate', value: v.respiratory_rate ?? '—', unit: '/min', color: '#7CC4A0' },
    { icon: Scale, label: 'BMI', value: v.bmi ?? '—', unit: v.bmi_category ?? '', color: '#B7A6E0' },
  ];
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(128px,1fr))]">
      {tiles.map(({ icon: Icon, label, value, unit, color }) => (
        <div key={label} className="vital-tile rounded-xl border border-border dark:border-[#24352C] p-3 bg-white/60 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
            <span className="icon-tile w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            {label}
          </div>
          <p className="mt-1.5 text-lg font-bold text-text dark:text-white whitespace-nowrap">
            {value} <span className="text-xs font-medium text-text-secondary dark:text-slate-400">{unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

const EMPTY = { systolic_bp: '', diastolic_bp: '', pulse: '', spo2: '', temperature_c: '', respiratory_rate: '', weight_kg: '', height_cm: '', notes: '' };

export function RecordVitalsModal({ patientId, isOpen, onClose, onSaved }: {
  patientId: string; isOpen: boolean; onClose: () => void; onSaved: (v: Vitals) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const num = (x: string) => (x.trim() === '' ? undefined : Number(x));
  const bmi = num(f.weight_kg) && num(f.height_cm) ? (num(f.weight_kg)! / ((num(f.height_cm)! / 100) ** 2)).toFixed(1) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'notes' ? (v || undefined) : num(v)]));
      const res = await api.post(`/patients/${patientId}/vitals`, body);
      toast.success(res.data.alerts?.length ? `Vitals saved — ${res.data.alerts.length} reading(s) need attention` : 'Vitals saved');
      onSaved(res.data);
      setF(EMPTY);
      onClose();
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Check the readings and try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof EMPTY, label: string, unit: string, step = '1', placeholder = '') => (
    <div>
      <label className="label">{label} <span className="text-text-light dark:text-slate-500 font-normal">({unit})</span></label>
      <input type="number" step={step} inputMode="decimal" className="input" value={f[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record vitals" maxWidth="xl">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {field('systolic_bp', 'Systolic BP', 'mmHg', '1', '120')}
          {field('diastolic_bp', 'Diastolic BP', 'mmHg', '1', '80')}
          {field('pulse', 'Pulse', 'bpm', '1', '72')}
          {field('spo2', 'SpO₂', '%', '1', '98')}
          {field('temperature_c', 'Temperature', '°C', '0.1', '36.8')}
          {field('respiratory_rate', 'Respiratory rate', '/min', '1', '16')}
          {field('weight_kg', 'Weight', 'kg', '0.1', '65')}
          {field('height_cm', 'Height', 'cm', '0.1', '170')}
        </div>
        <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-slate-300">
          <Ruler className="w-4 h-4" /> BMI: <b className="text-text dark:text-white">{bmi ?? '—'}</b>
          <span className="text-xs">(calculated from weight and height)</span>
        </div>
        <div><label className="label">Notes</label><textarea rows={2} className="input" value={f.notes} onChange={set('notes')} placeholder="e.g. Complains of headache since morning" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save vitals'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Patient page panel: latest reading, alerts, history; record button for receptionist/doctor. */
export default function VitalsPanel({ patientId, role }: { patientId: string; role?: string }) {
  const [history, setHistory] = useState<Vitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const canRecord = role === 'receptionist' || role === 'doctor';

  const load = () => {
    api.get(`/patients/${patientId}/vitals`).then((r) => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [patientId]);

  const latest = history[0];
  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text dark:text-white">Vital signs</h3>
          <p className="text-xs text-text-secondary dark:text-slate-400">
            {latest ? `Last recorded ${new Date(latest.recorded_at).toLocaleString()} by ${latest.recorded_by_name} (${latest.recorded_by_role})` : 'Recorded at check-in, before the doctor sees the patient'}
          </p>
        </div>
        {canRecord && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Record vitals</button>
        )}
      </div>

      {loading ? (
        <div className="skeleton h-24 rounded-xl" />
      ) : latest ? (
        <>
          <VitalTiles v={latest} />
          <VitalAlerts vitals={latest} />
          {latest.notes && <p className="text-xs text-text-secondary dark:text-slate-400">Note: “{latest.notes}”</p>}
          {history.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-text-secondary dark:text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr><th className="py-2 pr-3">When</th><th className="pr-3">BP</th><th className="pr-3">Pulse</th><th className="pr-3">SpO₂</th><th className="pr-3">Temp</th><th className="pr-3">BMI</th><th>Flags</th></tr>
                </thead>
                <tbody>
                  {history.slice(1, 6).map((h) => (
                    <tr key={h.id} className="border-t border-border dark:border-[#24352C] text-text dark:text-slate-200">
                      <td className="py-2 pr-3">{new Date(h.recorded_at).toLocaleDateString()}</td>
                      <td className="pr-3">{h.systolic_bp ? `${h.systolic_bp}/${h.diastolic_bp}` : '—'}</td>
                      <td className="pr-3">{h.pulse ?? '—'}</td>
                      <td className="pr-3">{h.spo2 ?? '—'}</td>
                      <td className="pr-3">{h.temperature_c ?? '—'}</td>
                      <td className="pr-3">{h.bmi ?? '—'}</td>
                      <td>{h.alerts.length || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary dark:text-slate-400">No vitals recorded yet.</p>
      )}

      {canRecord && (
        <RecordVitalsModal patientId={patientId} isOpen={open} onClose={() => setOpen(false)} onSaved={(v) => setHistory((h) => [v, ...h])} />
      )}
    </div>
  );
}
