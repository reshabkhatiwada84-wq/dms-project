import React, { useEffect } from 'react';
import { X, Download, FileText, CheckCircle2, AlertCircle, Percent } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CompareMetadataModal = ({ isOpen, onClose, data }) => {
  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const { summary, comparison } = data;

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF();
      
      // Add Title
      doc.setFontSize(18);
      doc.text('Document Metadata Comparison Report', 14, 22);
      
      // Add Summary
      doc.setFontSize(12);
      doc.text(`Total Properties Compared: ${summary.totalCompared}`, 14, 32);
      doc.text(`Same Properties: ${summary.same}`, 14, 38);
      doc.text(`Different Properties: ${summary.different}`, 14, 44);
      doc.text(`Match Percentage: ${summary.matchPercentage}%`, 14, 50);

      // Add Table
      const tableData = comparison.map(item => [
        item.field,
        item.file1,
        item.file2,
        item.status
      ]);

      autoTable(doc, {
        startY: 58,
        head: [['Property', 'File 1', 'File 2', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233] }, // sky-500
        didParseCell: function(cellData) {
          if (cellData.section === 'body' && cellData.column.index === 3) {
            if (cellData.cell.raw === 'Same') {
              cellData.cell.styles.textColor = [16, 185, 129]; // emerald-500
            } else {
              cellData.cell.styles.textColor = [244, 63, 94]; // rose-500
            }
          }
        }
      });

      doc.save('metadata-comparison-report.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF report.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Metadata Comparison</h3>
              <p className="text-xs text-slate-400 mt-0.5">Side-by-side analysis of two documents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/20">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="glass-panel p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="text-slate-400 text-xs font-semibold mb-1">Total Properties</div>
              <div className="text-2xl font-bold text-white">{summary.totalCompared}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-emerald-400/80 text-xs font-semibold">Same</div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{summary.same}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-rose-400/80 text-xs font-semibold">Different</div>
                <AlertCircle className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400">{summary.different}</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sky-400/80 text-xs font-semibold">Match</div>
                <Percent className="h-4 w-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-sky-400">{summary.matchPercentage}%</div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/30">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/80 text-slate-300 text-xs uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold w-1/4">Property</th>
                  <th className="px-6 py-4 font-semibold border-l border-white/5 w-1/3">File 1</th>
                  <th className="px-6 py-4 font-semibold border-l border-white/5 w-1/3">File 2</th>
                  <th className="px-6 py-4 font-semibold border-l border-white/5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparison.map((row, index) => (
                  <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-300">{row.field}</td>
                    <td className="px-6 py-4 text-slate-400 border-l border-white/5 break-words">{row.file1}</td>
                    <td className="px-6 py-4 text-slate-400 border-l border-white/5 break-words">{row.file2}</td>
                    <td className="px-6 py-4 border-l border-white/5 text-center">
                      {row.status === 'Same' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Same
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Different
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end border-t border-white/10 px-6 py-4 bg-slate-900/50 flex-shrink-0 space-x-3">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors border border-white/10 hover:bg-white/5"
          >
            Close
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <Download className="h-4.5 w-4.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompareMetadataModal;
