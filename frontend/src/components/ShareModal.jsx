import React, { useState, useContext } from 'react';
import { AuthContext, api } from '../context/AuthContext';
import { X, Copy, Share2, Check, Shield, Edit3, Eye } from 'lucide-react';

const ShareModal = ({ isOpen, onClose, document }) => {
  const [permission, setPermission] = useState('view');
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !document) return null;

  const generateLink = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/documents/${document._id}/share`, { permission });
      const { shareToken } = res.data;
      const frontendLink = `${window.location.origin}/shared/${shareToken}`;
      setShareLink(frontendLink);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shared Document: ${document.title}`,
          text: `Check out this document: ${document.title}`,
          url: shareLink
        });
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const handleClose = () => {
    setShareLink('');
    setPermission('view');
    setCopied(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Share2 className="h-5 w-5 text-emerald-400" />
            Share Document
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm font-semibold text-white mb-1 truncate">{document.title}</p>
            <p className="text-xs text-slate-400">Generate a secure link to share this document.</p>
          </div>

          {!shareLink ? (
            <div className="space-y-4">
              <label className="text-sm font-bold text-white">Access Level</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPermission('view')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                    permission === 'view'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 ring-2 ring-sky-500/30'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Eye className="h-6 w-6 mb-2" />
                  <span className="font-semibold text-sm">View Only</span>
                  <span className="text-[10px] mt-1 opacity-80 text-center">Can download and view</span>
                </button>
                
                <button
                  onClick={() => setPermission('edit')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                    permission === 'edit'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-2 ring-emerald-500/30'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Edit3 className="h-6 w-6 mb-2" />
                  <span className="font-semibold text-sm">Can Edit</span>
                  <span className="text-[10px] mt-1 opacity-80 text-center">Can upload new versions</span>
                </button>
              </div>

              {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

              <button
                onClick={generateLink}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full" /> : 'Generate Link'}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col items-center text-center">
                <Shield className="h-8 w-8 text-emerald-400 mb-2" />
                <h3 className="text-emerald-400 font-bold mb-1">Link Generated!</h3>
                <p className="text-xs text-slate-400">
                  Anyone with this link can {permission === 'view' ? 'view' : 'edit'} this document.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                />
                <button
                  onClick={copyToClipboard}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-white/10"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                </button>
              </div>

              <button
                onClick={nativeShare}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Share via Apps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
