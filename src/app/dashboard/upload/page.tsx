'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset } from '@/lib/api';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Table,
  Clock,
  ArrowRight,
  Sparkles,
  Link2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import styles from './upload.module.css';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const acceptedTypes = [
  { ext: '.csv', label: 'CSV', icon: Table },
  { ext: '.xlsx', label: 'Excel', icon: FileText },
  { ext: '.json', label: 'JSON', icon: FileText },
];

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [newDataset, setNewDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'kaggle'>('upload');
  const [kaggleUrl, setKaggleUrl] = useState('');
  const [kaggleStatus, setKaggleStatus] = useState<'idle' | 'validating' | 'importing' | 'success' | 'error'>('idle');
  const [kaggleError, setKaggleError] = useState<string>('');
  const [kaggleDatasetInfo, setKaggleDatasetInfo] = useState<{owner: string; dataset_name: string; display_name: string} | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const allowedExtensions = ['.csv', '.xlsx', '.json'];
    const maxSize = user?.subscription_tier === 'pro' ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
    
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setUploadedFile({
        file,
        status: 'error',
        progress: 0,
        error: 'Invalid file type. Please upload CSV, Excel, or JSON files.',
      });
      return;
    }
    
    if (file.size > maxSize) {
      setUploadedFile({
        file,
        status: 'error',
        progress: 0,
        error: `File too large. Maximum size is ${user?.subscription_tier === 'pro' ? '100MB' : '5MB'}.`,
      });
      return;
    }

    setUploadedFile({
      file,
      status: 'uploading',
      progress: 0,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 90) clearInterval(progressInterval);
        setUploadedFile(prev => prev ? { ...prev, progress: Math.min(progress, 90) } : null);
      }, 200);

      const response = await api.post<Dataset>('/api/datasets/upload', formData);
      
      clearInterval(progressInterval);
      setUploadedFile(prev => prev ? { ...prev, progress: 100, status: 'success' } : null);
      setNewDataset(response);
      setUploadComplete(true);
    } catch (error: any) {
      setUploadedFile(prev => prev ? { 
        ...prev, 
        status: 'error', 
        error: error.message || 'Upload failed. Please try again.' 
      } : null);
    }
  }, [user]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploadComplete(false);
    setNewDataset(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return Table;
    return FileText;
  };

  const validateKaggleUrl = async (url: string) => {
    if (!url.trim()) {
      setKaggleDatasetInfo(null);
      setKaggleStatus('idle');
      return;
    }

    setKaggleStatus('validating');
    try {
      const response = await fetch(`/api/datasets/import/kaggle/validate?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (data.valid) {
        setKaggleDatasetInfo({
          owner: data.owner,
          dataset_name: data.dataset_name,
          display_name: data.display_name,
        });
        setKaggleStatus('idle');
        setKaggleError('');
      } else {
        setKaggleDatasetInfo(null);
        setKaggleStatus('error');
        setKaggleError(data.error || 'Invalid Kaggle URL');
      }
    } catch (error) {
      setKaggleDatasetInfo(null);
      setKaggleStatus('error');
      setKaggleError('Failed to validate URL');
    }
  };

  const handleKaggleImport = async () => {
    if (!kaggleDatasetInfo) return;
    
    setKaggleStatus('importing');
    try {
      const response = await api.post<Dataset>('/api/datasets/import/kaggle', {
        url: kaggleUrl,
      });
      setKaggleStatus('success');
      setNewDataset(response);
      setUploadComplete(true);
    } catch (error: any) {
      setKaggleStatus('error');
      setKaggleError(error.message || 'Failed to import from Kaggle');
    }
  };

  const resetAll = () => {
    resetUpload();
    setKaggleUrl('');
    setKaggleStatus('idle');
    setKaggleError('');
    setKaggleDatasetInfo(null);
  };

  if (uploadComplete && newDataset) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <CheckCircle2 size={48} />
          </div>
          <h2>Upload Successful!</h2>
          <p>Your dataset has been uploaded and is ready for cleaning.</p>
          
          <div className={styles.datasetPreview}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: 'rgba(0, 212, 170, 0.1)', color: 'var(--accent-primary)', borderRadius: 10 }}>
              {(() => {
                const Icon = getFileIcon(newDataset.name);
                return <Icon size={24} />;
              })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{newDataset.name}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {newDataset.row_count.toLocaleString()} rows • {newDataset.column_count} columns • {formatFileSize(newDataset.file_size)}
              </span>
            </div>
          </div>

          <div className={styles.successActions}>
            <button className="btn btn-primary" onClick={() => router.push(`/datasets/${newDataset.id}`)}>
              Clean Dataset <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary" onClick={resetAll}>
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Upload Dataset</h2>
        <p>Import your data from a file or directly from Kaggle</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: activeTab === 'upload' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: activeTab === 'upload' ? '#000' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Upload size={18} />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('kaggle')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: activeTab === 'kaggle' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: activeTab === 'kaggle' ? '#000' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Link2 size={18} />
          Import from Kaggle
        </button>
      </div>

      <div className={styles.uploadArea}>
        {activeTab === 'kaggle' ? (
          <div className={styles.kaggleSection}>
            <div className={styles.kaggleHeader}>
              <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>Import from Kaggle</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Download datasets directly from Kaggle</span>
            </div>
            
            <div className={styles.kaggleForm}>
              <input
                type="url"
                placeholder="Paste Kaggle dataset URL (e.g., https://www.kaggle.com/datasets/username/dataset-name)"
                value={kaggleUrl}
                onChange={(e) => {
                  setKaggleUrl(e.target.value);
                  validateKaggleUrl(e.target.value);
                }}
                disabled={kaggleStatus === 'importing'}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                }}
              />
              
              {kaggleStatus === 'validating' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <Loader2 size={16} className={styles.spinIcon} />
                  Validating URL...
                </div>
              )}
              
              {kaggleDatasetInfo && kaggleStatus !== 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: 'rgba(0, 212, 170, 0.1)', color: 'var(--accent-primary)', borderRadius: 10 }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{kaggleDatasetInfo.display_name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>by {kaggleDatasetInfo.owner}</div>
                  </div>
                </div>
              )}
              
              {kaggleStatus === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-error)', fontSize: '0.875rem' }}>
                  <AlertCircle size={16} />
                  {kaggleError}
                </div>
              )}
              
              {kaggleStatus === 'importing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <Loader2 size={16} className={styles.spinIcon} />
                  Importing dataset from Kaggle...
                </div>
              )}
              
              <button
                onClick={handleKaggleImport}
                disabled={!kaggleDatasetInfo || kaggleStatus === 'importing'}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: 'var(--accent-primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: (!kaggleDatasetInfo || kaggleStatus === 'importing') ? 'not-allowed' : 'pointer',
                  opacity: (!kaggleDatasetInfo || kaggleStatus === 'importing') ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {kaggleStatus === 'importing' ? (
                  <>
                    <Loader2 size={18} className={styles.spinIcon} />
                    Importing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Import Dataset
                  </>
                )}
              </button>
              
              <a 
                href="https://www.kaggle.com/datasets" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: 'var(--accent-primary)',
                  fontSize: '0.9375rem',
                  textDecoration: 'none',
                }}
              >
                Browse Kaggle Datasets
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.json"
              onChange={handleFileSelect}
              className={styles.fileInput}
            />
            
            {uploadedFile ? (
              <div className={styles.uploadProgress}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileIcon}>
                    {(() => {
                      const Icon = getFileIcon(uploadedFile.file.name);
                      return <Icon size={24} />;
                    })()}
                  </div>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{uploadedFile.file.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(uploadedFile.file.size)}</span>
                  </div>
                  <button 
                    className={styles.removeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUpload();
                    }}
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <div className={styles.progressBar}>
                  <div 
                    className={`${styles.progressFill} ${uploadedFile.status === 'success' ? styles.progressSuccess : ''} ${uploadedFile.status === 'error' ? styles.progressError : ''}`}
                    style={{ width: `${uploadedFile.progress}%` }}
                  />
                </div>

                <div className={styles.uploadStatus}>
                  {uploadedFile.status === 'uploading' && (
                    <>
                      <Clock size={16} className={styles.spinIcon} />
                      <span>Uploading... {Math.round(uploadedFile.progress)}%</span>
                    </>
                  )}
                  {uploadedFile.status === 'success' && (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Upload complete!</span>
                    </>
                  )}
                  {uploadedFile.status === 'error' && (
                    <>
                      <XCircle size={16} />
                      <span>{uploadedFile.error}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className={styles.dropIcon}>
                  <Upload size={40} />
                </div>
                <h3>Drop your file here</h3>
                <p>or click to browse</p>
                <div className={styles.allowedTypes}>
                  {acceptedTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <span key={type.ext} className={styles.typeBadge}>
                        <Icon size={14} />
                        {type.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.uploadInfo}>
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <Sparkles size={20} />
          </div>
          <div className={styles.infoContent}>
            <h4>AI-Powered Cleaning</h4>
            <p>Our AI automatically detects and fixes data quality issues like missing values, duplicates, and inconsistencies.</p>
          </div>
        </div>
        
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <FileSpreadsheet size={20} />
          </div>
          <div className={styles.infoContent}>
            <h4>Data Privacy</h4>
            <p>Your data is processed securely and never shared. All files are encrypted in transit and at rest.</p>
          </div>
        </div>
      </div>

      <div className={styles.limitations}>
        <h4>File Limits</h4>
        <ul>
          <li>Maximum file size: {user?.subscription_tier === 'pro' ? '100MB' : '5MB'}</li>
          <li>Supported formats: CSV, Excel (.xlsx), JSON</li>
          <li>Maximum rows: {user?.subscription_tier === 'pro' ? '10 million' : '100,000'}</li>
        </ul>
      </div>
    </div>
  );
}
