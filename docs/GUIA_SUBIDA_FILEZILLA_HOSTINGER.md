# Guía Paso a Paso: Subir BSP Store a Hostinger (FileZilla + PHP 8 + MySQL) — $0 Costo Extra

Esta versión de **BSP Store** (rama `hostinger-php-mysql`) conserva el **100 % del diseño visual, modo oscuro, panel administrador, carga masiva Excel, tarjeta PNG de datos, Bre-B `@bbbsp` + Wompi y seguridad OWASP**, pero ejecuta toda la API en **PHP 8 + MySQL (PDO)** directamente en tu plan actual de Hostinger.

---

## Paso 1: Verificar versión de PHP en Hostinger hPanel
1. Ingresa a **Hostinger hPanel → Avanzado → Configuración PHP**.
2. Selecciona **PHP 8.2** o **PHP 8.3** (recomendado) y verifica que estén activas las extensiones `pdo_mysql`, `curl`, `mbstring` y `openssl` (vienen activas por defecto).

---

## Paso 2: Crear la Base de Datos MySQL e importar el SQL
1. En **Hostinger hPanel → Bases de datos → Gestión**:
   - Crea una base de datos (ej. `u123456789_bsp_store`), un usuario (ej. `u123456789_bsp_user`) y una contraseña fuerte.
   - Anota exactamente esos 3 datos.
2. Haz clic en **Ingresar a phpMyAdmin** junto a tu base de datos nueva.
3. En la pestaña **Importar**, selecciona el archivo:
   - `php-api/database/bsp_store_mysql.sql` (o `IMPORTAR_EN_PHPMYADMIN_bsp_store.sql`).
4. Pulsa **Importar / Continuar**. Esto creará las **28 tablas** y cargará los roles, categorías, marcas con logos oficiales, productos iniciales, cupones (`BSPWELCOME10`, `BSPSETUP50`) y transportadoras de Colombia.

---

## Paso 3: Generar y Subir los Archivos por FileZilla
1. En tu PC (`C:\dev\bsp-store`), si hiciste cambios visuales, regenera el paquete con:
   ```powershell
   npm run build:hostinger
   ```
   Esto genera la carpeta lista **`dist-hostinger/`**.
2. Abre **FileZilla**, conéctate a tu cuenta de Hostinger y entra a **`public_html/`** (o al subdominio de pruebas `public_html/staging/` si deseas probar primero sin tocar tu tienda actual).
3. Arrastra y sube **TODO el contenido interno** de `dist-hostinger/` hacia `public_html/`:
   - **Importante**: Asegúrate de que en FileZilla esté activa la opción *Servidor → Forzar mostrar archivos ocultos* para verificar que subieron ambos archivos **`.htaccess`**:
     - `public_html/.htaccess`
     - `public_html/api/storage/uploads/.htaccess`

---

## Paso 4: Configurar `config.php` en el Servidor
1. En `public_html/api/`, copia `config.example.php` y renómbralo a **`config.php`**.
2. Edita `config.php` con tus datos reales de Hostinger:
   - `db.host`: `'127.0.0.1'` (o `'localhost'`)
   - `db.name`, `db.user`, `db.pass`: los creados en el Paso 2.
   - `app_url`: `'https://bspstore.com.co'`
   - `auth_secret`: una cadena aleatoria única de 64 caracteres.
   - `mail.smtp_pass`: contraseña del correo `compras@bspstore.com.co` en Hostinger (para enviar correos automáticos de pedidos, guías y recuperación de contraseña vía `smtp.hostinger.com:465`).
   - `wompi.*`: tus llaves productivas de Wompi Colombia cuando estés listo para cobrar con PSE/tarjetas.
   - `google.*`: tus credenciales OAuth 2.0 (opcional, si activas "Continuar con Google").
3. Verifica permisos de carpetas en FileZilla:
   - `public_html/api/storage/uploads/avatars` → `755`
   - `public_html/api/storage/uploads/catalog` → `755`

---

## Paso 5: Verificación Inmediata y Seguridad Post-Instalación
1. Abre `https://bspstore.com.co/api/v1/health` → debe responder `{"ok":true,"data":{"status":"ok","engine":"mysql","database":"up"}}`.
2. Inicia sesión en `https://bspstore.com.co/cuenta/` con:
   - **Admin**: `admin@bspstore.com.co` / `BspAdmin2026*`
3. **¡Obligatorio antes de abrir al público!**:
   - Cambia la contraseña de `admin@bspstore.com.co` por una clave fuerte única.
   - Desactiva o elimina el usuario de prueba `cliente@bspstore.com.co`.
   - En **Hostinger hPanel → Avanzado → Tareas Cron** (opcional, para ofertas programadas con fecha), agrega cada 15 minutos:
     ```bash
     curl -s -X POST -H "Authorization: Bearer TU_CRON_SECRET" https://bspstore.com.co/api/v1/cron/offers > /dev/null
     ```
