'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset } from '@/lib/api';
import {
  Database,
  Upload,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  FileSpreadsheet,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import styles from './overview.module.css';

interface DashboardStats {
  totalDatasets: number;
  totalRows: number;
  avgQualityScore: number;
  processingTime: number;
}

interface CleaningJob {
  id: string;
  datasetName: string;
  status: 'completed' | 'processing' | 'failed';
  qualityScore: number;
  timestamp: string;
  operations: number;
}

const mockChartData = [
  { name: 'Jan', datasets: 4, rows: 12500 },
  { name: 'Feb', datasets: 6, rows: 28000 },
  { name: 'Mar', datasets: 3, rows: 15000 },
  { name: 'Apr', datasets: 8, rows: 42000 },
  { name: 'May', datasets: 5, rows: 31000 },
  { name: 'Jun', datasets: 7, rows: 38000 },
];

const mockQualityData = [
  { name: 'Excellent', value: 45, color: '#00d4aa' },
  { name: 'Good', value: 30, color: '#7c3aed' },
  { name: 'Fair', value: 15, color: '#f59e0b' },
  { name: 'Poor', value: 10, color: '#ef4444' },
];

const mockRecentJobs: CleaningJob[] = [
  { id: '1', datasetName: 'customer_data.csv', status: 'completed', qualityScore: 92, timestamp: '2024-01-15T10:30:00', operations: 5 },
  { id: '2', datasetName: 'sales_2024.csv', status: 'completed', qualityScore: 87, timestamp: '2024-01-14T15:45:00', operations: 3 },
  { id: '3', datasetName: 'inventory.csv', status: 'processing', qualityScore: 0, timestamp: '2024-01-15T11:00:00', operations: 2 },
  { id: '4', datasetName: 'users_export.csv', status: 'completed', qualityScore: 78, timestamp: '2024-01-13T09:15:00', operations: 4 },
  { id: '5', datasetName: 'transactions.csv', status: 'failed', qualityScore: 0, timestamp: '2024-01-12T14:20:00', operations: 1 },
];

export default function DashboardOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get<Dataset[]>('/api/datasets');
      setDatasets(data);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats: DashboardStats = {
    totalDatasets: datasets.length || 12,
    totalRows: datasets.reduce((acc, d) => acc + d.row_count, 0) || 156000,
    avgQualityScore: 84,
    processingTime: 245,
  };

  const recentJobs = mockRecentJobs;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 60) return Math.floor(seconds / 60) + 'm';
    return seconds + 's';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className={styles.statusCompleted} />;
      case 'processing':
        return <Clock size={16} className={styles.statusProcessing} />;
      case 'failed':
        return <AlertCircle size={16} className={styles.statusFailed} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(0, 212, 170, 0.1)' }}>
            <Database size={24} color="var(--accent-primary)" />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.totalDatasets}</span>
            <span className={styles.statLabel}>Datasets Processed</span>
          </div>
          <div className={styles.statTrend}>
            <TrendingUp size={14} />
            <span>+12%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(124, 58, 237, 0.1)' }}>
            <FileSpreadsheet size={24} color="var(--accent-secondary)" />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{formatNumber(stats.totalRows)}</span>
            <span className={styles.statLabel}>Total Rows Cleaned</span>
          </div>
          <div className={styles.statTrend}>
            <TrendingUp size={14} />
            <span>+23%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <Sparkles size={24} color="var(--accent-success)" />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.avgQualityScore}%</span>
            <span className={styles.statLabel}>Avg Quality Score</span>
          </div>
          <div className={styles.statTrendPositive}>
            <TrendingUp size={14} />
            <span>+5%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <Zap size={24} color="var(--accent-warning)" />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{formatTime(stats.processingTime)}</span>
            <span className={styles.statLabel}>Avg Processing Time</span>
          </div>
          <div className={styles.statTrendPositive}>
            <TrendingUp size={14} />
            <span>-18%</span>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Cleaning Activity</h3>
            <span className={styles.chartSubtitle}>Datasets processed over time</span>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorDatasets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="datasets"
                  stroke="#00d4aa"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDatasets)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Rows Processed</h3>
            <span className={styles.chartSubtitle}>Monthly data volume</span>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [formatNumber(value), 'Rows']}
                />
                <Bar dataKey="rows" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Quality Distribution</h3>
            <span className={styles.chartSubtitle}>Dataset quality scores</span>
          </div>
          <div className={styles.pieContainer}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={mockQualityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {mockQualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Datasets']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieLegend}>
              {mockQualityData.map((item) => (
                <div key={item.name} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color }} />
                  <span className={styles.legendLabel}>{item.name}</span>
                  <span className={styles.legendValue}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.jobsCard}>
          <div className={styles.jobsHeader}>
            <h3>Recent Cleaning Jobs</h3>
            <button className={styles.viewAllButton} onClick={() => router.push('/dashboard/history')}>
              View All <ArrowUpRight size={14} />
            </button>
          </div>
          <div className={styles.jobsList}>
            {recentJobs.map((job) => (
              <div key={job.id} className={styles.jobItem}>
                <div className={styles.jobIcon}>
                  <FileSpreadsheet size={18} />
                </div>
                <div className={styles.jobInfo}>
                  <span className={styles.jobName}>{job.datasetName}</span>
                  <span className={styles.jobMeta}>
                    {job.status === 'processing' ? 'Processing...' : `${job.operations} operations`} • {formatDate(job.timestamp)}
                  </span>
                </div>
                <div className={styles.jobStatus}>
                  {getStatusIcon(job.status)}
                  {job.status === 'completed' && (
                    <span className={styles.qualityScore}>{job.qualityScore}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div className={styles.actionsGrid}>
          <button className={styles.actionCard} onClick={() => router.push('/dashboard/upload')}>
            <div className={styles.actionIcon}>
              <Upload size={24} />
            </div>
            <span>Upload Dataset</span>
          </button>
          <button className={styles.actionCard} onClick={() => router.push('/dashboard/history')}>
            <div className={styles.actionIcon}>
              <Clock size={24} />
            </div>
            <span>View History</span>
          </button>
          <button className={styles.actionCard}>
            <div className={styles.actionIcon}>
              <Sparkles size={24} />
            </div>
            <span>Auto Clean</span>
          </button>
        </div>
      </div>
    </div>
  );
}
