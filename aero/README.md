# OcToS Aero V2.1.1 — geometría y precisión adaptativa

**Aplicación:** https://toniquerol.github.io/octos-apps/aero/

Visualizador **geométrico ilustrativo**, no solver CFD. Los trazadores se desvían mediante una regla local de separación de superficies; **no** calculan presión, coeficientes aerodinámicos, resistencia, sustentación, flujo turbulento ni condiciones de contorno.

## Uso

1. Abrir demo o importar GLB 2.0 estático con recursos incrustados (sin DRACO, Meshopt o KTX2).
2. Orientar el morro hacia −X. La importación opcional BMW gira el modelo 180° en Y; siguen disponibles los giros manuales.
3. Calibrar la longitud real en **metros**. La escala y la rotación reconstruyen las coordenadas del BVH y el atlas.
4. Elegir **precisión geométrica** por separado de **partículas**: ligera (160 rutas / 192 puntos GPU), equilibrada (360 / 288) o detallada (640 / 384). La integración intermedia usa **pasos adaptativos** y valida los segmentos interpolados.
5. En cualquiera de las vistas: doble clic en una superficie para centrarla. Mayús+arrastrar desplaza el punto de mira; en vistas ortográficas se desplaza arrastrando. La rueda acerca y, a distancias cortas, concentra un segundo grupo de trazadores alrededor del foco. «Eliminar foco» restablece la inspección global.

## Método y límites

- La geometría se extrae de los triángulos de las mallas visibles con las matrices de mundo aplicadas. Un **árbol BVH** permite consultar distancia al triángulo más próximo e intersección de **segmentos completos**. No existe una envolvente por máximos de 48 secciones.
- Las rutas visuales próximas a la superficie se guían por impactos reales de rayos sobre techo, laterales y bajos. Se combinan con trayectorias libres y cada segmento final se contrasta con la malla. La separación nominal para un coche de 4,6 m es de unos **3 cm**; cerca de bordes, huecos y pendientes pronunciadas puede aumentar para evitar penetraciones. El resultado sigue sin ser aerodinámica física.
- El radio de influencia del desvío libre se ha reducido y la zona de emisión se ha concentrado en torno a la carrocería. Las rutas que no encuentran intersección no se fuerzan a una superficie ficticia.
- La generación de rutas es **determinista** y está separada del renderizado GPU. La geometría se reconstruye al importar, escalar o girar. La precisión cambia cantidad de rutas y muestras integradas; aumentar partículas solo cambia las instancias dibujadas.
- Se comprueban los tramos tras convertir la integración adaptativa a la textura GPU. Cuando una ruta no puede resamplearse sin penetrar una superficie, se sustituye por una **ruta de seguridad externa**; si el trazado no puede avanzar, se detiene. El estado informa rutas corregidas/detenidas. Esto evita inventar una solución aerodinámica falsa.
- Los huecos y elementos asimétricos se consultan como triángulos independientes; un hueco realmente libre permanece abierto si las muestras lo alcanzan. **No garantiza** capturar ranuras inferiores a la distancia entre semillas/rutas o a la escala de integración. Un hueco muy pequeño puede quedarse sin trazadores aunque esté geométricamente abierto.
- Los bordes abiertos se identifican heurísticamente con un recuento de aristas para mallas hasta 90.000 triángulos; mallas mayores indican «topología no verificada». Bordes duplicados, caras invertidas, superficies internas, agujeros y autointersecciones impiden atribuir un interior sólido fiable. Los avisos no impiden inspeccionar.
- El campo de velocidades ilustrativo está aislado en `src/paths.js` (`velocity()`); los materiales y el atlas GPU están en `src/flow.js`. Zoom y pan **no** cambian ni reconstruyen el atlas subyacente: únicamente añaden trazadores de inspección que reutilizan sus rutas. Los colores son decorativos y carecen de escala física.
- Cada vista comparte el mismo estado de trayectorias. Las cámaras 3D y ortográficas pueden moverse de forma independiente. La animación GPU no actualiza miles de posiciones de partículas en la CPU.
- Construcción de triángulos, BVH y rutas en lotes asíncronos con cesiones al evento de navegador. Nuevas importaciones/transformaciones cancelan cálculos pendientes; el BVH y los recursos GPU previos se liberan. En mallas extremas, las consultas de geometría aún pueden requerir tiempo apreciable.

## Distribución y desarrollo

`aero/index.html` sigue siendo el paquete autónomo de Three.js, cargador GLB y Aero, utilizable desde `file://` sin instalación de dependencias para el visor principal. El enlace opcional del menú compartido (`../shared/nav.js`) y el logotipo de WordPress requieren recursos externos para esos elementos de interfaz, **no** para el cálculo 3D. No se necesitan APIs ni servidores para modelar localmente.

Archivos de trabajo: `src/geometry.js` (BVH), `src/paths.js` (campo y rutas), `src/flow.js` (GPU), `src/app.js` (cámaras, importación y controles), `src/template.html` (interfaz). `scripts/build.cjs` integra todo con Three.js 0.170.0 (MIT); `tests/` contiene las comprobaciones.

Desde `aero/`:

```sh
node scripts/build.cjs
node tests/check.cjs
node tests/flow.test.cjs
node tests/geometry.test.cjs
```

El flujo de GitHub Actions `.github/workflows/aero.yml` ejecuta estas comprobaciones y, si son correctas, actualiza `aero/index.html` en la rama del commit. Las pruebas automatizadas del renderizador utilizan un mock de WebGL: no certifican apariencia visual ni FPS reales. La página publicada depende de la actualización de `main` y GitHub Pages; las pruebas navegador y pruebas con un GLB BMW real deben comprobarse por separado si ese recurso no está disponible.

## Futuro CFD

Un solucionador CFD o un lector de volúmenes de velocidades validados podrá sustituir la función de transporte de `paths.js` sin cambiar el renderizador. Importar campos físicos exige unidades, coordenadas, condiciones de contorno y procedencia verificables; los resultados actuales no tienen interpretación física.
