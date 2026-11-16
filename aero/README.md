# OcToS Aero V2.5 — corrección de flujo próximo a superficies

**Aplicación:** https://toniquerol.github.io/octos-apps/aero/

Visor de estelas GPU con **dos modos**: trayectorias cinemáticas ilustrativas o integración sobre un campo CFD precomputado. OcToS Aero **no ejecuta el solver CFD**: los campos físicos se calculan externamente; solo se representan cuando se importa un fichero de velocidad válido.

## Flujo próximo a la carrocería (V2.5)

- **Diagnóstico corregido:** antes, el campo CFD se integraba hasta detectar una intersección y se detenía, sin rodear el vehículo; algunas mallas abiertas podían dejar entrar trayectorias. En el modo ilustrativo, las velocidades de todos los puntos de una misma ruta se sobrescribían sobre el primer valor del atlas. Además, rutas terminadas mantenían muestras repetidas con velocidad visible.
- **Evitación geométrica:** ambos modos consultan el BVH de triángulos, anticipan intersecciones, buscan rutas libres por techo o laterales con una separación aproximada de **3,5–9 cm** y comprueban los segmentos antes de enviarlos al atlas. Si no existe una salida geométricamente segura, ocultan el resto de esa trayectoria en lugar de atravesar la carrocería.
- **Estelas:** tras la modificación visual de las estelas se comprueban de nuevo las colisiones antes de dibujarlas.
- **CFD importado:** se conservan las velocidades, el origen, el espaciado y las dimensiones del JSON original. **Las trayectorias corregidas son una representación geométrica, no la solución CFD real**: no se debe utilizar la forma corregida para deducir presión, fuerzas, turbulencia ni sustentación. La exactitud física depende del campo CFD y de una malla de carrocería suficientemente cerrada.
- **Limitación:** las mallas abiertas, superficies inconsistentes o detalles menores que la resolución del campo pueden producir rutas interrumpidas; el sistema no completa automáticamente la geometría ausente.

## Uso

1. Abrir demo o importar GLB 2.0 estático con recursos incrustados (sin DRACO, Meshopt o KTX2).
2. Orientar el morro hacia −X. La importación opcional BMW gira el modelo 180° en Y; siguen disponibles los giros manuales.
3. Calibrar la longitud real en **metros**. La escala y la rotación reconstruyen las coordenadas del BVH y el atlas.
4. Elegir **precisión geométrica** por separado de **partículas**: ligera (160 rutas / 192 puntos GPU), equilibrada (360 / 288) o detallada (640 / 384). La integración intermedia usa **pasos adaptativos** y valida los segmentos interpolados.
5. Ajustar el **plano emisor** independientemente del campo CFD: anchura Z predeterminada **2,6 m**, altura Y **2,0 m**, con **12.000 partículas GPU** de inicio. Está situado aguas arriba del vehículo y centrado transversalmente en Z; sus semillas quedan entre el suelo y la altura indicada. Al cambiar ancho o alto se reconstruyen las trayectorias pero no se modifican el origen, espaciado, dimensiones ni velocidades del JSON importado. El selector «Zona de emisión» puede concentrarlas todavía más en una franja central.
6. **Paneles flotantes:** «Vehículo · importación» (derecha superior) contiene el modelo GLB, dimensiones y controles **X/Y/Z de giro +90°**; «Campo CFD · flujo» (derecha inferior) contiene el importador JSON y todos los ajustes de partículas; «Vistas del simulador» (izquierda superior) centraliza la distribución y el tipo de cámara de cada ventana; reproducción, pausa y reinicio aparecen centrados abajo. Los paneles se pliegan mediante su cabecera. Cada panel abierto tiene su **desplazamiento vertical independiente**; la anchura de los paneles derechos se ajusta arrastrando el borde izquierdo y la del panel de vistas arrastrando su borde derecho. Los tiradores también admiten las flechas del teclado.
7. **Sección orientable X/Y/Z:** elige primero el eje normal del corte (**Y por defecto**, plano horizontal XZ; X para el plano transversal YZ; Z para el plano longitudinal XY). Pulsa «Crear sección» y haz clic sobre el vehículo o el suelo. Si hay una sola vista, se generan dos: la vista 3D original y una **vista ortográfica perpendicular al plano seleccionado**. La cámara del corte empieza alineada con el plano, pero se puede **orbitar arrastrando** dentro de su ventana y ampliar con la rueda. El deslizador ajusta la posición del corte en el eje elegido sin recalcular el campo CFD. En el corte Y se conserva la parte inferior del modelo; en X se conserva +X y en Z se conserva −Z. El plano indicador aparece en la perspectiva general. «Eliminar» desactiva el corte y su recorte de partículas.
8. En cualquiera de las vistas: doble clic en una superficie para centrarla. Mayús+arrastrar desplaza el punto de mira; en vistas ortográficas se desplaza arrastrando. La rueda acerca y, a distancias cortas, concentra un segundo grupo de trazadores alrededor del foco. «Eliminar foco» restablece la inspección global.

## Método y límites

- La geometría se extrae de los triángulos de las mallas visibles con las matrices de mundo aplicadas. Un **árbol BVH** permite consultar distancia al triángulo más próximo e intersección de **segmentos completos**. No existe una envolvente por máximos de 48 secciones.
- Las rutas visuales próximas a la superficie se guían por impactos reales de rayos sobre techo, laterales y bajos. Se combinan con trayectorias libres y cada segmento final se contrasta con la malla. La separación nominal para un coche de 4,6 m es de unos **3 cm**; cerca de bordes, huecos y pendientes pronunciadas puede aumentar para evitar penetraciones. El resultado sigue sin ser aerodinámica física.
- El radio de influencia del desvío libre se ha reducido y la zona de emisión se ha concentrado en torno a la carrocería. Las rutas que no encuentran intersección no se fuerzan a una superficie ficticia.
- La generación de rutas es **determinista** y está separada del renderizado GPU. La geometría se reconstruye al importar, escalar o girar; modificar el emisor recalcula únicamente las trayectorias sobre la geometría ya analizada. La precisión cambia cantidad de rutas y muestras integradas; aumentar partículas solo cambia las instancias dibujadas. Las rutas rechazadas por intersecciones se ocultan sin desplazar artificialmente sus semillas fuera del plano.
- Se comprueban los tramos tras convertir la integración adaptativa a la textura GPU. Cuando una ruta no puede resamplearse sin penetrar una superficie, se sustituye por una **ruta de seguridad externa**; si el trazado no puede avanzar, se detiene. El estado informa rutas corregidas/detenidas. Esto evita inventar una solución aerodinámica falsa.
- Los huecos y elementos asimétricos se consultan como triángulos independientes; un hueco realmente libre permanece abierto si las muestras lo alcanzan. **No garantiza** capturar ranuras inferiores a la distancia entre semillas/rutas o a la escala de integración. Un hueco muy pequeño puede quedarse sin trazadores aunque esté geométricamente abierto.
- Los bordes abiertos se identifican heurísticamente con un recuento de aristas para mallas hasta 90.000 triángulos; mallas mayores indican «topología no verificada». Bordes duplicados, caras invertidas, superficies internas, agujeros y autointersecciones impiden atribuir un interior sólido fiable. Los avisos no impiden inspeccionar.
- El campo de velocidades ilustrativo está aislado en `src/paths.js` (`velocity()`), el lector CFD en `src/cfd.js`; los materiales y el atlas GPU están en `src/flow.js`. Zoom y pan **no** cambian ni reconstruyen el atlas subyacente: únicamente añaden trazadores de inspección que reutilizan sus rutas. El modo ilustrativo añade una estela oscilante y colores calculados heurísticamente (sin magnitudes físicas); el modo CFD colorea según la velocidad importada, normalizada por \`displayMaxSpeed\`.
- Las vistas de sección comparten las trayectorias existentes; el recorte X/Y/Z afecta solo a la presentación gráfica de esa ventana, sin modificar posiciones GPU ni datos CFD. El plano se aplica mediante recorte geométrico a la carrocería y mediante shader GPU a partículas y estelas. La sección es una **visualización de corte**, no un nuevo análisis CFD ni una medición física específica de la sección.
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
node tests/cfd.test.cjs
```

El flujo de GitHub Actions `.github/workflows/aero.yml` ejecuta estas comprobaciones y, si son correctas, actualiza `aero/index.html` en la rama del commit. Las pruebas automatizadas del renderizador utilizan un mock de WebGL: no certifican apariencia visual ni FPS reales. La página publicada depende de la actualización de `main` y GitHub Pages; las pruebas navegador y pruebas con un GLB BMW real deben comprobarse por separado si ese recurso no está disponible.

## Futuro CFD

Ya puede importarse un campo CFD **estructurado y uniforme** en formato JSON `octos-cfd-v1`. Los archivos se interpretan localmente, sin subirlos a servidores. El flujo físico se interpola trilinealmente y las partículas se integran mediante Runge-Kutta de cuarto orden, con comprobación de intersección de segmentos contra la carrocería.

### Formato de datos

```json
{
  "format": "octos-cfd-v1",
  "units": "m/s",
  "source": "OpenFOAM / ParaView, configuración concreta",
  "origin": [-7, 0, -4],
  "spacing": [0.2, 0.2, 0.2],
  "dimensions": [71, 20, 41],
  "referenceSpeed": 25,
  "displayMaxSpeed": 40,
  "velocity": [25, 0, 0, 25.1, 0.02, 0, "..."]
}
```

El elemento `velocity` del ejemplo es solo ilustrativo: **debe contener exactamente** `nx * ny * nz * 3` números reales finitos, en orden `x` más rápido, después `y` y finalmente `z`. El visor acepta un máximo de 2 millones de nodos y ficheros de 110 MB. No soporta directamente mallas CFD no estructuradas: hay que remuestrearlas previamente.

El marco de coordenadas debe coincidir con el vehículo **ya centrado, escalado y orientado en OcToS Aero**, con morro en −X y suelo en Y=0. Al cambiar el modelo, su escala o rotación, el visor desactiva el campo importado para evitar representar resultados desalineados. Los valores de velocidad se mantienen en m/s.

### Conversión desde OpenFOAM / ParaView

1. Resolver el flujo con OpenFOAM (por ejemplo k-ω SST) y validar la convergencia/malla/condiciones de contorno externamente.
2. Abrir los resultados en ParaView, generar un volumen cartesiano mediante **Resample To Image** y exportar las coordenadas de puntos y el vector de velocidad a CSV.
3. Convertir el CSV mediante `aero/tools/cfd_csv_to_json.py`:

```bash
python aero/tools/cfd_csv_to_json.py campo_uniforme.csv campo_octos.json --reference-speed 25 --source "OpenFOAM caso BMW E46"
```

El conversor reconoce las columnas `x,y,z,vx,vy,vz` y nombres habituales de ParaView (`Points:0/1/2`, `U:0/1/2`). Rechaza nodos faltantes, duplicados, no finitos o mallas no uniformes. Importar el JSON generado desde **03 / CAMPO CFD**.

### Interpretación

- **Modo ilustrativo:** vórtices y gradientes son solo efectos visuales; no representan resistencia, presión o turbulencia real.
- **Modo CFD:** las posiciones se integran desde los vectores de velocidad del archivo importado. La precisión depende de la malla CFD, la interpolación, la correspondencia geométrica y la calidad de los datos originales. No hay certificación ni validación automática de resultados aerodinámicos.
- La paleta es relativa a `displayMaxSpeed` y no calcula ni representa presión o coeficientes `Cd/Cl`.
- Las pruebas automáticas incluyen importación, interpolación, integración RK4 y smoke test WebGL de la interfaz. No sustituyen validación física ni inspección visual manual.
