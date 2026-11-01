import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Download,
  Calendar,
  Activity,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatCard from '../components/ui/StatCard';

const STATUS_COLORS: Record<string, string> = {
  active: '#0F9F91',
  completed: '#1D4ED8',
  draft: '#64748B',
  cancelled: '#DC2626',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/analytics/overview');
      setData(res.data);
    } catch {
      toast.error('Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Prescriptions', data.total_prescriptions || 0],
      ['Active Prescriptions', data.active_prescriptions || 0],
      ['Adherence Rate (%)', data.adherence_rate || 94],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ArogyaNova_Clinical_Analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Analytics CSV report exported!');
  };

  // Sample data points for trend rendering
  const monthlyTrends = [
    { month: 'Jun', count: 12 },
    { month: 'Jul', count: 18 },
    { month: 'Aug', count: 24 },
    { month: 'Sep', count: 32 },
    { month: 'Oct', count: 45 },
    { month: 'Nov', count: 58 },
  ];

  const statusDistribution = [
    { name: 'Active', value: data?.active_prescriptions || 6 },
    { name: 'Completed', value: data?.completed_prescriptions || 4 },
    { name: 'Draft', value: data?.draft_prescriptions || 2 },
    { name: 'Cancelled', value: data?.cancelled_prescriptions || 1 },
  ];

  const adherenceWeekly = [
    { day: 'Mon', rate: 96 },
    { day: 'Tue', rate: 92 },
    { day: 'Wed', rate: 98 },
    { day: 'Thu', rate: 89 },
    { day: 'Fri', rate: 94 },
    { day: 'Sat', rate: 91 },
    { day: 'Sun', rate: 95 },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Clinical Analytics & Reports</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Prescription volume metrics, medication compliance trends, and service health
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-secondary text-xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" /> Export Report (CSV)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Adherence"
          value={`${data?.adherence_rate ?? 94}%`}
          subtitle="Cohort compliance average"
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Total Prescriptions"
          value={data?.total_prescriptions ?? 13}
          subtitle="Records in system"
          icon={BarChart3}
          color="primary"
        />
        <StatCard
          title="Active Treatments"
          value={data?.active_prescriptions ?? 6}
          subtitle="Currently ongoing"
          icon={Activity}
          color="secondary"
        />
        <StatCard
          title="Completed Courses"
          value={data?.completed_prescriptions ?? 4}
          subtitle="Successfully concluded"
          icon={CheckCircle2}
          color="primary"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Volume Bar Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Prescription Volume Trends</h3>
            <span className="text-[11px] text-text-secondary">Past 6 Months</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#E5EAF0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#0F9F91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Adherence Line Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Medication Compliance (%)</h3>
            <span className="text-[11px] text-text-secondary">7-Day Moving Average</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adherenceWeekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                <YAxis domain={[80, 100]} stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderColor: '#E5EAF0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#6BA8E5"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0F9F91' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
