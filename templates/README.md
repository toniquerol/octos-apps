# OcToS Templates

El editor modifica los parámetros de `shared/theme.json`. Las cinco aplicaciones actuales cargan `shared/theme-core.js`, `shared/theme.js` y `shared/theme.css`. La carpeta histórica rain-v8 no participa.

Guardar borrador conserva parámetros solo en el navegador. Las vistas previas reciben parámetros por postMessage validado, únicamente desde el mismo origen y en marcos con templatePreview. No modifican el máster público.

Publicar requiere una autorización de GitHub para Contents: write sobre toniquerol/octos-apps. El token se usa en memoria exclusivamente contra api.github.com y se vacía al terminar; nunca se guarda ni se incluye en el catálogo. El GET obtiene el SHA y el PUT publica una única modificación atómica de theme.json. Un conflicto de SHA o revisión impide sobrescribir una publicación concurrente. No se guarda una credencial en el repositorio.

Cada publicación aumenta cada versión individual en 0,1 (4.1 → 4.2, 4.9 → 5.0), incluida Templates, y una revisión entera del máster. Restaurar parámetros anteriores genera un borrador; publicarlo avanza versiones, nunca las rebaja. Historial: últimas diez revisiones.

Tras GitHub Pages, las aplicaciones comprueban el máster al abrirse, recuperar el foco y cada 60 segundos. El título y la versión visible proceden del manifiesto; la versión funcional histórica del código no se reescribe en masa.

Primer registro común: Layers 2.9, Drive 11.1, Rain 9.7, Meteo 7.2. Carto no tenía versión visible y se incorpora en 1.1. Templates comienza en 1.0. Las atribuciones originales se trasladan como nodos vivos a una franja inferior reservada, conservando enlaces y actualización dinámica.

Las proporciones son comunes cuando existe el panel correspondiente; la columna de recursos y altura de ficha son específicas de Layers. Las herramientas especializadas y los cálculos de cada aplicación se mantienen. La botonera temporal de medición es un ejemplo interactivo en la pantalla modelo; las herramientas de las aplicaciones usan sus propios eventos, con estilos de panel comunes.

Validación: node --test tests/theme.test.cjs tests/basemaps.test.cjs. Publicación autenticada del editor pendiente de prueba con una credencial del propietario; no se simula una publicación exitosa.

