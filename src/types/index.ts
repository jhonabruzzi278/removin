
export interface LocalImage {
  id: string;        // ID único temporal
  file: File;        // El archivo raw
  preview: string;   // URL.createObjectURL para mostrarla
  status: 'pending' | 'processing' | 'success' | 'error';
}