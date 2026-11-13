# OcToS Rain V4 — estado de funcionalidades

## Implementado
- Módulo **00 · Selección de zona**: punto de interés, rectángulo, polígono y vista actual.
- Importación múltiple de GeoTIFF/COG locales (hasta 32 ficheros seleccionables).
- Mosaico georreferenciado en memoria a resolución original: mismo EPSG, mismo tamaño de celda y alineación verificada.
- Se conserva el primer valor en solapes; se indican conflictos de más de 0,2 m y vacíos NoData.
- Los flujos D8, pendientes y curvas se calculan sobre el mosaico unido, no por hoja.
- Los controles de lluvia y escorrentía de V3 se conservan.
- La opción de exportar GeoTIFF continúa en el apartado Terreno; su funcionamiento depende de la implementación GeoTIFF.js y está pendiente de verificación con muestras reales.

## Límites explícitos
- **No hay integración de descarga automática CNIG**: la página del catálogo MDT02 no proporciona, en esta implementación, un inventario de URLs COG directas con permisos CORS comprobados. Se enlaza el catálogo oficial para descargar las hojas.
- La opción de «punto de interés» **no delimita automáticamente la cuenca** antes de tener elevaciones. Tras importar el mosaico, hay que calcular drenaje y marcar la salida en «Cuenca aguas arriba».
- **No hay motor hidrológico distribuido por bloques**. El mosaico se crea en memoria y limita la cuadrícula resultante a 12 millones de celdas, sin degradar su resolución. Para más extensión, se debe trabajar por recortes.
- Los GeoTIFF deben compartir CRS y resolución y estar alineados a la misma rejilla; no se reproyectan automáticamente durante el mosaico.
- Un polígono de selección se usa para determinar la envolvente rectangular del recorte, no como máscara de NoData.
- El modelo de lluvia de V3 es volumétrico simplificado, no simula tiempos de concentración o inundación.
- No se ha realizado prueba de navegador end-to-end con cuatro hojas oficiales MDT02 en esta sesión.

## Fuente oficial
- [MDT02, segunda cobertura, COG por hoja MTN25](https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=MDT02)

## Criterios para V5 / completar V4
1. Buscar y verificar un catálogo geoespacial de hojas MDT02, descarga directa, CORS y HTTP Range.
2. Implementar mosaico fuera de memoria (IndexedDB/OPFS) y drenaje global de cuenca por bloques, con sincronización de fronteras y tests contra un motor GIS de referencia.
3. Pruebas con 4 hojas originales, solapes, NoData, límites y reproyección.
4. Verificación de exportación GeoTIFF mediante reimportación y comparación de cotas y georreferenciación.
