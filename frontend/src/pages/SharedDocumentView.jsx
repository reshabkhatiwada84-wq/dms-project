import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Download, FileText, UploadCloud, AlertCircle, CheckCircle2, Shield, Edit3, Eye } from 'lucide-react';

const SharedDocumentView = () => {
  const { shareToken } = useParams();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Upload states
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await api.get(`/api/documents/public-info/${shareToken}`);
        setDocument(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Document not found or link expired.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [shareToken]);

  const handleDownload = () => {
    window.location.href = `${api.defaults.baseURL}/api/documents/public/${shareToken}`;
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleUploadNewVersion = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/documents/public/${shareToken}/upload`, formData);
      setUploadSuccess(true);
      setFile(null);
      // Refresh doc info
      const res = await api.get(`/api/documents/public-info/${shareToken}`);
      setDocument(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload new version.');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center border border-rose-500/30">
          <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Link Invalid</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 blur-[100px]" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        
        {/* Header / Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-gradient-to-br from-sky-400 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-sky-500/20">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">DMS Share</h1>
        </div>

        {/* Document Card */}
        <div className="glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          
          {/* Permission Badge */}
          <div className="absolute top-0 right-0">
            <div className={`px-4 py-1.5 rounded-bl-2xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 ${
              document.sharePermission === 'edit' 
                ? 'bg-emerald-500/20 text-emerald-400 border-b border-l border-emerald-500/30' 
                : 'bg-sky-500/20 text-sky-400 border-b border-l border-sky-500/30'
            }`}>
              {document.sharePermission === 'edit' ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {document.sharePermission === 'edit' ? 'Edit Access' : 'View Only'}
            </div>
          </div>

          <div className="flex items-start gap-5 mb-8 pt-2">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-8 w-8 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-1 truncate" title={document.title}>
                {document.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-semibold text-slate-300">
                  {document.originalName?.split('.').pop().toUpperCase() || 'FILE'}
                </span>
                <span>•</span>
                <span>{formatBytes(document.size)}</span>
                <span>•</span>
                <span>{new Date(document.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {document.description && (
            <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/5 text-sm text-slate-300">
              {document.description}
            </div>
          )}

          <div className="space-y-4">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Download className="h-5 w-5" />
              Download Document
            </button>

            {/* Edit / Upload New Version Area */}
            {document.sharePermission === 'edit' && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4 text-emerald-400">
                  <Shield className="h-5 w-5" />
                  <h3 className="font-bold text-sm">Upload New Version</h3>
                </div>
                
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-colors bg-black/20 group relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {!file ? (
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-white">Click or drag file to update</p>
                      <p className="text-xs text-slate-400 mt-1">This will create a new version of the document.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-bold text-white truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
                    </div>
                  )}
                </div>

                {file && (
                  <button
                    onClick={handleUploadNewVersion}
                    disabled={uploading}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full" />
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        Confirm Upload
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
                    {error}
                  </div>
                )}

                {uploadSuccess && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 className="h-4 w-4" />
                    New version uploaded successfully!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <p className="text-center text-[10px] text-slate-500 mt-6 uppercase tracking-wider font-semibold">
          Powered by DMS Platform
        </p>
      </div>
    </div>
  );
};

export default SharedDocumentView;
