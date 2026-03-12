'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, Dataset } from '@/lib/api';
import {
  Search,
  Filter,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  MoreVertical,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import styles from './history.module.css';

type SortField = 'name' | 'created_at' | 'row_count' | 'file_size';
type SortOrder = 'asc' | 'desc';

const mockHistoryData: (Dataset & { status: 'completed' | 'processing'; qualityScore?: number; operations?: number })[] = [
  { id: '1', user_id: '1', name: 'customer_data_2024.csv', original_filename: 'customer_data_2024.csv', file_size: 2500000, row_count: 45000, column_count: 15, columns: [], created_at: '2024-01-15T10:30:00Z', status: 'completed', qualityScore: 92, operations: 5 },
  { id: '2', user_id: '1', name: 'sales_report.csv', original_filename: 'sales_report.csv', file_size: 1800000, row_count: 32000, column_count: 12, columns: [], created_at: '2024-01-14T15:45:00Z', status: 'completed', qualityScore: 87, operations: 3 },
  { id: '3', user_id: '1', name: 'inventory_master.csv', original_filename: 'inventory_master.csv', file_size: 3200000, row_count: 58000, column_count: 20, columns: [], created_at: '2024-01-15T11:00:00Z', status: 'processing' },
  { id: '4', user_id: '1', name: 'user_logs.json', original_filename: 'user_logs.json', file_size: 4500000, row_count: 125000, column_count: 8, columns: [], created_at: '2024-01-13T09:15:00Z', status: 'completed', qualityScore: 78, operations: 4 },
  { id: '5', user_id: '1', name: 'transactions.csv', original_filename: 'transactions.csv', file_size: 950000, row_count: 15000, column_count: 10, columns: [], created_at: '2024-01-12T14:20:00Z', status: 'completed', qualityScore: 95, operations: 6 },
  { id: '6', user_id: '1', name: 'product_catalog.xlsx', original_filename: 'product_catalog.xlsx', file_size: 1200000, row_count: 8500, column_count: 25, columns: [], created_at: '2024-01-11T16:30:00Z', status: 'completed', qualityScore: 88, operations: 2 },
  { id: '7', user_id: '1', name: 'marketing_campaigns.csv', original_filename: 'marketing_campaigns.csv', file_size: 2800000, row_count: 52000, column_count: 18, columns: [], created_at: '2024-01-10T11:45:00Z', status: 'completed', qualityScore: 82, operations: 4 },
  { id: '8', user_id: '1', name: 'employee_records.csv', original_filename: 'employee_records.csv', file_size: 650000, row_count: 2500, column_count: 30, columns: [], created_at: '2024-01-09T13:00:00Z', status: 'completed', qualityScore: 91, operations: 3 },
];

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [datasets, setDatasets] = useState(mockHistoryData);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing'>('all');
  const itemsPerPage = 10;

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const data = await api.get<Dataset[]>('/api/datasets');
      setDatasets(data.map(d => ({ ...d, status: 'completed' as const, qualityScore: Math.floor(Math.random() * 30) + 70, operations: Math.floor(Math.random() * 5) + 1 })));
    } catch (err) {
      console.error('Failed to load datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    
    try {
      await api.delete(`/api/datasets/${id}`);
      setDatasets(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('Failed to delete dataset');
    }
  };

  const filteredDatasets = datasets
    .filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'row_count':
          comparison = a.row_count - b.row_count;
          break;
        case 'file_size':
          comparison = a.file_size - b.file_size;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const totalPages = Math.ceil(filteredDatasets.length / itemsPerPage);
  const paginatedDatasets = filteredDatasets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className={styles.statusCompleted} />;
      case 'processing':
        return <Clock size={16} className={styles.statusProcessing} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Dataset History</h2>
          <span className={styles.count}>{filteredDatasets.length} datasets</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={styles.sortable}>
                Dataset <ArrowUpDown size={14} />
              </th>
              <th onClick={() => handleSort('row_count')} className={styles.sortable}>
                Rows <ArrowUpDown size={14} />
              </th>
              <th>Columns</th>
              <th onClick={() => handleSort('file_size')} className={styles.sortable}>
                Size <ArrowUpDown size={14} />
              </th>
              <th>Status</th>
              <th onClick={() => handleSort('created_at')} className={styles.sortable}>
                Date <ArrowUpDown size={14} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDatasets.map((dataset) => (
              <tr key={dataset.id} onClick={() => router.push(`/datasets/${dataset.id}`)}>
                <td>
                  <div className={styles.datasetCell}>
                    <div className={styles.fileIcon}>
                      <FileSpreadsheet size={18} />
                    </div>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{dataset.name}</span>
                      {dataset.qualityScore && (
                        <span className={styles.qualityBadge}>
                          Quality: {dataset.qualityScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td>{dataset.row_count.toLocaleString()}</td>
                <td>{dataset.column_count}</td>
                <td>{formatFileSize(dataset.file_size)}</td>
                <td>
                  <div className={styles.statusCell}>
                    {getStatusIcon(dataset.status)}
                    <span className={`${styles.statusBadge} ${styles[dataset.status]}`}>
                      {dataset.status}
                    </span>
                  </div>
                </td>
                <td>
                  <div className={styles.dateCell}>
                    <Calendar size={14} />
                    {formatDate(dataset.created_at)}
                  </div>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      title="Download"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className={styles.actionButton}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(dataset.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDatasets.length)} of {filteredDatasets.length}
          </span>
          <div className={styles.pageButtons}>
            <button
              className={styles.pageButton}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`${styles.pageButton} ${currentPage === page ? styles.pageButtonActive : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              className={styles.pageButton}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
