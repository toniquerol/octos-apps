# OcToS Drive · Paneles oficiales DGT / SCT

Estado: 15-11-2026. Integración de interfaz y validadores publicada; **los archivos de datos no se incluyen en el repositorio**.

## Capas funcionales de la interfaz
| Capa | Archivo oficial | Geometría disponible |
| --- | --- | --- |
| Radares fijos DGT | [content.xml](https://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml) | Punto si el XML DATEX II incluye latitud/longitud |
| Radares SCT | [radars.txt](https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars.txt) | Punto por ETRS89 / UTM 31N (EPSG:25831) |
| Referencias de radar de tramo SCT | Mismo radars.txt | Punto de referencia, **no** línea del tramo |
| Cinemómetros de remolque SCT | [radars-remolc.txt](https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars-remolc.txt) | Punto; no acredita actividad actual |

Los campos del TXT SCT son Via, PK, Velocitat, X, Y; el motor rechaza registros fuera de rango, coordenadas anómalas y duplicados idénticos. La conversión EPSG:25831 a EPSG:4326 se efectúa en cliente. El parser XML DATEX II se debe validar con una copia real antes de considerar completa la capa DGT.

## Datos oficiales adicionales sin coordenadas completas aún
- [DGT: inventario PDF de radares fijos, de tramo y sectores móviles](https://www.dgt.es/export/sites/web-DGT/.galleries/downloads/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/INFORME_CINEMOMETROS_WEB_OK_20260803_extra.pdf). Incluye carretera, PK y sentido; no basta por sí solo para calcular puntos y trazados correctos. No se importan ubicaciones deducidas.
- [NAP DGT](https://nap.dgt.es/es/dataset): cámaras, incidencias y paneles DATEX II. Sus estructuras y accesos se verificarán antes de activarse.
- DGT no cubre Cataluña ni País Vasco en su conjunto de radares. SCT cubre Cataluña; País Vasco requerirá fuente oficial específica.
- El directorio DGT anuncia un XML de aprox. 2 MB con última modificación 18-12-2025. La frecuencia declarada por el catálogo (1 h) no acredita que el fichero se renueve cada hora.

## Importación
1. Abrir Drive → botón **Paneles** en el visor.
2. Pulsar **Actualizar** junto a una capa para intentar la lectura directa. El navegador puede impedirla por CORS o acceso remoto.
3. Si falla, descargar el archivo desde el enlace **Fuente** y pulsar **Importar archivo**.
4. La capa importada se muestra con casilla de visibilidad, recuento, popup con fuente y caché IndexedDB local. Un solo radars.txt actualiza las dos capas SCT (puntos fijos y referencias de tramo).
5. Los datos se guardan en el navegador utilizado, no se sincronizan con otros equipos y no se añaden al repositorio.
6. La fuente de datos no es evidencia de que un radar esté activo. Los radares móviles recogidos en el PDF son **tramos susceptibles de vigilancia**, no ubicaciones actuales.

Archivos que deben incorporarse o facilitarse para cerrar la integración de todos los radares: content.xml de DGT, radars.txt y radars-remolc.txt de SCT, inventario PDF DGT agosto 2026. El XML necesita una prueba de compatibilidad real. Las líneas georreferenciadas de radares de tramo requerirán segundo extremo verificado o geometría oficial del tramo.
