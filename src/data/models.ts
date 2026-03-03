export interface AIModel {
  id: string;
  name: string;
  owner: string;
  description: string;
  category: 'background-removal' | 'upscaling' | 'style-transfer' | 'image-generation' | 'restoration';
  version: string;
  costPerRun: number; // en USD
  avgTime: number; // en segundos
  quality: 'standard' | 'high' | 'ultra';
  status: 'active' | 'beta' | 'premium';
  imageExample?: string;
  features: string[];
  maxResolution?: string;
}

export const availableModels: AIModel[] = [
  {
    id: 'cjwbw-rembg',
    name: 'RMBG Fast (Económico)',
    owner: 'cjwbw',
    description: 'Modelo rápido y económico para remover fondos. Buena opción para volúmenes grandes.',
    category: 'background-removal',
    version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
    costPerRun: 0.0002,
    avgTime: 3,
    quality: 'standard',
    status: 'active',
    features: ['Rápido', 'Económico', 'Batch support', 'Multi-formato'],
    maxResolution: '2048x2048'
  },
  {
    id: 'lucataco-remove-bg',
    name: 'Remove Background (Estándar)',
    owner: 'lucataco',
    description: 'Elimina fondos con alta precisión. Balance perfecto entre calidad y precio.',
    category: 'background-removal',
    version: '95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1',
    costPerRun: 0.00025,
    avgTime: 2,
    quality: 'high',
    status: 'active',
    features: ['Bordes limpios', 'Cabello detallado', 'Transparencia perfecta', 'Rápido'],
    maxResolution: '4096x4096'
  },
  {
    id: 'smoretalk-rembg-enhance',
    name: 'RMBG Enhanced (Premium)',
    owner: 'smoretalk',
    description: '🌟 Modelo PREMIUM con la máxima precisión. Ideal para imágenes complejas, cabello fino y transparencias.',
    category: 'background-removal',
    version: '4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919',
    costPerRun: 0.0012,
    avgTime: 4,
    quality: 'ultra',
    status: 'premium',
    features: ['Máxima precisión', 'Cabello fino', 'Bordes perfectos', 'Objetos complejos', 'Transparencias'],
    maxResolution: '8192x8192'
  }
];


