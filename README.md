# BSP Store Colombia — Plataforma E-Commerce & Consola Administrativa

Plataforma comercial real, escalable, segura y administrable para **BSP Store Colombia**, desarrollada con **Next.js 15 (App Router)**, **React 19**, **TypeScript 5.8**, **Tailwind CSS v4**, **API REST v1 desacoplada (`/api/v1/*`)**, **Zod**, **PostgreSQL 17** y **Prisma ORM**, preparada tanto para operación web como para la futura aplicación móvil en **Flutter / Dart**.

---

## 1. Arquitectura y Características Principales

- **Identidad Visual Oficial BSP Store**: Línea gráfica con azul eléctrico (`#168BFF`), negro carbón (`#10151F`), superficies claras (`#F4F7FB`), tipografías locales (`Sora` + `Inter`) y emblemas oficiales claro/oscuro (`public/images/logo-bsp-light.jpg` y `logo-bsp-dark.jpg`).
- **Estrategia Híbrida de Pagos para Colombia**:
  1. **Transferencia Inmediata con Llave Bre-B (`@bbbsp`)**: **$0 COP de comisión** desde cualquier banco o billetera colombiana; el pedido queda en `PENDING_BREB_VERIFICATION` y el cliente reporta el número de comprobante para validación administrativa.
  2. **Wompi Colombia**: Exclusivo para **PSE** y **Tarjetas de Crédito/Débito**, con firma criptográfica `SHA-256` en servidor y procesamiento idempotente de Webhooks (`PaymentEvent.eventId @unique`).
- **Modelo Relacional Completo (27 Tablas en PostgreSQL 17)**:
  - `Role`, `User`, `OAuthAccount`, `Session`, `PasswordResetToken`, `Address`, `Category`, `Brand`, `Product`, `ProductImage`, `ProductVariant`, `Inventory`, `InventoryMovement`, `Cart`, `CartItem`, `Favorite`, `Coupon`, `Discount`, `ShippingZone`, `Carrier`, `Order`, `OrderItem`, `Payment`, `PaymentEvent`, `Shipment`, `StoreSetting` y `AuditLog`.
- **Panel Administrativo Independiente (`/admin`)**:
  - Protegido por RBAC (`ADMIN` y `STAFF`) con dashboard de reportes ejecutivos, aprobación/rechazo de comprobantes Bre-B (`@bbbsp`), registro de guías de transportadoras (`Servientrega`, `Coordinadora`, `Inter Rapidísimo`, `Envía`), CRUD de productos/categorías/marcas, control de inventario auditado y gestión de clientes/roles.
- **Seguridad, SEO Técnico y Cumplimiento Colombiano**:
  - Cumplimiento de **Ley 1581 de 2012 (Habeas Data)** en `/api/v1/privacy/me` (portabilidad JSON y anonimización) y **Ley 1480 de 2011 (Estatuto del Consumidor)**.
  - `/sitemap.xml` dinámico, `/robots.txt`, JSON-LD `Schema.org` (`OnlineStore`, `Product`, `BreadcrumbList`) y cabeceras HTTP de seguridad.

---

## 2. Requisitos Locales en Windows

- **Node.js**: `v20.x+` / `v24.x`
- **PostgreSQL**: `17.x` ejecutándose en `localhost:5432`
- **Git**: `2.x`

---

## 3. Instalación y Puesta en Marcha Local

```powershell
# 1. Instalar dependencias
npm install

# 2. Sincronizar los 27 modelos en PostgreSQL 17 y cargar datos semilla
npx prisma db push
npm run db:seed

# 3. Iniciar servidor de desarrollo en http://localhost:3000
npm run dev
```

### Cuentas Semilla de Prueba (Entorno Local)
| Rol | Correo | Contraseña | Acceso |
| :--- | :--- | :--- | :--- |
| **Administrador (`ADMIN`)** | `admin@bspstore.com.co` | `BspAdmin2026*` | Tienda + Consola `/admin` |
| **Cliente (`CUSTOMER`)** | `cliente@bspstore.com.co` | `BspCliente2026*` | Tienda + Perfil `/cuenta` |

### Cupones Semilla Activos
- `BSPWELCOME10`: 10% de descuento en compras desde `$200.000 COP`.
- `BSPSETUP50`: `$50.000 COP` de descuento en compras desde `$600.000 COP`.

---

## 4. Comandos de Verificación, Pruebas y Copias de Seguridad

```powershell
# Validación estricta de tipos TypeScript
npm run typecheck

# Suite de 25 pruebas unitarias y de integración con PostgreSQL 17 (Vitest)
npm test

# Pruebas End-to-End de navegador (Playwright)
npm run test:e2e

# Compilación optimizada de producción
npm run build

# Generar respaldo comprimido (.dump + .sha256) de PostgreSQL 17
npm run db:backup
```

---

## 5. Flujo de Trabajo Git (GitFlow) y Despliegue

- **`develop`**: Rama principal de integración continua donde se desarrollan y verifican todas las funcionalidades.
- **`main`**: Rama exclusiva para versiones estables de producción (`releases`).
- Consulta la guía detallada de requisitos de hosting, migración paso a paso sin tiempo de inactividad, plan de reversión (`rollback`) e integración con Flutter en [`docs/DEPLOYMENT_AND_MIGRATION.md`](file:///C:/dev/bsp-store/docs/DEPLOYMENT_AND_MIGRATION.md).
