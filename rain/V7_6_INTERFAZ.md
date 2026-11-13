# OcToS Rain V7.6 · Limpieza de interfaz 3D

## Modificaciones
- Panel de render 3D: situado **abajo a la derecha**, más compacto.
- Eliminado texto de instrucciones de navegación y botones Girar / Mover del panel. Se mantienen los controles de ratón y táctiles implementados en V7.5.
- Exageración vertical predeterminada **1×**, rango **1–3×**, paso **0,1×**, marcas 1 / 1,1 / 1,2 / 1,5 / 2 / 2,5 / 3.
- Panel de cámara: **Vista en planta**, **Guardar vista** y **Recentrar terreno**.
- **Vista en planta** coloca la cámara casi vertical sobre el modelo completo.
- **Guardar vista** descarga un PNG del render 3D actual, incluidas las partículas visibles.
- **Recentrar terreno** recupera el centro y orientación iniciales.
- Escala Leaflet del visor 2D centrada en la zona inferior.
- Ficha del estudio en la parte superior izquierda del mapa, con elevaciones, resolución, EPSG, superficie, estado del drenaje y miniatura cenital del terreno. Si existe una cuenca calculada, se resalta en azul y se señala la salida.
- La ficha se puede contraer; al importar otro terreno se actualizan sus datos.

## Sin cambios
- Importación de varios GeoTIFF y cálculo del drenaje.
- Superficie de relieve 3D, mapa base seleccionado y transparencia.
- Trayectorias D8, reproducción Play, y navegación pan/rotación/zoom.

## Atribución
Se mantiene la atribución legal exigible a los mapas oficiales IGN/CNIG; no se eliminan créditos obligatorios. Se eliminan los textos explicativos duplicados del panel 3D.

## Validación
- Sintaxis JavaScript y coincidencia entre IDs de la interfaz y referencias del controlador: comprobadas.
- Publicación del código y actualización de WordPress efectuadas.
- Pendiente prueba visual en navegador con MDT real y comprobación manual de la captura PNG.
