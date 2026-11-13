# OcToS Aero V2.0

Visualizador 3D de flujo aproximado alrededor de carrocerías. V2 visual: 13 de noviembre de 2026.

**Abrir:** https://toniquerol.github.io/octos-apps/aero/

También se puede guardar `index.html` y abrirlo localmente. El HTML incluye Three.js y no necesita instalar paquetes ni acceder a servicios externos. Los vehículos seleccionados se procesan en el navegador, sin subirlos a un servidor.

## Uso

1. Prueba el coche de demostración. Arrastra para orbitar y usa la rueda para ajustar el zoom.
2. Abre un GLB 2.0 estático con recursos incrustados, sin compresión DRACO, Meshopt ni KTX2.
3. Corrige la orientación con los giros de 90°. El morro debe mirar hacia −X.
4. Introduce la longitud real en metros y pulsa Aplicar.
5. Selecciona una, dos o cuatro vistas y ajusta partículas, trayectorias y reproducción.

## Alcance y precisión

**Simulación visual aproximada — no CFD.** Las trayectorias rodean una envolvente conservadora obtenida de 48 secciones de la malla. No se resuelven las ecuaciones del aire, la presión, la resistencia, la sustentación ni la turbulencia. No permite decidir qué modificación aerodinámica funciona mejor.

La envolvente puede tapar huecos y pasos bajo la carrocería, y desviar el flujo demasiado pronto. Las partículas son trazadores visuales; sus colores no representan magnitudes físicas.

Calidad inicial: 6.000 partículas sobre 480 trayectorias precalculadas. Niveles de 2.000, 6.000, 12.000 o 24.000 partículas, animadas en GPU. Puntos suaves de 1 a 3 píxeles y estelas finas desvanecidas. Puedes ajustar el tamaño, la longitud de estela, la intensidad, el color y la anchura de emisión. El color es decorativo, no una escala física.

Un único renderizador para todas las vistas. La animación se detiene en pestañas ocultas; en pausa se redibuja al interactuar. Los modelos grandes pueden tardar al preparar las trayectorias. Si el equipo pierde fluidez, selecciona 2.000 partículas, una vista y el modo Solo partículas. Aumentar la cantidad no aumenta la precisión aerodinámica.

## Estructura independiente

- `index.html`: distribución autónoma y punto de entrada de GitHub Pages.
- `src/app.js`: escena, importación, envolvente, partículas y controles.
- `src/flow.js`: atlas de trayectorias, shaders, puntos suaves y estelas en GPU.
- `src/template.html`: interfaz y estilos.
- `vendor/`: Three.js 0.170.0 y módulos de la misma versión, licencia MIT incluida.
- `scripts/build.cjs`: empaquetado reproducible sin instalar dependencias.
- `tests/check.cjs`: comprobaciones de lógica e importación GLB.
- `version.json` y `CHANGELOG.md`: identificación de la versión.

Desde esta carpeta, con Node.js disponible:

```sh
node scripts/build.cjs
node tests/check.cjs
node tests/flow.test.cjs
```

## Verificación

Comprobadas la sintaxis del HTML empaquetado y la lógica de inicio, cuatro vistas, cambio de partículas, pausa, reinicio, escala, giro, rechazo de entradas inválidas e importación de un GLB válido de 12 triángulos. Las pruebas automáticas usan la geometría real de Three.js y un renderizador simulado; no prueban la GPU.

La V2 se ha comprobado también en navegador: demo, carga de GLB de prueba, modos de flujo, paletas, emisión central, pausa y cuatro cámaras. No se ha medido precisión aerodinámica ni validado Safari. Las pruebas por `file://` quedaron limitadas por la política del navegador de verificación. No se han establecido objetivos de FPS universales. Véase `CHANGELOG.md`.

## Evolución

Afinar la interacción geométrica a partir de carrocerías reales y permitir importar campos de velocidad calculados externamente. Incorporar CFD requerirá un motor físico y validación adicionales; no es una consecuencia automática de mejorar este visor.
