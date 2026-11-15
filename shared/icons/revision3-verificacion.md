# Verificación localizada — OcToS iconos, revisión 3

Fecha: 2026-11-15

- SVG regenerados: Drive, Carto, Meteo, Rain, Aero y Roads (6 maestros + 6 variantes claras).
- Exportaciones derivadas: 12 PNG (6 × 128 px y 6 × 32 px).
- Aplicaciones sin dibujo modificado: Apps, Layers, Templates, Team, Kitchen.
- Fuentes verificadas mediante parseo XML; ninguna contiene `<image>` raster incrustado.
- Previsualización local en 24, 32, 48, 64 y 128 píxeles, sobre fondos claros y oscuros.
- Alfa en esquinas de PNG: 0; tanto el hueco del pin Carto como las ventanillas Aero son transparentes, no colores de fondo pintados.
- Fuentes de Drive y Carto reproducen en vector los conceptos aprobados en sus láminas de referencia.
- Los catálogos y la navegación mantienen rutas de `icon-light.svg` existentes, por lo que la sustitución actualiza las imágenes sin refactorizar su código.
- No se modifica ningún botón funcional, logotipo «T» ni archivo ajeno a iconografía/documentación.

Comprobación pendiente tras integrar: carga de GitHub Pages en navegador real y posibles cachés; no equivale a la comprobación de que exista un despliegue publicado.
