import React, { useState, useEffect, useRef } from 'react';
import { api, API_URL } from '../context/AuthContext';
import { X, Download, FileText, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// DOCX renderer helper
// ─────────────────────────────────────────────
const DocxRenderer = ({ blob, onError }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && blob) {
      import('docx-preview').then(docx => {
        docx.renderAsync(blob, containerRef.current).catch(err => {
          console.error('docx error:', err);
          if (onError) onError('Failed to render Word document preview');
        });
      });
    }
  }, [blob, onError]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[60vh] overflow-auto bg-white rounded-xl p-4 text-black docx-container"
    />
  );
};

// ─────────────────────────────────────────────
// XLSX renderer helper
// ─────────────────────────────────────────────
const XlsxRenderer = ({ blob, onError }) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (!blob) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to array of arrays (header: 1)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          setColumns(jsonData[0] || []);
          setData(jsonData.slice(1) || []);
        }
      } catch (err) {
        console.error('xlsx error:', err);
        if (onError) onError('Failed to parse Excel file preview');
      }
    };
    reader.readAsArrayBuffer(blob);
  }, [blob, onError]);

  return (
    <div className="w-full h-[60vh] overflow-auto bg-slate-900 rounded-xl border border-white/10 custom-scrollbar p-2">
      <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
        <thead className="sticky top-0 bg-slate-950 shadow-md">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 font-semibold text-slate-200 border-b border-white/10 uppercase tracking-wider text-xs">
                {col || ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
              {columns.map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3 truncate max-w-[300px]" title={row[colIndex] || ''}>
                  {row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : ''}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && columns.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500 italic">No data found in spreadsheet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main PreviewModal
// ─────────────────────────────────────────────
const PreviewModal = ({ isOpen, onClose, document }) => {
  const [loading, setLoading]       = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [docxBlob, setDocxBlob]     = useState(null);
  const [error, setError]           = useState('');
  const videoRef                    = useRef(null);

  // Load preview data whenever the modal opens
  useEffect(() => {
    if (!isOpen || !document) return;

    const loadPreview = async () => {
      setLoading(true);
      setError('');
      setPreviewUrl('');
      setTextContent('');
      setDocxBlob(null);

      try {
        const mime     = document.mimeType || '';
        const isText   = mime.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(mime);
        const isImage  = mime.startsWith('image/');
        const isPdf    = mime === 'application/pdf';
        const isVideo  = mime.startsWith('video/');
        const isDocx   = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isXlsx   = mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel' || document.originalName?.endsWith('.xlsx') || document.originalName?.endsWith('.xls');

        if (isPdf || isVideo) {
          const token = localStorage.getItem('token');
          setPreviewUrl(`${API_URL}/api/documents/preview/${document._id}?token=${token}`);
          setLoading(false);
          return;
        }

        if (isImage) {
          const res = await api.get(`/api/documents/preview/${document._id}`, { responseType: 'blob' });
          const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
          setPreviewUrl(url);
        } else if (isText) {
          const res = await api.get(`/api/documents/download/${document._id}`, { responseType: 'text' });
          setTextContent(res.data);
        } else if (isDocx) {
          const res = await api.get(`/api/documents/download/${document._id}`, { responseType: 'blob' });
          setDocxBlob(res.data);
        } else if (isXlsx) {
          const res = await api.get(`/api/documents/download/${document._id}`, { responseType: 'blob' });
          setDocxBlob(res.data); // We can reuse the docxBlob state to hold the xlsx Blob for simplicity
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
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  // ── Download handler ─────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const response = await api({ url: `/api/documents/download/${document._id}`, method: 'GET', responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href  = url;
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

  const mime    = document.mimeType || '';
  const isVideo = mime.startsWith('video/');
  const isImage = mime.startsWith('image/');
  const isPdf   = mime === 'application/pdf';
  const isText  = mime.startsWith('text/') || ['application/json', 'application/javascript'].includes(mime);
  const isDocx  = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isXlsx  = mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel' || document.originalName?.endsWith('.xlsx') || document.originalName?.endsWith('.xls');

  // ══════════════════════════════════════════════════════════════════════════
  // VIDEO — dedicated fullscreen modal WITHOUT any overflow/scroll container
  // This is critical: overflow-y-auto on a parent div intercepts pointer
  // events on the native seekbar, making it impossible to drag/seek.
  // ══════════════════════════════════════════════════════════════════════════
  if (isVideo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white truncate max-w-[600px]" title={document.title}>
              {document.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{document.originalName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Video player — flex-1 so it fills remaining space, no overflow clipping */}
        <div className="flex-1 flex items-center justify-center px-6 py-4" style={{ minHeight: 0 }}>
          {loading && (
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-sky-500" />
          )}
          {error && (
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-12 w-12 text-rose-400" />
              <p className="text-slate-300">{error}</p>
            </div>
          )}
          {!loading && !error && previewUrl && (
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              playsInline
              onError={() => setError('Failed to load video. The format may not be supported by your browser.')}
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                width: '100%',
                outline: 'none',
                display: 'block',
              }}
              className="rounded-xl shadow-2xl"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 flex-shrink-0">
          <p className="text-xs text-slate-400">Uploaded: {new Date(document.createdAt).toLocaleString()}</p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors border border-white/10 hover:bg-white/5"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // All other file types — standard scrollable modal
  // ══════════════════════════════════════════════════════════════════════════
  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex h-[45vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-sky-500" />
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

    if (isDocx && docxBlob) {
      return <DocxRenderer blob={docxBlob} onError={setError} />;
    }

    if (isXlsx && docxBlob) {
      return <XlsxRenderer blob={docxBlob} onError={setError} />;
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
          <Download className="h-4 w-4" />
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
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/10">
          {renderPreview()}
        </div>

        {/* Footer */}
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
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
