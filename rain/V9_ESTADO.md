# OcToS Rain V9

Base: V8, commit 962f424a1e1edf9bbb2b2161c7164193c385259b. Respaldo publicado en ../rain-v8/ y copia local backup-v8.

## Funciones incorporadas
- Panel compacto, logo original centrado y área de estudio como referencia de preparación.
- Selector CNIG MDT02, superficies y visor ICGC, con enlaces oficiales y recomendaciones de uso.
- Cuadrícula MTN25 oficial IGN como capa WMS para MDT02. No confirma disponibilidad por hoja ni archivos descargados.
- Importación de varios TIFF mediante selector o arrastre, conectada al mosaico existente; detección de firmas y componentes Shapefile, errores y duplicados candidatos.
- Cobertura estimada en el área mediante 6400 puntos como máximo, excluyendo los exteriores del polígono y contabilizando NoData. Es un muestreo, no una certificación de cobertura completa.
- Exportación de ficha JSON de área, producto, datos y estado.
- Matriz de 14 familias de formatos con estados reales y requisitos de conversión.
- Corrección de orientación norte/Z de terreno, partículas y texturas 3D; normales coherentes.

## Verificación
16 pruebas automatizadas superadas: hidrología, terreno, GeoTIFF Float32 real sintético, recorte, NoData, reducción de resolución, coordenadas, cobertura muestreada, identificación y orientación de partículas. Comprobación sintáctica de módulos.
La comprobación visual local no pudo realizarse por timeout del navegador integrado. Estas pruebas no acreditan todos los códecs TIFF, estructura COG o HTTP Range ni sustituyen la comprobación visual de texturas 3D.

## Límites pendientes
- Consulta automática de archivos por hoja, selección sincronizada lista/mapa y cobertura exacta por cuadrícula.
- Reproyección de mallas: los mosaicos requieren igual EPSG, resolución y alineación. ETRS89 UTM se lee; mezclar husos exige conversión externa.
- Nuevos lectores LAS/LAZ, GeoPackage, vectoriales, ASCII Grid, NetCDF, CSV y modelos 3D; consultar matriz. WFS/WCS/OGC API no son clientes genéricos.
- El motor mantiene las hojas decodificadas al crear el mosaico; límite de 32 archivos y 12 millones de celdas de salida. Recortar antes de cargar. D8 no funciona por bloques fuera de memoria.
- Los resultados hidrológicos siguen siendo los de V8; la animación no resuelve hidráulica 2D.

## Fuentes verificadas
https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=MDT02
https://centrodedescargas.cnig.es/CentroDescargas/modelos-digitales-elevaciones
https://centrodedescargas.cnig.es/CentroDescargas/conf/capasVisor.js
https://www.ign.es/wms-inspire/cuadriculas
https://visors.icgc.cat/appdownloads/

Auditoría pública: comprobados cabecera V9, gestor de datos, selección de área, carga remota de fixture GeoTIFF y apertura 3D con textura. El WMS de cuadrículas devolvió errores y mostró el aviso previsto. Se ajustó además el encuadre 3D para considerar el desnivel. La revisión no cubre todos los datos reales ni equivale a validar el flujo completo de hojas.
