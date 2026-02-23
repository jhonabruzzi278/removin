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
    id: 'fottoai-remove-bg-2',
    name: 'Fotto AI Remove BG 2.0',
    owner: 'fottoai',
    description: 'Modelo avanzado con mejor detección de bordes. Ideal para retratos.',
    category: 'background-removal',
    version: 'd748bcc6882e5567ffe1468356323e6345736494dd9b827ff2871a68fca79be5',
    costPerRun: 0.0008,
    avgTime: 3,
    quality: 'high',
    status: 'active',
    features: ['Retratos', 'Bordes suaves', 'Alta precisión', 'Rápido'],
    maxResolution: '4096x4096'
  },
  {
    id: 'merahburam-remove-bg',
    name: 'ISNet General Use',
    owner: 'merahburam',
    description: 'Modelo versátil con múltiples modos. Excelente para objetos complejos.',
    category: 'background-removal',
    version: '8a2d643b0f842f67fa37c5f6b40601d4c45a9f0e8f47e9f254f11a6586d9af23',
    costPerRun: 0.0009,
    avgTime: 4,
    quality: 'high',
    status: 'active',
    features: ['Objetos complejos', 'Múltiples modos', 'Configurable', 'Precisión'],
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
  },
  {
    id: 'nightmareai-real-esrgan',
    name: 'Real-ESRGAN Upscaler',
    owner: 'nightmareai',
    description: 'Aumenta la resolución de imágenes hasta 4x sin perder calidad. Perfecto para ampliar fotos.',
    category: 'upscaling',
    version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
    costPerRun: 0.0055,
    avgTime: 8,
    quality: 'ultra',
    status: 'active',
    features: ['4x upscaling', 'Restauración de detalles', 'Anti-aliasing', 'Face enhancement'],
    maxResolution: '8192x8192'
  },
  {
    id: 'stability-ai-sdxl',
    name: 'Stable Diffusion XL',
    owner: 'stability-ai',
    description: 'Genera imágenes de alta calidad a partir de texto. Ideal para contenido creativo.',
    category: 'image-generation',
    version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    costPerRun: 0.0095,
    avgTime: 12,
    quality: 'ultra',
    status: 'active',
    features: ['1024x1024', 'Estilo artístico', 'Control de composición', 'Prompts avanzados'],
    maxResolution: '1024x1024'
  },
  {
    id: 'tencentarc-gfpgan',
    name: 'GFP-GAN Face Restore',
    owner: 'tencentarc',
    description: 'Restaura rostros en fotos antiguas o de baja calidad. Recupera detalles faciales.',
    category: 'restoration',
    version: '9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3',
    costPerRun: 0.0023,
    avgTime: 5,
    quality: 'high',
    status: 'beta',
    features: ['Restauración facial', 'Mejora de textura', 'Color correction', 'Fotos antiguas'],
    maxResolution: '2048x2048'
  },
  {
    id: 'rosebud-ai-styleganv2',
    name: 'StyleGAN Transfer',
    owner: 'rosebud-ai',
    description: 'Transfiere estilos artísticos a tus imágenes. Convierte fotos en arte.',
    category: 'style-transfer',
    version: 'c4a5f5e2c3fe45d78c5f78c4fe632f1bd5a7c8d3e2f5c7d8e3f7c9d5e2f8c7d3',
    costPerRun: 0.0045,
    avgTime: 7,
    quality: 'high',
    status: 'premium',
    features: ['Estilos variados', 'Control de intensidad', 'Preserva contenido', 'Alta resolución'],
    maxResolution: '1024x1024'
  }
];

export type ModelCategory = AIModel['category'];

export const categoryLabels: Record<ModelCategory, string> = {
  'background-removal': 'Remover Fondo',
  'upscaling': 'Aumentar Resolución',
  'style-transfer': 'Transferencia de Estilo',
  'image-generation': 'Generar Imágenes',
  'restoration': 'Restauración'
};

export const categoryColors: Record<ModelCategory, { bg: string; text: string; border: string }> = {
  'background-removal': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'upscaling': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'style-transfer': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  'image-generation': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  'restoration': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' }
};
