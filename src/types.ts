export type MaintenanceType = 'preventive' | 'corrective';

export interface SparePart {
  description: string;
  quantity: number;
  provider: string;
  partNumber: string;
  reference: string;
  value: string;
}

export interface VerificationItem {
  status: 'CU' | 'NC' | null;
}

export interface VerificationState {
  funcionamientoGeneral: VerificationItem;
  parametros: VerificationItem;
  perillaBotones: VerificationItem;
  panelTacto: VerificationItem;
  accesorios: VerificationItem;
  bateria: VerificationItem;
  estadoFisico: VerificationItem;
  limpieza: VerificationItem;
}

export interface Report {
  id?: string;
  reportNumber: string;
  type: MaintenanceType;
  dateReceived: string;
  dateService: string;
  responsible: string;
  equipment: string;
  model: string;
  brand: string;
  serial: string;
  invima: string;
  location: string;
  mode: string;
  isMobile: boolean;
  isFixed: boolean;
  maintenanceSubtype: string;
  description: string;
  technicalDiagnosis: string;
  workPerformed: string;
  spareParts: SparePart[];
  verification: VerificationState;
  finalDiagnosis: string;
  finalStatus: 'operativo' | 'no-operativo' | 'dar-de-baja' | null;
  observations: string;
  delivery: {
    senderName: string;
    senderRole: string;
    senderSignature: string;
    receiverName: string;
    receiverRole: string;
    receiverSignature: string;
  };
  photos: string[];
  createdAt: string;
  updatedAt?: string;
}
