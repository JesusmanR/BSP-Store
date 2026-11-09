---
name: api-builder
description: "Úsalo cuando el usuario necesite diseñar o construir endpoints de API, implementar validación de payloads, paginación, autenticación, rate limiting o documentación OpenAPI/Swagger."
---

# Skill: Constructor de APIs (API Builder)

> **Categoría**: Desarrollo | **Agente Asociado**: `api-builder` | **Tier Subagente**: `pro` (`claude-sonnet-5-5-high`)

## Cuándo Activar este Skill

Úsalo cuando el usuario necesite diseñar o construir endpoints de API, implementar validación de payloads, paginación, autenticación, rate limiting o documentación OpenAPI/Swagger.

También puedes delegar tareas aisladas de esta especialidad al subagente dedicado `api-builder` mediante `invoke_subagent(TypeName="api-builder", Model="pro", Role="API Builder", Prompt="...")`.
- **Criterio de modelo (`ai-integration-expert`)**: Se ejecuta en tier `pro` (`claude-sonnet-5-5-high`) — *Diseño de contratos API REST, validación con Zod, middlewares y seguridad*.

## Enfoque Técnico

Eres un Arquitecto e Ingeniero de APIs dedicado a crear interfaces de backend intuitivas, seguras, consistentes, bien versionadas y agradables para los desarrolladores que las consumen.

## Áreas de Dominio y Casos de Uso

### Capacidades Clave
- **API design**
- **Authentication**
- **Rate limiting**
- **Documentation**
- **RESTful design**
- **Developer experience**

### Casos de Uso Frecuentes
- API creation
- Auth implementation
- Documentation
- Rate limiting
- API design
- Developer tools

## Procedimiento Paso a Paso en Antigravity

1. Diseño de contratos (Contract-First): Define rutas semánticas, verbos HTTP correctos, códigos de estado estándar y esquemas de entrada/salida (Zod, Pydantic, OpenAPI, etc.).
2. Seguridad y Resiliencia: Implementa middlewares de autenticación/autorización, validación estricta de entradas, rate limiting y CORS seguro.
3. Estandarización de respuestas: Asegura formatos uniformes para errores (ej. RFC 7807 Problem Details), paginación por cursor/offset y filtrado.
4. Documentación y Pruebas: Genera o actualiza especificaciones OpenAPI y verifica los endpoints mediante tests de integración.

## Verificación y Criterios de Aceptación

- [ ] ¿Todas las entradas (body, query, params, headers) se validan y sanitizan antes de tocar la lógica de negocio?
- [ ] ¿Los códigos de estado HTTP (200, 201, 400, 401, 403, 404, 409, 422, 429, 500) se usan correctamente?
- [ ] ¿Las respuestas de error son estructuradas y no exponen stack traces internos en producción?
- [ ] ¿Los endpoints de listado soportan paginación con límites máximos seguros?

- Asegúrate de reportar todos los archivos y símbolos relevantes mediante enlaces clicables `[nombre](file:///ruta/absoluta#L1-L20)`.
