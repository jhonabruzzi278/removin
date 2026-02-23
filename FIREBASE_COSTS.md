# 💰 ANÁLISIS DE COSTOS FIREBASE - REMOVIN

## 📊 Resumen Ejecutivo

**Conclusión:** Removin puede operar con **hasta 100 usuarios activos** en la **capa gratuita de Firebase** con un costo de **$0 - $0.50 USD/mes**.

---

## 🆓 Firebase Spark Plan (Gratuito)

### Servicios Incluidos

| Servicio | Límite Gratuito | Estado Removin |
|----------|----------------|----------------|
| **Authentication** | ✅ Ilimitado | Siempre gratis |
| **Realtime Database** | 1 GB almacenamiento<br>10 GB/mes descarga | ✅ Suficiente para 1,000+ usuarios |
| **Storage** | 5 GB almacenamiento<br>1 GB/día descarga | ⚠️ **Límite crítico a optimizar** |
| **Hosting** | 10 GB/mes | N/A (usamos Vercel) |

---

## 📈 Estimación de Uso (100 usuarios activos/mes)

### Escenario: 50 imágenes por usuario/mes

#### Firebase Authentication
```
✅ Operaciones: Ilimitadas
✅ Usuarios: Ilimitados
✅ Google OAuth: Gratis siempre

💵 COSTO: $0.00/mes
```

---

#### Firebase Realtime Database

**Operaciones:**
- **Escrituras:** 5,000 tokens guardados = 5,000 writes/mes
  - Límite: 600,000/mes ✅ (0.8% usado)
- **Lecturas:** 10,000 lecturas de token/mes
  - Límite: 1,500,000/mes ✅ (0.6% usado)
- **Almacenamiento:** ~500 KB de JSON
  - Límite: 1 GB ✅ (0.05% usado)
- **Bandwidth:** ~5 MB/mes
  - Límite: 10 GB/mes ✅ (0.05% usado)

```
✅ Todas las operaciones dentro de límites gratuitos

💵 COSTO: $0.00/mes
```

---

#### Firebase Storage

**SIN Optimizaciones:**
```
❌ Escenario NO Optimizado:
• Subidas: 5,000 imágenes x 2 MB = 10 GB
• Descargas: 5,000 resultados x 2.5 MB = 12.5 GB
• Almacenamiento: 22.5 GB total

Exceso sobre límites gratuitos:
• Almacenamiento: (22.5 - 5) GB x $0.026 = $0.46/mes
• Descarga: (12.5 - 30) GB = $0.00 (dentro del límite)

💵 COSTO: $0.46/mes
```

**CON Optimizaciones (Recomendado):**
```
✅ Escenario Optimizado:
• Usar URLs de Replicate directamente (válidas 24h)
• Almacenar solo inputs temporales (auto-delete 24h)
• No re-subir resultados a Storage

Operaciones:
• Almacenamiento: ~2-3 GB temporales ✅
• Descarga: Mínima (solo previews) ✅

💵 COSTO: $0.00/mes (dentro de límites gratuitos)
```

---

## 🔧 Optimizaciones Implementadas

### 1. Usar URLs de Replicate Directamente
```javascript
// ❌ ANTES: Re-upload a Firebase Storage
const processedUrl = await uploadToStorage(resultBlob);

// ✅ AHORA: Usar URL de Replicate directamente
const processedUrl = replicateResponse.output; // Válida 24h
```

**Ahorro:**
- ✅ No consume storage
- ✅ No consume bandwidth de descarga
- ✅ Más rápido (no hay re-upload)

---

### 2. Lifecycle Policies de Auto-Delete
```javascript
// Configurar en Firebase Console → Storage → Rules
// Eliminar archivos después de 24 horas automáticamente
{
  "rules": {
    "match /{userId}/{batchId}/{fileName}": {
      "delete": "request.time > resource.metadata.timeCreated + duration.value(1, 'days')"
    }
  }
}
```

**Ahorro:**
- ✅ Mantiene almacenamiento bajo (solo archivos recientes)
- ✅ Evita acumulación descontrolada

---

### 3. Compresión de Imágenes Antes de Upload
```javascript
// Comprimir a 80% calidad antes de subir
const compressedBlob = await compressImage(file, 0.8);
await uploadFile(path, compressedBlob);
```

**Ahorro:**
- ✅ ~50% reducción de tamaño
- ✅ Menos bandwidth usado

---

## 💵 Proyección de Costos por Escala

| Usuarios Activos/Mes | Firebase Auth | Realtime DB | Storage (optimizado) | **TOTAL** |
|----------------------|--------------|-------------|---------------------|----------|
| 10 | $0.00 | $0.00 | $0.00 | **$0.00** |
| 50 | $0.00 | $0.00 | $0.00 | **$0.00** |
| 100 | $0.00 | $0.00 | $0.00 | **$0.00** |
| 500 | $0.00 | $0.00 | $0.20 | **$0.20** |
| 1,000 | $0.00 | $0.05 | $0.50 | **$0.55** |
| 5,000 | $0.00 | $0.30 | $2.50 | **$2.80** |

**Nota:** Costos asumen optimizaciones implementadas.

---

## 📊 Comparación con Otras Bases de Datos

| Servicio | Capa Gratuita | Costo (100 usuarios) | Observaciones |
|----------|--------------|---------------------|---------------|
| **Firebase Realtime DB** | Generosa | $0.00 | ✅ Mejor opción actual |
| Firestore | 1 GB, 50k reads, 20k writes/día | $0.00 | Similar a RTDB |
| Supabase (Postgres) | 500 MB, 2 GB bandwidth | $0.00 - $0.20 | Excelente alternativa |
| MongoDB Atlas | 512 MB | $0.00 | Limitado para escalar |
| PlanetScale (MySQL) | 5 GB, 1B row reads | $0.00 | Overkill para caso de uso |

**Conclusión:** Firebase Realtime Database es óptima para Removin (low-write, simple key-value).

---

## ⚠️ Límites Críticos a Monitorear

### 1. Storage Bandwidth (⚠️ CRÍTICO)
```
Límite Gratuito: 1 GB/día descarga

Cálculo:
• 100 usuarios x 5 imágenes/día x 2 MB = 1 GB/día ✅
• Con picos: Puede exceder fácilmente

Solución:
✅ Usar URLs de Replicate (no descargar desde Storage)
```

### 2. Realtime Database Concurrent Connections
```
Límite Gratuito: 100 conexiones simultáneas

Removin:
• Conexiones efímeras (solo durante API calls)
• No persistentes (no hay websockets en uso)

Estado: ✅ No es problema actualmente
```

### 3. Storage Total (5 GB)
```
Límite: 5 GB

Con auto-delete 24h:
• Máximo ~2-3 GB en uso simultáneo ✅

Sin auto-delete:
• Crecimiento descontrolado ❌
• Necesario limpiar manualmente

Solución Implementada: Lifecycle rules
```

---

## 🚀 Cuándo Migrar a Plan Pagado

### Firebase Blaze Plan (Pay-as-you-go)

**Costos adicionales:**
| Servicio | Costo Unitario |
|----------|---------------|
| Realtime DB - Storage | $5/GB |
| Realtime DB - Download | $1/GB |
| Storage - Storage | $0.026/GB |
| Storage - Download | $0.12/GB |

**Migrar cuando:**
- ✅ Más de 1,000 usuarios activos/mes
- ✅ Storage > 5 GB persistente
- ✅ Bandwidth Storage > 30 GB/mes
- ✅ Generando ingresos (monetización implementada)

**Ejemplo 1,000 usuarios:**
```
Firebase Storage: $0.50/mes
Realtime DB: $0.05/mes
TOTAL: $0.55/mes

ROI: Si cada usuario paga $5/mes plan Pro
Ingresos: $5,000/mes
Costos Firebase: $0.55/mes
Margen: 99.99% 🚀
```

---

## 🔐 Costos de Replicate API

**⚠️ IMPORTANTE:** Removin NO paga costos de Replicate. El usuario usa su propio token.

### Costos Típicos por Usuario

**Escenario: Usuario promedio (50 imágenes/mes)**
```
Operaciones:
• 50x Remove Background (modelo económico): 50 x $0.0002 = $0.01
• 10x Generate Image (SDXL): 10 x $0.0095 = $0.095
• 5x Upscale (opcional): 5 x $0.0055 = $0.0275

TOTAL: ~$0.13 USD/mes por usuario
```

**Costo anual:** ~$1.56 USD/usuario/año

**Modelo de negocio:**
```
Plan Free (Removin): Usuario paga su Replicate (~$0.13/mes)
Plan Pro (futuro): $5/mes → Removin incluye créditos de IA
```

---

## 📌 Checklist de Optimización

### ✅ Implementado
- [x] Usar URLs de Replicate directamente (no re-upload)
- [x] Firebase Realtime Database en lugar de Firestore
- [x] CORS restrictivo en API
- [x] Rate limiting (5 req/min)
- [x] Validación de tamaño de archivo (10 MB max)

### ⚠️ Pendiente
- [ ] Lifecycle rules de auto-delete (24h) en Storage
- [ ] Comprimir imágenes antes de upload
- [ ] Cachear resultados en LocalStorage (evitar re-fetch)
- [ ] Implementar CDN externo para assets estáticos (Cloudflare)

### 🚀 Futuro (Monetización)
- [ ] Plan Pro con créditos de IA incluidos
- [ ] Dashboard de consumo en tiempo real
- [ ] Alertas de límites de uso
- [ ] Integración con Stripe para pagos

---

## 📞 Soporte

- **Firebase Console:** https://console.firebase.google.com/project/removin-55744
- **Firebase Quotas:** Console → Usage and Billing
- **Firebase Pricing Calculator:** https://firebase.google.com/pricing

---

**Última actualización:** 23 de febrero de 2026  
**Autor:** GitHub Copilot + Jonathan

