# 🔐 Configuración de Variables de Entorno en Vercel

## ⚠️ IMPORTANTE: Variables Requeridas para el Backend (API)

Para que el endpoint `/api/user/token` funcione correctamente y puedas guardar tokens de Replicate, **DEBES** configurar estas variables de entorno en Vercel:

### 1. Firebase Admin SDK (Backend)

```bash
FIREBASE_PROJECT_ID=removin-55744
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@removin-55744.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[TU_CLAVE_PRIVADA_COMPLETA]\n-----END PRIVATE KEY-----\n"
```

### 2. Frontend (Cliente)

```bash
VITE_FIREBASE_API_KEY=AIzaSyBbGWKaZXQZGPWh-J0hc1FkzZAle9Dn06Q
VITE_FIREBASE_APP_ID=1:1001416313768:web:48616ac87141f5e615eb9d
VITE_FIREBASE_AUTH_DOMAIN=removin-55744.firebaseapp.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1001416313768
VITE_FIREBASE_PROJECT_ID=removin-55744
VITE_FIREBASE_STORAGE_BUCKET=removin-55744.firebasestorage.app
```

### 3. Replicate (Backend)

```bash
REPLICATE_API_TOKEN=[TU_TOKEN_DE_REPLICATE]
```

### 4. Configuración del Entorno

```bash
NODE_ENV=production
FRONTEND_URL=https://removin.vercel.app
```

---

## 📋 Pasos para Configurar en Vercel

### Opción 1: Dashboard de Vercel (Recomendado)

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto **"removin"**
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable con su valor correspondiente
5. Asegúrate de seleccionar los entornos: **Production**, **Preview**, **Development**
6. Haz clic en **"Save"**

### Opción 2: CLI de Vercel

```bash
# Login en Vercel
vercel login

# Configurar variables de entorno
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
vercel env add VITE_FIREBASE_API_KEY
# ... agregar todas las demás variables

# Re-desplegar para aplicar los cambios
vercel --prod
```

---

## 🚨 Solución de Problemas

### Error: "Firebase Admin no está inicializado"

**Causa:** Las variables `FIREBASE_*` no están configuradas en Vercel

**Solución:**
1. Verifica que todas las variables estén en Vercel
2. Asegúrate de que `FIREBASE_PRIVATE_KEY` incluya `\n` (saltos de línea)
3. Re-despliega el proyecto después de agregar las variables

### Error 500 en `/api/user/token`

**Causa:** Firebase Realtime Database no puede conectarse

**Solución:**
1. Verifica que `FIREBASE_PROJECT_ID` sea correcto
2. Verifica que la clave privada tenga el formato correcto
3. Asegúrate de que el email de la cuenta de servicio sea correcto

### Error: "Respuesta inválida del servidor"

**Causa:** El servidor no está respondiendo con JSON

**Solución:**
1. Verifica los logs de Vercel para ver el error específico
2. Ve a **Vercel Dashboard** → **Tu Proyecto** → **Functions** → Ve los logs
3. Si ves "Firebase Admin no configurado", agrega las variables faltantes

---

## 🔍 Verificar que las Variables Estén Configuradas

### Desde Vercel Dashboard:

```bash
# Ver qué variables están configuradas
vercel env ls
```

### Probar el endpoint de health check:

```bash
curl https://removin.vercel.app/api/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "env": "production",
  "firebase": true
}
```

Si `"firebase": false`, significa que Firebase Admin no está inicializado correctamente.

---

## 📚 Recursos Adicionales

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Firebase Service Account](https://console.firebase.google.com/project/removin-55744/settings/serviceaccounts/adminsdk)

---

## ✅ Checklist Pre-Deploy

- [ ] Todas las variables `FIREBASE_*` están en Vercel
- [ ] Todas las variables `VITE_FIREBASE_*` están en Vercel
- [ ] `REPLICATE_API_TOKEN` está configurado
- [ ] `NODE_ENV=production` está configurado
- [ ] `FRONTEND_URL` apunta a la URL correcta de Vercel
- [ ] Se re-desplegó después de agregar las variables
- [ ] El health check responde `"firebase": true`
