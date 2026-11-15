# Patrón de iconos OcToS — implementación en octos-apps

Este patrón rige los **símbolos de aplicación**. No modifica la firma corporativa ni el monograma «T». La especificación externa titulada «Patrón de iconos OcToS» y sus cuatro imágenes maestras no estaban disponibles como archivos adjuntos en la conversación de implementación. Por tanto esta familia es una normalización provisional basada en el **manual corporativo OcToS 3D Studio** y los iconos del proyecto, no una reproducción verificada de esos cuatro originales.

## Geometría y color
- SVG de geometría real, `viewBox="0 0 160 160"`, sin `<image>` ni raster incrustado.
- Transparencia total del lienzo y los espacios negativos; nunca colocar placas de fondo ni sombras exteriores.
- Grafito **#2A2B2F** en estructura y naranja corporativo **#FF6A1A** en acción, fenómeno o foco principal.
- Variante `icon-light.svg` con grafito sustituido por blanco cálido **#F1F1EF** para cabeceras y tarjetas oscuras. Naranja, trazado y transparencia idénticos.
- Trazos redondeados, contornos consistentes, siluetas diferentes por función; sin palabras dentro del icono.
- Pruebas objetivo: 24, 32, 48, 64 y 128 píxeles sobre blanco y carbón. Evitar redibujar el símbolo para cada tamaño salvo pérdida demostrada de legibilidad.

## Archivos canónicos y uso
- Cada aplicación mantiene **una fuente maestra** en su carpeta `<app>/icon.svg`; su variante clara está en `<app>/icon-light.svg`.
- OcToS Apps utiliza `apps-icon.svg` y `apps-icon-light.svg` en la raíz.
- `shared/icons/catalog.json` registra función real, concepto, rutas y exportaciones.
- Exportaciones: `icon-128.png` transparente y `favicon-32.png` transparente por aplicación (prefijo `apps-` en raíz). Los SVG son preferentes donde el navegador lo permite.
- Para páginas con fondo oscuro usar el SVG claro en las imágenes de catálogo y menú; el favicon se mantiene en SVG estándar y PNG de respaldo.
- Los iconos de **controles internos**, marcadores de mapa, logotipo de WordPress y monograma corporativo no pertenecen a esta familia: no deben reemplazarse en bloque.

## Compatibilidad y referencias
Los cuatro iconos anteriores enlazados desde WordPress se conservan como **referencias históricas de URL** en `shared/icons/legacy-urls.json`; no equivalen a los cuatro archivos adjuntos solicitados ni a copias binarias inmutables.
La web externa de WordPress queda fuera del repositorio; esta implementación solo actualiza `octos-apps`.

## Verificación
Revisar XML SVG y ausencia de imágenes embebidas; alfa cero en bordes y huecos; contraste en ambos fondos; tamaños del catálogo; enlaces de SVG, PNG y favicon; cabeceras y vista móvil. No alterar contenido funcional de los visores para corregir un icono.

## Lámina y regeneración
- [Comparativa interactiva de tamaños sobre ambos fondos](comparativa.html) y [lámina PNG](comparativa.png).
- Para regenerar `icon-128.png` y `favicon-32.png` desde las fuentes SVG: `python shared/icons/export_png.py` (requiere CairoSVG).
- El documento externo de patrón y las cuatro referencias maestras no se han guardado porque **no se recibieron sus archivos**; no se han sustituido por archivos inventados.
