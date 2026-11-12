# OcToS Rain V1

Aplicación estática independiente de análisis topográfico. Publicación prevista: https://toniquerol.github.io/octos-apps/rain/

## Abrir

En Internet abre la URL publicada. En local, instala Node.js y ejecuta `node server.mjs` desde esta carpeta. Abre http://127.0.0.1:8765. No abras index.html mediante file://: los módulos y Web Workers necesitan HTTP. El HTML requiere las carpetas js, css, assets y vendor incluidas. No usa IA, cuentas de ChatGPT, bases de datos ni servidores de cálculo. Los mapas oficiales requieren Internet; las bibliotecas están incluidas.

## Cargar terreno

Descarga un MDT numérico del [CNIG](https://centrodedescargas.cnig.es/CentroDescargas/modelos-digitales-elevaciones), preferiblemente MDT02 o MDT05. Los productos disponibles y su precisión dependen de la cobertura. Selecciona un recorte con margen aguas arriba antes de importar si el archivo supera el límite de celdas. Importa GeoTIFF/COG monobanda con cotas en metros, malla norte-arriba y CRS UTM EPSG:25828–25831, 32628–32631 o 4083. Otros CRS requieren reproyección previa, por ejemplo con QGIS. No se reproyectan ni remuestrean silenciosamente los datos numéricos.

Para COG remoto necesitas una URL directa HTTPS con CORS y lectura por rangos; la descarga oficial automática por hoja no está implementada. La importación local es la alternativa. No se importan nubes LAS/LAZ. La capa LiDAR IGN es solo visual y nunca alimenta cálculos.

## Funciones implementadas

- Mapas IGN, PNOA, topográfico y gris; LiDAR visual; catálogos WMS de hidrografía e inundaciones oficiales consultados al desplegarlos.
- GeoTIFF/COG, recorte, NoData, límites de memoria, consulta puntual, elevaciones, pendientes, orientación, sombreado y curvas de nivel.
- Priority-Flood, D8, acumulación topológica en m², profundidad de relleno de depresiones, cauces por umbral, seguir agua y cuenca aguas arriba.
- Perfiles con vértices editables, consulta sobre el gráfico, distancias y desniveles.
- Parcela por centros de celda; planos fijo, inclinado, de mejor ajuste y balance. Desmonte/terraplén en m³. La orientación del plano señala la dirección ascendente; la cota se sitúa en el centroide de celdas seleccionadas. Comparación mediante selector entre elevaciones originales y superficie proyectada.
- GeoJSON WGS84, CSV y PDF mediante impresión del navegador. El informe imprime el mapa visible: revisa la vista y las capas antes de imprimir.

## Límites de esta V1

No es una simulación hidráulica certificada: no incluye lluvia, infiltración, red de alcantarillado, caudales, obras de drenaje ni inundación dinámica. La acumulación mide área aportante, no litros. El relleno permite continuidad del flujo y puede atravesar depresiones originales; no representa desbordamiento hidráulico real. Las superficies planas se resuelven con el árbol de Priority-Flood y tienen direcciones convencionales.

NoData y bordes son salidas abiertas. Una cuenca que los toca puede estar truncada. Superficies/volúmenes usan celdas cuyo centro cae dentro del polígono: el borde tiene incertidumbre de discretización. Las unidades de altura deben verificarse en la ficha del producto cuando no están declaradas. El sombreado y las imágenes de visualización no cambian las cotas.

Pendiente de próximas versiones: mosaico de múltiples MDT, identificación/descarga automática de hojas, flechas de dirección, inventario individual de depresiones con volúmenes, división de parcelas por sectores, comparador deslizante, gradientes personalizados, gestión unificada de orden de todos los ráster y PDF con composición paginada avanzada. Sin validación de precisión sobre un levantamiento real aportado por el usuario. Compatibilidad móvil adaptada por CSS, pendiente de pruebas en dispositivos físicos.

## Pruebas

Ejecuta `node --test tests/*.test.mjs`. Incluye superficies sintéticas: pendiente uniforme, valle V, dos cuencas, depresión, horizontal, NoData, bordes, cota fija, plano inclinado y volúmenes conocidos; más lectura real GeoTIFF, coordenadas, pendientes y curvas. `tests/fixture-utm.tif` es exclusivamente un ensayo sintético y no terreno IGN. Importación y cálculo de acumulación probados también en navegador.

## Referencias y dependencias

Priority-Flood: Barnes, Lehman y Mulla (2014), doi:10.1016/j.cageo.2013.04.024. [RichDEM](https://richdem.readthedocs.io/en/latest/depression_filling.html). Direcciones D8 y acumulación topológica implementadas de forma independiente. [Productos PNOA](https://pnoa.ign.es/pnoa-lidar/productos-a-descarga).

Leaflet 1.9.4, geotiff.js 2.1.3 y proj4 2.12.1 se distribuyen con sus licencias en vendor/. Logos originales aportados por el titular. Servicios IGN comprobados con respuestas HTTP 200 el 12/11/2026; disponibilidad y cobertura externas pueden variar. El código y los activos de Carto no se modifican ni se cargan desde Rain.
