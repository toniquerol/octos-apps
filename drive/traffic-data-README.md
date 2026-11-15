# OcToS Drive · Radares DGT y SCT

**Estado: integrado en GitHub · 15/11/2026.** Se recibieron cuatro archivos oficiales del usuario. El visor carga automáticamente un catálogo georreferenciado compacto; no hace falta descargar ni importar ficheros en cada visita.

## Archivos y resultados

| Entrada | Registros originales | Puntos incorporados | Observación |
|---|---:|---:|---|
| DGT `content.xml`, DATEX II v1.0 | 690 cabinas | **690** | Fuente de datos fechada 18/12/2025 |
| DGT `content.xml`, DATEX II v1.0 | 47 controles de velocidad media | **94** | Coordenadas de inicio y fin; no se dibuja una línea recta que simule el eje real |
| SCT `radars.txt` | 247 filas | **201** radares fijos + **29** referencias de tramo | 17 filas excluidas por coordenadas anómalas |
| SCT `radars-remolc.txt` | 53 filas | **53** | Posiciones publicadas; no acreditan actividad actual |
| DGT `INFORME_CINEMOMETROS_WEB_OK_20260803_extra.pdf` | Documento de 32 páginas (03/08/2026) | **No georreferenciado** | Contraste de carretera, PK, provincia, sentido y tipo; no se inventan coordenadas a partir del PK |

Total disponible en el mapa: **1.067 puntos** en **cinco capas** independientes. El PDF contiene referencias que pueden ser más recientes que el XML y no debe interpretarse como confirmación de que cada punto siga vigente.

## Archivos del repositorio

- `drive/data/official-radars-v1.json`: colección autocontenida con los 1.067 puntos de datos oficiales, en EPSG:4326.
- `drive/traffic-panels.js`: carga automática, capas, popups, descargas e importación opcional (DATEX II y TXT).
- `drive/index.html`: botón flotante **Paneles** y panel de activación de las cinco capas.

## Uso

1. Abrir [OcToS Drive](https://toniquerol.github.io/octos-apps/drive/).
2. Pulsar **Paneles** arriba a la izquierda.
3. Activar las casillas de Radares fijos DGT, Extremos de tramo DGT, Radares SCT, Tramos SCT o Remolque SCT.
4. Pulsar un marcador para ver carretera, PK, velocidad (SCT), fuente y advertencia.

El botón **Actualizar** intenta acceder directamente al origen público, pero depende de CORS. **Importar archivo** permite sustituir los datos alojados por un XML/TXT posterior. Los archivos importados manualmente se guardan en IndexedDB del navegador y prevalecen sobre la copia del repositorio.

## Limitaciones técnicas

- **Tramos:** se conservan puntos de inicio/fin o referencias, no geometría vial entre extremos. Para mostrar líneas exactas deben obtenerse ejes viarios verificados y georreferenciados.
- **Calidad SCT:** se han descartado 17 filas con coordenadas incompatibles con ETRS89 / UTM 31N. No se corrigen añadiendo o eliminando dígitos.
- **Cobertura:** el conjunto DGT no incluye Cataluña ni País Vasco. SCT aporta Cataluña; la cobertura vasca queda pendiente de fuente oficial.
- **Actualización:** la versión incorporada es una copia fija de los archivos suministrados, no un feed de controles activos ni un sistema de avisos actualizado en tiempo real.
- **PDF:** no se georreferencia por interpolación de puntos kilométricos.
