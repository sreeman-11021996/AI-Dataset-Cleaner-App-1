'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';
import { 
  Database, Key, Copy, Check, X, 
  Loader2, ExternalLink, Shield, Zap,
  Code, BookOpen
} from 'lucide-react';
import styles from './api-docs.module.css';

const endpoints: {
  category: string;
  items: {
    method: string;
    path: string;
    description: string;
    parameters: { name: string; type: string; required: boolean; description: string }[];
    bodyExample?: any[];
    response: any;
  }[];
}[] = [
  {
    category: 'Upload',
    items: [
      {
        method: 'POST',
        path: '/api/upload_dataset',
        description: 'Upload a CSV dataset',
        parameters: [
          { name: 'file', type: 'binary', required: true, description: 'CSV file' },
          { name: 'filename', type: 'string', required: true, description: 'File name' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        response: {
          dataset_id: 'uuid',
          name: 'string',
          file_size: 'number',
          row_count: 'number',
          column_count: 'number',
          columns: 'array',
        } as Record<string, string>,
      },
    ],
  },
  {
    category: 'Clean',
    items: [
      {
        method: 'POST',
        path: '/api/clean_dataset',
        description: 'Clean a dataset with specified operations',
        parameters: [
          { name: 'dataset_id', type: 'query', required: true, description: 'Dataset UUID' },
          { name: 'operations', type: 'body', required: true, description: 'Array of operations' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        bodyExample: [
          { type: 'remove_duplicates' },
          { type: 'fill_missing', column: 'age', method: 'mean' },
          { type: 'remove_outliers', column: 'salary', method: 'iqr' },
        ],
        response: {
          dataset_id: 'uuid',
          status: 'string',
          operations_applied: 'number',
          rows_affected: 'number',
          cleaned_file_path: 'string',
        },
      },
    ],
  },
  {
    category: 'Download',
    items: [
      {
        method: 'GET',
        path: '/api/download_dataset',
        description: 'Download a cleaned dataset',
        parameters: [
          { name: 'dataset_id', type: 'query', required: true, description: 'Dataset UUID' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        response: 'CSV file download',
      },
    ],
  },
  {
    category: 'Datasets',
    items: [
      {
        method: 'GET',
        path: '/api/datasets',
        description: 'List all datasets',
        parameters: [
          { name: 'limit', type: 'query', required: false, description: 'Pagination limit (default 10)' },
          { name: 'offset', type: 'query', required: false, description: 'Pagination offset' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        response: {
          datasets: 'array',
          total: 'number',
        },
      },
      {
        method: 'GET',
        path: '/api/datasets/:id',
        description: 'Get dataset details',
        parameters: [
          { name: 'dataset_id', type: 'path', required: true, description: 'Dataset UUID' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        response: {
          id: 'uuid',
          name: 'string',
          file_size: 'number',
          row_count: 'number',
          column_count: 'number',
          columns: 'array',
          created_at: 'datetime',
        },
      },
      {
        method: 'DELETE',
        path: '/api/datasets/:id',
        description: 'Delete a dataset',
        parameters: [
          { name: 'dataset_id', type: 'path', required: true, description: 'Dataset UUID' },
          { name: 'X-API-Key', type: 'header', required: true, description: 'Your API key' },
        ],
        response: {
          status: 'deleted',
          dataset_id: 'uuid',
        },
      },
    ],
  },
];

const cleaningOperations = [
  { type: 'remove_duplicates', description: 'Remove duplicate rows' },
  { type: 'fill_missing', description: 'Fill missing values', params: 'column, method (mean/median/mode/forward/backward)' },
  { type: 'remove_outliers', description: 'Remove outliers', params: 'column, method (iqr/zscore)' },
  { type: 'normalize', description: 'Normalize values', params: 'column, method (minmax/zscore)' },
  { type: 'encode_categorical', description: 'Encode categorical column', params: 'column' },
  { type: 'drop_column', description: 'Drop a column', params: 'column' },
  { type: 'rename_column', description: 'Rename a column', params: 'old_name, new_name' },
];

export default function APIDocsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{has_api_key: boolean; created_at?: string} | null>(null);

  const isTeam = user?.subscription_tier === 'team';

  const handleGenerateKey = async () => {
    if (!isTeam) return;
    setLoading(true);
    try {
      const response = await api.post<{api_key: string}>('/api/subscription/api-key/generate');
      setApiKey(response.api_key);
    } catch (error: any) {
      alert(error.message || 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!isTeam || !confirm('Are you sure you want to revoke your API key?')) return;
    setLoading(true);
    try {
      await api.post('/api/subscription/api-key/revoke');
      setApiKey(null);
      alert('API key revoked');
    } catch (error: any) {
      alert(error.message || 'Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/dashboard" className={styles.backLink}>
            <Database size={20} />
            Back to Dashboard
          </Link>
          <div className={styles.titleSection}>
            <BookOpen size={32} className={styles.titleIcon} />
            <div>
              <h1>Developer API</h1>
              <p>Access DatasetCleaner AI programmatically</p>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {!isTeam && (
          <div className={styles.upgradeBanner}>
            <Shield size={24} />
            <div>
              <h3>Team Plan Required</h3>
              <p>API access is only available for Team plan subscribers.</p>
            </div>
            <Link href="/pricing" className={styles.upgradeButton}>
              Upgrade to Team
            </Link>
          </div>
        )}

        {isTeam && (
          <section className={styles.section}>
            <h2><Key size={20} /> API Key Management</h2>
            <p className={styles.sectionDesc}>
              Generate an API key to access the dataset cleaning API programmatically.
            </p>
            
            <div className={styles.keyCard}>
              <div className={styles.keyInfo}>
                <Zap size={20} className={styles.keyIcon} />
                <div>
                  <h3>Your API Key</h3>
                  {apiKey ? (
                    <div className={styles.keyDisplay}>
                      <code>{apiKey}</code>
                      <button onClick={() => copyToClipboard(apiKey)} className={styles.copyButton}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  ) : (
                    <p className={styles.noKey}>No API key generated yet</p>
                  )}
                </div>
              </div>
              <div className={styles.keyActions}>
                <button 
                  onClick={handleGenerateKey} 
                  disabled={loading}
                  className={styles.generateButton}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Generate New Key
                </button>
                {apiKey && (
                  <button 
                    onClick={handleRevokeKey} 
                    disabled={loading}
                    className={styles.revokeButton}
                  >
                    <X size={16} /> Revoke
                  </button>
                )}
              </div>
            </div>

            <div className={styles.warning}>
              <strong>Important:</strong> Save your API key securely. It will not be shown again after generation.
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h2><Code size={20} /> Authentication</h2>
          <p className={styles.sectionDesc}>
            Include your API key in the request header for all API calls.
          </p>
          <pre className={styles.codeBlock}>
{`curl -X POST "https://api.datasetcleaner.ai/upload_dataset" \\
  -H "X-API-Key: your-api-key-here" \\
  -F "file=@data.csv" \\
  -F "filename=data.csv"`}
          </pre>
        </section>

        <section className={styles.section}>
          <h2><BookOpen size={20} /> API Endpoints</h2>
          
          {endpoints.map((category) => (
            <div key={category.category} className={styles.endpointCategory}>
              <h3>{category.category}</h3>
              {category.items.map((endpoint) => (
                <div key={endpoint.path} className={styles.endpoint}>
                  <div className={styles.endpointHeader}>
                    <span className={`${styles.method} ${styles[endpoint.method.toLowerCase()]}`}>
                      {endpoint.method}
                    </span>
                    <code className={styles.path}>{endpoint.path}</code>
                    <span className={styles.description}>{endpoint.description}</span>
                  </div>
                  
                  <div className={styles.endpointDetails}>
                    <h4>Parameters</h4>
                    <table className={styles.paramTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.parameters.map((param) => (
                          <tr key={param.name}>
                            <td><code>{param.name}</code></td>
                            <td><span className={styles.typeBadge}>{param.type}</span></td>
                            <td>{param.required ? 'Yes' : 'No'}</td>
                            <td>{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {endpoint.bodyExample && (
                      <>
                        <h4>Request Body Example</h4>
                        <pre className={styles.codeBlock}>
{JSON.stringify(endpoint.bodyExample, null, 2)}
                        </pre>
                      </>
                    )}

                    <h4>Response</h4>
                    <pre className={styles.codeBlock}>
{JSON.stringify(endpoint.response, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <h2>Cleaning Operations</h2>
          <p className={styles.sectionDesc}>
            Available operations for the clean_dataset endpoint.
          </p>
          
          <table className={styles.operationsTable}>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Description</th>
                <th>Parameters</th>
              </tr>
            </thead>
            <tbody>
              {cleaningOperations.map((op) => (
                <tr key={op.type}>
                  <td><code>{op.type}</code></td>
                  <td>{op.description}</td>
                  <td><code>{op.params || '-'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
