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
        if (progress > 90) {
          progress = 90;
          clearInterval(progressInterval);
        }
        setUploadedFile(prev => prev ? { ...prev, progress } : null);
      }, 200);

      const response = await fetch('http://localhost:8000/api/datasets/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const dataset = await response.json();
      
      setUploadedFile({
        file,
        status: 'success',
        progress: 100,
      });
      setNewDataset(dataset);
      setUploadComplete(true);
    } catch (err: any) {
      setUploadedFile({
        file,
        status: 'error',
        progress: 0,
        error: err.message || 'Failed to upload file',
      });
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
            <div className={previewStyles.fileIcon}>
              {(() => {
                const Icon = getFileIcon(newDataset.name);
                return <Icon size={24} />;
              })()}
            </div>
            <div className={previewStyles.fileInfo}>
              <span className={previewStyles.fileName}>{newDataset.name}</span>
              <span className={previewStyles.fileMeta}>
                {newDataset.row_count.toLocaleString()} rows • {newDataset.column_count} columns • {formatFileSize(newDataset.file_size)}
              </span>
            </div>
          </div>

          <div className={styles.successActions}>
            <button className="btn btn-primary" onClick={() => router.push(`/datasets/${newDataset.id}`)}>
              Clean Dataset <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary" onClick={resetUpload}>
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
        <p>Drag and drop your file or click to browse. We support CSV, Excel, and JSON formats.</p>
      </div>

      <div className={styles.uploadArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={handleFileSelect}
          className={styles.fileInput}
        />
        
        {!uploadedFile ? (
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
        ) : (
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
                  <AlertCircle size={16} />
                  <span>{uploadedFile.error}</span>
                </>
              )}
            </div>
          </div>
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

const previewStyles = {
  fileIcon: "display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: rgba(0, 212, 170, 0.1); color: var(--accent-primary); border-radius: 10px;",
  fileInfo: "display: flex; flex-direction: column; gap: 0.25rem;",
  fileName: "font-weight: 500; font-size: 0.9375rem;",
  fileMeta: "font-size: 0.8125rem; color: var(--text-muted);",
};
