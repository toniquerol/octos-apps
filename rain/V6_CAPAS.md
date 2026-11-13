# OcToS Rain V6 — Capas y mapas

## Nuevos controles
- Selector en cabecera: IGN Base, PNOA, Topográfico, IGN Gris, IGN Simplificado, Relieve, MDT visual y LiDAR IGN.
- Opacidad del mapa base ajustable de 0 % a 100 %.
- El LiDAR continúa disponible como superposición independiente con su propia opacidad.
- Nuevo catálogo de capas de los servicios utilizados en OcToS Carto: hidrografía, MDT, pendientes, inundaciones SNCZI/MITECO (retornos 10, 50, 100 y 500 años), riesgo, ARPSI, cobertura del suelo y unidades administrativas.
- Cada subcapa WMS tiene activación y regulador de opacidad individual.
- Orden explícito de dibujo en Leaflet: base (200), LiDAR (270), imagen local (310), ráster de análisis (350), cartografía oficial WMS (480), vectores calculados (490). Se mantienen las funciones de la V5.2.
- Catálogo situado en el menú lateral, después de «Capas visibles», sin modificar el asistente de hidrología.

## Comprobaciones
- Sintaxis JavaScript validada para app.js y catalog.js.
- Todos los identificadores DOM utilizados desde app.js se corresponden con elementos del index.html.
- Actualización del contenido de WordPress en la página de aplicaciones.

## Limitaciones
- Las capas WMS se descubren consultando `GetCapabilities` mediante fetch en el navegador. Algunos servicios pueden bloquear CORS, estar temporalmente caídos o no ofrecer datos a determinada escala/cobertura; en ese caso se muestra un aviso.
- Las fuentes se han trasladado desde el propio repositorio OcToS Carto, pero **no se ha completado una prueba de visualización end-to-end con cada subcapa**.
- La transparencia del mapa base puede dejar ver el fondo gris del visor y las superposiciones; no modifica los datos del MDT.
- Las áreas oficiales de inundación son cartografía de referencia, no resultados calculados por OcToS Rain.
