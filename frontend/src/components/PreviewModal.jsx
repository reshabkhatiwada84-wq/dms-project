import React, { useState, useEffect } from 'react';
import { api, API_URL } from '../context/AuthContext';
import { X, Download, FileText, AlertCircle } from 'lucide-react';

const DocxRenderer = ({ blob, onError }) => {
  const containerRef = React.useRef(null);
  
  useEffect(() => {
    if (containerRef.current && blob) {
      import('docx-preview').then(docx => {
        docx.renderAsync(blob, containerRef.current).catch(err => {
          console.error("docx error:", err);
          if (onError) onError('Failed to render Word document preview');
        });
      });
    }
  }, [blob, onError]);

  return <div ref={containerRef} className="w-full h-[60vh] overflow-auto bg-white rounded-xl p-4 text-black docx-container" />;
};

const PreviewModal = ({ isOpen, onClose, document }) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [docxBlob, setDocxBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !document) return;

    const loadPreview = async () => {
      setLoading(true);
      setError('');
      setPreviewUrl('');
      setTextContent('');
      setDocxBlob(null);

      try {
        const isText = 
          document.mimeType.startsWith('text/') || 
          document.mimeType === 'application/json' ||
          document.mimeType === 'application/javascript' ||
          document.mimeType === 'application/xml';

        const isImage = document.mimeType.startsWith('image/');
        const isPdf = document.mimeType === 'application/pdf';
        const isVideo = document.mimeType.startsWith('video/');
        const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (isPdf || isVideo) {
          // For PDF/Video: use the preview endpoint URL directly
          // We append the token as a query param so the backend can authorize it
          const token = localStorage.getItem('token');
          setPreviewUrl(`${API_URL}/api/documents/preview/${document._id}?token=${token}`);
          setLoading(false);
          return;
        }

        if (isText) {
          const res = await api.get(`/api/documents/download/${document._id}`, {
            responseType: 'text',
          });
          setTextContent(res.data);
        } else if (isImage) {
          const res = await api.get(`/api/documents/preview/${document._id}`, {
            responseType: 'blob',
          });
          const blob = new Blob([res.data], { type: document.mimeType });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } else if (isDocx) {
          const res = await api.get(`/api/documents/download/${document._id}`, {
            responseType: 'blob',
          });
          setDocxBlob(res.data);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load file preview');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, document]);


  if (!isOpen || !document) return null;

  const handleDownload = async () => {
    try {
      const response = await api({
        url: `/api/documents/download/${document._id}`,
        method: 'GET',
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.originalName);
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download file');
    }
  };

  const isText = 
    document.mimeType.startsWith('text/') || 
    document.mimeType === 'application/json' ||
    document.mimeType === 'application/javascript';

  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';
  const isVideo = document.mimeType.startsWith('video/');
  const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex h-[45vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-sky-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[35vh] text-center">
          <AlertCircle className="h-12 w-12 text-rose-400 mb-2" />
          <p className="text-slate-300 font-semibold">{error}</p>
        </div>
      );
    }

    if (isImage && previewUrl) {
      return (
        <div className="flex justify-center p-2 bg-slate-950/20 rounded-xl">
          <img
            src={previewUrl}
            alt={document.title}
            className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg border border-white/5"
          />
        </div>
      );
    }

    if (isPdf && previewUrl) {
      return (
        <iframe
          src={previewUrl}
          title={document.title}
          className="w-full h-[60vh] rounded-xl border border-white/10 bg-slate-900"
        />
      );
    }

    if (isText && textContent) {
      return (
        <pre className="w-full h-[55vh] overflow-auto bg-slate-950 p-4 rounded-xl text-slate-300 font-mono text-sm text-left whitespace-pre-wrap border border-white/5">
          {textContent}
        </pre>
      );
    }

    if (isVideo && previewUrl) {
      return (
        <div className="flex justify-center p-2 bg-slate-950/20 rounded-xl">
          <video
            src={previewUrl}
            controls
            controlsList="nodownload"
            className="max-h-[60vh] max-w-full rounded-lg shadow-lg border border-white/5"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isDocx && docxBlob) {
      return <DocxRenderer blob={docxBlob} onError={setError} />;
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-950/20 border border-white/5 rounded-xl">
        <FileText className="h-16 w-16 text-slate-500 mb-4" />
        <h4 className="text-lg font-bold text-white mb-1">Preview not available</h4>
        <p className="text-slate-400 max-w-sm text-sm mb-6">
          This file format ({document.mimeType}) cannot be rendered directly in the browser. You can download it to view locally.
        </p>
        <button
          onClick={handleDownload}
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 font-semibold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          <Download className="h-4.5 w-4.5" />
          <span>Download File</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <div className="text-left">
            <h3 className="text-lg font-bold text-white truncate max-w-[500px]" title={document.title}>
              {document.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[500px]">
              {document.originalName} • {document.category}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/10">
          {renderPreview()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-slate-950/20 flex-shrink-0">
          <p className="text-xs text-slate-400">
            Uploaded: {new Date(document.createdAt).toLocaleString()}
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors border border-white/5 hover:bg-white/5"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Download className="h-4.5 w-4.5" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
