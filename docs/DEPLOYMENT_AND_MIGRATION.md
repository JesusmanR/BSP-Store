# Guía de Preparación de Despliegue, Requisitos de Hosting, Migración Paso a Paso y Plan de Rollback — BSP Store Colombia

> **Importante**: Durante la etapa actual todo el desarrollo y las pruebas se ejecutan localmente en Windows (`C:\dev\bsp-store`). **No se modifica la tienda actual en producción (`bspstore.com.co`) ni su configuración DNS** hasta contar con verificación completa en un entorno de preproducción (`staging`) y autorización expresa.

---

## 1. Requisitos Técnicos del Hosting de Destino

Antes de desplegar la plataforma en el servidor de producción actual o futuro, confirma que el proveedor de hosting cumpla con:

| Componente | Requisito Mínimo | Recomendado en Producción | Propósito en BSP Store |
| :--- | :--- | :--- | :--- |
| **Node.js Runtime** | `v20.18+` LTS | `v22.x LTS` o `v24.x` | Ejecución del servidor Next.js 15 App Router, SSR dinámicos y API REST `/api/v1/*`. |
| **Base de Datos** | PostgreSQL `15+` | PostgreSQL `17.x` | Soporte transaccional ACID para los 27 modelos relacionales de Prisma ORM. |
| **Memoria RAM** | `2 GB RAM` | `4 GB RAM` (2 vCPU) | Compilación de bundles y atención concurrente de tráfico web + futura App Flutter. |
| **Almacenamiento** | `20 GB SSD NVMe` | `40 GB SSD NVMe` | Almacenamiento de PostgreSQL, imágenes optimizadas (`AVIF`/`WebP`) y respaldos `.dump`. |
| **SSL / TLS** | TLS 1.2 / 1.3 activo | Let's Encrypt / Cloudflare SSL | Obligatorio para cookies `HttpOnly; Secure` y recepción de Webhooks firmados de Wompi. |

---

## 2. Variables de Entorno de Producción (`.env`)

Configura estas variables en el panel seguro del servidor de destino (**nunca** las incluyas en Git):

```ini
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://bspstore.com.co"

# PostgreSQL 17 con SSL activo
DATABASE_URL="postgresql://bsp_prod_user:<PASSWORD_SEGURO>@<HOST_BD>:5432/bsp_store?schema=public&sslmode=require"

# Secreto criptográfico de sesiones (mínimo 32 bytes aleatorios)
AUTH_SECRET="<GENERAR_CON_openssl_rand_-hex_32>"

# Estrategia Híbrida de Pagos Colombia:
# 1. Transferencia inmediata sin costo con Llave Bre-B (@bbbsp)
NEXT_PUBLIC_BREB_KEY="@bbbsp"
BREB_MERCHANT_NAME="BSP Store Colombia"

# 2. Wompi Colombia (PSE y Tarjetas de Crédito/Débito)
NEXT_PUBLIC_WOMPI_PUBLIC_KEY="pub_prod_..."
WOMPI_PRIVATE_KEY="prv_prod_..."
WOMPI_INTEGRITY_SECRET="prod_integrity_..."
WOMPI_EVENTS_SECRET="prod_events_..."
WOMPI_ENVIRONMENT="production"

# Google OAuth 2.0 (Opcional si se activa login con Google en producción)
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

---

## 3. Estrategia de Copias de Seguridad (`pg_dump` y `pg_restore`)

El proyecto incluye scripts automatizados en PowerShell con verificación de integridad criptográfica `SHA-256`:

### Generar una copia de seguridad completa (`.dump` + `.sha256`)
```powershell
npm run db:backup
```
- Genera `backups/bsp_store_YYYYMMDD_HHMMSS.dump` y su archivo `.sha256`.
- Aplica política de retención automática (por defecto conserva los últimos 30 días).

### Restaurar una copia de seguridad verificando su hash `SHA-256`
```powershell
powershell -ExecutionPolicy Bypass -File scripts/db-restore.ps1 -BackupFile "backups/bsp_store_YYYYMMDD_HHMMSS.dump"
```

---

## 4. Plan de Migración Paso a Paso (Cero Tiempo de Inactividad)

### Etapa A — Preparación en Preproducción (`staging.bspstore.com.co`)
1. Crear la base de datos PostgreSQL 17 de producción y configurar las variables `.env`.
2. Clonar la rama estable desde GitHub (`https://github.com/JesusmanR/BSP-Store.git`).
3. Instalar dependencias y sincronizar el esquema relacional:
   ```bash
   npm ci
   npx prisma generate
   npx prisma db push
   ```
4. Compilar y arrancar el servidor de aplicación en un puerto interno (ej. `3000`) detrás de Nginx / Caddy / Reverse Proxy bajo el subdominio temporal `staging.bspstore.com.co`:
   ```bash
   npm run build
   npm start
   ```

### Etapa B — Validación Operativa Pre-Corte
1. Verificar el endpoint de salud: `GET https://staging.bspstore.com.co/api/v1/health` -> debe responder `200 OK` con `"database": "up"`.
2. Ingresar a `https://staging.bspstore.com.co/admin`, cambiar la contraseña inicial del administrador y cargar/verificar el inventario real.
3. Realizar un pedido de prueba con **Llave Bre-B (`@bbbsp`)** y aprobarlo desde `/admin`.
4. Configurar la URL del Webhook en el comercio de Wompi (`https://bspstore.com.co/api/v1/webhooks/wompi`) y verificar una transacción PSE/Tarjeta.

### Etapa C — Corte Controlado de DNS (Cutover)
1. 24 horas antes del lanzamiento, reducir el TTL del registro DNS `A` / `CNAME` de `bspstore.com.co` a `300` segundos (5 minutos).
2. Ejecutar un respaldo completo de la tienda anterior y un `npm run db:backup` de la nueva base de datos.
3. Apuntar el registro `A` / `CNAME` o el bloque de VirtualHost de `bspstore.com.co` hacia la nueva instancia Next.js.
4. Verificar certificado SSL, `/sitemap.xml`, `/robots.txt` y recepción de webhooks en vivo.

---

## 5. Plan de Reversión Inmediata (`Rollback` en < 2 minutos)

Si durante la ventana de lanzamiento se detecta cualquier anomalía crítica:

1. **Rollback de Tráfico / DNS (Inmediato)**:
   - Restablecer el VirtualHost del proxy inverso o el registro DNS hacia la instancia anterior de la tienda.
2. **Rollback de Versión de Código (GitFlow)**:
   ```bash
   git checkout main
   git reset --hard <TAG_O_COMMIT_ESTABLE_ANTERIOR>
   npm ci && npm run build && pm2 reload bsp-store
   ```
3. **Rollback de Base de Datos PostgreSQL**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/db-restore.ps1 -BackupFile "backups/<SNAPSHOT_PRE_DESPLIEGUE>.dump"
   ```

---

## 6. Guía de Conexión para la Futura Aplicación Móvil en Flutter / Dart

Toda la lógica de negocio está desacoplada en `/api/v1/*` y lista para consumirse desde **Flutter** (`dio` o `http`):

- **Autenticación Móvil**:
  - `POST /api/v1/auth/login` o `POST /api/v1/auth/google` devuelve `{ ok: true, data: { user, sessionToken, expiresAt } }`.
  - La app Flutter guarda `sessionToken` en `flutter_secure_storage` y lo envía en cada petición mediante el encabezado:
    ```http
    Authorization: Bearer <sessionToken>
    ```
- **Catálogo, Carrito y Checkout Móvil**:
  - `GET /api/v1/products?category=...&q=...&sort=...`
  - `GET / POST /api/v1/cart`
  - `POST /api/v1/shipping/quote` y `POST /api/v1/coupons/validate`
  - `POST /api/v1/orders` (devuelve `brebInstructions` para `@bbbsp` o `wompiSession.checkoutUrl` para abrir en `CustomTabs` / `SFSafariViewController` / WebView).
  - `POST /api/v1/orders/{orderNumber}` (registro de comprobante Bre-B desde el teléfono).
