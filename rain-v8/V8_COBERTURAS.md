# OcToS Rain V8 · Cubiertas del suelo y escorrentía (versión ligera)

## Fuente oficial verificada
- Instituto Cartográfico y Geológico de Cataluña (ICGC): WMS de cubiertas del suelo, `https://geoserveis.icgc.cat/servei/catalunya/cobertes-sol/wms`.
- Subcapas admitidas: `cobertes_2024`, `cobertes_2023`, `cobertes_2019_2022`, `cobertes_2018`, `cobertes_2009`.
- Producto descargable ICGC: Mapa de Cubiertas del Suelo de Cataluña, GeoTIFF con **una banda de códigos categóricos**; GeoPackage disponible desde el proveedor, pero **no importable automáticamente en esta V8**.
- Referencias:
  - https://www.icgc.cat/es/Geoinformacion-y-mapas/Servicios-en-linea-Geoservicios/WMS-Cubiertas-del-suelo
  - https://www.icgc.cat/es/Geoinformacion-y-mapas/Mapas/Mapa-de-cubiertas-del-suelo-de-Cataluna

## Implementación
- Se parte del código V7.6 publicado, conservando mapas IGN/PNOA/LiDAR, mosaicos de MDT, cálculos, vista 3D y animación de partículas D8.
- Menú adicional **02B · Cobertura del suelo / Escorrentía**: activar WMS, seleccionar año y opacidad.
- Importar archivo local de cobertura GeoTIFF con valores de código originales; **no se analizan los colores del WMS**.
- Se lee sólo la envolvente del MDT, hasta 1,5 millones de píxeles recortados o remuestreados por vecino próximo.
- Tras seleccionar cuenca se realiza un muestreo dentro de su máscara, con tope de 270.000 posiciones. Se indican las muestras, cobertura y códigos sin clasificar.
- Cada código original debe asociarse inicialmente a una categoría usando la leyenda y las especificaciones del ICGC. Se guardan asociaciones **por nombre de archivo** y coeficientes editados en el navegador (localStorage). No se inventan asociaciones.
- Seis categorías orientativas: asfalto 0,90; edificios 0,95; urbano 0,75; cultivos 0,35; bosques 0,20; suelo natural 0,40. Editables de 0 a 1. No son coeficientes oficiales ICGC.
- C ponderado = suma de C por área clasificada / suma de área clasificada. **Se integra automáticamente en el balance de lluvia sólo si al menos el 95 % de muestras se cubren con datos y el 95 % de las muestras cubiertas tienen código asignado.** Si no, se utiliza el coeficiente manual del modelo anterior.
- Resultados: superficie de cuenca, cobertura, porcentajes por categoría, superficie impermeable estimada, C ponderado y fuente.
- Mapa de escorrentía con colores, casilla visible/opacidad en 2D y proyección en relieve 3D.
- Las partículas D8 pueden emitirse desde posiciones ponderadas por los valores C cuando la clasificación está completa; no se calculan velocidades físicas ni hidrogramas.

## Limitaciones explícitas
1. **No hay descarga automática por teselas del ICGC ni lectura directa de GeoPackage:** el cálculo necesita importar el GeoTIFF de clases. El servicio WMS oficial se utiliza sólo para visualización.
2. **La asignación inicial de códigos a categorías NO es automática si falta una tabla de correspondencias validada.** Se configuran una vez y se reutilizan si el archivo tiene el mismo nombre.
3. El muestreo espacial y el remuestreo categórico son aproximaciones para rendimiento; no equivalen a una intersección vectorial exacta a 1 m ni producen métricas catastrales.
4. La cuenca debe delimitarse primero con el motor D8 ya existente. El modelo de lluvia sigue siendo volumétrico por evento, sin infiltración dinámica ni propagación de inundaciones. La velocidad de partículas es visual.
5. La zona sin cobertura o sin código asociado **no recibe un coeficiente supuesto**. Cuando la cobertura es incompleta se conserva el valor manual.
6. Servicios WMS dependen de disponibilidad del ICGC; algunos navegadores o entornos pueden limitar CORS o texturas 3D.
7. Se validaron sintaxis de app.js, landcover.js, terrain3d.js y flow-particles.js, IDs HTML, y cálculo sintético de C=0,55 para mitad asfalto / mitad bosque, y rechazo de clases desconocidas. **Falta prueba integral con un GeoTIFF real de cubiertas ICGC en el navegador.**

## Versión prevista posterior
- Incluir una tabla de correspondencias oficial versionada de las 41 clases, con pruebas para el GeoTIFF específico de ICGC y sin inferir por color.
- GeoPackage local, recortes remotos si existe API apropiada, análisis exacto por polígonos.
- Modelización distribuida con tiempos de concentración, hidrogramas, propagación y calibración.
