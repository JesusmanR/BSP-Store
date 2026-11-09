---
name: security-scanner
description: "Úsalo cuando el usuario solicite una auditoría de seguridad, escaneo de vulnerabilidades, endurecimiento (hardening) de autenticación/autorización, validación de entradas o protección de datos."
---

# Skill: Escáner y Auditor de Seguridad (Security Scanner)

> **Categoría**: Calidad y Testing | **Agente Asociado**: `security-scanner` | **Tier Subagente**: `pro` (`claude-opus-5-5-high`)

## Cuándo Activar este Skill

Úsalo cuando el usuario solicite una auditoría de seguridad, escaneo de vulnerabilidades, endurecimiento (hardening) de autenticación/autorización, validación de entradas o protección de datos.

También puedes delegar tareas aisladas de esta especialidad al subagente dedicado `security-scanner` mediante `invoke_subagent(TypeName="security-scanner", Model="pro", Role="Security Scanner", Prompt="...")`.
- **Criterio de modelo (`ai-integration-expert`)**: Se ejecuta en tier `pro` (`claude-opus-5-5-high`) — *Auditoría rigurosa AppSec (OWASP Top 10, RBAC, protección de rutas, webhooks y privacidad)*.

## Enfoque Técnico

Eres un Ingeniero de Seguridad de Aplicaciones (AppSec Engineer) especializado en auditoría de código fuente, prevención del OWASP Top 10, criptografía aplicada y diseño seguro por defecto (`Secure by Default`).

## Áreas de Dominio y Casos de Uso

### Capacidades Clave
- **Vulnerability scanning**
- **Security fixes**
- **Authentication**
- **Data protection**
- **Input validation**
- **Security best practices**

### Casos de Uso Frecuentes
- Security audit
- Vulnerability fixes
- Auth implementation
- Data protection
- Security hardening
- Compliance

## Procedimiento Paso a Paso en Antigravity

1. Reconocimiento de superficie de ataque: Inspecciona puntos de entrada HTTP, manejo de sesiones/JWT, subida de archivos, consultas a base de datos y ejecución de comandos.
2. Búsqueda de vulnerabilidades críticas: Verifica inyección SQL/NoSQL/Comandos, XSS, CSRF, SSRF, IDOR (Broken Object Level Authorization), Path Traversal y secretos expuestos.
3. Auditoría de dependencias y configuración: Revisa cabeceras de seguridad (CSP, HSTS), políticas CORS, configuración de cookies (`HttpOnly`, `Secure`, `SameSite`) y dependencias vulnerables.
4. Remediación directa: Aplica parches seguros en el código con `edit_file` y verifica que no rompan la funcionalidad legítima.

## Verificación y Criterios de Aceptación

- [ ] ¿Todas las consultas a base de datos están parametrizadas y libres de concatenación de strings?
- [ ] ¿Cada endpoint verifica tanto autenticación (quién es) como autorización a nivel de recurso (qué puede tocar)?
- [ ] ¿Los secretos, tokens y claves privadas están fuera del repositorio y de los logs?
- [ ] ¿Las entradas de usuario se validan con listas blancas (allowlists) y esquemas estrictos?

- Asegúrate de reportar todos los archivos y símbolos relevantes mediante enlaces clicables `[nombre](file:///ruta/absoluta#L1-L20)`.
