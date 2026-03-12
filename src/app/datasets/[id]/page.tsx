'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset, DatasetPreview, Analysis, CleaningSuggestion } from '@/lib/api';
import { 
  Database, ArrowLeft, FileSpreadsheet, BarChart3, 
  Wand2, Download, Check, X, ChevronDown, RefreshCw,
  AlertTriangle, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import styles from './dataset.module.css';

type Tab = 'preview' | 'analysis' | 'clean' | 'export';

export default function DatasetPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [suggestions, setSuggestions] = useState<CleaningSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const datasetId = params.id as string;

  useEffect(() => {
    if (!user) return;
    loadDataset();
  }, [user, datasetId]);

  useEffect(() => {
    if (activeTab === 'preview' && !preview) loadPreview();
    if (activeTab === 'analysis' && !analysis) loadAnalysis();
    if (activeTab === 'clean' && suggestions.length === 0) loadSuggestions();
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
          column: s.column
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

  const handleDownload = async () => {
    const token = localStorage.getItem('access_token');
    window.open(`http://localhost:8000/api/datasets/${datasetId}/download?token=${token}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading || !dataset) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

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
          className={`${styles.tab} ${activeTab === 'preview' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <FileSpreadsheet size={18} />
          Preview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'analysis' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={18} />
          Analysis
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

        {activeTab === 'analysis' && analysis && (
          <div className={styles.analysisTab}>
            <div className={styles.qualityScore}>
              <div className={styles.scoreCircle} style={{ 
                '--score': analysis.quality_score,
                '--color': analysis.quality_score > 80 ? 'var(--accent-success)' : 
                           analysis.quality_score > 50 ? 'var(--accent-warning)' : 'var(--accent-error)'
              } as React.CSSProperties}>
                <span>{analysis.quality_score}</span>
              </div>
              <h3>Data Quality Score</h3>
            </div>

            <div className={styles.issuesGrid}>
              <div className={styles.issueCard}>
                <AlertCircle size={24} className={styles.issueIcon} style={{ color: 'var(--accent-warning)' }} />
                <div>
                  <span className={styles.issueCount}>
                    {Object.values(analysis.missing_values).reduce((a, b) => a + b, 0)}
                  </span>
                  <span className={styles.issueLabel}>Missing Values</span>
                </div>
              </div>
              <div className={styles.issueCard}>
                <AlertTriangle size={24} className={styles.issueIcon} style={{ color: 'var(--accent-error)' }} />
                <div>
                  <span className={styles.issueCount}>{analysis.duplicate_rows}</span>
                  <span className={styles.issueLabel}>Duplicate Rows</span>
                </div>
              </div>
              <div className={styles.issueCard}>
                <Info size={24} className={styles.issueIcon} style={{ color: 'var(--accent-secondary)' }} />
                <div>
                  <span className={styles.issueCount}>
                    {Object.values(analysis.outliers).reduce((a, b) => a + b, 0)}
                  </span>
                  <span className={styles.issueLabel}>Outliers</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Column Summary</h3>
              <div className={styles.columnStats}>
                {dataset.columns.map((col, i) => (
                  <div key={i} className={styles.columnStat}>
                    <span className={styles.columnName}>{col.name}</span>
                    <span className={styles.columnType}>{col.dtype}</span>
                    <span className={styles.columnMissing}>
                      {analysis.missing_values[col.name] || 0} missing
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(analysis.summary_stats).length > 0 && (
              <div className={styles.section}>
                <h3>Numeric Column Statistics</h3>
                <div className={styles.statsTable}>
                  {Object.entries(analysis.summary_stats).map(([col, stats]) => (
                    <div key={col} className={styles.statsRow}>
                      <span className={styles.statsColName}>{col}</span>
                      <span>mean: {stats.mean?.toFixed(2) || '-'}</span>
                      <span>std: {stats.std?.toFixed(2) || '-'}</span>
                      <span>min: {stats.min?.toFixed(2) || '-'}</span>
                      <span>max: {stats.max?.toFixed(2) || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clean' && (
          <div className={styles.cleanTab}>
            <div className={styles.suggestionsHeader}>
              <h3>Cleaning Suggestions</h3>
              <p>
                {suggestions.filter(s => s.enabled).length} of {suggestions.length} suggestions enabled
              </p>
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
                    className={`${styles.suggestionCard} ${suggestion.enabled ? styles.enabled : ''}`}
                    onClick={() => toggleSuggestion(suggestion.id)}
                  >
                    <div className={styles.suggestionCheckbox}>
                      {suggestion.enabled ? <Check size={16} /> : <div />}
                    </div>
                    <div className={styles.suggestionInfo}>
                      <span className={styles.suggestionType}>
                        {suggestion.operation_type.replace(/_/g, ' ')}
                      </span>
                      <span className={styles.suggestionDesc}>{suggestion.description}</span>
                      {suggestion.affected_rows && (
                        <span className={styles.affectedRows}>
                          Affects {suggestion.affected_rows.toLocaleString()} rows
                        </span>
                      )}
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
