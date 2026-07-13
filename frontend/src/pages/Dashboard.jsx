import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext, api } from '../context/AuthContext';
import UploadModal from '../components/UploadModal';
import PreviewModal from '../components/PreviewModal';
import FolderPanel from '../components/FolderPanel';
import MoveFolderModal from '../components/MoveFolderModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import ShareModal from '../components/ShareModal';
import CompareMetadataModal from '../components/CompareMetadataModal';
import {
  Download, FileText, Search, Trash2, Upload, AlertCircle, X,
  HardDrive, BarChart2, Clock, TrendingUp, FolderOpen, CheckCircle2, Activity, Share2, FolderInput, History, GitBranch, Star
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

// ─── Mini Bar Chart (pure CSS/SVG, no library needed) ───────────────────────
const ActivityChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.uploads), 1);
  const CHART_HEIGHT = 80; // matches h-20

  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {data.map((d, i) => {
        const ratio = max > 0 ? d.uploads / max : 0;
        const heightPx = d.uploads > 0 ? Math.max(ratio * CHART_HEIGHT, 8) : 2;
        return (
          <div key={i} className="flex flex-col items-center justify-end flex-1 h-full group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              {d.date}<br />
              <span className="text-sky-400 font-bold">{d.uploads} uploads</span>
            </div>
            {/* Bar */}
            <div
              className="w-full rounded-t-sm transition-all duration-500"
              style={{ height: `${heightPx}px` }}
            >
              <div className={`h-full w-full rounded-t-sm ${d.uploads > 0 ? 'bg-gradient-to-t from-sky-600 to-sky-400' : 'bg-white/[0.07]'}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Category Donut Chart (SVG) ──────────────────────────────────────────────
const DonutChart = ({ breakdown, total }) => {
  const colors = {
    Invoice: '#10b981',
    Contract: '#8b5cf6',
    Resume: '#f43f5e',
    Report: '#f59e0b',
    Other: '#0ea5e9',
  };

  const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
  let cumulativeAngle = -90;
  const radius = 40;
  const cx = 60, cy = 60;
  const circumference = 2 * Math.PI * radius;

  const arcs = entries.map(([cat, count]) => {
    const pct = total > 0 ? count / total : 0;
    const startAngle = cumulativeAngle;
    cumulativeAngle += pct * 360;
    return { cat, count, pct, startAngle, endAngle: cumulativeAngle, color: colors[cat] || '#0ea5e9' };
  });

  const describeArc = (start, end) => {
    const toRad = deg => (deg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(toRad(start));
    const y1 = cy + radius * Math.sin(toRad(start));
    const x2 = cx + radius * Math.cos(toRad(end));
    const y2 = cy + radius * Math.sin(toRad(end));
    const large = end - start > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-500">
        <FolderOpen className="h-8 w-8 mb-2" />
        <p className="text-xs">No documents yet</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {arcs.map((arc, i) => (
          <path key={i} d={describeArc(arc.startAngle, arc.endAngle - 0.5)} fill={arc.color} opacity={0.9} />
        ))}
        <circle cx={cx} cy={cy} r={24} fill="rgba(15,23,42,0.9)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="7">DOCS</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {arcs.map(arc => (
          <div key={arc.cat} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: arc.color }} />
              <span className="text-slate-300">{arc.cat}</span>
            </div>
            <span className="text-slate-400 font-medium">{arc.count} ({(arc.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, gradient, sub }) => (
  <div className={`glass-panel rounded-2xl p-5 border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all duration-300`}>
    <div className={`absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10 ${gradient}`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-extrabold text-white tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { userId } = useParams();
  const navigate = useNavigate();
  const isReadOnly = !!userId;
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  // ── Folder state ──────────────────────────────────────────────────────────
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('all'); // 'all' | 'none' | folderId
  const [moveDoc, setMoveDoc] = useState(null); // document to move
  const [isMoveOpen, setIsMoveOpen] = useState(false);

  // ── Share state ───────────────────────────────────────────────────────────
  const [shareDoc, setShareDoc] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // ── Version History state ─────────────────────────────────────────────────
  const [versionDoc, setVersionDoc] = useState(null);
  const [isVersionOpen, setIsVersionOpen] = useState(false);

  const [categories, setCategories] = useState(['All', 'Invoice', 'Contract', 'Resume', 'Report']);

  const fetchCategories = useCallback(async () => {
    try {
      const params = userId ? { targetUserId: userId } : {};
      const res = await api.get('/api/documents/categories', { params });
      if (res.data && res.data.length > 0) {
        setCategories(['All', ...res.data]);
      }
    } catch (err) {
      console.error('Categories fetch error:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = userId ? { targetUserId: userId } : {};
      const res = await api.get('/api/documents/stats', { params });
      setStats(res.data);
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const params = userId ? { targetUserId: userId } : {};
      const res = await api.get('/api/folders', { params });
      setFolders(res.data);
    } catch (err) {
      console.error('Folders fetch error:', err);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { search, category: selectedCategory };
      if (userId) params.targetUserId = userId;
      if (selectedFormat) params.format = selectedFormat;
      if (selectedFolder === 'none') params.folder = 'none';
      else if (selectedFolder !== 'all') params.folder = selectedFolder;
      const res = await api.get('/api/documents', { params });
      setDocuments(res.data);
      setSelectedDocs(new Set());
    } catch (err) {
      console.error(err);
      setError('Failed to fetch documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedFolder, selectedFormat]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const t = setTimeout(fetchDocuments, 300);
    return () => clearTimeout(t);
  }, [fetchDocuments]);

  const handleDelete = async (id) => {
    setConfirmConfig({
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document?',
      confirmText: 'Delete',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${id}`);
          fetchDocuments();
          fetchStats();
        } catch (err) {
          alert(err.response?.data?.message || 'Failed to delete document');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const handleSelectDoc = (e, docId) => {
    e.stopPropagation();
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocs.size === documents.length && documents.length > 0) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(d => d._id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocs.size === 0) return;
    setConfirmConfig({
      title: 'Delete Selected Documents',
      message: `Are you sure you want to delete ${selectedDocs.size} selected document(s)?`,
      confirmText: 'Delete All',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        try {
          await Promise.all(Array.from(selectedDocs).map(id => api.delete(`/api/documents/${id}`)));
          showToast(`${selectedDocs.size} document(s) deleted successfully`);
          setSelectedDocs(new Set());
          fetchDocuments();
          fetchStats();
        } catch (err) {
          alert('Failed to delete some documents');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleCompareMetadata = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (selectedDocs.size !== 2) {
      alert('Please select exactly two documents to compare.');
      return;
    }
    
    const [doc1Id, doc2Id] = Array.from(selectedDocs);
    const doc1 = documents.find(d => d._id === doc1Id);
    const doc2 = documents.find(d => d._id === doc2Id);
    
    if (!doc1 || !doc2) {
      alert('Could not find selected documents in the current list.');
      return;
    }

    const formatSize = (bytes) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString() : 'N/A';

    const comparisonFields = [
      { field: 'Title', val1: doc1.title, val2: doc2.title },
      { field: 'Original File Name', val1: doc1.originalName, val2: doc2.originalName },
      { field: 'File Type (MIME Type)', val1: doc1.mimeType, val2: doc2.mimeType },
      { field: 'File Size', val1: formatSize(doc1.size), val2: formatSize(doc2.size) },
      { field: 'Category', val1: doc1.category, val2: doc2.category },
      { field: 'Uploaded By', val1: doc1.uploadedBy?.name || 'Unknown', val2: doc2.uploadedBy?.name || 'Unknown' },
      { field: 'Folder', val1: doc1.folder?.name || 'Root', val2: doc2.folder?.name || 'Root' },
      { field: 'Upload Date', val1: formatDate(doc1.createdAt), val2: formatDate(doc2.createdAt) },
      { field: 'Last Modified Date', val1: formatDate(doc1.updatedAt), val2: formatDate(doc2.updatedAt) },
      { field: 'Favorite Status', val1: doc1.favoritedBy?.length > 0 ? 'Yes' : 'No', val2: doc2.favoritedBy?.length > 0 ? 'Yes' : 'No' },
      { field: 'Trash Status', val1: doc1.isDeleted ? 'Yes' : 'No', val2: doc2.isDeleted ? 'Yes' : 'No' }
    ];

    let sameCount = 0;
    let diffCount = 0;

    const comparison = comparisonFields.map(item => {
      const isSame = item.val1 === item.val2;
      if (isSame) sameCount++;
      else diffCount++;

      return {
        field: item.field,
        file1: item.val1,
        file2: item.val2,
        status: isSame ? 'Same' : 'Different'
      };
    });

    const totalCompared = comparisonFields.length;
    const matchPercentage = Math.round((sameCount / totalCompared) * 100);

    setCompareData({
      summary: {
        totalCompared,
        same: sameCount,
        different: diffCount,
        matchPercentage
      },
      comparison
    });
    
    setIsCompareOpen(true);
  };

  const handleToggleFavorite = async (e, doc) => {
    e.stopPropagation();
    try {
      const res = await api.put(`/api/documents/${doc._id}/favorite`);
      const { isFavorite, message } = res.data;
      
      showToast(message);
      
      // Update local state to reflect the change immediately
      setDocuments(prevDocs => prevDocs.map(d => 
        d._id === doc._id 
          ? { ...d, favoritedBy: isFavorite ? [...d.favoritedBy, user._id] : d.favoritedBy.filter(id => id !== user._id) } 
          : d
      ));
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      alert('Failed to update favorite status');
    }
  };

  const handleDownload = async (id, originalName) => {
    try {
      const response = await api({ url: `/api/documents/download/${id}`, method: 'GET', responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Failed to download file');
    }
  };

  const handleOpenMove = (e, doc) => {
    e.stopPropagation();
    setMoveDoc(doc);
    setIsMoveOpen(true);
  };

  const handleShare = (doc) => {
    setShareDoc(doc);
    setIsShareOpen(true);
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Invoice': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'Contract': return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
      case 'Resume': return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
      case 'Report': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      default: return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
    }
  };

  const getCategoryDot = (cat) => {
    switch (cat) {
      case 'Invoice': return 'bg-emerald-400';
      case 'Contract': return 'bg-violet-400';
      case 'Resume': return 'bg-rose-400';
      case 'Report': return 'bg-amber-400';
      default: return 'bg-sky-400';
    }
  };

  const totalUploadsThisWeek = stats?.activity?.reduce((sum, d) => sum + d.uploads, 0) || 0;
  const todayUploads = stats?.activity?.[6]?.uploads || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-300 relative">
      
      {/* Impersonation Banner */}
      {isReadOnly && (
        <div className="mb-6 bg-amber-500/20 border border-amber-500/30 px-6 py-3 rounded-xl flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <Activity className="h-4 w-4" />
            <span>Admin View: You are in READ-ONLY mode viewing another user's dashboard</span>
          </div>
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Exit View
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center space-x-3 animate-in slide-in-from-bottom-5">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {(user?.role === 'admin' || user?.role === 'superadmin') ? 'Admin Workspace' : 'My Workspace'}
          </h1>
          <p className="mt-1.5 text-slate-400 text-sm">
            {(user?.role === 'admin' || user?.role === 'superadmin')
              ? 'System-wide overview across all user accounts.'
              : `Welcome back, ${user?.name?.split(' ')[0] || 'User'}! Here's your document overview.`}
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 active:scale-95 transition-all self-start md:self-auto"
          >
            <Upload className="h-5 w-5" />
            <span>Upload File</span>
          </button>
        )}
      </div>

      {/* ── Tab Nav ── */}
      <div className="flex gap-1 mb-8 bg-white/5 border border-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'documents', label: 'Documents', icon: FileText },
          { id: 'activity', label: 'Activity', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-8">

          {/* Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Total Documents"
              value={statsLoading ? '—' : (stats?.totalDocuments ?? 0)}
              sub={`${todayUploads} uploaded today`}
              color="bg-sky-500/10 text-sky-400"
              gradient="bg-sky-500"
            />
            <StatCard
              icon={HardDrive}
              label="Storage Used"
              value={statsLoading ? '—' : formatBytes(stats?.totalStorage || 0)}
              sub="Across all files"
              color="bg-indigo-500/10 text-indigo-400"
              gradient="bg-indigo-500"
            />
            <StatCard
              icon={TrendingUp}
              label="This Week"
              value={statsLoading ? '—' : totalUploadsThisWeek}
              sub="Uploads in last 7 days"
              color="bg-emerald-500/10 text-emerald-400"
              gradient="bg-emerald-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Categories"
              value={statsLoading ? '—' : Object.values(stats?.categoryBreakdown || {}).filter(v => v > 0).length}
              sub="Active document types"
              color="bg-amber-500/10 text-amber-400"
              gradient="bg-amber-500"
            />
          </div>

          {/* Version Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5 border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
              <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10 bg-violet-500" />
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Versions Stored</p>
                  <p className="text-2xl font-extrabold text-white tracking-tight">
                    {statsLoading ? '—' : (stats?.versionStats?.totalVersions ?? 0)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Across all documents</p>
                  {/* Latest version detail */}
                  {!statsLoading && stats?.versionStats?.latestVersion && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Latest Version</p>
                      <p className="text-xs font-bold text-violet-400 truncate">
                        {stats.versionStats.latestVersion.originalName}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        v{stats.versionStats.latestVersion.versionNumber} · {stats.versionStats.latestVersion.documentTitle}
                      </p>
                    </div>
                  )}
                  {!statsLoading && !stats?.versionStats?.latestVersion && (
                    <p className="text-[11px] text-slate-600 mt-2">No versions uploaded yet</p>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 flex-shrink-0 ml-3">
                  <GitBranch className="h-5 w-5" />
                </div>
              </div>
            </div>
            <StatCard
              icon={History}
              label="Multi-Version Docs"
              value={statsLoading ? '—' : (stats?.versionStats?.docsWithMultipleVersions ?? 0)}
              sub="Documents with 2+ versions"
              color="bg-rose-500/10 text-rose-400"
              gradient="bg-rose-500"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Upload Activity Chart */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Upload Activity</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Last 7 days</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <BarChart2 className="h-4 w-4" />
                </div>
              </div>
              {statsLoading ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-500" />
                </div>
              ) : (
                <>
                  <ActivityChart data={stats?.activity || []} />
                  <div className="flex justify-between mt-2">
                    {(stats?.activity || []).map((d, i) => (
                      <span key={i} className="text-[9px] text-slate-500 flex-1 text-center">
                        {d.date.split(',')[0]}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Category Breakdown */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">By Category</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Distribution breakdown</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <FolderOpen className="h-4 w-4" />
                </div>
              </div>
              {statsLoading ? (
                <div className="h-24 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-violet-500" />
                </div>
              ) : (
                <DonutChart breakdown={stats?.categoryBreakdown || {}} total={stats?.totalDocuments || 0} />
              )}
            </div>
          </div>

          {/* Recent Uploads + Pending Approvals */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Recent Uploads */}
            <div className="glass-panel rounded-2xl border border-white/5 shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">Recent Uploads</h3>
                </div>
                <button onClick={() => setActiveTab('documents')} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                  View all →
                </button>
              </div>
              <div className="divide-y divide-white/5">
                {statsLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-500" />
                  </div>
                ) : (stats?.recentUploads || []).length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">No documents yet</div>
                ) : (
                  (stats?.recentUploads || []).map(doc => (
                    <div key={doc._id}
                      onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 cursor-pointer transition-colors group"
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getCategoryDot(doc.category)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-sky-400 transition-colors">{doc.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-bold text-slate-300">{doc.originalName?.split('.').pop().toUpperCase() || 'FILE'}</span> · {doc.category} · {formatBytes(doc.size)} ·&nbsp;
                          {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <span className="text-[10px] text-amber-400 font-semibold truncate max-w-[80px]">
                          {doc.uploadedBy?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Approvals / Quick Actions */}
            <div className="glass-panel rounded-2xl border border-white/5 shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Quick Actions & Status</h3>
              </div>
              <div className="p-5 space-y-3">
                {/* Category Status Cards */}
                {Object.entries(stats?.categoryBreakdown || {}).map(([cat, count]) => {
                  const colorMap = {
                    Invoice: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400',
                    Contract: 'from-violet-500/10 to-transparent border-violet-500/20 text-violet-400',
                    Resume: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-400',
                    Report: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-400',
                    Other: 'from-sky-500/10 to-transparent border-sky-500/20 text-sky-400',
                  };
                  return (
                    <div key={cat}
                      onClick={() => { setActiveTab('documents'); setSelectedCategory(cat); }}
                      className={`flex items-center justify-between rounded-xl border bg-gradient-to-r px-4 py-2.5 cursor-pointer hover:brightness-110 transition-all ${colorMap[cat] || 'from-sky-500/10 to-transparent border-sky-500/20 text-sky-400'}`}
                    >
                      <span className="text-sm font-semibold">{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{count} files</span>
                        <span className="text-[10px] opacity-60">→</span>
                      </div>
                    </div>
                  );
                })}
                {Object.values(stats?.categoryBreakdown || {}).every(v => v === 0) && (
                  <p className="text-center text-slate-500 text-sm py-4">Upload documents to see category status</p>
                )}
              </div>
            </div>

            {/* Document Formats Widget */}
            <div className="glass-panel rounded-2xl border border-white/5 shadow-xl overflow-hidden mt-6">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">File Formats</h3>
              </div>
              <div className="p-5 space-y-3">
                {Object.entries(stats?.typeBreakdown || {}).map(([typeLabel, count]) => {
                  let badgeColor = 'bg-slate-500/20 text-slate-400 border-slate-500/30';
                  if (typeLabel === 'PDF') badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                  else if (typeLabel.includes('DOCX')) badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                  else if (typeLabel.includes('XLSX')) badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                  else if (typeLabel.includes('PPTX')) badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  else if (typeLabel === 'Image') badgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
                  else if (typeLabel === 'Video') badgeColor = 'bg-pink-500/20 text-pink-400 border-pink-500/30';

                  return (
                    <div key={typeLabel} 
                      onClick={() => { setActiveTab('documents'); setSelectedFormat(typeLabel); }}
                      className="flex items-center justify-between rounded-xl border bg-gradient-to-r px-4 py-2.5 cursor-pointer hover:brightness-110 transition-all border-slate-700 hover:border-slate-600 bg-white/5"
                    >
                      <span className="text-sm font-semibold text-slate-300">{typeLabel}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                        {count} files
                      </span>
                    </div>
                  );
                })}
                {Object.keys(stats?.typeBreakdown || {}).length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-2">No files yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DOCUMENTS TAB ══════════ */}
      {activeTab === 'documents' && (
        <div className="flex gap-6">
          {/* Folder Sidebar */}
          <FolderPanel
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={(id) => setSelectedFolder(id)}
            onFoldersChange={() => { fetchFolders(); fetchDocuments(); }}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
          {/* Search & Filter */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Search documents by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input block w-full rounded-xl py-3 pl-12 pr-4 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                      selectedCategory === cat
                        ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {selectedFormat && (
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                    <span className="text-xs text-slate-400">Format:</span>
                    <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {selectedFormat}
                      <button onClick={() => setSelectedFormat('')} className="hover:text-white transition-colors ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* View Toggle */}
              <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 flex items-center gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Grid View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="List View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
              {/* Bulk Actions */}
              {!isReadOnly && documents.length > 0 && (
                <div className="flex items-center gap-3 mt-4 sm:mt-0">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    {selectedDocs.size === documents.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedDocs.size === 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Button literally clicked');
                        handleCompareMetadata(e);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors z-50 cursor-pointer"
                    >
                      <Activity className="h-3.5 w-3.5 pointer-events-none" />
                      <span className="pointer-events-none">Compare Metadata</span>
                    </button>
                  )}
                  {selectedDocs.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Selected ({selectedDocs.size})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center space-x-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-500" />
            </div>
          ) : documents.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl py-16 px-4 text-center">
              <FileText className="h-16 w-16 text-slate-500 mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-white mb-1">No documents found</h3>
              <p className="text-slate-400 max-w-sm text-sm">
                No documents match your criteria. Try uploading a new file or modifying your search.
              </p>
            </div>
          ) : (
            <>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {documents.map((doc) => {
                    const isFavorite = doc.favoritedBy?.includes(user._id);
                    return (
                    <div
                      key={doc._id}
                      onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                      className="glass-card flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              onClick={(e) => handleSelectDoc(e, doc._id)}
                              className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                                selectedDocs.has(doc._id) 
                                  ? 'bg-sky-500 border-sky-500 text-white' 
                                  : 'border-white/20 hover:border-sky-400 text-transparent bg-white/5'
                              }`}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                              <FileText className="h-6 w-6" />
                            </div>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(doc.category)}`}>
                              {doc.category}
                            </span>
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-500/10 text-slate-300 border-slate-500/25">
                              {doc.originalName?.split('.').pop().toUpperCase() || 'FILE'}
                            </span>
                          </div>
                          {!isReadOnly && (
                            <button 
                              onClick={(e) => handleToggleFavorite(e, doc)} 
                              className={`${isFavorite ? 'text-yellow-400' : 'text-slate-400'} hover:text-yellow-400 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full border border-white/5`}
                              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                            </button>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors truncate mb-1">{doc.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-2 h-8">{doc.description || 'No description provided.'}</p>
                        {doc.folder && (
                          <div className="flex items-center gap-1 mb-2">
                            <FolderOpen className="h-3 w-3 text-violet-400" />
                            <span className="text-[10px] text-violet-400 font-semibold truncate">{doc.folder.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-white/5 pt-3 mt-2 text-[11px] text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="font-semibold text-slate-300">{formatBytes(doc.size)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Uploaded:</span>
                          <span className="font-semibold text-slate-300">
                            {new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {(user?.role === 'admin' || user?.role === 'superadmin') && (
                          <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-[10px]">
                            <span>Uploaded By:</span>
                            <span className="text-amber-400 truncate max-w-[150px] font-bold">{doc.uploadedBy?.name || 'Unknown'}</span>
                          </div>
                        )}
                      </div>
                      {/* ── Action Toolbar ── */}
                      <div className="border-t border-white/5 mt-3 pt-3 flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.originalName); }}
                            title="Download" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                          {!isReadOnly && (
                            <button onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                              title="Share" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Share</span>
                            </button>
                          )}
                        </div>
                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setVersionDoc(doc); setIsVersionOpen(true); }}
                              title="Version History" className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                              <History className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => handleOpenMove(e, doc)}
                              title="Move to Folder" className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                              <FolderInput className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                              title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
              {/* List View */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const isFavorite = doc.favoritedBy?.includes(user._id);
                    return (
                    <div
                      key={doc._id}
                      onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                      className="glass-card flex items-center gap-4 p-4 rounded-2xl relative overflow-hidden group cursor-pointer"
                    >
                      {/* Checkbox + Icon */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div 
                          onClick={(e) => handleSelectDoc(e, doc._id)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                            selectedDocs.has(doc._id) 
                              ? 'bg-sky-500 border-sky-500 text-white' 
                              : 'border-white/20 hover:border-sky-400 text-transparent bg-white/5'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 flex-shrink-0">
                          <FileText className="h-6 w-6" />
                        </div>
                      </div>
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors truncate">{doc.title}</h4>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(doc.category)}`}>
                            {doc.category}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-500/10 text-slate-300 border-slate-500/25">
                            {doc.originalName?.split('.').pop().toUpperCase() || 'FILE'}
                          </span>
                          {doc.folder && (
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3 text-violet-400" />
                              <span className="text-[10px] text-violet-400 font-semibold truncate">{doc.folder.name}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{doc.description || 'No description provided.'}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                          <span>Size: <span className="font-semibold text-slate-300">{formatBytes(doc.size)}</span></span>
                          <span>Uploaded: <span className="font-semibold text-slate-300">{new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></span>
                          {(user?.role === 'admin' || user?.role === 'superadmin') && (
                            <span>Uploaded By: <span className="text-amber-400 font-bold">{doc.uploadedBy?.name || 'Unknown'}</span></span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isReadOnly && (
                          <button 
                            onClick={(e) => handleToggleFavorite(e, doc)} 
                            className={`${isFavorite ? 'text-yellow-400' : 'text-slate-400'} hover:text-yellow-400 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full border border-white/5`}
                            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.originalName); }}
                          title="Download" className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                          <Download className="h-4 w-4" />
                        </button>
                        {!isReadOnly && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                              title="Share" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                              <Share2 className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setVersionDoc(doc); setIsVersionOpen(true); }}
                              title="Version History" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                              <History className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => handleOpenMove(e, doc)}
                              title="Move to Folder" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                              <FolderInput className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                              title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </>
          )}
          </div>{/* end flex-1 */}
        </div>
      )}

      {/* ══════════ ACTIVITY TAB ══════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Weekly Summary */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Upload Activity — Last 7 Days</h3>
                <p className="text-xs text-slate-400 mt-0.5">{totalUploadsThisWeek} total uploads this week</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            {statsLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-500" />
              </div>
            ) : (
              <>
                <ActivityChart data={stats?.activity || []} />
                <div className="flex justify-between mt-2">
                  {(stats?.activity || []).map((d, i) => (
                    <span key={i} className="text-[10px] text-slate-500 flex-1 text-center">{d.date.split(',')[0]}</span>
                  ))}
                </div>
                {/* Day-by-day list */}
                <div className="mt-6 space-y-2">
                  {[...(stats?.activity || [])].reverse().map((d, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-white/3 border border-white/5 px-4 py-2.5">
                      <span className="text-sm text-slate-300">{d.date}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full transition-all"
                            style={{ width: `${Math.max((d.uploads / Math.max(...(stats?.activity || [{ uploads: 1 }]).map(x => x.uploads), 1)) * 100, d.uploads > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold w-6 text-right ${d.uploads > 0 ? 'text-sky-400' : 'text-slate-600'}`}>{d.uploads}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User Activity Feed — Recent Docs */}
          <div className="glass-panel rounded-2xl border border-white/5 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Recent Document Activity</h3>
            </div>
            <div className="divide-y divide-white/5">
              {statsLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-emerald-500" />
                </div>
              ) : (stats?.recentUploads || []).length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No recent activity</div>
              ) : (
                (stats?.recentUploads || []).map((doc, i) => (
                  <div key={doc._id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/2 transition-colors cursor-pointer group"
                    onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                  >
                    <div className="relative mt-1">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${
                        ['from-sky-600 to-sky-400','from-violet-600 to-violet-400','from-emerald-600 to-emerald-400','from-rose-600 to-rose-400','from-amber-600 to-amber-400'][i % 5]
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-sky-400 transition-colors truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(user?.role === 'admin' || user?.role === 'superadmin') ? `${doc.uploadedBy?.name || 'Unknown'} uploaded` : 'You uploaded'} ·&nbsp;
                        <span className="font-bold text-slate-300">{doc.originalName?.split('.').pop().toUpperCase() || 'FILE'}</span> ·&nbsp;
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getCategoryColor(doc.category)}`}>{doc.category}</span>
                        &nbsp;· {formatBytes(doc.size)}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        confirmColor={confirmConfig?.confirmColor}
        onConfirm={confirmConfig?.onConfirm}
      />
      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} document={shareDoc} />
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => { fetchDocuments(); fetchStats(); }}
        folders={folders}
        defaultFolderId={selectedFolder !== 'all' && selectedFolder !== 'none' ? selectedFolder : ''}
      />
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setSelectedPreviewDoc(null); }}
        document={selectedPreviewDoc}
      />
      <MoveFolderModal
        isOpen={isMoveOpen}
        onClose={() => { setIsMoveOpen(false); setMoveDoc(null); }}
        document={moveDoc}
        folders={folders}
        onSuccess={() => { fetchDocuments(); }}
      />
      <VersionHistoryModal
        isOpen={isVersionOpen}
        onClose={() => { setIsVersionOpen(false); setVersionDoc(null); }}
        document={versionDoc}
        onVersionChange={() => { fetchDocuments(); fetchStats(); }}
      />
      <CompareMetadataModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        data={compareData}
      />
    </div>
  );
};

export default Dashboard;
