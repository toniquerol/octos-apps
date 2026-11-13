# OcToS Rain V9.5 — Capas por defecto y control del orden

Base: V9 publicada en la rama main. Cambios realizados sin alterar los lectores, los cálculos D8, la geometría del terreno ni los controles 3D.

## Mapa de fondo
- Por defecto: **LiDAR IGN · MDS** (servicio WMTS de visualización, opacidad **100 %**).
- Botón superior: **Mapa de fondo**. Se conservan las ocho alternativas y el selector de opacidad.
- Se elimina el control LiDAR redundante del apartado lateral «Capas visibles».
- La imagen LiDAR del WMTS no sustituye la importación del MDT/GeoTIFF para el análisis de alturas.

## Capas activas al abrir
Orden de arriba (más visible) a abajo (menos visible):

| Capa | Opacidad inicial | Identificador WMS |
|---|---:|---|
| Puntos de interés hidrológico | 75 % | HY.PhysicalWaters.HydroPointOfInterest |
| Red hidrológica | 80 % | HY.Network |
| Masas de agua | 50 % | HY.PhysicalWaters.Waterbodies |
| Humedales | 50 % | HY.PhysicalWaters.Wetland |
| Curvas de nivel | 100 % | EL.ContourLine |
| Modelo digital del terreno | 30 % | EL.ElevationGridCoverage |
| Modelo digital de pendientes | 20 % | MDP05 |
| Zona inundable 10 años (ZI alta probabilidad) | 25 % | NZ.RiskZone |
| Superficie de cobertura terrestre | 15 % | LC.LandCoverSurfaces |

- Botón **Capas** a la izquierda de **Mapa de fondo**: muestra casilla de visibilidad, flechas pequeñas ↑↓ para cambiar orden y deslizador de opacidad.
- El ajuste de color aparece para geometrías vectoriales creadas en el estudio; los WMS oficiales son imágenes preestilizadas y se conservan sus colores sin inventar estilos SLD.
- Las subcapas que se añaden desde el catálogo lateral 06 se incorporan también al nuevo panel, y su transparencia se sincroniza.
- Valores por defecto en cada carga; los ajustes del usuario son temporales y no se guardan al recargar.
- La visualización WMS depende de disponibilidad, escala y cobertura de servicios de terceros; errores de tesela se indican. Las superposiciones temáticas están implementadas en el mapa 2D. En 3D, el fondo LiDAR se usa como textura base, y el análisis sigue dependiendo del MDT importado.

## Referencias
- IGN / IDEE: https://servicios.idee.es/wms-inspire/hidrografia
- IGN / IDEE: https://servicios.idee.es/wms-inspire/mdt
- IGN / IDEE: https://wms-pendientes.idee.es/pendientes
- MITECO / SNCZI: https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ10/wms.aspx
- IGN / IDEE: https://servicios.idee.es/wms-inspire/ocupacion-suelo
