# Guía de Subida a Hostinger — Solo FileZilla (3 Pasos, Sin hPanel ni phpMyAdmin)

Esta versión de **BSP Store** (rama `hostinger-php-mysql`) está lista para subir **únicamente por FileZilla**, **sin necesidad de entrar a Hostinger hPanel ni crear bases de datos en phpMyAdmin**, y con **$0 costo adicional**.

Incluye el **100 % del diseño visual, modo oscuro, panel administrador, carga masiva Excel, tarjeta PNG de datos, Bre-B `@bbbsp` + Wompi y seguridad OWASP**, ejecutando la API en **PHP 8 + SQLite integrado** (y también es 100 % compatible con MySQL si más adelante recuperas acceso a hPanel).

---

## Qué ya viene pre-generado en `dist-hostinger/`
Al ejecutar `npm run build:hostinger` se crea la carpeta **`C:\dev\bsp-store\dist-hostinger\`** con todo listo:
- Frontend completo optimizado (`index.html`, `catalogo/`, `producto/`, `cuenta/`, `admin/`, `checkout/`, `seguimiento/`, `images/`, etc.).
- Backend PHP 8 seguro en `api/` (`index.php`, controladores, validación binaria magic bytes, protección anti-XSS/SQLi/CSRF/IDOR).
- **`api/config.php`** ya creado con `'driver' => 'sqlite'` y claves aleatorias únicas de 64 caracteres (`auth_secret` y `cron_secret`).
- **`api/storage/db/bsp_store.sqlite`** ya pre-creada con las **28 tablas**, roles en español, 6 categorías, 6 marcas con logos oficiales, 6 productos iniciales, cupones (`BSPWELCOME10`, `BSPSETUP50`) y tarifas de envío en Colombia.
- **3 archivos `.htaccess` de seguridad**:
  - `.htaccess` (en la raíz): rutas limpias, cabeceras de seguridad (CSP, HSTS, X-Frame-Options) y bloqueo total de descarga de `.sqlite` o `config.php`.
  - `api/storage/db/.htaccess`: prohíbe cualquier acceso web directo a la base de datos.
  - `api/storage/uploads/.htaccess`: desactiva ejecución de PHP/scripts en imágenes subidas.

---

## Subir la Tienda en 3 Pasos (Solo FileZilla)

### Paso 1: Activar archivos ocultos en FileZilla
1. Abre **FileZilla** y conéctate a tu servidor Hostinger.
2. En el menú superior de FileZilla, activa:
   - **`Servidor` → `Forzar mostrar archivos ocultos`** *(vital para que suban los archivos `.htaccess`)*.
3. En el panel derecho (servidor), entra a la carpeta **`public_html/`**.
   - *(Tip: si ya tienes algo publicado y quieres probar primero sin borrarlo, sube todo dentro de `public_html/nueva/` o respalda antes lo que haya en `public_html/`).*

### Paso 2: Subir `dist-hostinger/` a `public_html/`
1. En el panel izquierdo de FileZilla, abre:
   `C:\dev\bsp-store\dist-hostinger\`
2. Selecciona **TODOS los archivos y carpetas dentro de `dist-hostinger/`** (incluyendo `.htaccess`, `index.html`, `_next`, `api`, `admin`, `cuenta`, `catalogo`, `images`, etc.) y arrástralos hacia **`public_html/`**.
3. Al terminar la transferencia, verifica con clic derecho → **Permisos de archivo** que estas carpetas tengan permiso **`755`** (por defecto Hostinger ya los pone en `755`):
   - `public_html/api/storage/db`
   - `public_html/api/storage/uploads/avatars`
   - `public_html/api/storage/uploads/catalog`

### Paso 3: Verificar y Asegurar tu Cuenta Admin
1. Abre en tu navegador:
   **`https://bspstore.com.co/api/v1/health`**
   Debe responder:
   ```json
   {"ok":true,"data":{"status":"ok","engine":"sqlite","database":"up"}}
   ```
2. Entra a **`https://bspstore.com.co/cuenta/`** e inicia sesión como administrador:
   - **Correo**: `admin@bspstore.com.co`
   - **Contraseña inicial**: `BspAdmin2026*`
3. **Recomendación de seguridad inmediata**:
   - Cambia la contraseña del administrador y desactiva la cuenta de prueba `cliente@bspstore.com.co` desde **`/admin/` → Clientes**.

---

## Opcional: Editar `public_html/api/config.php` por FileZilla más adelante
Cuando desees activar correos automáticos, pagos Wompi o Google OAuth, simplemente edita `public_html/api/config.php` directamente desde FileZilla (clic derecho → *Ver/Editar*):
- **Correos automáticos** (`mail.smtp_pass` o `mail.resend_api_key`): contraseña de `compras@bspstore.com.co` o clave gratuita de Resend.
- **Wompi Colombia** (`wompi.*`): tus llaves de producción cuando quieras recibir PSE/tarjetas además de Bre-B `@bbbsp`.
- **Google OAuth** (`google.*`): tus credenciales de Google Cloud Console (URL autorizada: `https://bspstore.com.co/api/v1/auth/google/callback`).
- **Migración futura a MySQL**: si algún día recuperas acceso a hPanel y quieres pasar de SQLite a MySQL, importa `php-api/database/bsp_store_mysql.sql` en phpMyAdmin y cambia en `api/config.php` únicamente `'driver' => 'mysql'` junto con `db.name`, `db.user` y `db.pass`.
