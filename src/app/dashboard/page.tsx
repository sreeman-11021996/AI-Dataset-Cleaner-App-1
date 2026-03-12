'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset } from '@/lib/api';
import { 
  Database, Upload, FolderOpen, Trash2, 
  BarChart3, Wand2, Download, Settings, LogOut,
  FileSpreadsheet, ChevronRight, Sparkles,
  HardDrive, Zap
} from 'lucide-react';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadDatasets();
    }
  }, [user]);

  const loadDatasets = async () => {
    try {
      const data = await api.get<Dataset[]>('/api/datasets');
      setDatasets(data);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Only CSV files are allowed');
      return;
    }

    if (user?.subscription_tier === 'free' && file.size > 5 * 1024 * 1024) {
      alert('Free plan allows only up to 5MB files');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/datasets/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const newDataset = await response.json();
      setDatasets(prev => [newDataset, ...prev]);
      router.push(`/datasets/${newDataset.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, datasetId: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this dataset?')) return;

    try {
      await api.delete(`/api/datasets/${datasetId}`);
      setDatasets(prev => prev.filter(d => d.id !== datasetId));
    } catch (err) {
      alert('Failed to delete dataset');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (authLoading || !user) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <Database size={24} />
            <span>DatasetCleaner</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <a href="/dashboard" className={`${styles.navItem} ${styles.navItemActive}`}>
            <FolderOpen size={18} />
            My Datasets
          </a>
          <a href="/pricing" className={styles.navItem}>
            <Sparkles size={18} />
            Upgrade Plan
          </a>
          <a href="/settings" className={styles.navItem}>
            <Settings size={18} />
            Settings
          </a>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user.email[0].toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userEmail}>{user.email}</span>
              <span className={styles.userPlan}>
                {user.subscription_tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
              </span>
            </div>
          </div>
          <button onClick={logout} className={styles.logoutButton}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>My Datasets</h1>
            <p>Upload and manage your datasets</p>
          </div>
          <div className={styles.storageInfo}>
            <HardDrive size={18} />
            <span>{formatFileSize(user.storage_used)} / {user.subscription_tier === 'pro' ? '5GB' : '100MB'}</span>
          </div>
        </header>

        <div className={styles.uploadSection}>
          <div 
            className={styles.uploadZone}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <div className={styles.uploading}>
                <div className={styles.spinner} />
                <span>Uploading...</span>
              </div>
            ) : (
              <>
                <Upload size={32} />
                <h3>Upload Dataset</h3>
                <p>Drag & drop CSV file or click to browse</p>
                <span className={styles.uploadLimit}>
                  {user.subscription_tier === 'free' ? 'Max 5MB (Free)' : 'Max 100MB (Pro)'}
                </span>
              </>
            )}
          </div>
        </div>

        <section className={styles.datasetsSection}>
          <h2>Recent Datasets</h2>
          
          {loading ? (
            <div className={styles.datasetGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.datasetCardSkeleton}>
                  <div className="skeleton" style={{ height: 24, width: '60%' }} />
                  <div className="skeleton" style={{ height: 16, width: '40%', marginTop: 12 }} />
                  <div className="skeleton" style={{ height: 16, width: '30%', marginTop: 8 }} />
                </div>
              ))}
            </div>
          ) : datasets.length === 0 ? (
            <div className={styles.emptyState}>
              <FileSpreadsheet size={48} />
              <h3>No datasets yet</h3>
              <p>Upload your first CSV file to get started</p>
            </div>
          ) : (
            <div className={styles.datasetGrid}>
              {datasets.map(dataset => (
                <div 
                  key={dataset.id}
                  className={styles.datasetCard}
                  onClick={() => router.push(`/datasets/${dataset.id}`)}
                >
                  <div className={styles.datasetIcon}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className={styles.datasetInfo}>
                    <h3>{dataset.name}</h3>
                    <div className={styles.datasetMeta}>
                      <span>{dataset.row_count.toLocaleString()} rows</span>
                      <span>•</span>
                      <span>{dataset.column_count} columns</span>
                    </div>
                    <div className={styles.datasetMeta}>
                      <span>{formatFileSize(dataset.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(dataset.created_at)}</span>
                    </div>
                  </div>
                  <button 
                    className={styles.deleteButton}
                    onClick={(e) => handleDelete(e, dataset.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                  <ChevronRight size={20} className={styles.arrowIcon} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.quickStats}>
          <div className={styles.statCard}>
            <BarChart3 size={24} />
            <div>
              <span className={styles.statValue}>{datasets.length}</span>
              <span className={styles.statLabel}>Total Datasets</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <Zap size={24} />
            <div>
              <span className={styles.statValue}>{user.operations_used}</span>
              <span className={styles.statLabel}>Operations Used</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
