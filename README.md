# BSP Store — Plataforma E-Commerce Colombia (v2.0)

Plataforma comercial escalable, segura y administrable para **BSP Store** en Colombia, migrando el diseño de Figma Make a una arquitectura full-stack moderna preparada para Web y futura aplicación móvil en **Flutter / Dart**.

---

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind CSS v4, fuentes variables locales (`Inter` y `Sora`).
- **Backend**: Node.js, API REST versionada (`/api/v1/*`), validación de esquemas con **Zod**, manejo centralizado de errores (`AppError`), rate limiting y arquitectura en capas (`Controlador -> Servicio -> Acceso a Datos`).
- **Base de Datos**: PostgreSQL 17 + **Prisma ORM** (27 modelos relacionales).
- **Autenticación y Seguridad**: Hash `bcryptjs`, sesiones persistentes en PostgreSQL (`HttpOnly` Cookie para Web + `Bearer Token` para futura app móvil en Flutter), vinculación con **Google OAuth**, recuperación de contraseña con tokens de un solo uso y control de acceso basado en roles (`CUSTOMER`, `STAFF`, `ADMIN`).
- **Medios de Pago en Colombia**:
  - **Transferencia inmediata Bre-B (`@bbbsp`)**: $0 COP comisión / sin costo de pasarela.
  - **Wompi Colombia**: Exclusivo para PSE, tarjetas de crédito/débito y otros medios de pago de pasarela.
- **Pruebas Automatizadas**: **Vitest** + Testing Library (unitarias e integración con PostgreSQL 17) y **Playwright** (E2E).
- **Orquestación Agéntica**: Catálogo de 60 agentes y skills especializados en `.agents/` (`AGENTS.md`).

---

## Estado de Avance por Fases

- [x] **Fase 1: Diagnóstico y Preparación** — Completada y aprobada.
- [x] **Fase 2: Fundación** — Completada y aprobada.
- [x] **Fase 3: Interfaz (Migración de Figma Make a Next.js App Router)** — Completada y aprobada.
- [x] **Fase 4: Backend, Modelo Relacional (27 tablas en PostgreSQL 17), Autenticación (`/cuenta`, Google OAuth) y API REST (`/api/v1/*`)** — Completada y verificada.
- [ ] **Fase 5: Operación Comercial (Carrito persistente en BD, Checkout transaccional, Pagos Bre-B `@bbbsp` + Wompi con Webhooks idempotentes y Envíos)** — Siguiente fase.
- [ ] **Fase 6: Panel Administrativo Independiente (`/admin`)**
- [ ] **Fase 7: Pruebas E2E, Seguridad, SEO Técnico y Rendimiento**
- [ ] **Fase 8: Preparación del Despliegue y Documentación Final**

---

## Flujo de Trabajo GitFlow y Pipeline CI/CD

El repositorio implementa una política estricta basada en **GitFlow** y verificación continua automatizada vía **GitHub Actions**:

### 1. Política de Ramas (GitFlow)

- **`develop`**: Rama activa de integración y desarrollo principal (Fases 1 a 8). Todo desarrollo activo converge aquí mediante Pull Requests y revisiones automáticas.
- **`feature/fase-*`**: Ramas de trabajo aisladas por fase (p. ej. `feature/fase-5-operacion-comercial`). Cada incremento funcional se desarrolla en su rama de feature y se integra exclusivamente en `develop` una vez superada la suite de pruebas.
- **`main`**: Rama protegida exclusiva para versiones estables y lanzamientos oficiales verificados en producción.

### 2. Integración Continua (CI Pipeline)

El workflow [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml) se ejecuta automáticamente en cada `push` y `pull_request` dirigidos a `develop` y `main`:

- **Servicio PostgreSQL 17**: Despliega un contenedor de base de datos PostgreSQL 17 con sondas de salud (`pg_isready`).
- **Validación Automatizada**:
  1. `npm ci`: Instalación limpia y determinista de dependencias.
  2. `npx prisma db push`: Sincronización inmutable del esquema relacional (27 modelos).
  3. `npm run db:seed`: Siembra de roles RBAC, usuarios de prueba, categorías, marcas y catálogo tecnológico.
  4. `npm run typecheck`: Validación estricta de tipos con TypeScript (`tsc --noEmit`).
  5. `npm test`: Ejecución de suite unitaria y de integración con Vitest.
  6. `npm run build`: Compilación y optimización de producción con Next.js App Router.
- **Seguridad y Concurrencia**: Permisos mínimos (`permissions: contents: read`) y cancelación de ejecuciones obsoletas en progreso (`cancel-in-progress: true`).

---

## Requisitos e Instalación Local en Windows

1. **Clonar el repositorio e instalar dependencias**:
   ```powershell
   npm install
   ```
2. **Configurar variables de entorno**:
   Copia `.env.example` a `.env` y ajusta la cadena de conexión local a PostgreSQL 17:
   ```powershell
   Copy-Item .env.example .env
   ```
3. **Sincronizar esquema Prisma y sembrar datos iniciales en PostgreSQL 17**:
   ```powershell
   npm run db:push
   npm run db:seed
   ```
4. **Ejecutar verificaciones y servidor de desarrollo**:
   ```powershell
   npm run typecheck
   npm test
   npm run dev
   ```
   Abrir `http://localhost:3000`.
