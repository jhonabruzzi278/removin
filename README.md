# Removin 🎨

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)

Plataforma SaaS de automatización de procesamiento de imágenes con IA.

## 🚀 Características

- **Remover Fondo**: Elimina fondos de imágenes usando IA (Replicate)
- **Generar Imágenes**: Crea imágenes con Stable Diffusion XL
- **Procesamiento por Lotes**: Procesa hasta 20 imágenes simultáneamente
- **Auto Monitor**: Vigila carpetas y procesa automáticamente
- **Comprimir Imágenes**: Reduce tamaño sin perder calidad
- **Comparar Modelos**: Compara resultados de diferentes modelos IA
- **Autenticación Google**: Login seguro con OAuth

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS 4
- **Backend**: Node.js + Express 4.18
- **Base de Datos**: Firebase Auth + Storage
- **IA**: Replicate API
- **UI Components**: Radix UI + shadcn/ui

## 📋 Requisitos

- Node.js 18+ y npm
- Cuenta de Firebase (gratuita)
- Token de Replicate API

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd removin
```

### 2. Instalar dependencias

```bash
# Frontend
npm install

# Backend
cd api
npm install
cd ..
```

### 3. Configurar Firebase

#### Crear proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. En "Authentication", habilita el proveedor de Google
4. En "Storage", crea un bucket predeterminado
5. En "Project Settings > General", añade una Web App (ícono `</>`)
6. Copia la configuración que aparece

### 4. Configurar variables de entorno

#### Frontend (.env)
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id

# Backend API URL
VITE_API_URL=http://localhost:3001
```

#### Backend (api/.env)
```env
PORT=3001
REPLICATE_API_TOKEN=tu_token_replicate
NODE_ENV=development
```

### 5. Iniciar servidores

```bash
# Terminal 1: Backend
cd api
node server.js

# Terminal 2: Frontend
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## 📦 Scripts Disponibles

```bash
npm run dev              # Inicia servidor de desarrollo
npm run build            # Compila para producción
npm run preview          # Preview del build
npm run lint             # Ejecuta ESLint
```

## 🏗️ Estructura del Proyecto

```
removin/
├── api/                   # Backend Express
│   ├── server.js         # Servidor principal
│   ├── .env             # Variables backend
│   └── package.json
├── src/
│   ├── components/
│   │   ├── auth/        # Autenticación
│   │   ├── layout/      # Layout y sidebar
│   │   └── ui/          # Componentes UI
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Firebase y utilidades
│   ├── pages/           # Páginas principales
│   ├── types/           # TypeScript types
│   └── data/            # Modelos IA
└── public/              # Assets estáticos
```

## 🔐 Seguridad

- JWT authentication con Firebase Auth
- Storage rules configuradas en Firebase
- Validación de URLs en backend
- CORS restrictivo para producción

## 🚀 Despliegue

### Frontend (Vercel)

```bash
npm run build
vercel --prod
```

Variables de entorno necesarias en Vercel:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL`

### Backend (Railway/Render)

```bash
cd api
npm install
node server.js
```

Variables de entorno necesarias:
- `PORT`
- `REPLICATE_API_TOKEN`
- `NODE_ENV=production`

## 📝 Características Futuras

- [ ] Sistema de suscripciones (planes Pro)
- [ ] Historial completo con Firestore
- [ ] Integración con Google Drive/Dropbox
- [ ] API pública para desarrolladores
- [ ] Webhooks para automatización

## 🐛 Solución de Problemas

### Backend no inicia

```bash
cd api
npm install
node server.js
```

### Error 401 en API

Verifica que el token JWT se esté pasando correctamente en las headers.

### Error 429 (Too Many Requests)

El sistema tiene rate limiting. Espera unos segundos entre peticiones.

### El login no funciona

Asegúrate de haber habilitado el proveedor de Google en Firebase Authentication y configurado correctamente las variables de entorno.

## 📄 Licencia

MIT

---

**⚠️ Nota**: Recuerda mantener tus credenciales de Firebase seguras y no compartirlas públicamente.
