'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset, DatasetPreview, Analysis, CleaningSuggestion } from '@/lib/api';
import { 
  Database, ArrowLeft, FileSpreadsheet, BarChart3, 
  Wand2, Download, Check, X, ChevronDown, RefreshCw,
  AlertTriangle, AlertCircle, CheckCircle, Info,
  TrendingUp, TrendingDown, Minus, PieChart, Activity,
  Layers, AlertOctagon, GitCompare, Zap, Play
} from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import styles from './dataset.module.css';

type Tab = 'preview' | 'analysis' | 'clean' | 'export';

const SCORES_COLORS = {
  excellent: '#00d4aa',
  good: '#7c3aed',
  fair: '#f59e0b',
  poor: '#ef4444',
};

const ISSUE_COLORS = ['#00d4aa', '#7c3aed', '#f59e0b', '#ef4444', '#3b82f6'];

export default function DatasetPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [suggestions, setSuggestions] = useState<CleaningSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [autoCleanProgress, setAutoCleanProgress] = useState(0);
  const [autoCleanSteps, setAutoCleanSteps] = useState<string[]>([]);
  const [autoCleanComplete, setAutoCleanComplete] = useState(false);

  const datasetId = params.id as string;

  useEffect(() => {
    if (!user) return;
    loadDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, datasetId]);

  useEffect(() => {
    if (activeTab === 'preview' && !preview) loadPreview();
    if (activeTab === 'analysis' && !analysis) loadAnalysis();
    if (activeTab === 'clean' && suggestions.length === 0) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadDataset = async () => {
    try {
      const data = await api.get<Dataset>(`/api/datasets/${datasetId}`);
      setDataset(data);
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      const data = await api.get<DatasetPreview>(`/api/datasets/${datasetId}/preview`);
      setPreview(data);
    } catch (err) {
      console.error('Failed to load preview:', err);
    }
  };

  const loadAnalysis = async () => {
    try {
      const data = await api.get<Analysis>(`/api/analysis/${datasetId}/analysis`);
      setAnalysis(data);
    } catch (err) {
      console.error('Failed to load analysis:', err);
    }
  };

  const loadSuggestions = async () => {
    try {
      const data = await api.get<CleaningSuggestion[]>(`/api/cleaning/${datasetId}/suggestions`);
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const handleClean = async () => {
    const enabledSuggestions = suggestions.filter(s => s.enabled);
    if (enabledSuggestions.length === 0) return;

    setCleaning(true);
    try {
      await api.post(`/api/cleaning/${datasetId}/clean`, {
        operations: enabledSuggestions.map(s => ({
          operation_type: s.operation_type,
          column: s.column,
          strategy: s.strategy
        }))
      });
      await loadDataset();
      await loadPreview();
      await loadAnalysis();
      await loadSuggestions();
    } catch (err) {
      alert('Failed to clean dataset');
    } finally {
      setCleaning(false);
    }
  };

  const toggleSuggestion = (id: string) => {
    setSuggestions(prev => 
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const updateStrategy = (id: string, strategy: string) => {
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, strategy } : s)
    );
  };

  const applySingleSuggestion = async (suggestion: CleaningSuggestion) => {
    setCleaning(true);
    try {
      await api.post(`/api/cleaning/${datasetId}/clean`, {
        operations: [{
          operation_type: suggestion.operation_type,
          column: suggestion.column,
          strategy: suggestion.strategy
        }]
      });
      await loadDataset();
      await loadPreview();
      await loadAnalysis();
      await loadSuggestions();
    } catch (err) {
      alert('Failed to apply recommendation');
    } finally {
      setCleaning(false);
    }
  };

  const handleAutoClean = async () => {
    setCleaning(true);
    setAutoCleanProgress(10);
    setAutoCleanSteps(['Starting auto-clean pipeline...']);
    setAutoCleanComplete(false);

    try {
      const steps = [
        'Analyzing dataset...',
        'Removing duplicates...',
        'Filling missing values...',
        'Normalizing numeric columns...',
        'Encoding categorical variables...',
        'Handling outliers...',
        'Finalizing...'
      ];

      for (let i = 0; i < steps.length; i++) {
        setAutoCleanProgress(Math.round((i + 1) * (80 / steps.length)));
        setAutoCleanSteps(prev => [...prev, steps[i]]);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const result = await api.post<{
        steps_completed: string[];
        original_rows: number;
        new_rows: number;
        original_columns: number;
        new_columns: number;
      }>(`/api/cleaning/${datasetId}/auto-clean`, {});

      setAutoCleanSteps(result.steps_completed);
      setAutoCleanProgress(100);
      setAutoCleanComplete(true);

      await loadDataset();
      await loadPreview();
      await loadAnalysis();
      await loadSuggestions();
    } catch (err) {
      alert('Failed to auto-clean dataset');
      setAutoCleanSteps(prev => [...prev, 'Error: Auto-clean failed']);
    } finally {
      setCleaning(false);
    }
  };

  const handleDownload = async () => {
    const token = localStorage.getItem('access_token');
    window.open(`http://localhost:8000/api/datasets/${datasetId}/download?token=${token}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return SCORES_COLORS.excellent;
    if (score >= 70) return SCORES_COLORS.good;
    if (score >= 50) return SCORES_COLORS.fair;
    return SCORES_COLORS.poor;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <TrendingUp size={18} />;
    if (score >= 50) return <Minus size={18} />;
    return <TrendingDown size={18} />;
  };

  if (loading || !dataset) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const qualityScoreData = analysis ? [
    { name: 'Completeness', value: analysis.completeness_score, fullMark: 100 },
    { name: 'Consistency', value: analysis.consistency_score, fullMark: 100 },
    { name: 'Balance', value: analysis.imbalance_score, fullMark: 100 },
  ] : [];

  const issueDistributionData = analysis ? [
    { name: 'Missing', value: Object.values(analysis.missing_values).reduce((a, b) => a + b, 0), color: '#f59e0b' },
    { name: 'Duplicates', value: analysis.duplicate_rows, color: '#ef4444' },
    { name: 'Outliers', value: Object.values(analysis.outliers).reduce((a, b) => a + b, 0), color: '#7c3aed' },
    { name: 'Inconsistent', value: Object.values(analysis.inconsistent_categories).reduce((a, b) => a + b.length, 0), color: '#3b82f6' },
  ].filter(d => d.value > 0) : [];

  const missingColumnsData = analysis ? Object.entries(analysis.missing_values_percent)
    .filter(([_, val]) => val > 0)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .slice(0, 8) : [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.push('/dashboard')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Back to Datasets
        </button>
        <div className={styles.headerInfo}>
          <div className={styles.datasetIcon}>
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1>{dataset.name}</h1>
            <p>
              {dataset.row_count.toLocaleString()} rows • {dataset.column_count} columns • 
              {formatFileSize(dataset.file_size)}
            </p>
          </div>
        </div>
      </header>

      <nav className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'analysis' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={18} />
          Quality Report
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'preview' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <FileSpreadsheet size={18} />
          Preview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'clean' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('clean')}
        >
          <Wand2 size={18} />
          Clean
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'export' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <Download size={18} />
          Export
        </button>
      </nav>

      <main className={styles.content}>
        {activeTab === 'analysis' && analysis && (
          <div className={styles.analysisTab}>
            <div className={styles.reportHeader}>
              <div className={styles.overallScore}>
                <div className={styles.scoreRing} style={{ '--score-color': getScoreColor(analysis.quality_score) } as React.CSSProperties}>
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className={styles.scoreBg} />
                    <circle 
                      cx="50" cy="50" r="45" 
                      className={styles.scoreProgress}
                      style={{ 
                        strokeDasharray: `${(analysis.quality_score / 100) * 283} 283`,
                        stroke: getScoreColor(analysis.quality_score)
                      }}
                    />
                  </svg>
                  <div className={styles.scoreValue}>
                    <span className={styles.scoreNumber}>{analysis.quality_score}</span>
                    <span className={styles.scoreLabel}>out of 100</span>
                  </div>
                </div>
                <div className={styles.scoreInfo}>
                  <h2>Data Quality Score</h2>
                  <span className={styles.scoreRating} style={{ color: getScoreColor(analysis.quality_score) }}>
                    {getScoreIcon(analysis.quality_score)}
                    {getScoreLabel(analysis.quality_score)}
                  </span>
                  <p>Based on completeness, consistency, and balance metrics</p>
                </div>
              </div>
            </div>

            <div className={styles.scoresGrid}>
              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <Layers size={20} />
                  <span>Completeness</span>
                </div>
                <div className={styles.scoreCardValue} style={{ color: getScoreColor(analysis.completeness_score) }}>
                  {analysis.completeness_score}%
                </div>
                <div className={styles.scoreCardBar}>
                  <div 
                    className={styles.scoreCardProgress}
                    style={{ 
                      width: `${analysis.completeness_score}%`,
                      background: getScoreColor(analysis.completeness_score)
                    }}
                  />
                </div>
                <p className={styles.scoreCardDesc}>
                  {Object.values(analysis.missing_values).reduce((a, b) => a + b, 0).toLocaleString()} missing cells
                </p>
              </div>

              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <GitCompare size={20} />
                  <span>Consistency</span>
                </div>
                <div className={styles.scoreCardValue} style={{ color: getScoreColor(analysis.consistency_score) }}>
                  {analysis.consistency_score}%
                </div>
                <div className={styles.scoreCardBar}>
                  <div 
                    className={styles.scoreCardProgress}
                    style={{ 
                      width: `${analysis.consistency_score}%`,
                      background: getScoreColor(analysis.consistency_score)
                    }}
                  />
                </div>
                <p className={styles.scoreCardDesc}>
                  {analysis.duplicate_rows} duplicates + outliers
                </p>
              </div>

              <div className={styles.scoreCard}>
                <div className={styles.scoreCardHeader}>
                  <PieChart size={20} />
                  <span>Balance</span>
                </div>
                <div className={styles.scoreCardValue} style={{ color: getScoreColor(analysis.imbalance_score) }}>
                  {analysis.imbalance_score}%
                </div>
                <div className={styles.scoreCardBar}>
                  <div 
                    className={styles.scoreCardProgress}
                    style={{ 
                      width: `${analysis.imbalance_score}%`,
                      background: getScoreColor(analysis.imbalance_score)
                    }}
                  />
                </div>
                <p className={styles.scoreCardDesc}>
                  {Object.keys(analysis.imbalanced_columns).length} imbalanced columns
                </p>
              </div>
            </div>

            <div className={styles.chartsRow}>
              <div className={styles.chartCard}>
                <h3>
                  <AlertCircle size={18} />
                  Issues Distribution
                </h3>
                {issueDistributionData.length > 0 ? (
                  <div className={styles.pieChartWrapper}>
                    <ResponsiveContainer width="100%" height={220}>
                      <RechartsPie>
                        <Pie
                          data={issueDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {issueDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={styles.noIssues}>
                    <CheckCircle size={32} />
                    <span>No issues detected</span>
                  </div>
                )}
              </div>

              <div className={styles.chartCard}>
                <h3>
                  <Activity size={18} />
                  Quality Radar
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={qualityScoreData}>
                    <PolarGrid stroke="var(--border-color)" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="#00d4aa"
                      fill="#00d4aa"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {missingColumnsData.length > 0 && (
              <div className={styles.chartCard}>
                <h3>
                  <AlertTriangle size={18} />
                  Missing Values by Column
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={missingColumnsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className={styles.issuesSummary}>
              <h3>Detailed Issues</h3>
              <div className={styles.issuesList}>
                <div className={styles.issueItem}>
                  <AlertCircle size={18} className={styles.issueIcon} style={{ color: '#f59e0b' }} />
                  <div className={styles.issueContent}>
                    <span className={styles.issueTitle}>Missing Values</span>
                    <span className={styles.issueCount}>
                      {Object.values(analysis.missing_values).reduce((a, b) => a + b, 0).toLocaleString()} cells
                      ({Object.values(analysis.missing_values_percent).reduce((a, b) => a + b, 0) / analysis.column_count}% avg)
                    </span>
                  </div>
                </div>

                <div className={styles.issueItem}>
                  <AlertTriangle size={18} className={styles.issueIcon} style={{ color: '#ef4444' }} />
                  <div className={styles.issueContent}>
                    <span className={styles.issueTitle}>Duplicate Rows</span>
                    <span className={styles.issueCount}>
                      {analysis.duplicate_rows.toLocaleString()} rows ({analysis.duplicate_percentage}%)
                    </span>
                  </div>
                </div>

                <div className={styles.issueItem}>
                  <AlertOctagon size={18} className={styles.issueIcon} style={{ color: '#7c3aed' }} />
                  <div className={styles.issueContent}>
                    <span className={styles.issueTitle}>Outliers Detected</span>
                    <span className={styles.issueCount}>
                      {Object.values(analysis.outliers).reduce((a, b) => a + b, 0).toLocaleString()} values
                    </span>
                  </div>
                </div>

                {Object.keys(analysis.inconsistent_categories).length > 0 && (
                  <div className={styles.issueItem}>
                    <Info size={18} className={styles.issueIcon} style={{ color: '#3b82f6' }} />
                    <div className={styles.issueContent}>
                      <span className={styles.issueTitle}>Categorical Inconsistencies</span>
                      <span className={styles.issueCount}>
                        {Object.keys(analysis.inconsistent_categories).length} columns
                      </span>
                    </div>
                  </div>
                )}

                {Object.keys(analysis.imbalanced_columns).length > 0 && (
                  <div className={styles.issueItem}>
                    <PieChart size={18} className={styles.issueIcon} style={{ color: '#00d4aa' }} />
                    <div className={styles.issueContent}>
                      <span className={styles.issueTitle}>Class Imbalance</span>
                      <span className={styles.issueCount}>
                        {Object.keys(analysis.imbalanced_columns).length} columns with skewed distribution
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className={styles.previewTab}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {preview?.columns.map((col, i) => (
                      <th key={i}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview?.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell === null ? <span className={styles.nullValue}>null</span> : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.previewNote}>
              Showing {preview?.rows.length} of {preview?.total_rows.toLocaleString()} rows
            </p>
          </div>
        )}

        {activeTab === 'clean' && (
          <div className={styles.cleanTab}>
            <div className={styles.autoCleanSection}>
              <div className={styles.autoCleanHeader}>
                <div className={styles.autoCleanInfo}>
                  <Zap size={24} className={styles.autoCleanIcon} />
                  <div>
                    <h3>Auto Clean Dataset</h3>
                    <p>Apply all cleaning operations automatically in one click</p>
                  </div>
                </div>
                <button 
                  className={styles.autoCleanButton}
                  onClick={handleAutoClean}
                  disabled={cleaning}
                >
                  {cleaning ? (
                    <>
                      <RefreshCw size={18} className={styles.spinning} />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Auto Clean
                    </>
                  )}
                </button>
              </div>

              {cleaning && (
                <div className={styles.autoCleanProgress}>
                  <div className={styles.progressBarContainer}>
                    <div 
                      className={styles.progressBarFill}
                      style={{ width: `${autoCleanProgress}%` }}
                    />
                  </div>
                  <div className={styles.progressInfo}>
                    <span className={styles.progressPercent}>{autoCleanProgress}%</span>
                  </div>
                  <div className={styles.stepsList}>
                    {autoCleanSteps.map((step, index) => (
                      <div key={index} className={styles.stepItem}>
                        {index < autoCleanSteps.length - 1 || autoCleanComplete ? (
                          <CheckCircle size={14} className={styles.stepComplete} />
                        ) : (
                          <RefreshCw size={14} className={styles.stepRunning} />
                        )}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {autoCleanComplete && (
                <div className={styles.autoCleanSuccess}>
                  <CheckCircle size={20} />
                  <span>Auto-clean completed successfully!</span>
                </div>
              )}
            </div>

            <div className={styles.divider} />

            <div className={styles.suggestionsHeader}>
              <div>
                <h3>AI Cleaning Recommendations</h3>
                <p>
                  {suggestions.filter(s => s.enabled).length} of {suggestions.length} recommendations enabled
                </p>
              </div>
              <div className={styles.aiBadge}>
                <Wand2 size={16} />
                <span>AI Powered</span>
              </div>
            </div>

            <div className={styles.suggestionsList}>
              {suggestions.length === 0 ? (
                <div className={styles.noIssues}>
                  <CheckCircle size={48} />
                  <h3>No issues found!</h3>
                  <p>Your dataset is clean</p>
                </div>
              ) : (
                suggestions.map(suggestion => (
                  <div 
                    key={suggestion.id} 
                    className={`${styles.recommendationCard} ${suggestion.enabled ? styles.enabled : ''}`}
                  >
                    <div className={styles.recommendationHeader}>
                      <div 
                        className={styles.recommendationCheckbox}
                        onClick={() => toggleSuggestion(suggestion.id)}
                      >
                        {suggestion.enabled ? <Check size={16} /> : <div />}
                      </div>
                      <div className={styles.recommendationTitle}>
                        <span className={styles.operationType}>
                          {suggestion.operation_type.replace(/_/g, ' ')}
                        </span>
                        {suggestion.column && (
                          <span className={styles.columnBadge}>{suggestion.column}</span>
                        )}
                        {suggestion.column_type && (
                          <span className={styles.typeBadge}>
                            {suggestion.column_type}
                          </span>
                        )}
                      </div>
                      <div className={`${styles.priorityBadge} ${styles[`priority${suggestion.priority}`]}`}>
                        {suggestion.priority === 1 ? 'High' : suggestion.priority === 2 ? 'Medium' : 'Low'}
                      </div>
                    </div>

                    <div className={styles.recommendationBody}>
                      <div className={styles.issueSection}>
                        <AlertCircle size={14} />
                        <span className={styles.issueText}>
                          {suggestion.issue_detected || suggestion.description}
                        </span>
                      </div>
                      {suggestion.recommendation && (
                        <div className={styles.recommendationSection}>
                          <Wand2 size={14} />
                          <span className={styles.recommendationText}>
                            {suggestion.recommendation}
                          </span>
                        </div>
                      )}
                    </div>

                    {suggestion.strategy_options && suggestion.strategy_options.length > 1 && (
                      <div className={styles.strategySection}>
                        <span className={styles.strategyLabel}>Strategy:</span>
                        <div className={styles.strategyOptions}>
                          {suggestion.strategy_options.map((strategy) => (
                            <button
                              key={strategy}
                              className={`${styles.strategyButton} ${suggestion.strategy === strategy ? styles.strategyActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStrategy(suggestion.id, strategy);
                              }}
                            >
                              {strategy.replace(/_/g, ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.recommendationFooter}>
                      {suggestion.affected_rows && (
                        <span className={styles.affectedCount}>
                          {suggestion.affected_rows.toLocaleString()} rows affected
                        </span>
                      )}
                      <button 
                        className={styles.applyOneClick}
                        onClick={(e) => {
                          e.stopPropagation();
                          applySingleSuggestion(suggestion);
                        }}
                      >
                        <Wand2 size={14} />
                        Apply
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {suggestions.length > 0 && (
              <button 
                className={styles.applyButton}
                onClick={handleClean}
                disabled={cleaning || suggestions.filter(s => s.enabled).length === 0}
              >
                {cleaning ? (
                  <>
                    <RefreshCw size={18} className={styles.spinning} />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    Apply Selected ({suggestions.filter(s => s.enabled).length})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className={styles.exportTab}>
            <div className={styles.exportCard}>
              <FileSpreadsheet size={48} />
              <h3>Download Cleaned Dataset</h3>
              <p>Your dataset is ready to download</p>
              <button className={styles.downloadButton} onClick={handleDownload}>
                <Download size={20} />
                Download CSV
              </button>
            </div>
            <div className={styles.exportInfo}>
              <h4>Dataset Information</h4>
              <div className={styles.infoRow}>
                <span>Rows</span>
                <span>{dataset.row_count.toLocaleString()}</span>
              </div>
              <div className={styles.infoRow}>
                <span>Columns</span>
                <span>{dataset.column_count}</span>
              </div>
              <div className={styles.infoRow}>
                <span>File Size</span>
                <span>{formatFileSize(dataset.file_size)}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
