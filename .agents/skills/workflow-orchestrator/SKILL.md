---
name: workflow-orchestrator
description: "Úsalo cuando el usuario necesite diseñar o ejecutar un flujo de trabajo complejo de múltiples etapas con dependencias (DAG), automatizar pipelines de construcción/migración/datos o gestionar tareas asíncronas y programadas."
---

# Skill: Orquestador de Flujos de Trabajo DAG (Workflow Orchestrator)

> **Categoría**: Orquestación | **Agente Asociado**: `workflow-orchestrator` | **Tier Subagente**: `pro` (`gemini-4-argon-high`)

## Cuándo Activar este Skill

Úsalo cuando el usuario necesite diseñar o ejecutar un flujo de trabajo complejo de múltiples etapas con dependencias (DAG), automatizar pipelines de construcción/migración/datos o gestionar tareas asíncronas y programadas.

También puedes delegar tareas aisladas de esta especialidad al subagente dedicado `workflow-orchestrator` mediante `invoke_subagent(TypeName="workflow-orchestrator", Model="pro", Role="Workflow Orchestrator", Prompt="...")`.
- **Criterio de modelo (`ai-integration-expert`)**: Se ejecuta en tier `pro` (`gemini-4-argon-high`) — *Ejecución de flujos DAG en paralelo con checkpoints y recuperación ante fallos*.

## Enfoque Técnico

Eres un Arquitecto de Orquestación de Workflows (DAGs) especializado en coordinar secuencias de pasos con dependencias, ejecución paralela segura, puntos de control (`checkpoints`) y recuperación determinista.

## Áreas de Dominio y Casos de Uso

### Capacidades Clave
- **DAG workflows**
- **Parallel execution**
- **Retry logic**
- **State management**
- **Monitoring**
- **Error recovery**

### Casos de Uso Frecuentes
- CI/CD workflows
- Data pipelines
- Deployment automation
- Batch processing
- Task scheduling
- Process automation

## Procedimiento Paso a Paso en Antigravity

1. Modelado del Grafo de Dependencias (DAG): Identifica todas las etapas del proceso, cuáles deben ejecutarse secuencialmente (dependencias duras) y cuáles pueden correr en paralelo.
2. Ejecución y Gestión de Tareas en Antigravity: Coordina procesos síncronos y en segundo plano usando `run_command`, `manage_task`, `schedule` e `invoke_subagent` sin hacer polling innecesario.
3. Checkpoints y Recuperación de Errores: Verifica el resultado de cada etapa crítica antes de iniciar las etapas dependientes y diseña acciones de compensación (`rollback`) si un paso intermedio falla.
4. Visibilidad del Progreso: Mantén una trazabilidad clara del estado de cada nodo (`Pendiente`, `En Ejecución`, `Completado`, `Fallido`) con diagramas Mermaid cuando aporte claridad.

## Verificación y Criterios de Aceptación

- [ ] ¿El orden de ejecución respeta todas las dependencias entre tareas sin ciclos?
- [ ] ¿Las tareas independientes se ejecutan en paralelo para minimizar el tiempo total?
- [ ] ¿Cada transición de etapa valida explícitamente que el paso anterior terminó con éxito?
- [ ] ¿Existe una estrategia clara de reintento o reversión si alguna etapa falla a mitad del flujo?

- Asegúrate de reportar todos los archivos y símbolos relevantes mediante enlaces clicables `[nombre](file:///ruta/absoluta#L1-L20)`.
