# Catálogo y Reglas de Orquestación de los 60 Agentes Especializados

Este entorno cuenta con **60 especialistas** adaptados de [claudecodeagents.com](https://www.claudecodeagents.com/) a la arquitectura nativa de **Google Antigravity**, auditados por `ai-integration-expert` con asignación óptima de modelos (`pro` vs `flash`).

## Política de Selección de Modelos Auditada (`ai-integration-expert`)

- **Tier `pro` (44 agentes)**: Asignado a especialistas de arquitectura, seguridad, bases de datos, lenguajes tipados, frameworks full-stack, testing automatizado, DevOps profundo y orquestación.
  - **Razonamiento Arquitectónico, Datos, Seguridad y Orquestación**: `gemini-4-argon-high` / `claude-opus-5-5-high`.
  - **Implementación de Código, APIs, Next.js/React, TypeScript y Pruebas**: `claude-sonnet-5-5-high` / `gemini-4-argon-medium`.
- **Tier `flash` (16 agentes)**: Asignado a especialistas de ejecución rápida y focalizada (`gemini-3.8-flash-high`): UI polish, UX flows, microcopy, SEO técnico, accesibilidad, analítica de eventos, plantillas de email, soporte y optimización móvil.

---

## Directorio Completo de Especialistas (12 Categorías · 60 Agentes)

### Estrategia de Producto (5 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `product-strategist` | **Estratega de Producto (Product Strategist)** | `pro` | `gemini-4-argon-high` | Especialista en estrategia de producto que analiza el codebase y las funcionalidades para tomar decisiones de construcción o eliminación (build/kill), priorizar el roadmap y definir métricas de éxito. |
| `growth-engineer` | **Ingeniero de Crecimiento (Growth Engineer)** | `flash` | `gemini-3.8-flash-high` | Especialista en ingeniería de crecimiento (Growth Engineering) que diseña e implementa bucles virales, sistemas de referidos, onboarding de alta conversión y experimentos A/B en el código. |
| `user-researcher` | **Investigador de Usuarios (User Researcher)** | `flash` | `gemini-3.8-flash-high` | Especialista en investigación UX que analiza flujos reales de usuario en la aplicación, detecta puntos de abandono (rage quits) y propone e implementa mejoras concretas. |
| `revenue-optimizer` | **Optimizador de Ingresos (Revenue Optimizer)** | `pro` | `gemini-4-argon-high` | Experto en monetización que identifica oportunidades de ingresos en el código, implementa niveles de precios (pricing tiers), pasarelas de pago, suscripciones y mejoras de checkout. |
| `market-analyst` | **Analista de Mercado (Market Analyst)** | `pro` | `gemini-4-argon-medium` | Especialista en análisis competitivo y posicionamiento de producto que compara tus funcionalidades frente al mercado y detecta ventajas competitivas diferenciadoras. |

### Desarrollo (8 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `system-architect` | **Arquitecto de Sistemas (System Architect)** | `pro` | `claude-opus-5-5-high` | Experto en arquitectura de software que transforma codebases desordenados en sistemas limpios, modulares y escalables aplicando patrones de diseño probados. |
| `code-refactorer` | **Refactorizador de Código (Code Refactorer)** | `pro` | `claude-sonnet-5-5-high` | Especialista en refactorización y calidad de código que transforma código complejo o duplicado en implementaciones legibles, rápidas, tipadas y fáciles de mantener. |
| `api-builder` | **Constructor de APIs (API Builder)** | `pro` | `claude-sonnet-5-5-high` | Experto en diseño y desarrollo de APIs REST/GraphQL/RPC robustas, con validación de esquemas, autenticación, rate limiting, manejo de errores consistente y documentación OpenAPI. |
| `database-expert` | **Experto en Bases de Datos (Database Expert)** | `pro` | `gemini-4-argon-high` | Especialista en bases de datos SQL y NoSQL que optimiza consultas lentas, diseña esquemas escalables, define índices estratégicos y planifica migraciones sin tiempo de inactividad. |
| `integration-master` | **Maestro de Integraciones (Integration Master)** | `pro` | `claude-sonnet-5-5-high` | Especialista en integración de servicios externos que implementa flujos OAuth, clientes HTTP resilientes, webhooks verificados, reintentos con backoff exponencial y circuit breakers. |
| `mobile-optimizer` | **Optimizador Móvil y PWA (Mobile Optimizer)** | `flash` | `gemini-3.8-flash-high` | Experto en web móvil y Progressive Web Apps (PWA) que logra una experiencia nativa en teléfonos con soporte offline, gestos táctiles, diseño responsivo y alto rendimiento en redes móviles. |
| `performance-engineer` | **Ingeniero de Rendimiento (Performance Engineer)** | `pro` | `gemini-4-argon-high` | Experto en optimización de rendimiento que localiza cuellos de botella en CPU, memoria, red y renderizado, e implementa estrategias de caché, concurrencia y carga diferida. |
| `accessibility-pro` | **Especialista en Accesibilidad (Accessibility Pro)** | `flash` | `gemini-3.8-flash-high` | Especialista en accesibilidad web (a11y) que garantiza cumplimiento WCAG 2.1/2.2 AA+, compatibilidad con lectores de pantalla, navegación completa por teclado y uso correcto de ARIA. |

### Diseño y UX (4 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `ux-optimizer` | **Optimizador de UX (UX Optimizer)** | `flash` | `gemini-3.8-flash-high` | Experto en optimización de experiencia de usuario que simplifica flujos confusos, reduce clics innecesarios y hace que la navegación y las acciones principales sean intuitivas. |
| `ui-polisher` | **Pulidor de Interfaz (UI Polisher)** | `flash` | `gemini-3.8-flash-high` | Experto en diseño visual de interfaces que eleva el acabado estético de la aplicación con espaciado armónico, tipografía cuidada, micro-interacciones y estados visuales pulidos. |
| `content-writer` | **Redactor UX y Microcopy (Content Writer)** | `flash` | `gemini-3.8-flash-high` | Especialista en UX Writing y microcopy que transforma mensajes de error técnicos, etiquetas ambiguas y textos vacíos en guías claras, humanas y orientadas a la acción. |
| `design-system-builder` | **Constructor de Sistemas de Diseño (Design System Builder)** | `pro` | `claude-sonnet-5-5-high` | Experto en sistemas de diseño que construye librerías de componentes reutilizables, tokens de diseño (colores, tipografía, espaciado), variantes tipadas y guías de estilo consistentes. |

### Calidad y Testing (6 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `test-generator` | **Generador de Pruebas (Test Generator)** | `pro` | `claude-sonnet-5-5-high` | Especialista en pruebas automatizadas que diseña y escribe suites completas de tests unitarios, de integración y E2E cubriendo casos borde, errores y regresiones. |
| `security-scanner` | **Escáner y Auditor de Seguridad (Security Scanner)** | `pro` | `claude-opus-5-5-high` | Experto en seguridad de aplicaciones (AppSec) que detecta vulnerabilidades (OWASP Top 10, inyecciones, XSS, CSRF, secretos expuestos, fallos de autorización) y las corrige en el código. |
| `code-reviewer` | **Revisor de Código Senior (Code Reviewer)** | `pro` | `claude-opus-5-5-high` | Ingeniero Senior que realiza revisiones exhaustivas de código detectando bugs lógicos, problemas de concurrencia, regresiones de rendimiento, brechas de seguridad y deuda técnica. |
| `load-tester` | **Especialista en Pruebas de Carga (Load Tester)** | `pro` | `gemini-4-argon-medium` | Especialista en pruebas de carga, estrés y escalabilidad que simula miles de usuarios concurrentes, identifica puntos de quiebre del sistema y optimiza su capacidad. |
| `playwright-expert` | **Especialista en Automatización E2E con Playwright (Playwright Expert)** | `pro` | `claude-sonnet-5-5-high` | Experto en pruebas End-to-End (E2E) con Playwright: selectores accesibles resilientes (`getByRole`), Page Object Model, aislamiento de autenticación, intercepción de red y ejecución paralela sin tests inestables (flaky). |
| `debugger` | **Especialista en Depuración y Análisis de Causa Raíz (Debugger)** | `pro` | `gemini-4-argon-high` | Experto en investigación de errores, análisis de stack traces, reproducción sistemática de bugs, diagnóstico de fallos en tests, condiciones de carrera y fugas de memoria. |

### Operaciones (5 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `deployment-wizard` | **Especialista en CI/CD y Despliegues (Deployment Wizard)** | `pro` | `claude-sonnet-5-5-high` | Experto en DevOps y automatización de despliegues que configura pipelines CI/CD (GitHub Actions, GitLab CI, etc.) rápidos, seguros y sin pasos manuales hasta producción. |
| `infrastructure-builder` | **Arquitecto de Infraestructura Cloud (Infrastructure Builder)** | `pro` | `gemini-4-argon-high` | Experto en arquitectura cloud (AWS, GCP, Azure) e Infraestructura como Código que diseña topologías escalables, seguras, de alta disponibilidad y eficientes en costos. |
| `monitoring-expert` | **Experto en Monitoreo y Observabilidad (Monitoring Expert)** | `flash` | `gemini-3.8-flash-high` | Especialista en observabilidad que implementa logs estructurados, métricas (Prometheus/OpenTelemetry), trazas distribuidas, dashboards y alertas accionables antes de que los usuarios noten fallos. |
| `release-manager` | **Gestor de Lanzamientos (Release Manager)** | `pro` | `gemini-4-argon-medium` | Experto en gestión de releases que garantiza despliegues sin tiempo de inactividad mediante feature flags, despliegues canary/blue-green, versionado semántico y rollbacks inmediatos. |
| `cost-optimizer` | **Optimizador de Costos Cloud (Cost Optimizer)** | `flash` | `gemini-3.8-flash-high` | Especialista en FinOps y optimización de costos en la nube que detecta recursos ociosos, ajusta tamaños de instancias (right-sizing), optimiza transferencia de datos y configura auto-escalado. |

### Negocio y Analítica (7 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `analytics-engineer` | **Ingeniero de Analítica de Producto (Analytics Engineer)** | `flash` | `gemini-3.8-flash-high` | Especialista en analítica de producto que diseña taxonomías de eventos limpias, instrumenta embudos de conversión, cohortes de retención y métricas accionables de comportamiento. |
| `email-automator` | **Especialista en Automatización de Emails (Email Automator)** | `flash` | `gemini-3.8-flash-high` | Experto en sistemas de correo transaccional y secuencias automatizadas (onboarding, recuperación, notificaciones) con plantillas responsivas, alta entregabilidad y envíos en segundo plano. |
| `support-builder` | **Constructor de Sistemas de Soporte y Autoservicio (Support Builder)** | `flash` | `gemini-3.8-flash-high` | Especialista en sistemas de atención al cliente y autoservicio que construye centros de ayuda interactivos, FAQs buscables, widgets de soporte contextual y diagnóstico guiado. |
| `compliance-expert` | **Especialista en Cumplimiento y Privacidad (Compliance Expert)** | `pro` | `gemini-4-argon-high` | Especialista técnico en privacidad y cumplimiento normativo (GDPR, CCPA, LOPD, cookies, trazabilidad) que implementa gestión de consentimiento, portabilidad y derecho al olvido en el código. |
| `seo-master` | **Maestro en SEO Técnico (SEO Master)** | `flash` | `gemini-3.8-flash-high` | Experto en SEO técnico que optimiza metadatos dinámicos, OpenGraph, datos estructurados JSON-LD (Schema.org), sitemaps XML, robots.txt, URLs canónicas y Core Web Vitals. |
| `community-features` | **Constructor de Funcionalidades de Comunidad (Community Features)** | `flash` | `gemini-3.8-flash-high` | Especialista en funcionalidades sociales y de comunidad que implementa perfiles de usuario, comentarios anidados, foros, reacciones, notificaciones y herramientas de moderación. |
| `landing-page-optimizer` | **Optimizador de Landing Pages y Conversión (Landing Page Optimizer)** | `flash` | `gemini-3.8-flash-high` | Experto en optimización de conversión (CRO) y copywriting para landing pages que estructura propuestas de valor claras, titulares de alto impacto, prueba social y llamados a la acción (CTAs). |

### IA e Innovación (3 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `ai-integration-expert` | **Experto en Integración de IA y LLMs (AI Integration Expert)** | `pro` | `gemini-4-argon-high` | Especialista en integrar capacidades de Inteligencia Artificial y LLMs en aplicaciones: streaming en tiempo real, llamadas a herramientas (function calling), embeddings, búsqueda semántica y control de costos. |
| `automation-builder` | **Constructor de Automatizaciones y Jobs (Automation Builder)** | `flash` | `gemini-3.8-flash-high` | Experto en automatización de procesos, tareas programadas (cron jobs), colas de trabajo en segundo plano, triggers por eventos y pipelines que eliminan el trabajo manual repetitivo. |
| `innovation-lab` | **Laboratorio de Innovación y Prototipado Rápido (Innovation Lab)** | `pro` | `gemini-4-argon-high` | Especialista en prototipado rápido y exploración de tecnologías emergentes (WebGPU, WebAssembly, IA multimodal, tiempo real, APIs modernas del navegador) para validar ideas ambiciosas en tiempo récord. |

### Especialistas de Lenguaje (6 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `typescript-pro` | **Especialista Avanzado en TypeScript (TypeScript Pro)** | `pro` | `claude-sonnet-5-5-high` | Experto en TypeScript avanzado: genéricos complejos, inferencia de tipos, tipos condicionales y mapeados, uniones discriminadas, type guards y configuración estricta (`strict: true`) sin `any`. |
| `python-pro` | **Especialista Avanzado en Python (Python Pro)** | `pro` | `claude-sonnet-5-5-high` | Experto en Python idiomático y moderno (3.11+): `type hints` completos, programación asíncrona (`asyncio`), decoradores, context managers, generadores, Pydantic, `ruff`/`mypy` y alto rendimiento. |
| `rust-engineer` | **Ingeniero de Sistemas en Rust (Rust Engineer)** | `pro` | `claude-opus-5-5-high` | Experto en programación de sistemas en Rust: ownership, borrowing, lifetimes, traits, concurrencia sin data races (`Tokio`/async), manejo de errores con `Result` y abstracciones de costo cero. |
| `go-expert` | **Especialista en Go (Go Expert)** | `pro` | `claude-sonnet-5-5-high` | Experto en Go (Golang) idiomático y concurrente: goroutines, channels, `context.Context`, interfaces pequeñas, manejo explícito de errores y servicios de red de alta velocidad. |
| `java-architect` | **Arquitecto Java Empresarial (Java Architect)** | `pro` | `gemini-4-argon-high` | Arquitecto Java experto en Java moderno (17/21+), Virtual Threads, records, sealed classes, patrones de diseño SOLID, optimización de la JVM y sistemas empresariales escalables. |
| `csharp-developer` | **Desarrollador Senior C# y .NET (C# Developer)** | `pro` | `claude-sonnet-5-5-high` | Experto en C# moderno y .NET (8/9+): `async`/`await` con `CancellationToken`, LINQ eficiente, Entity Framework Core optimizado, Clean Architecture, inyección de dependencias y Minimal APIs. |

### Especialistas de Frameworks (6 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `nextjs-expert` | **Experto en Next.js Full-Stack (Next.js Expert)** | `pro` | `claude-sonnet-5-5-high` | Especialista en Next.js (App Router, React Server Components, Server Actions, caché, ISR/SSR, Middleware, Edge Runtime y optimización de Core Web Vitals). |
| `react-specialist` | **Especialista en React y Arquitectura de Componentes (React Specialist)** | `pro` | `claude-sonnet-5-5-high` | Experto en React moderno: diseño de custom hooks, composición de componentes, gestión de estado local/remoto/global, concurrencia y eliminación de `useEffect` innecesarios. |
| `vue-expert` | **Experto en Vue 3 y Ecosistema Reactivo (Vue Expert)** | `pro` | `claude-sonnet-5-5-high` | Especialista en Vue 3 (`<script setup lang='ts'>`, Composition API, composables reutilizables, Pinia, Vue Router y reactividad fina sin pérdida de referencias). |
| `django-developer` | **Desarrollador Senior Django y DRF (Django Developer)** | `pro` | `claude-sonnet-5-5-high` | Experto en desarrollo web con Python y Django: optimización del ORM (`select_related`/`prefetch_related`), Django REST Framework, personalización del Admin, permisos y tareas con Celery. |
| `laravel-specialist` | **Especialista en Laravel y PHP Moderno (Laravel Specialist)** | `pro` | `claude-sonnet-5-5-high` | Experto en Laravel y PHP 8.2+: Eloquent ORM optimizado, Form Requests, API Resources, colas/jobs, eventos, Policies de autorización y pruebas con Pest/PHPUnit. |
| `spring-boot-engineer` | **Ingeniero de Microservicios Spring Boot (Spring Boot Engineer)** | `pro` | `gemini-4-argon-high` | Experto en Spring Boot 3, Spring Security 6, Spring Data JPA, validación Bean Validation, manejo global de errores (`@RestControllerAdvice`), Actuator y microservicios listos para producción. |

### DevOps Profundo (4 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `kubernetes-specialist` | **Especialista en Kubernetes y Cloud Native (Kubernetes Specialist)** | `pro` | `gemini-4-argon-high` | Experto en orquestación de contenedores con Kubernetes: manifiestos listos para producción, Helm charts, Kustomize, sondas de salud, HPA, NetworkPolicies, RBAC y flujos GitOps. |
| `terraform-expert` | **Experto en Terraform e IaC (Terraform Expert)** | `pro` | `gemini-4-argon-high` | Especialista en Infraestructura como Código con Terraform / OpenTofu: diseño de módulos reutilizables, gestión segura del estado remoto (`tfstate`), variables tipadas y despliegues multi-entorno. |
| `docker-expert` | **Experto en Docker y Contenedores (Docker Expert)** | `pro` | `claude-sonnet-5-5-high` | Especialista en contenedorización con Docker: `Dockerfile` multi-etapa (multi-stage) ultraligeros, optimización de caché de capas, seguridad rootless, `.dockerignore` y entornos `docker-compose.yml`. |
| `sre-engineer` | **Ingeniero de Confiabilidad de Sitios (SRE Engineer)** | `pro` | `gemini-4-argon-high` | Ingeniero SRE que define SLIs/SLOs, presupuestos de error (error budgets), patrones de resiliencia (circuit breakers, timeouts, degradación elegante), respuesta a incidentes y postmortems. |

### Datos y Machine Learning (4 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `prompt-engineer` | **Ingeniero de Prompts y Evaluación de LLMs (Prompt Engineer)** | `pro` | `gemini-4-argon-high` | Especialista en ingeniería de prompts que diseña instrucciones de sistema robustas, ejemplos few-shot, razonamiento paso a paso, salidas estructuradas deterministas, optimización de tokens y suites de evaluación. |
| `ml-engineer` | **Ingeniero de Machine Learning y MLOps (ML Engineer)** | `pro` | `gemini-4-argon-high` | Ingeniero de Machine Learning que construye pipelines de entrenamiento reproducibles, ingeniería de características sin fuga de datos (data leakage), evaluación rigurosa, registro de modelos e inferencia en producción. |
| `data-engineer` | **Ingeniero de Datos y Pipelines ETL/ELT (Data Engineer)** | `pro` | `gemini-4-argon-high` | Especialista en ingeniería de datos que diseña pipelines ETL/ELT idempotentes, modelado dimensional en Data Warehouses (dbt, SQL, Spark, Polars), procesamiento batch/streaming y contratos de calidad de datos. |
| `langchain-expert` | **Experto en Arquitecturas RAG y Agentes LLM (LangChain Expert)** | `pro` | `gemini-4-argon-high` | Especialista en desarrollo de aplicaciones con LangChain / LangGraph / LlamaIndex, sistemas RAG (Retrieval-Augmented Generation), bases de datos vectoriales, memoria conversacional y grafos de agentes. |

### Orquestación (2 especialistas)

| ID (`TypeName` / `Skill`) | Especialista | Tier (`model`) | Modelo CLI Recomendado | Especialidad |
| :--- | :--- | :---: | :--- | :--- |
| `multi-agent-coordinator` | **Coordinador Multi-Agente (Multi-Agent Coordinator)** | `pro` | `gemini-4-argon-high` | Especialista en orquestación multi-agente en Antigravity que descompone proyectos complejos en subtareas independientes, delega en subagentes especializados (`invoke_subagent`) y sintetiza e integra los resultados. |
| `workflow-orchestrator` | **Orquestador de Flujos de Trabajo DAG (Workflow Orchestrator)** | `pro` | `gemini-4-argon-high` | Experto en diseño y ejecución de flujos de trabajo basados en grafos acíclicos dirigidos (DAG), gestión de tareas en paralelo, reintentos, checkpoints de estado y recuperación ante fallos. |
