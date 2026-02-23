# FolderWatch - Características Mejoradas

## 🎯 Resumen
El módulo FolderWatch ha sido completamente rediseñado con capacidades avanzadas de procesamiento por lotes, incluyendo selección de modelo, previsualización en tiempo real y reprocesamiento inteligente.

## ✨ Nuevas Características

### 1. **Selector de Modelo AI**
- 🎨 **Interfaz Visual Mejorada**: Grid de 5 modelos con badges, estrellas de calidad y pricing
- 💰 **Comparación de Costos**: Visualiza el precio por imagen de cada modelo ($0.0002 - $0.0012)
- ⭐ **Niveles de Calidad**: Sistema de 5 estrellas mostrando la calidad de cada modelo
- 🔒 **Selección Obligatoria**: Debes elegir un modelo ANTES de iniciar el monitoreo
- 🚫 **Bloqueado Durante Procesamiento**: No puedes cambiar el modelo mientras el monitoreo está activo

#### Modelos Disponibles
1. **RMBG Fast (Económico)** - $0.0002/img ⭐⭐
2. **Remove Background (Estándar)** - $0.00025/img ⭐⭐⭐
3. **Fotto AI Remove BG 2.0** - $0.0008/img ⭐⭐⭐
4. **ISNet General Use** - $0.0009/img ⭐⭐⭐
5. **RMBG Enhanced (Premium)** - $0.0012/img ⭐⭐⭐⭐⭐

### 2. **Grid de Previsualización**
- 📸 **Vista Before/After**: Cada tarjeta muestra la imagen original y procesada lado a lado
- 🎨 **Fondo Transparente Visual**: Patrón de cuadrícula para visualizar transparencias
- 🏷️ **Badges de Estado**: 
  - 🔵 Procesando (con spinner animado)
  - 🟢 Listo (success)
  - 🔴 Error (con mensaje detallado)
- ⏱️ **Tiempo de Procesamiento**: Muestra cuántos segundos tomó cada imagen
- 🏷️ **Modelo Usado**: Badge indicando qué modelo procesó la imagen
- 📱 **Responsive**: Grid adaptativo (1-4 columnas según el tamaño de pantalla)

### 3. **Reprocesamiento Inteligente**
- 🔄 **Reprocesar al Hover**: Botón aparece al pasar el mouse sobre imágenes con error
- 🎯 **Modal de Selección**: Elige un modelo diferente para reprocesar
- 🚫 **Filtrado Inteligente**: El modal solo muestra modelos que NO fueron usados anteriormente
- 💾 **Mantener Preview**: La imagen original se conserva para facilitar el reprocesamiento
- ⚡ **Proceso Rápido**: Un clic y la imagen se reprocesa con el nuevo modelo

### 4. **Indicadores Visuales Avanzados**
- 🟥 **Bordes Rojos**: Imágenes con error tienen borde rojo distintivo
- 🟩 **Bordes Verdes**: Imágenes exitosas con borde verde sutil
- 🔵 **Animación Pulse**: Imágenes en procesamiento tienen efecto pulse
- 🌓 **Hover Effects**: Sombras y efectos al pasar el mouse
- 📊 **Estadísticas en Tiempo Real**: Contador de Total/Exitosas/Errores

## 🚀 Flujo de Uso

### Paso 1: Configuración Inicial
1. Selecciona **Carpeta de Entrada** (donde están tus imágenes originales)
2. Selecciona **Carpeta de Salida** (donde se guardarán las imágenes procesadas)
3. **Elige un Modelo AI** según tu balance costo/calidad

### Paso 2: Configurar Opciones
- Toggle **Fondo Blanco**: Activa si quieres JPG con fondo blanco en lugar de PNG transparente
- El modelo seleccionado aparecerá resaltado con borde azul

### Paso 3: Iniciar Monitoreo
- Presiona **"Iniciar Monitoreo"**
- El sistema escanea la carpeta cada 3 segundos
- Las imágenes aparecen en tiempo real en la grid

### Paso 4: Visualizar Resultados
- Observa el **Grid de Previsualización** que muestra:
  - Original (izquierda) | Procesada (derecha)
  - Badge de estado (Procesando/Listo/Error)
  - Tiempo de procesamiento
  - Modelo usado

### Paso 5: Reprocesar si Necesario
- Si una imagen tiene **error**:
  1. Pasa el mouse sobre la tarjeta
  2. Aparece botón "Reprocesar"
  3. Clic abre modal con modelos alternativos
  4. Selecciona un modelo más potente (ej: Premium)
  5. La imagen se reprocesa automáticamente

## 🎨 Mejoras de UX

### Diseño Visual
- **Cards con Hover**: Efectos de elevación al pasar el mouse
- **Colores Semánticos**: Verde=éxito, Rojo=error, Azul=procesando
- **Gradientes Informativos**: Labels sobre las imágenes con gradiente negro
- **Badges Contextuales**: Económico/Estándar/Premium con colores distintivos

### Feedback al Usuario
- **Toasts Informativos**: Mensajes de éxito/error en la esquina
- **Estados Visuales Claros**: Impossible confundir qué imagen está en qué estado
- **Progress Animations**: Spinners y pulsos para indicar actividad
- **Empty States**: Mensaje amigable cuando no hay imágenes

### Prevención de Errores
- **Validación de Selección**: No puedes iniciar sin carpetas y modelo
- **Alertas Contextuales**: Mensajes informativos sobre qué falta configurar
- **Botones Deshabilitados**: Visual claro de qué acciones no están disponibles
- **Confirmaciones Implícitas**: Check icons en carpetas seleccionadas

## 🔧 Detalles Técnicos

### Estado del Componente
```typescript
interface ProcessedFile {
  name: string;
  status: 'processing' | 'completed' | 'error';
  time?: number;
  error?: string;
  originalPreview?: string;      // URL para preview original
  processedPreview?: string;     // URL para preview procesado
  modelUsed?: string;            // Version ID del modelo
  modelName?: string;            // Nombre legible del modelo
}
```

### Funciones Helper
- `getQualityLevel(quality)`: Convierte string quality a número (2-5)
- `getPricing(costPerRun)`: Formatea precio como "$0.0002/img"
- `processImage(file, fileName, modelVersion?)`: Procesa imagen con modelo específico

### Rate Limiting
- ⏱️ **12 segundos** entre imágenes (Replicate limit: 5 req/min)
- 🔁 **Retry automático** en caso de 429 error
- 📊 **Queue interno** para procesar imágenes secuencialmente

### Cleanup Automático
- 🗑️ **Supabase Storage**: Limpia archivos temporales después de procesamiento
- 💾 **Object URLs**: Revoca URLs de blobs para liberar memoria
- 🔄 **Estado Consistente**: Actualiza grid en tiempo real

## 📱 Responsive Design

### Desktop (1920px+)
- Grid 4 columnas
- Previews grandes
- Modal ancho

### Tablet (768px - 1920px)
- Grid 2-3 columnas
- Previews medianas
- Modal adaptado

### Mobile (< 768px)
- Grid 1 columna
- Previews optimizadas
- Modal full-screen

## 🎯 Casos de Uso

### Caso 1: Batch Processing Económico
1. Selecciona **RMBG Fast (Económico)**
2. Procesa 1000 imágenes
3. Costo: $0.20
4. Revisa grid, reprocesa solo errores con modelo Premium

### Caso 2: Máxima Calidad
1. Selecciona **RMBG Enhanced (Premium)**
2. Procesa 50 retratos profesionales
3. Costo: $0.06
4. Resultados perfectos, sin reprocesamiento

### Caso 3: Balance Costo-Calidad
1. Selecciona **Remove Background (Estándar)**
2. Procesa 500 productos
3. Costo: $0.125
4. Reprocesa 5% con errores usando modelo superior

## 🚨 Limitaciones y Consideraciones

### Limitaciones Técnicas
- ⚠️ **Rate Limit**: Máximo 5 imágenes/minuto (límite de Replicate)
- 📏 **Tamaño Máximo**: 10MB por imagen
- 🔧 **Browser Support**: Requiere Chrome 86+ o Edge (File System Access API)
- 💰 **Créditos**: Necesitas créditos en Replicate ($5 mínimo recomendado)

### Mejores Prácticas
1. **Ordenar por Prioridad**: Procesa primero imágenes críticas
2. **Monitor During Processing**: Observa la grid para detectar errores temprano
3. **Model Selection Strategy**: 
   - Económico para pruebas
   - Estándar para producción
   - Premium para casos difíciles
4. **Backup**: Mantén copias de originales (el sistema no modifica la carpeta de entrada)

## 🔮 Roadmap Futuro

### Posibles Mejoras
- [ ] Pause/Resume individual por imagen
- [ ] Exportar reporte de procesamiento (CSV/JSON)
- [ ] Filtros de la grid (solo errores, solo exitosos, por modelo)
- [ ] Búsqueda por nombre de archivo
- [ ] Download individual desde la grid
- [ ] Comparación antes/después en fullscreen
- [ ] Historial de reprocesamiento
- [ ] Batch reprocessing (seleccionar múltiples errores)

## 📝 Notas de Implementación

### Cambios Realizados
- ✅ Agregado `modelVersion` parameter a `processImage()`
- ✅ Creado componente de selección de modelo con grid
- ✅ Implementado sistema de previews con Object URLs
- ✅ Modal de reprocesamiento con filtrado de modelos
- ✅ Estados visuales mejorados con badges y borders
- ✅ Helpers para quality level y pricing display
- ✅ Grid responsive con diferentes breakpoints
- ✅ Hover effects para reprocesar
- ✅ Cleanup de Object URLs para prevenir memory leaks

### Archivos Modificados
- `src/pages/FolderWatch.tsx`: Lógica principal y UI
- `src/lib/api.ts`: Ya soporta `modelVersion` parameter
- `api/server.js`: Backend con multi-model support
- `src/data/models.ts`: Catálogo de modelos con metadatos

---

## 🎊 Resultado Final
Un sistema de batch processing **profesional, intuitivo y robusto** que permite procesar cientos de imágenes con control total sobre el modelo usado, visualización en tiempo real y capacidad de reprocesar errores con modelos más potentes. Perfectamente alineado con un workflow SaaS de producción. ✨
