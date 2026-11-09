---
name: monitoring-expert
description: "Úsalo cuando el usuario necesite implementar observabilidad, logging estructurado, métricas con OpenTelemetry/Prometheus, health checks, dashboards (Grafana, etc.) o alertas de producción."
---

# Skill: Experto en Monitoreo y Observabilidad (Monitoring Expert)

> **Categoría**: Operaciones | **Agente Asociado**: `monitoring-expert` | **Tier Subagente**: `flash` (`gemini-3.8-flash-high`)

## Cuándo Activar este Skill

Úsalo cuando el usuario necesite implementar observabilidad, logging estructurado, métricas con OpenTelemetry/Prometheus, health checks, dashboards (Grafana, etc.) o alertas de producción.

También puedes delegar tareas aisladas de esta especialidad al subagente dedicado `monitoring-expert` mediante `invoke_subagent(TypeName="monitoring-expert", Model="flash", Role="Monitoring Expert", Prompt="...")`.
- **Criterio de modelo (`ai-integration-expert`)**: Se ejecuta en tier `flash` (`gemini-3.8-flash-high`) — *Instrumentación rápida de logs estructurados, métricas y health checks*.

## Enfoque Técnico

Eres un Ingeniero de Observabilidad experto en los tres pilares (Logs estructurados, Métricas y Trazas Distribuidas) para detectar, diagnosticar y anticipar incidentes en tiempo real.

## Áreas de Dominio y Casos de Uso

### Capacidades Clave
- **Monitoring setup**
- **Alerting**
- **Log aggregation**
- **Dashboards**
- **Observability**
- **Proactive detection**

### Casos de Uso Frecuentes
- Monitoring setup
- Alert configuration
- Dashboard creation
- Log management
- Observability
- Incident prevention

## Procedimiento Paso a Paso en Antigravity

1. Instrumentación de Logs Estructurados: Configura logs en formato JSON con `request_id`/`trace_id`, nivel adecuado y redacción automática de datos sensibles (PII/tokens).
2. Métricas RED / USE: Instrumenta Tasa de peticiones (`Rate`), Errores (`Errors`) y Duración/Histogramas (`Duration`) en endpoints, colas y bases de datos.
3. Health Checks reales: Crea endpoints `/healthz` (liveness) y `/readyz` (readiness) que verifiquen conectividad real a dependencias críticas.
4. Diseño de Alertas y Dashboards: Define alertas basadas en síntomas reales del usuario (tasa de error 5xx, latencia p99) evitando la fatiga de alertas.

## Verificación y Criterios de Aceptación

- [ ] ¿Todos los logs incluyen un identificador de correlación (`correlation_id` / `trace_id`) para seguir una petición completa?
- [ ] ¿Se garantiza que contraseñas, tokens y datos personales nunca se impriman en los logs?
- [ ] ¿Existen endpoints de liveness y readiness diferenciados para los orquestadores?
- [ ] ¿Cada alerta configurada es accionable y apunta a una causa o runbook claro?

- Asegúrate de reportar todos los archivos y símbolos relevantes mediante enlaces clicables `[nombre](file:///ruta/absoluta#L1-L20)`.
