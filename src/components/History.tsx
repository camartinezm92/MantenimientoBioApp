import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { Report } from '../types';
import { Search, FileText, Download, Eye, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryProps {
  onViewReport: (report: Report) => void;
  onDownloadReport: (report: Report) => void;
}

export const History: React.FC<HistoryProps> = ({ onViewReport, onDownloadReport }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedReports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      setReports(fetchedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.serial.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadHistoryCSV = () => {
    const headers = ['N° Reporte', 'Fecha', 'Equipo', 'Marca', 'Modelo', 'Serie', 'Tipo', 'Estado'];
    const rows = filteredReports.map(r => [
      r.reportNumber,
      format(new Date(r.createdAt), 'dd/MM/yyyy'),
      r.equipment,
      r.brand,
      r.model,
      r.serial,
      r.type === 'preventive' ? 'Preventivo' : 'Correctivo',
      r.finalStatus || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Historial_Mantenimientos_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Mantenimientos</h1>
          <p className="text-gray-500 text-sm">Consulte y descargue reportes realizados anteriormente.</p>
        </div>
        <button
          onClick={downloadHistoryCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md"
        >
          <Download size={18} /> Descargar Lista (CSV)
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por N° de reporte, equipo o serial..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No se encontraron reportes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map(report => (
            <div key={report.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit mb-1 ${
                    report.type === 'preventive' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {report.type === 'preventive' ? 'Preventivo' : 'Correctivo'}
                  </span>
                  <h3 className="font-bold text-lg text-gray-900">{report.reportNumber}</h3>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <Calendar size={12} />
                    {format(new Date(report.createdAt), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-2 border-y border-gray-50">
                <div className="flex items-center gap-2 text-sm">
                  <Tag size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-700">{report.equipment}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div><span className="font-bold">Marca:</span> {report.brand}</div>
                  <div><span className="font-bold">Modelo:</span> {report.model}</div>
                  <div className="col-span-2"><span className="font-bold">Serial:</span> {report.serial}</div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-auto pt-2">
                <span className={`text-[10px] font-bold uppercase ${
                  report.finalStatus === 'operativo' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {report.finalStatus || 'Sin estado'}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onViewReport(report)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                    title="Ver Detalle"
                  >
                    <Eye size={18} />
                  </button>
                  <button 
                    onClick={() => onDownloadReport(report)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" 
                    title="Descargar PDF"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
