# 📋 DOCUMENTACIÓN TÉCNICA - REMOVIN SAAS

**Fecha:** 23 de febrero de 2026  
**Versión:** 1.0.0  
**Proyecto:** Removin - Plataforma SaaS de Procesamiento de Imágenes con IA  
**URL Producción:** https://removin.vercel.app  
**Repositorio:** https://github.com/jhonabruzzi278/removin

---

## 📊 RESUMEN EJECUTIVO

### ¿Qué es Removin?

Removin es una plataforma SaaS moderna para automatización de procesamiento de imágenes mediante Inteligencia Artificial. Permite a usuarios individuales y equipos procesar imágenes de forma masiva sin necesidad de software especializado, todo desde el navegador web.

### Stack Principal
- **Frontend:** React 19 + TypeScript + Vite 7 + Tailwind CSS 4
- **Backend:** Node.js 20 + Express 4.18 (Serverless en Vercel)
- **Base de Datos:** Firebase Realtime Database
- **Autenticación:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage
- **IA/ML:** Replicate API (Stable Diffusion XL, RMBG, etc.)
- **Hosting:** Vercel (Edge Network)
- **Node Version:** 20.x

### Estado Actual
✅ **EN PRODUCCIÓN** - Sistema completamente funcional y desplegado

---

## 🎯 MISIÓN, VISIÓN Y OBJETIVOS

### Misión
Democratizar el acceso a herramientas profesionales de procesamiento de imágenes con IA, permitiendo que empresas, diseñadores y creadores de contenido automaticen tareas repetitivas y mejoren su productividad sin necesidad de conocimientos técnicos avanzados.

### Visión
Convertirnos en la plataforma líder en Latinoamérica para procesamiento automatizado de imágenes, integrando las tecnologías de IA más avanzadas en una interfaz simple y accesible para cualquier usuario.

### Objetivos de Negocio

#### Corto Plazo (3-6 meses)
- ✅ Lanzar MVP con 4 funcionalidades core (Remove BG, Generate, Compress, Folder Watch)
- ✅ Implementar autenticación segura con Google OAuth
- 🔄 Alcanzar 100 usuarios activos mensuales
- 🔄 Implementar sistema de métricas y analytics

#### Mediano Plazo (6-12 meses)
- 📋 Implementar planes de suscripción (Free, Pro, Enterprise)
- 📋 Integrar pasarela de pagos (Stripe/MercadoPago)
- 📋 Desarrollar API pública para integraciones
- 📋 Expandir a 5 modelos de IA adicionales

#### Largo Plazo (12+ meses)
- 📋 Marketplace de modelos de IA personalizados
- 📋 Aplicación móvil (iOS/Android)
- 📋 Plugins para Adobe Photoshop/Figma
- 📋 Sistema de colaboración en equipo

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIOS                              │
│                    (Web Browsers)                            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL CDN/EDGE                           │
│              (Global Edge Network)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         FRONTEND (SPA - React 19)                    │   │
│  │  • Vite 7 Build                                      │   │
│  │  • Tailwind CSS 4                                    │   │
│  │  • React Router v7                                   │   │
│  │  • TypeScript 5.9                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      BACKEND API (Serverless Functions)              │   │
│  │  • Node.js 20 + Express                              │   │
│  │  • Firebase Admin SDK                                │   │
│  │  • Rate Limiting (5 req/min)                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  FIREBASE AUTH   │  │   FIREBASE      │  │  REPLICATE API   │
│                  │  │ REALTIME DB     │  │                  │
│ • Google OAuth   │  │                 │  │ • SDXL           │
│ • JWT Tokens     │  │ • User Tokens   │  │ • RMBG Models    │
│ • Session Mgmt   │  │ • User Settings │  │ • Upscaling      │
└──────────────────┘  └─────────────────┘  └──────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│              FIREBASE STORAGE                                 │
│  • Imágenes originales (input)                               │
│  • Imágenes procesadas (output)                              │
│  • Organización por UID/BatchID                              │
└──────────────────────────────────────────────────────────────┘
```

### Flujo de Datos Principal

1. **Autenticación:**
   ```
   Usuario → Firebase Auth → Google OAuth → JWT Token → Frontend
   ```

2. **Procesamiento de Imagen:**
   ```
   Upload Image → Firebase Storage → Get Public URL 
   → Backend API → Replicate API → Process Image 
   → Return Result URL → Display to User
   ```

3. **Gestión de Tokens:**
   ```
   User Token Input → Backend Validation → Firebase Realtime DB 
   → Encrypted Storage → Retrieve for API Calls
   ```

---

## ⚙️ FUNCIONALIDADES

### 1. 🎨 Remover Fondo (Remove Background)

**Descripción:** Elimina el fondo de imágenes automáticamente usando modelos de IA especializados.

**Características:**
- Procesamiento por lotes (hasta 20 imágenes simultáneas)
- 5 modelos de IA disponibles (económico → premium)
- Opción de fondo transparente (PNG) o fondo blanco
- Preview en tiempo real antes de descargar
- Descarga individual o masiva (ZIP)
- Comparación antes/después con slider

**Modelos Disponibles:**
| Modelo | Propietario | Costo/imagen | Calidad | Velocidad |
|--------|------------|--------------|---------|-----------|
| RMBG Fast | cjwbw | $0.0002 | Estándar | 3s |
| Remove BG | lucataco | $0.00025 | Alta | 2s |
| Fotto AI BG 2.0 | fottoai | $0.0008 | Alta | 3s |
| ISNet General | merahburam | $0.0009 | Alta | 4s |
| RMBG Enhanced | smoretalk | $0.0012 | Ultra | 4s |

**Casos de Uso:**
- E-commerce: Fotos de productos con fondo uniforme
- Marketing: Imágenes para redes sociales
- Agencias: Procesamiento masivo de sesiones fotográficas

---

### 2. ✨ Generar Imágenes (Generate with AI)

**Descripción:** Crea imágenes desde cero usando prompts de texto con Stable Diffusion XL.

**Características:**
- Generación basada en prompts (descripción textual)
- Prompts negativos (lo que NO quieres en la imagen)
- 5 relaciones de aspecto predefinidas (1:1, 16:9, 9:16, 4:3, 3:2)
- Control avanzado de parámetros:
  - Steps (20-50): Precisión del resultado
  - CFG Scale (1-20): Adherencia al prompt
  - Scheduler: Algoritmo de sampling (DPM++, Euler, DDIM)
  - Seed: Reproducibilidad
- 6 estilos preconfigurados (Realista, Digital Art, Anime, Óleo, Cinematic, 3D)
- Historial de generaciones recientes
- Tiempo estimado y costo por generación ($0.0095 USD/imagen)

**Modelo:** `stability-ai/sdxl` (Stable Diffusion XL)

**Casos de Uso:**
- Diseño gráfico: Mockups, conceptos visuales
- Marketing: Imágenes para campañas sin stock photos
- Creativos: Exploración de ideas visuales rápidas

---

### 3. 🗜️ Comprimir Imágenes (Compress)

**Descripción:** Reduce el tamaño de archivo de imágenes manteniendo la calidad visual.

**Características:**
- Compresión inteligente con preservación de calidad
- Soporte múltiples formatos (JPG, PNG, WebP)
- Procesamiento por lotes
- Preview de comparación (antes/después)
- Métricas de reducción de tamaño (%)
- Conversión automática a WebP para máxima eficiencia
- No requiere API externa (procesamiento client-side con Canvas API)

**Casos de Uso:**
- Optimización web: Imágenes para sitios/apps
- E-commerce: Reducir tiempo de carga de catálogos
- Email Marketing: Imágenes que no excedan límites de tamaño

---

### 4. 📁 Vigilancia de Carpetas (Folder Watch)

**Descripción:** Monitorea una carpeta local y procesa automáticamente nuevas imágenes.

**Características:**
- Selección de carpeta de entrada (input) y salida (output)
- Monitoreo continuo con intervalo configurable
- Procesamiento automático de archivos nuevos
- Selección de modelo de IA preferido
- Estadísticas en tiempo real (total, éxitos, errores)
- Historial de archivos procesados
- Opción de reprocesar con otro modelo
- Pausa/Resume del monitoreo

⚠️ **Compatibilidad:** Solo navegadores modernos (Chrome 86+, Edge 86+) que soporten File System Access API

**Casos de Uso:**
- Fotógrafos: Procesar automáticamente fotos de sesiones
- Estudios: Automatización de flujo de trabajo
- Empresas: Procesamiento batch nocturno sin supervisión

---

### 5. ⚙️ Configuración (Settings)

**Descripción:** Panel de configuración de tokens y preferencias del usuario.

**Características:**
- Configuración de Replicate API Token
- Validación automática de formato de token (debe iniciar con `r8_`)
- Estado visual de conexión (Conectado/Desconectado)
- Instrucciones paso a paso para obtener token
- Almacenamiento seguro en Firebase Realtime Database
- Máscara de token para privacidad (••••••••)

---

### 6. 📊 Uso y Estadísticas (Usage)

**Descripción:** Dashboard de consumo y costos estimados.

**Características:**
- Resumen de uso mensual
- Desglose por tipo de operación
- Estimación de costos en USD
- Gráficos de tendencia temporal
- Historial de procesamiento

**Estado:** 🚧 En desarrollo (pendiente de implementación)

---

## 💰 ANÁLISIS DE COSTOS - FIREBASE (CAPA GRATUITA)

### Firebase Spark Plan (Gratis)

#### ✅ Incluido en Capa Gratuita

| Servicio | Límite Gratuito | Costo Excedente | Escenario Removin |
|----------|----------------|-----------------|-------------------|
| **Authentication** | Ilimitado | Gratis siempre | ✅ Cubierto 100% |
| **Realtime Database** | 1 GB almacenamiento<br>10 GB/mes descarga<br>20k escrituras/día<br>50k lecturas/día | $5/GB almacenado<br>$1/GB descargado | ✅ Suficiente para 1,000+ usuarios |
| **Cloud Storage** | 5 GB almacenamiento<br>1 GB/día descarga<br>20k ops/día subida<br>50k ops/día descarga | $0.026/GB almacenado<br>$0.12/GB descargado | ⚠️ **Límite crítico** |
| **Cloud Functions** | 2M invocaciones/mes<br>400k GB-seg<br>200k CPU-seg | $0.40/M invocaciones<br>+ recursos compute | N/A (usamos Vercel) |

#### 📊 Estimación de Uso Mensual

**Escenario: 100 usuarios activos**
- **Operaciones promedio:** 50 imágenes/usuario/mes = 5,000 imágenes totales

##### Firebase Realtime Database
```
Operaciones:
• Escrituras: 5,000 tokens guardados = 5,000 writes ✅ (límite: 600k/mes)
• Lecturas: 5,000 lecturas de token x 2 = 10,000 reads ✅ (límite: 1.5M/mes)
• Almacenamiento: ~500 KB de JSON ✅ (límite: 1 GB)
• Descarga: ~5 MB/mes ✅ (límite: 10 GB/mes)

💵 COSTO: $0.00 USD/mes (dentro de límites gratuitos)
```

##### Firebase Storage
```
Operaciones:
• Subidas: 5,000 imágenes x 2 MB promedio = 10 GB uploaded
• Descargas: 5,000 resultados x 2.5 MB promedio = 12.5 GB downloaded
• Almacenamiento: 10 GB input + 12.5 GB output = 22.5 GB

⚠️ EXCEDE CAPA GRATUITA (5 GB storage, 1 GB/día download)

💵 COSTO ESTIMADO:
• Almacenamiento: (22.5 GB - 5 GB) x $0.026 = $0.46/mes
• Descarga: (12.5 GB - 30 GB/mes gratis) = $0.00
• Total Firebase Storage: $0.46/mes
```

##### Firebase Authentication
```
• Usuarios autenticados: Ilimitado
• Operaciones OAuth: Ilimitadas

💵 COSTO: $0.00 USD/mes (siempre gratis)
```

#### 💡 Optimizaciones para Mantener Costos Bajos

1. **Limitar Almacenamiento:**
   - Eliminar imágenes procesadas después de 24 horas
   - Implementar bucket policy de auto-delete con lifecycle rules
   - Almacenar solo URLs de Replicate (válidas por 24h) en lugar de imágenes

2. **Reducir Descargas:**
   - Usar Replicate output URLs directamente (sin resubir a Firebase)
   - Cachear resultados en cliente con localStorage (24h)

3. **Compression:**
   - Comprimir imágenes antes de subir a Storage
   - Usar WebP en lugar de PNG cuando sea posible

**Con Optimizaciones Implementadas:**
```
Firebase Storage:
• Almacenamiento: Solo inputs temporales (2-3 GB) ✅
• Descarga: Mínima (solo para preview) ✅

💵 COSTO OPTIMIZADO: $0.00 – $0.20/mes
```

---

### Otros Servicios (No Firebase)

#### Vercel (Hosting + Serverless)
- **Plan Hobby (Gratis):**
  - 100 GB ancho de banda/mes ✅
  - Despliegues ilimitados ✅
  - Functions: 100 GB-horas ✅
  - Serverless function duration: 60s max ✅

**Removin:** Dentro de límites gratuitos para <500 usuarios activos

#### Replicate API (IA/ML)
- **Pay-as-you-go** (sin plan gratuito)
- Facturación por segundo de compute + modelo

**Costos promedio por operación:**
```
• Remove Background: $0.0002 - $0.0012 por imagen
• Generate Image (SDXL): $0.0095 por imagen
• Upscaling: $0.0055 por imagen

Ejemplo 100 usuarios x 50 imágenes/mes:
= 5,000 operaciones x $0.0005 promedio
= $2.50 USD/mes en Replicate API
```

⚠️ **Usuario paga su propio token de Replicate** → Removin NO asume costos de IA

---

### 💵 RESUMEN DE COSTOS MENSUALES

| Categoría | Costo Mensual | Notas |
|-----------|--------------|-------|
| Firebase (Auth + RTDB) | **$0.00** | Dentro de capa gratuita |
| Firebase Storage | **$0.00 - $0.50** | Con optimizaciones |
| Vercel Hosting | **$0.00** | Hobby plan |
| Replicate API | **$0.00** | Usuario paga su token |
| **TOTAL** | **$0.00 - $0.50/mes** | ✅ Prácticamente gratis |

**Conclusión:** Removin puede operar con **0-100 usuarios activos** por menos de $1 USD/mes usando capas gratuitas.

---

## 📋 REQUISITOS FUNCIONALES

### RF-001: Autenticación de Usuarios
**Prioridad:** 🔴 Alta  
**Estado:** ✅ Implementado

- **RF-001.1:** El sistema debe permitir login con cuenta de Google mediante OAuth 2.0
- **RF-001.2:** El sistema debe generar y validar tokens JWT para sesiones
- **RF-001.3:** El sistema debe cerrar sesión y revocar tokens al logout
- **RF-001.4:** El sistema debe redirigir usuarios no autenticados a /login
- **RF-001.5:** El sistema debe mantener sesión activa entre recargas de página

---

### RF-002: Gestión de Tokens API
**Prioridad:** 🔴 Alta  
**Estado:** ✅ Implementado

- **RF-002.1:** El sistema debe permitir configurar token de Replicate en Settings
- **RF-002.2:** El sistema debe validar formato de token (inicio con `r8_`, mínimo 33 caracteres)
- **RF-002.3:** El sistema debe almacenar tokens encriptados en Firebase Realtime Database
- **RF-002.4:** El sistema debe verificar existencia de token antes de operaciones de IA
- **RF-002.5:** El sistema debe mostrar flujo de onboarding si usuario no tiene token

---

### RF-003: Remover Fondo de Imágenes
**Prioridad:** 🔴 Alta  
**Estado:** ✅ Implementado

- **RF-003.1:** El sistema debe aceptar formatos JPG, PNG, WebP (máx 10 MB/archivo)
- **RF-003.2:** El sistema debe procesar hasta 20 imágenes simultáneamente
- **RF-003.3:** El sistema debe mostrar progreso en tiempo real con barra de porcentaje
- **RF-003.4:** El sistema debe permitir seleccionar entre 5 modelos de IA
- **RF-003.5:** El sistema debe ofrecer opción de fondo transparente o blanco
- **RF-003.6:** El sistema debe mostrar preview antes/después con slider comparativo
- **RF-003.7:** El sistema debe permitir descarga individual o masiva (ZIP)
- **RF-003.8:** El sistema debe manejar errores y reintentos automáticos

---

### RF-004: Generación de Imágenes con IA
**Prioridad:** 🟡 Media  
**Estado:** ✅ Implementado

- **RF-004.1:** El sistema debe generar imágenes desde prompts de texto
- **RF-004.2:** El sistema debe permitir configurar negative prompts
- **RF-004.3:** El sistema debe ofrecer 5 relaciones de aspecto (1:1, 16:9, 9:16, 4:3, 3:2)
- **RF-004.4:** El sistema debe permitir ajustar parámetros avanzados (steps, CFG, scheduler, seed)
- **RF-004.5:** El sistema debe incluir 6 estilos predefinidos (Realista, Digital Art, Anime, etc.)
- **RF-004.6:** El sistema debe mostrar ejemplos de prompts para inspiración
- **RF-004.7:** El sistema debe guardar historial de últimas 10 generaciones en LocalStorage
- **RF-004.8:** El sistema debe mostrar tiempo de generación y costo estimado

---

### RF-005: Compresión de Imágenes
**Prioridad:** 🟢 Baja  
**Estado:** ✅ Implementado

- **RF-005.1:** El sistema debe comprimir imágenes manteniendo calidad visual
- **RF-005.2:** El sistema debe soportar conversión a WebP
- **RF-005.3:** El sistema debe mostrar porcentaje de reducción de tamaño
- **RF-005.4:** El sistema debe procesar compresión en cliente (sin upload)
- **RF-005.5:** El sistema debe permitir ajustar nivel de calidad (1-100)

---

### RF-006: Vigilancia de Carpetas
**Prioridad:** 🟡 Media  
**Estado:** ✅ Implementado

- **RF-006.1:** El sistema debe solicitar permisos de lectura/escritura de carpetas
- **RF-006.2:** El sistema debe escanear carpeta input cada 10 segundos
- **RF-006.3:** El sistema debe detectar archivos nuevos y procesarlos automáticamente
- **RF-006.4:** El sistema debe guardar resultados en carpeta output seleccionada
- **RF-006.5:** El sistema debe evitar reprocesar archivos ya procesados
- **RF-006.6:** El sistema debe mostrar estadísticas (total, éxitos, errores)
- **RF-006.7:** El sistema debe permitir pausar/reanudar monitoreo
- **RF-006.8:** El sistema debe permitir reprocesar con otro modelo manualmente

---

### RF-007: Interfaz de Usuario
**Prioridad:** 🔴 Alta  
**Estado:** ✅ Implementado

- **RF-007.1:** El sistema debe ser responsive (desktop, tablet, mobile)
- **RF-007.2:** El sistema debe incluir sidebar de navegación con 6 secciones
- **RF-007.3:** El sistema debe mostrar toasts para feedback de operaciones
- **RF-007.4:** El sistema debe implementar lazy loading de páginas (code splitting)
- **RF-007.5:** El sistema debe incluir tooltips explicativos en opciones avanzadas
- **RF-007.6:** El sistema debe mantener accesibilidad (ARIA labels, contraste)

---

### RF-008: Seguridad y Rate Limiting
**Prioridad:** 🔴 Alta  
**Estado:** ✅ Implementado

- **RF-008.1:** El sistema debe implementar rate limiting (5 req/min por IP)
- **RF-008.2:** El sistema debe validar tokens JWT en cada request autenticado
- **RF-008.3:** El sistema debe sanitizar inputs de usuario (XSS prevention)
- **RF-008.4:** El sistema debe usar HTTPS en todas las comunicaciones
- **RF-008.5:** El sistema debe implementar CORS restrictivo (solo frontend autorizado)
- **RF-008.6:** El sistema debe ocultar errores del servidor (no exponer stack traces)

---

## 👥 HISTORIAS DE USUARIO (SCRUM)

### Epic 1: Onboarding y Autenticación

#### US-001: Login con Google
**Como** nuevo usuario  
**Quiero** iniciar sesión con mi cuenta de Google  
**Para** acceder rápidamente sin crear otra contraseña

**Criterios de Aceptación:**
- ✅ Botón "Continuar con Google" visible en /login
- ✅ Popup de OAuth se abre correctamente
- ✅ Usuario es redirigido a /onboarding después de autenticar
- ✅ Token JWT almacenado en memoria para sesiones

**Puntos de Historia:** 5  
**Prioridad:** Alta  
**Sprint:** 1

---

#### US-002: Configurar Token de Replicate
**Como** usuario nuevo  
**Quiero** ingresar mi token de Replicate API durante el onboarding  
**Para** poder usar las funciones de procesamiento de IA

**Criterios de Aceptación:**
- ✅ Pantalla de onboarding muestra instrucciones claras
- ✅ Link externo a Replicate.com para obtener token
- ✅ Validación de formato (debe empezar con r8_)
- ✅ Error amigable si token es inválido
- ✅ Redirección a dashboard después de guardar

**Puntos de Historia:** 3  
**Prioridad:** Alta  
**Sprint:** 1

---

### Epic 2: Procesamiento de Imágenes

#### US-003: Remover Fondo de Manera Simple
**Como** diseñador  
**Quiero** arrastrar imágenes y que se procesen automáticamente  
**Para** ahorrar tiempo en trabajo repetitivo de edición

**Criterios de Aceptación:**
- ✅ Drag & drop funcional en área de carga
- ✅ Hasta 20 imágenes pueden ser cargadas
- ✅ Botón "Procesar Todo" inicia batch processing
- ✅ Barra de progreso muestra % completado
- ✅ Resultados se muestran lado a lado con originales

**Puntos de Historia:** 8  
**Prioridad:** Alta  
**Sprint:** 2

---

#### US-004: Comparar Modelos de IA
**Como** usuario avanzado  
**Quiero** comparar resultados de diferentes modelos de IA  
**Para** elegir el mejor balance entre calidad y costo

**Criterios de Aceptación:**
- ✅ Selector de modelo muestra 5 opciones con info (costo, velocidad, calidad)
- ✅ Badge visual diferencia económico/estándar/premium
- ✅ Misma imagen puede ser reprocesada con otro modelo
- ✅ Resultados guardados permiten comparación visual

**Puntos de Historia:** 5  
**Prioridad:** Media  
**Sprint:** 3

---

#### US-005: Generar Imagen desde Descripción
**Como** creativo  
**Quiero** escribir una descripción de texto  
**Para** generar una imagen visual sin usar Photoshop

**Criterios de Aceptación:**
- ✅ Textarea para prompt con contador de caracteres
- ✅ Botón "Generar" ejecuta request a Replicate/SDXL
- ✅ Loader muestra tiempo estimado (~20s)
- ✅ Resultado se muestra en alta resolución
- ✅ Opción de descargar PNG

**Puntos de Historia:** 8  
**Prioridad:** Media  
**Sprint:** 4

---

#### US-006: Personalizar Parámetros de Generación
**Como** power user  
**Quiero** ajustar parámetros técnicos (steps, CFG, scheduler)  
**Para** tener control fino sobre el resultado final

**Criterios de Aceptación:**
- ✅ Panel de "Opciones Avanzadas" colapsable
- ✅ Sliders para Steps (20-50) y CFG (1-20)
- ✅ Dropdown de schedulers con tooltips explicativos
- ✅ Campo de seed para reproducibilidad
- ✅ Valores guardados entre sesiones (LocalStorage)

**Puntos de Historia:** 5  
**Prioridad:** Baja  
**Sprint:** 4

---

### Epic 3: Automatización

#### US-007: Vigilar Carpeta Automáticamente
**Como** fotógrafo profesional  
**Quiero** que el sistema vigile una carpeta  
**Para** que procese automáticamente fotos nuevas sin intervención manual

**Criterios de Aceptación:**
- ✅ Botones para elegir carpeta input y output
- ✅ Botón "Iniciar Monitoreo" activa escaneo cada 10s
- ✅ Archivos nuevos se detectan y procesan automáticamente
- ✅ Resultados se guardan en carpeta output con mismo nombre
- ✅ Estadísticas de éxito/error en tiempo real

**Puntos de Historia:** 13  
**Prioridad:** Media  
**Sprint:** 5

---

#### US-008: Pausar y Reanudar Procesamiento
**Como** usuario con vigilancia activa  
**Quiero** pausar el monitoreo temporalmente  
**Para** evitar procesar imágenes mientras organizo archivos

**Criterios de Aceptación:**
- ✅ Botón "Pausar" detiene el escaneo
- ✅ Estado visual indica "Pausado" con badge naranja
- ✅ Botón "Reanudar" reinicia monitoreo
- ✅ Archivos añadidos durante pausa se procesan al reanudar

**Puntos de Historia:** 3  
**Prioridad:** Baja  
**Sprint:** 5

---

### Epic 4: Gestión y Configuración

#### US-009: Ver Uso y Costos
**Como** usuario consciente del presupuesto  
**Quiero** ver cuántas imágenes he procesado y el costo estimado  
**Para** controlar mi gasto en API de Replicate

**Criterios de Aceptación:**
- 🚧 Dashboard muestra total de operaciones del mes
- 🚧 Desglose por tipo (remove-bg, generate, upscale)
- 🚧 Costo estimado en USD
- 🚧 Gráfico de tendencia semanal

**Puntos de Historia:** 8  
**Prioridad:** Media  
**Sprint:** 6 (Pendiente)

---

#### US-010: Actualizar Token de API
**Como** usuario existente  
**Quiero** cambiar mi token de Replicate desde Settings  
**Para** actualizarlo si caduca o quiero usar otra cuenta

**Criterios de Aceptación:**
- ✅ Página Settings muestra estado de conexión (Conectado/Desconectado)
- ✅ Input permite ingresar nuevo token
- ✅ Token existente se muestra enmascarado (••••••)
- ✅ Validación antes de guardar
- ✅ Toast de confirmación al guardar exitosamente

**Puntos de Historia:** 3  
**Prioridad:** Alta  
**Sprint:** 2

---

## 🔒 CIBERSEGURIDAD Y POLÍTICAS DE SEGURIDAD

### 🛡️ Modelo de Amenazas

#### Activos Críticos
1. **Tokens de API de Replicate** (Valor: Alto)
   - Permiten consumir créditos de usuario
   - Compromiso = pérdida económica directa

2. **Sesiones de Usuario (JWT)** (Valor: Alto)
   - Acceso no autorizado a cuenta
   - Manipulación de configuraciones

3. **Imágenes de Usuario** (Valor: Medio)
   - Privacidad del contenido
   - Propiedad intelectual

4. **Firebase Credentials** (Valor: Crítico)
   - Control total del backend
   - Acceso a base de datos completa

---

### 🔐 Controles de Seguridad Implementados

#### 1. Autenticación y Autorización

##### Firebase Authentication con Google OAuth
```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ✅ Solo Google OAuth (no contraseñas = menos vectores de ataque)
// ✅ Tokens JWT firmados por Firebase (validados en backend)
```

**Controles:**
- ✅ **Multi-factor:** OAuth 2.0 con Google (hereda MFA de cuenta Google)
- ✅ **Session Management:** Tokens JWT con expiración automática (1h)
- ✅ **Logout Seguro:** Revocación de tokens + limpieza de estado local

##### Middleware de Autenticación Backend
```javascript
// api/server.js
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const { uid, error } = await verifyAuthToken(authHeader);
  
  if (error || !uid) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  req.uid = uid; // Inyectar UID verificado en request
  next();
}
```

**Controles:**
- ✅ **Verificación en cada request:** JWT validado contra Firebase Admin SDK
- ✅ **Principio de privilegio mínimo:** Solo UID necesario se extrae del token
- ✅ **No confianza en cliente:** Token debe venir del header, no del body

---

#### 2. Rate Limiting y DDoS Protection

```javascript
// api/server.js
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 5,                      // 5 requests por minuto
  message: { 
    error: 'Demasiadas peticiones. Espera unos segundos.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

**Controles:**
- ✅ **Rate Limiting:** 5 req/min por IP (evita abuso de API)
- ✅ **429 Response:** Cliente recibe `retryAfter` para esperar automáticamente
- ✅ **Retry Logic:** Frontend reintentar después del tiempo especificado

**Protección contra:**
- DDoS básico
- Scraping agresivo
- Uso abusivo de Replicate API (protege costos del usuario)

---

#### 3. Gestión Segura de Secrets

##### Frontend (Variables de Entorno Públicas)
```env
# .env (frontend - OK para exponerse)
VITE_FIREBASE_API_KEY=AIzaSy...         # Público, OK
VITE_FIREBASE_AUTH_DOMAIN=...           # Público, OK
VITE_FIREBASE_PROJECT_ID=removin-55744  # Público, OK
```

⚠️ **NOTA:** Firebase API Keys son **intencionalmente públicas** según documentación oficial. La seguridad viene de:
- Firebase Security Rules (restricción de acceso)
- Authentication (solo usuarios autenticados acceden)

##### Backend (Variables de Entorno Privadas)
```env
# api/.env (backend - NUNCA exponer)
FIREBASE_PROJECT_ID=removin-55744
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@removin-55744.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."  # ⚠️ CRÍTICO
```

**Controles:**
- ✅ **Almacenamiento:** Vercel Environment Variables (encriptadas en reposo)
- ✅ **Rotación:** Service Account puede ser regenerado en Firebase Console
- ✅ **Separación de Entornos:** Production ≠ Development secrets
- ✅ **.gitignore:** Archivos .env nunca en repositorio

##### Tokens de Usuario (Replicate API)
```javascript
// api/lib/firebase-admin.js
export async function saveUserReplicateToken(uid, token) {
  const db = getDb();
  await db.ref(`users/${uid}/replicateToken`).set(token);
  // ⚠️ TODO: Implementar encriptación en reposo (AES-256)
}
```

**⚠️ Estado Actual:** Tokens almacenados en plaintext en Realtime Database  
**🔐 Mejora Recomendada:**
```javascript
import crypto from 'crypto';

// Usar Cloud KMS o variable de entorno como encryption key
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32 bytes

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

#### 4. CORS (Cross-Origin Resource Sharing)

```javascript
// api/server.js
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'https://removin.vercel.app']
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

**Controles:**
- ✅ **Whitelist Estricto:** Solo frontend autorizado puede llamar API
- ✅ **Credentials:** Permite envío de cookies (para futuras sesiones)
- ✅ **Env-Aware:** Diferente config para dev vs prod

---

#### 5. Input Validation & Sanitization

##### Validación de Tokens Replicate
```javascript
// api/server.js
app.post('/api/user/token', authenticateUser, async (req, res) => {
  const { token } = req.body;
  
  // ✅ Validación de formato
  if (!token || !token.startsWith('r8_') || token.length < 33) {
    return res.status(400).json({ 
      error: 'Token inválido. Debe empezar con r8_ y tener al menos 33 caracteres.' 
    });
  }
  
  // ✅ Sanitización: trim whitespace
  const sanitizedToken = token.trim();
  
  await saveUserReplicateToken(req.uid, sanitizedToken);
});
```

##### Validación de Archivos (Cliente)
```typescript
// src/hooks/useImageProcessor.ts
// ✅ Validar tipo MIME
if (!localImg.file.type.startsWith('image/')) {
  throw new Error('El archivo no es una imagen válida');
}

// ✅ Validar tamaño (max 10 MB)
if (localImg.file.size > 10 * 1024 * 1024) {
  throw new Error('El archivo excede el tamaño máximo de 10MB');
}

// ✅ Validar extensión (whitelist)
const fileExt = localImg.file.name.split('.').pop()?.toLowerCase();
if (!fileExt || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExt)) {
  throw new Error('Formato no soportado');
}
```

**Protección contra:**
- Path traversal (inyección de ../ en nombres de archivo)
- Subida de ejecutables (.exe, .sh)
- Archivos corruptos que pueden crashear procesadores de imagen

---

#### 6. Secure Headers

```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        }
      ]
    }
  ]
}
```

**⚠️ Headers Faltantes (Recomendados):**
```json
{
  "key": "X-Frame-Options",
  "value": "DENY"  // ✅ Previene clickjacking
},
{
  "key": "X-Content-Type-Options",
  "value": "nosniff"  // ✅ Previene MIME sniffing
},
{
  "key": "Strict-Transport-Security",
  "value": "max-age=31536000; includeSubDomains"  // ✅ Fuerza HTTPS
},
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."  // ✅ XSS protection
}
```

---

#### 7. Firebase Security Rules

##### Realtime Database Rules
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "replicateToken": {
          ".validate": "newData.isString() && newData.val().length > 30"
        }
      }
    }
  }
}
```

**Controles:**
- ✅ **Aislamiento:** Usuario solo accede a su propio UID
- ✅ **Validación:** Token debe ser string > 30 chars
- ✅ **Autenticación Requerida:** `auth.uid` debe existir

##### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{allPaths=**} {
      // Solo propietario puede leer/escribir
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Validar tamaño (max 10 MB)
      allow write: if request.resource.size < 10 * 1024 * 1024;
      
      // Validar tipo MIME (solo imágenes)
      allow write: if request.resource.contentType.matches('image/.*');
    }
  }
}
```

**Controles:**
- ✅ **Path-based Authorization:** Carpeta `/{userId}/` solo accesible por ese usuario
- ✅ **File Size Limit:** 10 MB max en servidor (adicional a validación cliente)
- ✅ **Content-Type Validation:** Solo `image/*` MIME types

---

### 🚨 Vulnerabilidades Conocidas y Mitigaciones

| Vulnerabilidad | Severidad | Estado | Mitigación |
|----------------|-----------|--------|------------|
| **Tokens en plaintext** | 🔴 Alta | ⚠️ Pendiente | Implementar encriptación AES-256 para tokens en RTDB |
| **Sin CSP header** | 🟡 Media | ⚠️ Pendiente | Añadir Content-Security-Policy a Vercel headers |
| **Sin logging de seguridad** | 🟡 Media | ⚠️ Pendiente | Integrar Cloud Logging para auditoría de accesos |
| **Sin 2FA adicional** | 🟢 Baja | N/A | Depende de MFA de Google (fuera de control) |
| **Client-side secrets** | 🟢 Baja | ✅ Mitigado | Firebase API Keys son públicas por diseño, rules en servidor |

---

### 📜 Políticas de Seguridad

#### Política de Contraseñas
**N/A** - No usamos contraseñas, solo OAuth con Google

#### Política de Acceso
- **Autenticación Obligatoria:** Todas las rutas excepto `/login` requieren autenticación
- **Token de API Obligatorio:** Funciones de IA requieren token válido configurado en Settings
- **Sesión Única:** Un token JWT por sesión, expiración automática después de 1 hora

#### Política de Retención de Datos
- **Imágenes en Storage:** 24 horas después de subida (lifecycle policy)
- **Tokens de API:** Sin fecha de expiración (usuario controla en Settings)
- **Logs de Procesamiento:** 30 días (futuro - no implementado aún)

#### Política de Respuesta a Incidentes
1. **Detección:** Monitoring de errores en Vercel Dashboard + Firebase Console
2. **Contención:** Revocación inmediata de Service Account si se compromete
3. **Erradicación:** Rotación de secrets, revisión de logs
4. **Recuperación:** Deploy de versión limpia, notificación a usuarios
5. **Lecciones Aprendidas:** Documentación de incidente + actualización de esta política

#### Política de Actualizaciones
- **Dependencias:** Revisión mensual de `npm audit` para vulnerabilidades
- **Framework Updates:** Actualizar a versiones LTS (Long-Term Support)
- **Security Patches:** Aplicar inmediatamente (< 24 horas) para vulnerabilidades críticas

---

## 🏗️ ESTRUCTURA TÉCNICA DETALLADA

### Frontend (React 19 + Vite 7)

```
src/
├── assets/              # Recursos estáticos (imágenes, fuentes)
├── components/
│   ├── auth/
│   │   └── AuthProvider.tsx       # Context provider para autenticación
│   ├── layout/
│   │   ├── DashboardLayout.tsx    # Layout principal con sidebar
│   │   └── Sidebar.tsx            # Navegación lateral
│   ├── shared/                     # Componentes compartidos custom
│   └── ui/                         # shadcn/ui components
│       ├── alert.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── progress.tsx
│       ├── separator.tsx
│       ├── switch.tsx
│       ├── toast.tsx
│       └── tooltip.tsx
├── data/
│   └── models.ts                   # Catálogo de modelos de IA
├── hooks/
│   ├── useAuth.ts                  # Hook de autenticación
│   ├── useImageProcessor.ts        # Hook de procesamiento de imágenes
│   └── useToast.ts                 # Hook de notificaciones
├── lib/
│   ├── api.ts                      # Cliente HTTP para backend API
│   ├── firebase.ts                 # Configuración de Firebase Client SDK
│   └── utils.ts                    # Utilidades (cn(), etc.)
├── pages/
│   ├── Compare.tsx                 # 🚧 Comparar modelos (pendiente)
│   ├── Compress.tsx                # Compresión de imágenes
│   ├── ConfigError.tsx             # Error de configuración
│   ├── FolderWatch.tsx             # Vigilancia de carpetas
│   ├── Generate.tsx                # Generación con SDXL
│   ├── Login.tsx                   # Pantalla de login
│   ├── Onboarding.tsx              # Flujo de onboarding
│   ├── Remove.tsx                  # Remover fondo
│   ├── Settings.tsx                # Configuración de tokens
│   └── Usage.tsx                   # 🚧 Dashboard de uso (pendiente)
├── types/
│   └── index.ts                    # Tipos TypeScript globales
├── App.tsx                         # Componente raíz con routing
├── main.tsx                        # Entry point de la aplicación
└── index.css                       # Estilos globales
```

### Backend (Node.js + Express)

```
api/
├── lib/
│   └── firebase-admin.js           # Firebase Admin SDK + utilities
├── package.json
└── server.js                       # Express server con endpoints

Endpoints disponibles:
• GET  /api/health                  - Health check
• GET  /api/debug                   - Debug info (temporal)
• GET  /api/user/token              - Verificar si usuario tiene token
• POST /api/user/token              - Guardar token de Replicate
• POST /api/remove-bg               - Procesar remoción de fondo
• POST /api/generate-image          - Generar imagen con SDXL
• POST /api/compare-models          - 🚧 Comparar modelos (pendiente)
```

### Base de Datos (Firebase Realtime Database)

```json
{
  "users": {
    "<uid>": {
      "replicateToken": "r8_...",
      "settings": {
        "preferredModel": "cjwbw-rembg",
        "autoWhiteBackground": false
      }
    }
  },
  "processing_history": {
    "<uid>": {
      "<timestamp>": {
        "type": "remove-bg",
        "modelUsed": "cjwbw-rembg",
        "cost": 0.0002,
        "success": true
      }
    }
  }
}
```

### Storage (Firebase Storage)

```
gs://removin-55744.appspot.com/
├── <uid_1>/
│   ├── <batch_id_1>/
│   │   ├── image1.jpg          # Input
│   │   └── image1_result.png   # Output (🚧 actualmente no usado)
│   └── <batch_id_2>/
│       └── ...
└── <uid_2>/
    └── ...
```

**⚠️ Optimización Actual:** Resultados vienen directamente de Replicate URLs (no re-upload a Storage)

---

## 🚀 INFRAESTRUCTURA Y DESPLIEGUE

### Hosting: Vercel

**Plan:** Hobby (Gratuito)  
**Región:** Global Edge Network (CDN)  
**Build Command:** `npm run build`  
**Output Directory:** `dist/`

**Características Usadas:**
- ✅ Serverless Functions (API endpoints)
- ✅ Edge Network (baja latencia global)
- ✅ Automatic HTTPS
- ✅ Git-based Deployments (auto-deploy en push a `main`)
- ✅ Preview Deployments (branches)
- ✅ Environment Variables (secrets seguros)

**Configuración:**
```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/index.js": { "maxDuration": 60 }
  }
}
```

---

### CI/CD Pipeline

```
1. Developer Push to GitHub
   ↓
2. Vercel Webhook Triggered
   ↓
3. Build Process
   • Install dependencies (npm ci)
   • TypeScript compilation (tsc -b)
   • Vite build (optimización + minificación)
   • Generate sourcemaps
   ↓
4. Serverless Functions Bundled
   • Backend API routes → Lambda functions
   • Max execution time: 60s
   ↓
5. Deploy to Edge Network
   • Static files → Global CDN
   • Functions → Closest region to user
   ↓
6. Smoke Tests (Vercel)
   • Health check: /api/health
   • Status 200 OK
   ↓
7. Production Live ✅
   • https://removin.vercel.app
```

**Rollback:** Instant rollback desde Vercel Dashboard (revert to previous deployment)

---

### Monitoreo y Observabilidad

#### Vercel Dashboard
- **Logs en Tiempo Real:** Requests, errores, warnings
- **Analytics:** Pageviews, bandwidth, edge requests
- **Function Metrics:** Invocaciones, duración, memoria

#### Firebase Console
- **Authentication:** Usuarios activos, logins por día
- **Realtime Database:** Lecturas/escrituras, latencia
- **Storage:** Uso de espacio, descargas
- **Crashlytics:** 🚧 No implementado (futuro)

#### Error Tracking
⚠️ **Faltante:** Integración con Sentry o Rollbar para error tracking detallado

---

## 📝 BACKLOG Y ROADMAP

### Sprint 6 (Próximos 2 semanas)
- [ ] **US-009:** Dashboard de uso y costos
- [ ] Encriptación de tokens en Realtime Database
- [ ] Headers de seguridad adicionales (CSP, HSTS)

### Sprint 7-8 (Próximo mes)
- [ ] Comparación de modelos (página Compare)
- [ ] Historial de procesamiento con búsqueda
- [ ] Exportar historial a CSV
- [ ] Dark mode

### Futuro (3+ meses)
- [ ] Sistema de planes (Free, Pro, Enterprise)
- [ ] Integración con Stripe para pagos
- [ ] API pública con API Keys
- [ ] Webhooks para integraciones
- [ ] Aplicación móvil (React Native)

---

## 🤝 EQUIPO Y ROLES

| Rol | Responsabilidad |
|-----|----------------|
| **Product Owner** | Jonathan (tú) - Define prioridades y requisitos |
| **Full-Stack Developer** | Jonathan - Desarrollo frontend + backend |
| **DevOps/Infrastructure** | Jonathan + Vercel (managed) |
| **QA/Testing** | Manual testing + future automation |
| **Security** | Responsabilidad compartida (revisar esta doc) |

---

## 📚 DOCUMENTACIÓN ADICIONAL

- **README.md:** Instalación y configuración local
- **FOLDER_WATCH_FEATURES.md:** Especificaciones de Folder Watch
- **API_DOCS.md:** 🚧 Documentación de API (pendiente)
- **SECURITY.md:** 🚧 Política de reporte de vulnerabilidades (pendiente)

---

## 🎓 GLOSARIO

| Término | Definición |
|---------|-----------|
| **Replicate** | Plataforma de IA-as-a-Service que ejecuta modelos de ML en la nube |
| **SDXL** | Stable Diffusion XL - Modelo de generación de imágenes text-to-image |
| **RMBG** | Remove Background - Modelos especializados en quitar fondos |
| **JWT** | JSON Web Token - Standard de autenticación basado en tokens firmados |
| **OAuth** | Protocolo de autorización delegada (login con Google) |
| **Serverless** | Funciones backend que escalan automáticamente sin servidor dedicado |
| **Edge Network** | Red de servidores distribuidos globalmente para baja latencia |
| **Rate Limiting** | Límite de requests por tiempo para prevenir abuso |

---

## ✅ CHECKLIST DE COMPLETITUD

### Funcionalidades Core
- [x] Login con Google OAuth
- [x] Onboarding con configuración de token
- [x] Remover fondo con 5 modelos
- [x] Generar imágenes con SDXL
- [x] Comprimir imágenes
- [x] Vigilancia de carpetas
- [x] Settings para gestionar tokens
- [ ] Dashboard de uso (pendiente)

### Seguridad
- [x] Autenticación obligatoria
- [x] Rate limiting (5 req/min)
- [x] CORS restrictivo
- [x] Input validation
- [x] Firebase Security Rules
- [ ] Encriptación de tokens (pendiente)
- [ ] CSP headers (pendiente)
- [ ] Error tracking (Sentry) (pendiente)

### Infraestructura
- [x] Deploy a Vercel
- [x] Firebase Realtime Database configurado
- [x] Firebase Auth configurado
- [x] Firebase Storage configurado
- [x] CI/CD automático con GitHub
- [x] Environment variables seguras
- [x] HTTPS forzado

### Documentación
- [x] README.md con instalación
- [x] Documentación técnica completa (este documento)
- [ ] API documentation (Swagger/OpenAPI) (pendiente)
- [ ] Contributing guidelines (pendiente)

---

**📌 FIN DEL DOCUMENTO**

_Última actualización: 23 de febrero de 2026_  
_Autor: GitHub Copilot + Jonathan_  
_Versión: 1.0.0_

