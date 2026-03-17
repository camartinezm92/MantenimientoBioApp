import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  Report, 
  MaintenanceType, 
  SparePart, 
  VerificationState 
} from '../types';
import { improveAllTechnicalTexts } from '../services/aiService';
import { SignaturePad } from './SignaturePad';
import html2pdf from 'html2pdf.js';
import { Plus, Trash2, Wand2, Download, Save, Camera, ClipboardList } from 'lucide-react';

const INITIAL_VERIFICATION: VerificationState = {
  funcionamientoGeneral: { status: null },
  parametros: { status: null },
  perillaBotones: { status: null },
  panelTacto: { status: null },
  accesorios: { status: null },
  bateria: { status: null },
  estadoFisico: { status: null },
  limpieza: { status: null },
};

interface ReportFormProps {
  onComplete: () => void;
  initialData?: Report;
  isViewOnly?: boolean;
  autoDownload?: boolean;
}

export const ReportForm: React.FC<ReportFormProps> = ({ onComplete, initialData, isViewOnly, autoDownload }) => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<MaintenanceType | null>(initialData?.type || null);
  const [reportNumber, setReportNumber] = useState(initialData?.reportNumber || '');
  const [formData, setFormData] = useState<Partial<Report>>(initialData || {
    dateReceived: format(new Date(), 'yyyy-MM-dd'),
    dateService: format(new Date(), 'yyyy-MM-dd'),
    responsible: 'CAMILO MARTINEZ',
    equipment: '',
    model: '',
    brand: '',
    serial: '',
    invima: '',
    location: '',
    mode: '',
    isMobile: false,
    isFixed: false,
    maintenanceSubtype: '',
    description: '',
    technicalDiagnosis: '',
    workPerformed: '',
    spareParts: [],
    verification: INITIAL_VERIFICATION,
    finalDiagnosis: '',
    finalStatus: null,
    observations: '',
    delivery: {
      senderName: 'CAMILO MARTINEZ',
      senderRole: 'INGENIERO BIOMÉDICO',
      senderSignature: '', 
      receiverName: '',
      receiverRole: '',
      receiverSignature: ''
    },
    photos: []
  });

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reportType && !initialData) {
      generateReportNumber(reportType);
    }
  }, [reportType, initialData]);

  useEffect(() => {
    if (autoDownload && initialData) {
      // Small delay to ensure everything is rendered
      const timer = setTimeout(() => {
        downloadPDF();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoDownload, initialData]);

  const generateReportNumber = async (type: MaintenanceType) => {
    const counterRef = doc(db, 'counters', 'reports');
    const counterSnap = await getDoc(counterRef);
    
    let count = 1;
    if (counterSnap.exists()) {
      count = (counterSnap.data()[type] || 0) + 1;
    } else {
      await setDoc(counterRef, { preventive: 0, corrective: 0 });
    }

    const prefix = type === 'preventive' ? 'RPP' : 'RPC';
    const datePart = format(new Date(), 'yyMM');
    const paddedCount = count.toString().padStart(4, '0');
    const newNumber = `${prefix}-${datePart}-${paddedCount}`;
    setReportNumber(newNumber);
    setFormData(prev => ({ ...prev, reportNumber: newNumber }));
  };

  const handleImproveAll = async () => {
    const fieldsToImprove = {
      description: formData.description || '',
      technicalDiagnosis: formData.technicalDiagnosis || '',
      workPerformed: formData.workPerformed || '',
      finalDiagnosis: formData.finalDiagnosis || '',
      observations: formData.observations || ''
    };
    
    setLoading(true);
    const improved = await improveAllTechnicalTexts(fieldsToImprove);
    setFormData(prev => ({ ...prev, ...improved }));
    setLoading(false);
  };

  const addSparePart = () => {
    setFormData(prev => ({
      ...prev,
      spareParts: [
        ...(prev.spareParts || []),
        { description: '', quantity: 1, provider: '', partNumber: '', reference: '', value: '' }
      ]
    }));
  };

  const removeSparePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      spareParts: prev.spareParts?.filter((_, i) => i !== index)
    }));
  };

  const updateSparePart = (index: number, field: keyof SparePart, value: any) => {
    setFormData(prev => {
      const newParts = [...(prev.spareParts || [])];
      newParts[index] = { ...newParts[index], [field]: value };
      return { ...prev, spareParts: newParts };
    });
  };

  const toggleVerification = (key: keyof VerificationState, status: 'CU' | 'NC') => {
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        [key]: { status: prev.verification![key].status === status ? null : status }
      }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photos: [...(prev.photos || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const saveReport = async () => {
    if (!reportType || !reportNumber) {
      alert("Por favor seleccione el tipo de mantenimiento");
      return;
    }

    setLoading(true);
    try {
      // Increment counter robustly
      const counterRef = doc(db, 'counters', 'reports');
      await setDoc(counterRef, {
        [reportType]: increment(1)
      }, { merge: true });

      // Save report
      const reportData = {
        ...formData,
        reportNumber,
        type: reportType,
        createdAt: new Date().toISOString()
      };
      
      console.log("Saving report data:", reportData);
      await addDoc(collection(db, 'reports'), reportData);

      alert("Reporte guardado exitosamente");
      onComplete();
    } catch (error: any) {
      console.error("Error saving report:", error);
      alert(`Error al guardar el reporte: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) {
      console.error("Report ref is null");
      return;
    }
    setLoading(true);
    
    try {
      console.log("Generating PDF for report:", reportNumber);
      
      const element = reportRef.current;
      
      // Options for html2pdf
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `Reporte_${reportNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            const el = clonedDoc.getElementById('report-to-pdf');
            if (el) {
              // A4 at 96dpi is 794px wide.
              el.style.width = '794px';
              el.style.margin = '0';
              el.style.padding = '30px';
              el.style.boxShadow = 'none';
              el.style.border = 'none';
              el.style.minHeight = 'auto';
              el.style.overflow = 'visible';
            }

            // Apply colors and fix oklch
            const allElements = clonedDoc.getElementsByTagName('*');
            const header = clonedDoc.querySelector('.report-header');
            
            for (let i = 0; i < allElements.length; i++) {
              const element = allElements[i] as HTMLElement;
              
              // Ensure everything is visible and breaks correctly
              // Remove overflow-hidden that might be clipping text
              element.style.overflow = 'visible';
              element.style.boxSizing = 'border-box';
              element.style.wordBreak = 'break-word';

              // Apply page break avoidance to sections
              if (element.classList.contains('report-section') || element.classList.contains('photo-item')) {
                element.style.pageBreakInside = 'avoid';
                element.style.breakInside = 'avoid';
                element.style.display = 'block';
                element.style.position = 'relative';
                
                if (element.classList.contains('report-section')) {
                  element.style.width = '100%';
                }
                
                // Reduce margins for PDF
                if (element.classList.contains('mb-4')) {
                  element.style.marginBottom = '6px';
                }

                // Eliminate extra space at the end as requested
                const text = element.innerText || '';
                if (text.includes('ENTREGA DEL EQUIPO') || text.includes('REGISTRO FOTOGRÁFICO')) {
                  element.style.marginBottom = '0px';
                  element.style.marginTop = '2px';
                }
              }

              // Remove extra spaces requested by user
              if (element.classList.contains('mt-6') || element.classList.contains('mt-2')) {
                element.style.marginTop = '2px';
              }
              if (element.classList.contains('mt-4')) {
                element.style.marginTop = '2px';
              }

              const style = window.getComputedStyle(element);
              const isHeader = header && (header.contains(element) || element === header);

              let bg = style.backgroundColor;
              let color = style.color;
              let border = style.borderColor;

              // Fix oklch globally by checking classes if style returns oklch
              if (bg.includes('oklch')) {
                if (element.classList.contains('bg-[#003366]')) bg = '#003366';
                else if (element.classList.contains('bg-[#f0f7ff]')) bg = '#f0f7ff';
                else bg = 'transparent';
                element.style.backgroundColor = bg;
              }
              if (color.includes('oklch')) {
                if (element.classList.contains('text-[#003366]')) color = '#003366';
                else color = '#000000';
                element.style.color = color;
              }
              if (border.includes('oklch')) {
                element.style.borderColor = '#2596be';
              }

              if (isHeader) {
                // Header text should be black as requested "textos y titulos en negro"
                if (element.classList.contains('text-[#003366]') || color.includes('rgb(0, 51, 102)') || color === '#003366') {
                  // Keep main titles blue, others black
                  if (element.tagName === 'H1' || element.innerText.includes('MEDICINA INTENSIVA')) {
                    element.style.color = '#003366';
                  } else {
                    element.style.color = '#000000';
                  }
                }
              } else {
                // Apply blue theme to everything NOT inside the header
                
                // Section headers (dark blue background)
                if (bg.includes('rgb(0, 51, 102)') || bg.includes('#003366') || element.classList.contains('bg-[#003366]')) {
                  element.style.backgroundColor = '#003366'; // Dark blue for titles
                  element.style.color = '#ffffff'; 
                }
                // Light blue for backgrounds (#f0f7ff)
                else if (bg.includes('rgb(240, 247, 255)') || bg.includes('#f0f7ff') || element.classList.contains('bg-[#f0f7ff]')) {
                  element.style.backgroundColor = '#eef7fa';
                }
                
                // Dark blue for labels/text
                if (color.includes('rgb(0, 51, 102)') || color.includes('#003366') || element.classList.contains('text-[#003366]')) {
                  if (!element.classList.contains('bg-[#003366]')) {
                    element.style.color = '#003366'; 
                  }
                }
                
                // Borders - use the lighter blue #2596be
                if (border.includes('rgb(0, 51, 102)') || border.includes('#003366') || element.classList.contains('border-[#003366]')) {
                  element.style.borderColor = '#2596be';
                }
              }
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'], avoid: '.report-section' }
      };

      // Force black text for PDF export
      const originalStyle = element.style.color;
      element.style.color = '#000000';
      
      // Use html2pdf to generate and save the PDF
      await html2pdf().set(opt).from(element).save();
      
      // Restore original style
      element.style.color = originalStyle;
      
      console.log("PDF saved successfully");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      alert(`Error al generar PDF: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!reportType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">Iniciar Nuevo Reporte</h2>
        <p className="text-gray-500">Seleccione el tipo de mantenimiento a realizar:</p>
        <div className="flex gap-4">
          <button
            onClick={() => setReportType('preventive')}
            className="px-8 py-4 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-md"
          >
            MANTENIMIENTO PREVENTIVO
          </button>
          <button
            onClick={() => setReportType('corrective')}
            className="px-8 py-4 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-md"
          >
            MANTENIMIENTO CORRECTIVO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 flex flex-col gap-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 sticky top-0 z-10">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-500 uppercase">
            {isViewOnly ? 'Visualizando Reporte' : 'Nuevo Reporte'} - {reportType === 'preventive' ? 'Preventivo' : 'Correctivo'}
          </span>
          <h1 className="text-xl font-bold text-gray-900">Reporte N° {reportNumber}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onComplete()}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold text-sm rounded-md transition-all"
          >
            Volver
          </button>
          <button
            onClick={downloadPDF}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm transition-all shadow-sm"
          >
            <Download size={16} /> Descargar PDF
          </button>
          {!isViewOnly && (
            <button
              onClick={saveReport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-bold text-sm transition-all"
            >
              <Save size={16} /> {loading ? 'Guardando...' : 'Guardar Reporte'}
            </button>
          )}
        </div>
      </div>

      {/* Report Content for PDF */}
      <div 
        id="report-to-pdf"
        ref={reportRef} 
        className="bg-white p-8 shadow-2xl border border-gray-300 font-sans text-[11px] leading-normal text-black w-[210mm] mx-auto min-h-[297mm]"
      >
        {/* Header Section */}
        <div className="report-header report-section border-2 border-[#003366] grid grid-cols-12 mb-4 overflow-visible rounded-lg">
          {/* Logo Column */}
          <div className="col-span-2 border-r-2 border-[#003366] p-2 flex items-center justify-center bg-white">
            <img 
              src="/logo.png" 
              alt="Logo UCI" 
              className="max-w-full max-h-16 object-contain"
              onError={(e) => {
                // Fallback if logo.png doesn't exist yet
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `
                  <div class="flex flex-col items-center">
                    <div class="w-16 h-16 rounded-full border-2 border-[#0070c0] flex flex-col items-center justify-center p-1 relative">
                      <span class="text-[#0070c0] font-black text-xl leading-none tracking-tighter">UCI</span>
                      <div class="w-full h-px bg-[#0070c0] my-0.5 relative"></div>
                      <span class="text-[#0070c0] font-bold text-[7px] leading-none mt-1">HONDA</span>
                    </div>
                  </div>
                `;
              }}
            />
          </div>

          {/* Info Table Column */}
          <div className="col-span-10 flex flex-col text-[10px] text-black">
            {/* Row 1: Institution Name */}
            <div className="border-b-2 border-[#003366] p-1 text-center font-bold uppercase bg-[#f0f7ff] text-[#003366] text-[12px]">
              MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA
            </div>
            
            {/* Row 2: Form Title */}
            <div className="border-b-2 border-[#003366] p-1 text-center font-bold uppercase bg-white text-[11px]">
              FORMATO REPORTE TÉCNICO MANTENIMIENTO DE DISPOSITIVOS MÉDICOS
            </div>

            {/* Row 3: Macroproceso & Proceso */}
            <div className="grid grid-cols-12 border-b-2 border-[#003366]">
              <div className="col-span-7 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Macroproceso:</span> <span className="font-semibold">Gestión de tecnología</span>
              </div>
              <div className="col-span-5 p-1 px-2">
                <span className="font-bold text-[#003366]">Proceso:</span> <span className="font-semibold">Gestión de Tecnología</span>
              </div>
            </div>

            {/* Row 4: Responsable, Emisión, Código */}
            <div className="grid grid-cols-12 border-b-2 border-[#003366]">
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Responsable:</span> <span className="font-semibold">Líder de proceso</span>
              </div>
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Fecha de emisión:</span> <span className="font-semibold">2017-08-30</span>
              </div>
              <div className="col-span-4 p-1 px-2">
                <span className="font-bold text-[#003366]">Código:</span> <span className="font-semibold">GTE-FOR-015-V3</span>
              </div>
            </div>

            {/* Row 5: Revisó, Actualización, Versión */}
            <div className="grid grid-cols-12 border-b-2 border-[#003366]">
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Revisó:</span> <span className="font-semibold">Comité de Calidad</span>
              </div>
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Fecha última actualización:</span> <span className="font-semibold">2024-01-15</span>
              </div>
              <div className="col-span-4 p-1 px-2">
                <span className="font-bold text-[#003366]">Versión:</span> <span className="font-semibold">0,3</span>
              </div>
            </div>

            {/* Row 6: Aprobó, Archivo, Página/Reporte */}
            <div className="grid grid-cols-12">
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Aprobó:</span> <span className="font-semibold">Gerente de la institución</span>
              </div>
              <div className="col-span-4 border-r-2 border-[#003366] p-1 px-2">
                <span className="font-bold text-[#003366]">Archivo:</span> <span className="font-semibold">Archivo de Gestión de la Tecnología</span>
              </div>
              <div className="col-span-4 p-1 px-2 flex justify-between items-center">
                <span className="font-bold text-[#003366]">Página 1 de 1</span>
                <span className="font-bold text-red-600 text-[11px]">N° {reportNumber}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div className="report-section grid grid-cols-4 border-2 border-[#003366] mb-4 font-bold uppercase text-[10px] rounded-lg overflow-visible">
          <div className="border-r-2 border-[#003366] p-2 bg-[#003366] text-white">Fecha Recepción</div>
          <div className="border-r-2 border-[#003366] p-2 bg-white text-center text-black">
            {isViewOnly ? formData.dateReceived : (
              <input 
                type="date" 
                value={formData.dateReceived} 
                onChange={e => setFormData(prev => ({ ...prev, dateReceived: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] text-center font-semibold"
              />
            )}
          </div>
          <div className="border-r-2 border-[#003366] p-2 bg-[#003366] text-white">Fecha Servicio</div>
          <div className="p-2 bg-white text-center text-black">
            {isViewOnly ? formData.dateService : (
              <input 
                type="date" 
                value={formData.dateService} 
                onChange={e => setFormData(prev => ({ ...prev, dateService: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] text-center font-semibold"
              />
            )}
          </div>
        </div>

        {/* 1. Datos Equipo */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">1. DATOS DEL EQUIPO</div>
          <div className="grid grid-cols-4 border-2 border-[#003366] mb-4 text-[10px] bg-white rounded-b-lg overflow-visible">
            <div className="border-r-2 border-b-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Equipo</div>
          <div className="border-r-2 border-b-2 border-[#003366] p-2 text-black font-semibold">
            {isViewOnly ? formData.equipment : (
              <select 
                value={formData.equipment} 
                onChange={e => setFormData(prev => ({ ...prev, equipment: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              >
                <option value="">Seleccione...</option>
                <option value="MONITOR DE SIGNOS VITALES">MONITOR DE SIGNOS VITALES</option>
                <option value="VENTILADOR MECÁNICO">VENTILADOR MECÁNICO</option>
                <option value="CAMA">CAMA</option>
                <option value="CAMILLA">CAMILLA</option>
                <option value="TAC">TAC</option>
                <option value="FLUJÓMETROS">FLUJÓMETROS</option>
                <option value="SUCCIONADORES">SUCCIONADORES</option>
                <option value="BOMBAS DE INFUSIÓN">BOMBAS DE INFUSIÓN</option>
                <option value="EQUIPO DE ÓRGANOS">EQUIPO DE ÓRGANOS</option>
                <option value="TENSIÓMETRO">TENSIÓMETRO</option>
                <option value="REGULADOR DE VACÍO">REGULADOR DE VACÍO</option>
                <option value="LARINGOSCOPIO">LARINGOSCOPIO</option>
                <option value="DESFIBRILADOR">DESFIBRILADOR</option>
                <option value="ELECTROCARDIÓ-GRAFO">ELECTROCARDIÓ-GRAFO</option>
                <option value="MÁQUINA DE GASES">MÁQUINA DE GASES</option>
                <option value="MÁQUINA DE ANESTESIA">MÁQUINA DE ANESTESIA</option>
                <option value="MESA DE CIRUGÍA">MESA DE CIRUGÍA</option>
                <option value="LÁMPARA CIELÍTICA">LÁMPARA CIELÍTICA</option>
                <option value="ELECTROBISTURÍ">ELECTROBISTURÍ</option>
                <option value="GLUCÓMETROS">GLUCÓMETROS</option>
                <option value="AUTOCLAVE">AUTOCLAVE</option>
                <option value="INCUBADORA">INCUBADORA</option>
                <option value="FONENDOSCOPIOS">FONENDOSCOPIOS</option>
                <option value="DIGITALIZADOR">DIGITALIZADOR</option>
                <option value="EQUIPO DE RAYOS X PORTÁTIL">EQUIPO DE RAYOS X PORTÁTIL</option>
                <option value="COLCHONES ANTIESCARAS">COLCHONES ANTIESCARAS</option>
                <option value="BÁSCULA">BÁSCULA</option>
                <option value="TALLÍMETRO">TALLÍMETRO</option>
                <option value="SILLAS DE RUEDAS">SILLAS DE RUEDAS</option>
                <option value="EQUIPO DE HEMATOLOGÍA">EQUIPO DE HEMATOLOGÍA</option>
                <option value="EQUIPO DE QUÍMICA">EQUIPO DE QUÍMICA</option>
                <option value="CENTRÍFUGAS">CENTRÍFUGAS</option>
                <option value="PIPETAS AUTOMÁTICAS">PIPETAS AUTOMÁTICAS</option>
                <option value="BAÑO SEROLÓGICO">BAÑO SEROLÓGICO</option>
                <option value="MICROSCOPIO">MICROSCOPIO</option>
                <option value="AGITADOR DE PLAQUETAS">AGITADOR DE PLAQUETAS</option>
                <option value="LÁMPARA DE BANCO DE SANGRE">LÁMPARA DE BANCO DE SANGRE</option>
                <option value="TERMÓMETRO DIGITAL">TERMÓMETRO DIGITAL</option>
                <option value="TERMOHIGRÓMETROS">TERMOHIGRÓMETROS</option>
                <option value="REFRIGERADORES">REFRIGERADORES</option>
                <option value="CONGELADOR">CONGELADOR</option>
              </select>
            )}
          </div>
          <div className="border-r-2 border-b-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Modelo</div>
          <div className="border-b-2 border-[#003366] p-2 text-black font-semibold">
            {isViewOnly ? formData.model : (
              <input 
                value={formData.model} 
                onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              />
            )}
          </div>
          <div className="border-r-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Marca</div>
          <div className="border-r-2 border-[#003366] p-2 text-black font-semibold">
            {isViewOnly ? formData.brand : (
              <input 
                value={formData.brand} 
                onChange={e => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              />
            )}
          </div>
          <div className="border-r-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Serie</div>
          <div className="p-2 text-black font-semibold">
            {isViewOnly ? formData.serial : (
              <input 
                value={formData.serial} 
                onChange={e => setFormData(prev => ({ ...prev, serial: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              />
            )}
          </div>
        </div>
      </div>

        {/* 2. Datos Generales */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">2. DATOS GENERALES</div>
          <div className="grid grid-cols-12 border-2 border-[#003366] mb-4 text-[10px] bg-white rounded-b-lg overflow-visible">
            <div className="col-span-2 border-r-2 border-b-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Invima</div>
          <div className="col-span-4 border-r-2 border-b-2 border-[#003366] p-2 text-black font-semibold">
            {isViewOnly ? formData.invima : (
              <select 
                value={formData.invima} 
                onChange={e => setFormData(prev => ({ ...prev, invima: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              >
                    <option value="">pendiente!...</option>
                    <option value="UNIDAD DE CUIDADOS INTENSIVOS O INTERMEDIOS">UNIDAD DE CUIDADOS INTENSIVOS O INTERMEDIOS</option>
                    <option value="ESTERILIZACION">ESTERILIZACION</option>
                    <option value="LABORATORIO">LABORATORIO</option>
                    <option value="HOSPITALIZACION">HOSPITALIZACION</option>
                    <option value="CONSULTA EXTERNA">CONSULTA EXTERNA</option>
                    <option value="IMAGENES DIAGNOSTICAS">IMAGENES DIAGNOSTICAS</option>
                    <option value="CIRUGIA">CIRUGIA</option>
                </select>
        
            )}
          </div>
          <div className="col-span-2 border-r-2 border-b-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366] text-center">Modo</div>
          <div className="col-span-4 border-b-2 border-[#003366] p-2 flex items-center justify-around font-semibold">
            <label className="flex items-center gap-1 cursor-pointer">
              Móvil <input type="checkbox" disabled={isViewOnly} checked={formData.isMobile} onChange={e => setFormData(prev => ({ ...prev, isMobile: e.target.checked, isFixed: !e.target.checked }))} className="accent-[#003366]" />
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              Fijo <input type="checkbox" disabled={isViewOnly} checked={formData.isFixed} onChange={e => setFormData(prev => ({ ...prev, isFixed: e.target.checked, isMobile: !e.target.checked }))} className="accent-[#003366]" />
            </label>
          </div>
          <div className="col-span-2 border-r-2 border-[#003366] p-2 font-bold uppercase bg-[#f0f7ff] text-[#003366]">Ubicación</div>
          <div className="col-span-10 p-2 text-black font-semibold">
            {isViewOnly ? formData.location : (
              <select 
                value={formData.location} 
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full border-none p-0 focus:ring-0 text-[10px] bg-transparent font-semibold"
              >
                <option value="">Seleccione...</option>
                <option value="UNIDAD DE CUIDADOS INTENSIVOS O INTERMEDIOS">UNIDAD DE CUIDADOS INTENSIVOS O INTERMEDIOS</option>
                <option value="ESTERILIZACION">ESTERILIZACION</option>
                <option value="LABORATORIO">LABORATORIO</option>
                <option value="HOSPITALIZACION">HOSPITALIZACION</option>
                <option value="CONSULTA EXTERNA">CONSULTA EXTERNA</option>
                <option value="IMAGENES DIAGNOSTICAS">IMAGENES DIAGNOSTICAS</option>
                <option value="CIRUGIA">CIRUGIA</option>
              </select>
            )}
          </div>
        </div>
      </div>

        {/* 3. Tipo Mantenimiento */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">3. TIPO DE MANTENIMIENTO</div>
          <div className="grid grid-cols-2 border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            <div className="border-r-2 border-[#003366] p-2 flex flex-col gap-1">
            <div className="font-bold text-center border-b-2 border-[#003366] mb-2 bg-[#f0f7ff] text-[#003366] text-[10px] py-1">MANTENIMIENTO PREVENTIVO</div>
            <div className="flex justify-around font-semibold text-[10px]">
              <label className="flex items-center gap-1 cursor-pointer">
                Plan <input type="checkbox" disabled={isViewOnly} checked={reportType === 'preventive' && formData.maintenanceSubtype === 'plan'} onChange={() => setFormData(prev => ({ ...prev, maintenanceSubtype: 'plan' }))} className="accent-[#003366]" />
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                Revisión <input type="checkbox" disabled={isViewOnly} checked={reportType === 'preventive' && formData.maintenanceSubtype === 'revision'} onChange={() => setFormData(prev => ({ ...prev, maintenanceSubtype: 'revision' }))} className="accent-[#003366]" />
              </label>
            </div>
          </div>
          <div className="p-2 flex flex-col gap-1">
            <div className="font-bold text-center border-b-2 border-[#003366] mb-2 bg-[#f0f7ff] text-[#003366] text-[10px] py-1">MANTENIMIENTO CORRECTIVO</div>
            <div className="flex justify-around font-semibold text-[10px]">
              <label className="flex items-center gap-1 cursor-pointer">
                Reparación <input type="checkbox" disabled={isViewOnly} checked={reportType === 'corrective' && formData.maintenanceSubtype === 'reparacion'} onChange={() => setFormData(prev => ({ ...prev, maintenanceSubtype: 'reparacion' }))} className="accent-[#003366]" />
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                Reposición <input type="checkbox" disabled={isViewOnly} checked={reportType === 'corrective' && formData.maintenanceSubtype === 'reposicion'} onChange={() => setFormData(prev => ({ ...prev, maintenanceSubtype: 'reposicion' }))} className="accent-[#003366]" />
              </label>
            </div>
          </div>
        </div>
      </div>

        {/* 4. Descripcion */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">4. DESCRIPCIÓN DEL REPORTE DE MANTENIMIENTO</div>
          <div className="border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            {isViewOnly ? (
              <div className="p-3 min-h-[60px] text-[10px] text-black font-semibold whitespace-pre-wrap leading-relaxed">
                {formData.description || 'Sin descripción.'}
              </div>
            ) : (
              <textarea 
                value={formData.description} 
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describa el reporte de mantenimiento..."
                className="w-full border-none p-3 text-[10px] focus:ring-0 min-h-[60px] resize-none text-black font-semibold"
              />
            )}
          </div>
        </div>

        {/* 5. Diagnostico Tecnico */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">5. DIAGNÓSTICO TÉCNICO</div>
          <div className="border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            {isViewOnly ? (
              <div className="p-3 min-h-[60px] text-[10px] text-black font-semibold whitespace-pre-wrap leading-relaxed">
                {formData.technicalDiagnosis || 'Sin diagnóstico técnico.'}
              </div>
            ) : (
              <textarea 
                value={formData.technicalDiagnosis} 
                onChange={e => setFormData(prev => ({ ...prev, technicalDiagnosis: e.target.value }))}
                placeholder="Describa el diagnóstico técnico..."
                className="w-full border-none p-3 text-[10px] focus:ring-0 min-h-[60px] resize-none text-black font-semibold"
              />
            )}
          </div>
        </div>

        {/* 6. Trabajo Realizado */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">6. TRABAJO REALIZADO</div>
          <div className="border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            {isViewOnly ? (
              <div className="p-3 min-h-[80px] text-[10px] text-black font-semibold whitespace-pre-wrap leading-relaxed">
                {formData.workPerformed || 'Sin trabajo realizado.'}
              </div>
            ) : (
              <textarea 
                value={formData.workPerformed} 
                onChange={e => setFormData(prev => ({ ...prev, workPerformed: e.target.value }))}
                placeholder="Describa detalladamente el trabajo realizado..."
                className="w-full border-none p-3 text-[10px] focus:ring-0 min-h-[80px] resize-none text-black font-semibold"
              />
            )}
          </div>
        </div>

        {/* 7. Repuestos */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg flex justify-between items-center px-4 text-[11px]">
            <span>7. REPUESTOS UTILIZADOS</span>
            {!isViewOnly && <button onClick={addSparePart} className="bg-white text-[#003366] rounded-full p-0.5 hover:bg-gray-100"><Plus size={10} /></button>}
          </div>
          <div className="border-2 border-[#003366] mb-4 overflow-visible rounded-b-lg bg-white">
            <table className="w-full text-center border-collapse">
              <thead className="bg-[#f0f7ff] font-bold uppercase text-[9px] text-[#003366]">
                <tr className="border-b-2 border-[#003366]">
                  <th className="border-r-2 border-[#003366] p-1.5">Descripción</th>
                  <th className="border-r-2 border-[#003366] p-1.5">Cant</th>
                  <th className="border-r-2 border-[#003366] p-1.5">Proveedor</th>
                  <th className="border-r-2 border-[#003366] p-1.5">Serie/Parte</th>
                  <th className="border-r-2 border-[#003366] p-1.5">Referencia</th>
                  <th className="p-1.5">Valor</th>
                  {!isViewOnly && <th className="p-1.5 print:hidden"></th>}
                </tr>
              </thead>
              <tbody className="text-[9px] text-black font-semibold">
                {formData.spareParts?.map((part, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                    <td className="border-r-2 border-[#003366] p-1 text-left">
                      {isViewOnly ? part.description : <input value={part.description} onChange={e => updateSparePart(idx, 'description', e.target.value)} className="w-full border-none p-0 text-[9px] focus:ring-0 font-semibold" />}
                    </td>
                    <td className="border-r-2 border-[#003366] p-1">
                      {isViewOnly ? part.quantity : <input type="number" value={part.quantity} onChange={e => updateSparePart(idx, 'quantity', parseInt(e.target.value))} className="w-full border-none p-0 text-[9px] focus:ring-0 text-center font-semibold" />}
                    </td>
                    <td className="border-r-2 border-[#003366] p-1">
                      {isViewOnly ? part.provider : <input value={part.provider} onChange={e => updateSparePart(idx, 'provider', e.target.value)} className="w-full border-none p-0 text-[9px] focus:ring-0 font-semibold" />}
                    </td>
                    <td className="border-r-2 border-[#003366] p-1">
                      {isViewOnly ? part.partNumber : <input value={part.partNumber} onChange={e => updateSparePart(idx, 'partNumber', e.target.value)} className="w-full border-none p-0 text-[9px] focus:ring-0 font-semibold" />}
                    </td>
                    <td className="border-r-2 border-[#003366] p-1">
                      {isViewOnly ? part.reference : <input value={part.reference} onChange={e => updateSparePart(idx, 'reference', e.target.value)} className="w-full border-none p-0 text-[9px] focus:ring-0 font-semibold" />}
                    </td>
                    <td className="border-r-2 border-[#003366] p-1">
                      {isViewOnly ? part.value : <input value={part.value} onChange={e => updateSparePart(idx, 'value', e.target.value)} className="w-full border-none p-0 text-[9px] focus:ring-0 font-semibold" />}
                    </td>
                    {!isViewOnly && <td className="p-1 print:hidden"><button onClick={() => removeSparePart(idx)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 size={10} /></button></td>}
                  </tr>
                ))}
                {(!formData.spareParts || formData.spareParts.length === 0) && (
                  <tr>
                    <td colSpan={isViewOnly ? 6 : 7} className="p-3 text-gray-500 italic text-[10px]">No se utilizaron repuestos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. Verificacion */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">8. VERIFICACIÓN DE FUNCIONAMIENTO Y ESTADO</div>
          <div className="grid grid-cols-2 gap-x-2 mb-4">
            <div className="flex flex-col border-2 border-[#003366] rounded-b-lg overflow-visible bg-white">
              {[
                { key: 'funcionamientoGeneral', label: 'Verificación de Funcionamiento General' },
                { key: 'parametros', label: 'Verificación de los Parámetros' },
                { key: 'perillaBotones', label: 'Verificación de la Perilla y Botones' },
                { key: 'panelTacto', label: 'Panel Táctil' },
              ].map(item => (
                <div key={item.key} className="grid grid-cols-12 border-b border-[#003366] last:border-b-0">
                  <div className="col-span-8 p-1.5 uppercase text-[9px] font-bold bg-[#f0f7ff] text-[#003366] flex items-center">{item.label}</div>
                  <div className="col-span-2 border-l-2 border-[#003366] p-1 flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-black">CU</span>
                    <input type="checkbox" disabled={isViewOnly} checked={formData.verification?.[item.key as keyof VerificationState]?.status === 'CU'} onChange={() => toggleVerification(item.key as keyof VerificationState, 'CU')} className="accent-[#003366]" />
                  </div>
                  <div className="col-span-2 border-l-2 border-[#003366] p-1 flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-black">NC</span>
                    <input type="checkbox" disabled={isViewOnly} checked={formData.verification?.[item.key as keyof VerificationState]?.status === 'NC'} onChange={() => toggleVerification(item.key as keyof VerificationState, 'NC')} className="accent-[#003366]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col border-2 border-[#003366] rounded-b-lg overflow-visible bg-white">
              {[
                { key: 'accesorios', label: 'Verificación de los Accesorios' },
                { key: 'bateria', label: 'Verificación de la Batería' },
                { key: 'estadoFisico', label: 'Estado Físico del Equipo' },
                { key: 'limpieza', label: 'Limpieza y Desinfección' },
              ].map(item => (
                <div key={item.key} className="grid grid-cols-12 border-b border-[#003366] last:border-b-0">
                  <div className="col-span-8 p-1.5 uppercase text-[9px] font-bold bg-[#f0f7ff] text-[#003366] flex items-center">{item.label}</div>
                  <div className="col-span-2 border-l-2 border-[#003366] p-1 flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-black">CU</span>
                    <input type="checkbox" disabled={isViewOnly} checked={formData.verification?.[item.key as keyof VerificationState]?.status === 'CU'} onChange={() => toggleVerification(item.key as keyof VerificationState, 'CU')} className="accent-[#003366]" />
                  </div>
                  <div className="col-span-2 border-l-2 border-[#003366] p-1 flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-black">NC</span>
                    <input type="checkbox" disabled={isViewOnly} checked={formData.verification?.[item.key as keyof VerificationState]?.status === 'NC'} onChange={() => toggleVerification(item.key as keyof VerificationState, 'NC')} className="accent-[#003366]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 9. Diagnostico Final */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">9. DIAGNÓSTICO FINAL</div>
          <div className="border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            {isViewOnly ? (
              <div className="p-3 min-h-[50px] text-[10px] text-black font-semibold whitespace-pre-wrap leading-relaxed">
                {formData.finalDiagnosis || 'Sin diagnóstico final.'}
              </div>
            ) : (
              <textarea 
                value={formData.finalDiagnosis} 
                onChange={e => setFormData(prev => ({ ...prev, finalDiagnosis: e.target.value }))}
                placeholder="Describa el diagnóstico final..."
                className="w-full border-none p-3 text-[10px] focus:ring-0 min-h-[50px] resize-none text-black font-semibold"
              />
            )}
          </div>
        </div>

        {/* 10. Estado Equipo */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">10. ESTADO DEL EQUIPO</div>
          <div className="grid grid-cols-3 border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            <div className="p-2 flex items-center justify-center gap-2 font-bold bg-[#f0f7ff] text-[#003366] border-r-2 border-[#003366] text-[10px]">
              OPERATIVO <input type="checkbox" disabled={isViewOnly} checked={formData.finalStatus === 'operativo'} onChange={() => setFormData(prev => ({ ...prev, finalStatus: 'operativo' }))} className="accent-[#003366]" />
            </div>
            <div className="p-2 flex items-center justify-center gap-2 font-bold bg-[#f0f7ff] text-[#003366] border-r-2 border-[#003366] text-[10px]">
              NO OPERATIVO <input type="checkbox" disabled={isViewOnly} checked={formData.finalStatus === 'no-operativo'} onChange={() => setFormData(prev => ({ ...prev, finalStatus: 'no-operativo' }))} className="accent-[#003366]" />
            </div>
            <div className="p-2 flex items-center justify-center gap-2 font-bold bg-[#f0f7ff] text-[#003366] text-[10px]">
              DAR DE BAJA <input type="checkbox" disabled={isViewOnly} checked={formData.finalStatus === 'dar-de-baja'} onChange={() => setFormData(prev => ({ ...prev, finalStatus: 'dar-de-baja' }))} className="accent-[#003366]" />
            </div>
          </div>
        </div>

        {/* 11. Observaciones */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">11. OBSERVACIONES</div>
          <div className="border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            {isViewOnly ? (
              <div className="p-3 min-h-[50px] text-[10px] text-black font-semibold whitespace-pre-wrap leading-relaxed">
                {formData.observations || 'Sin observaciones.'}
              </div>
            ) : (
              <textarea 
                value={formData.observations} 
                onChange={e => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Observaciones adicionales..."
                className="w-full border-none p-3 text-[10px] focus:ring-0 min-h-[50px] resize-none text-black font-semibold"
              />
            )}
          </div>
        </div>

        {/* 12. Entrega */}
        <div className="report-section">
          <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">12. ENTREGA DEL EQUIPO</div>
          <div className="grid grid-cols-2 border-2 border-[#003366] mb-4 bg-white rounded-b-lg overflow-visible">
            <div className="border-r-2 border-[#003366] flex flex-col">
              <div className="h-24 flex items-center justify-center border-b-2 border-[#003366] p-2 bg-white">
                {formData.delivery?.senderSignature ? (
                  <img src={formData.delivery.senderSignature} alt="Firma" className="max-h-full" />
                ) : (
                  <img 
                    src="/firma.png" 
                    alt="Firma" 
                    className="max-h-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://picsum.photos/seed/sig-camilo/200/80";
                      target.classList.add('grayscale');
                    }}
                  />
                )}
              </div>
              <div className="grid grid-cols-12 text-[10px] font-bold border-b-2 border-[#003366]">
                <div className="col-span-3 border-r-2 border-[#003366] p-1.5 bg-[#f0f7ff] text-[#003366] uppercase">Nombre</div>
                <div className="col-span-9 p-1.5 text-black font-bold uppercase">{formData.delivery?.senderName}</div>
              </div>
              <div className="grid grid-cols-12 text-[10px] font-bold">
                <div className="col-span-3 border-r-2 border-[#003366] p-1.5 bg-[#f0f7ff] text-[#003366] uppercase">Cargo</div>
                <div className="col-span-9 p-1.5 text-black font-bold uppercase">{formData.delivery?.senderRole}</div>
              </div>
              <div className="p-1.5 text-center font-bold uppercase bg-[#e6f2ff] text-[#003366] border-t-2 border-[#003366] text-[10px]">QUIEN ENTREGA</div>
            </div>
            <div className="flex flex-col">
              <div className="h-24 flex items-center justify-center border-b-2 border-[#003366] p-2 bg-white">
                {formData.delivery?.receiverSignature ? (
                  <img src={formData.delivery.receiverSignature} alt="Firma Recibe" className="max-h-full" />
                ) : (
                  <div className="text-gray-400 italic text-[10px]">Firma pendiente</div>
                )}
              </div>
              <div className="grid grid-cols-12 text-[10px] font-bold border-b-2 border-[#003366]">
                <div className="col-span-3 border-r-2 border-[#003366] p-1.5 bg-[#f0f7ff] text-[#003366] uppercase">Nombre</div>
                <div className="col-span-9 p-1.5">
                  {isViewOnly ? <span className="uppercase text-black font-bold">{formData.delivery?.receiverName}</span> : (
                    <input 
                      placeholder="Nombre de quien recibe" 
                      value={formData.delivery?.receiverName} 
                      onChange={e => setFormData(prev => ({ ...prev, delivery: { ...prev.delivery!, receiverName: e.target.value } }))}
                      className="w-full border-none p-0 focus:ring-0 text-[10px] uppercase text-black font-bold"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-12 text-[10px] font-bold">
                <div className="col-span-3 border-r-2 border-[#003366] p-1.5 bg-[#f0f7ff] text-[#003366] uppercase">Cargo</div>
                <div className="col-span-9 p-1.5">
                  {isViewOnly ? <span className="uppercase text-black font-bold">{formData.delivery?.receiverRole}</span> : (
                    <input 
                      placeholder="Cargo de quien recibe" 
                      value={formData.delivery?.receiverRole} 
                      onChange={e => setFormData(prev => ({ ...prev, delivery: { ...prev.delivery!, receiverRole: e.target.value } }))}
                      className="w-full border-none p-0 focus:ring-0 text-[10px] uppercase text-black font-bold"
                    />
                  )}
                </div>
              </div>
              <div className="p-1.5 text-center font-bold uppercase bg-[#e6f2ff] text-[#003366] border-t-2 border-[#003366] text-[10px]">QUIEN RECIBE</div>
            </div>
          </div>
        </div>

        {/* Photos Section */}
        {formData.photos && formData.photos.length > 0 && (
          <div className="mt-2">
            <div className="bg-[#003366] text-white border-2 border-[#003366] p-1.5 font-bold text-center uppercase mb-0 rounded-t-lg text-[11px]">REGISTRO FOTOGRÁFICO</div>
            <div className="grid grid-cols-2 gap-3 border-2 border-[#003366] p-3 bg-white rounded-b-lg overflow-visible">
              {formData.photos.map((photo, i) => (
                <div key={i} className="photo-item border-2 border-[#f0f7ff] p-1 flex items-center justify-center bg-white rounded shadow-sm">
                  <img src={photo} alt={`Foto ${i+1}`} className="max-w-full max-h-48 object-contain" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center font-bold text-[9px] mt-4 uppercase text-gray-500 tracking-widest">Copia Controlada</div>
      </div>

      {/* Interactive Controls (Hidden in PDF and in View Only Mode) */}
      {!isViewOnly && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-lg font-bold">Acciones Adicionales</h3>
            <button
              onClick={handleImproveAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
            >
              <Wand2 size={16} /> {loading ? 'Mejorando...' : 'Mejorar toda la redacción con IA'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-sm uppercase text-gray-500">Firmas y Entrega</h4>
              <SignaturePad 
                label="Firma de quien recibe" 
                onSave={(sig) => setFormData(prev => ({ ...prev, delivery: { ...prev.delivery!, receiverSignature: sig } }))} 
              />
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="font-bold text-sm uppercase text-gray-500">Registro Fotográfico</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                <Camera size={32} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Subir fotos del mantenimiento</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {formData.photos?.map((photo, i) => (
                  <div key={i} className="relative group aspect-square border rounded overflow-hidden">
                    <img src={photo} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, idx) => idx !== i) }))}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
