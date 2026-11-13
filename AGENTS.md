# AGENTS.md — OcToS / Codex

## Regla principal: intervención localizada y consumo eficiente
Antes de modificar código, identifica exactamente qué comportamiento, componente, función o pantalla afecta a la petición. Trabaja solo sobre ese alcance. **No releas, analices, reescribas ni reformatees todo el repositorio por defecto.**

## Procedimiento por tarea
1. Resume internamente la petición y determina los archivos o módulos probables.
2. Localiza primero por nombre de archivo, ruta, componente, selector o símbolo con búsquedas acotadas (por ejemplo, `rg --files` y `rg -n`). Evita listar o abrir indiscriminadamente todos los archivos.
3. Lee únicamente los fragmentos y dependencias necesarios para entender y resolver el cambio. Aprovecha el contexto ya disponible; no releas archivos completos si no hace falta.
4. Implementa el **parche mínimo y preciso**. Conserva la arquitectura, los nombres, la interfaz y el comportamiento de otras funciones.
5. Comprueba primero el área modificada: revisión del diff, sintaxis y pruebas específicas disponibles. No ejecutes baterías completas, builds globales ni refactorizaciones preventivas si no son necesarios.
6. Al finalizar, indica brevemente los archivos cambiados, qué se solucionó y qué verificaciones se realizaron. Señala cualquier prueba que no se pudo ejecutar.

## Límites de alcance
- No modifiques código ajeno a la petición ni introduzcas mejoras «de paso».
- No cambies estilos, estructura, dependencias, configuraciones ni versiones si el usuario no lo solicita.
- No instales paquetes ni generes archivos voluminosos sin necesidad técnica.
- No repitas búsquedas, lecturas o pruebas que ya aportaron información suficiente.
- Cuando el problema cruce módulos, amplía el análisis **progresivamente** y solo hasta las dependencias justificadas; explica por qué fue necesario.
- Si hay varias soluciones, prioriza la más simple, localizada, reversible y compatible con el funcionamiento existente.
- Conserva el diseño e identidad corporativa OcToS y las versiones estables; no sustituyas funcionalidades validadas sin indicación expresa.

## Elección de esfuerzo
- Ajustes de texto, dimensiones, distribución y estilos: análisis breve y cambios puntuales.
- Funciones nuevas o integración entre pocos módulos: análisis focalizado en dependencias directas.
- Fallos transversales, seguridad, arquitectura o regresiones complejas: análisis más amplio solo cuando la evidencia lo requiera.
- No aumentes deliberadamente el razonamiento, el número de pasos ni las llamadas a herramientas por tareas triviales. **La calidad y la corrección prevalecen si una verificación adicional es necesaria.**

El objetivo es **resolver exactamente lo pedido con la menor lectura, el menor diff y las comprobaciones suficientes**, sin sacrificar la fiabilidad.
