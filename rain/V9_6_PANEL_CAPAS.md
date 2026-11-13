# OcToS Rain 9.6 — Panel de simulación y árbol de capas fijo

**Base:** versión 9.5 en la rama `main`. Sin cambios en el motor D8, cálculo de lluvia/escorrentía, importadores GeoTIFF, cuencas o visualizador 3D.

## Distribución de la columna izquierda
- Zona superior (2/3): herramientas de estudio y simulación existentes, con desplazamiento vertical independiente.
- Zona inferior (1/3): árbol de capas cartográficas siempre visible; cabecera fija y listado desplazable.
- Mantiene la ocultación de la columna desde el botón superior y adapta la altura al tamaño de la ventana.

## Árbol inferior
- **Capas predefinidas · 9:** muestra las nueve capas de la versión 9.5, con controles de visibilidad y opacidades sincronizadas con «Capas» en la cabecera; sin crear copias WMS.
- **Resultados de la simulación:** superficies y elementos vectoriales calculados que antes estaban en «Capas visibles».
- **Catálogo de capas INSPIRE / IDEE:** nombres geográficos, unidades administrativas, parcelas catastrales, direcciones, hidrografía, transporte, lugares protegidos, cubierta terrestre, usos del suelo, elevaciones, geología, ortoimágenes y edificios. También se conservan las categorías propias de inundaciones, riesgo y zonas de gestión.
- **Añadir otro servicio WMS:** campo para introducir una URL HTTPS y consultar sus subcapas.

## Sin redundancias
- Los servicios ya presentes se integran en la categoría que corresponda.
- Las capas WMS predefinidas no se vuelven a añadir desde el catálogo si tienen el mismo servidor e identificador.
- Los valores y el orden de las capas por defecto de la 9.5 no cambian.

## Fuentes documentadas
- https://www.idee.es/segun-tema-inspire
- https://www.idee.es/monitorizacion-de-servicios
- https://www.ide.cat/es/Geodatos/Geodatos-INSPIRE
- https://www.ide.cat/es/Geodatos/Conjuntos-de-datos-de-alto-valor/Observacion-de-la-Tierra-y-Medio-Ambiente

## Limitaciones
El catálogo lee `GetCapabilities` desde el navegador: algunos servidores pueden impedir la lectura JavaScript por CORS o no responder. Si es posible se muestran subcapas oficiales preconfiguradas, junto con el enlace al servicio. El WMS es únicamente visual; no proporciona por sí mismo datos numéricos válidos para una simulación hidrológica.
