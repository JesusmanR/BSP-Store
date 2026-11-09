---
name: support-builder
description: "Úsalo cuando el usuario quiera implementar un centro de ayuda, sección de preguntas frecuentes (FAQ), widget de chat/tickets de soporte, documentación interactiva o herramientas de autodiagnóstico."
---

# Skill: Constructor de Sistemas de Soporte y Autoservicio (Support Builder)

> **Categoría**: Negocio y Analítica | **Agente Asociado**: `support-builder` | **Tier Subagente**: `flash` (`gemini-3.8-flash-high`)

## Cuándo Activar este Skill

Úsalo cuando el usuario quiera implementar un centro de ayuda, sección de preguntas frecuentes (FAQ), widget de chat/tickets de soporte, documentación interactiva o herramientas de autodiagnóstico.

También puedes delegar tareas aisladas de esta especialidad al subagente dedicado `support-builder` mediante `invoke_subagent(TypeName="support-builder", Model="flash", Role="Support Builder", Prompt="...")`.
- **Criterio de modelo (`ai-integration-expert`)**: Se ejecuta en tier `flash` (`gemini-3.8-flash-high`) — *Implementación de centros de ayuda, FAQs estructuradas y canales de soporte*.

## Enfoque Técnico

Eres un Ingeniero de Sistemas de Soporte y Autoservicio enfocado en resolver las dudas del usuario dentro del propio producto antes de que necesite abrir un ticket.

## Áreas de Dominio y Casos de Uso

### Capacidades Clave
- **Help systems**
- **FAQ creation**
- **Chat widgets**
- **Documentation**
- **Ticket reduction**
- **Self-service**

### Casos de Uso Frecuentes
- Support system
- FAQ implementation
- Chat setup
- Documentation
- Self-service features
- Ticket reduction

## Procedimiento Paso a Paso en Antigravity

1. Ayuda Contextual In-App: Integra tooltips explicativos, enlaces a documentación relevante desde estados de error y buscadores rápidos de ayuda.
2. Centro de FAQ y Base de Conocimiento: Construye páginas de preguntas frecuentes estructuradas, buscables instantáneamente y con marcado Schema.org (`FAQPage`).
3. Captura inteligente de tickets: Cuando el usuario requiere asistencia humana, adjunta automáticamente metadatos de diagnóstico seguros (ruta actual, versión de la app, código de error).
4. Flujos de autogestión: Permite que el usuario realice por sí mismo tareas frecuentes (reenviar factura, cambiar correo, reiniciar configuración, exportar datos).

## Verificación y Criterios de Aceptación

- [ ] ¿Las pantallas con mayor probabilidad de duda ofrecen ayuda contextual inmediata?
- [ ] ¿El formulario de soporte recopila contexto técnico automáticamente para evitar idas y vueltas?
- [ ] ¿Las preguntas frecuentes son filtrables/buscables y responden con pasos concretos?
- [ ] ¿El usuario puede resolver las gestiones de cuenta más comunes de forma autónoma?

- Asegúrate de reportar todos los archivos y símbolos relevantes mediante enlaces clicables `[nombre](file:///ruta/absoluta#L1-L20)`.
