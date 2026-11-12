# OcToS Rain V5.2 — Asistente de drenaje y animación de partículas

## Referencia
[HEC-RAS — US Army Corps of Engineers](https://www.hec.usace.army.mil/software/hec-ras/).

HEC-RAS modela flujo 1D/2D en régimen permanente y transitorio, mallas de cálculo, condiciones de contorno, rugosidad de Manning, calados, velocidades, inundación y trazado de partículas a partir de campos de velocidad. OcToS Rain V5.2 no incorpora el solver de HEC-RAS, sino un visor topográfico con rutas D8 y estimación volumétrica por evento.

## Implementación V5.2
El módulo **ASISTENTE · ESTUDIO DE AGUA** está situado antes de «00 · Selección de zona» y explica seis pasos:
1. Seleccionar punto o área.
2. Importar MDT/MDS o mosaico GeoTIFF, conservando el comportamiento V4.
3. Calcular drenaje D8 sobre el MDT completo mediante Priority-Flood.
4. Seleccionar cuenca aguas arriba pulsando su salida en el mapa (opcional).
5. Introducir lluvia en mm, duración en horas y coeficiente de escorrentía. Preparar recorridos y calcular volumen mediante `volumen_m³ = superficie_m² × lluvia_mm / 1000 × coeficiente`.
6. Iniciar, pausar y detener animación de partículas sobre rutas D8. Controles de rapidez visual y cantidad de partículas.

La animación dibuja partículas georreferenciadas en Canvas y respeta pan y zoom. Si hay cuenca seleccionada, los puntos de emisión se restringen a ella. No interpreta que el resto de celdas estén mojadas: simplemente ilustra rutas topográficas.

## Comprobación
- Sintaxis JavaScript del controlador y módulo de partículas validada.
- Comprobación de que todos los elementos HTML referidos en JS están presentes.
- Pendiente prueba E2E con MDT02 real y navegador.

## Limitaciones esenciales
- **NO se resuelven las ecuaciones de aguas someras 2D (Saint-Venant), difusión ni Manning**. Por lo tanto, no se calculan calados, velocidades físicas en m/s, tiempo real de tránsito, propagación de inundación, caudales punta, hidrogramas de salida ni interacción con estructuras.
- La animación sigue un campo topológico de direcciones D8. La rapidez es **artificial y expresada como velocidad de visualización**. La lluvia solo se utiliza en el balance volumétrico simplificado, no para modificar el movimiento de partículas.
- La capa muestra partículas en las trayectorias posibles aun cuando no se haya realizado un cálculo de profundidad. No es un mapa de inundabilidad.
- El motor D8 continúa limitado a 12 millones de celdas en memoria; **no está implementado el procesamiento distribuido por bloques** ni la descarga automática de hojas del IGN.
- El mosaico V4 exige mismas coordenadas EPSG, resolución y alineación.
- El modelo no incorpora pérdidas por infiltración temporales, hidrogramas, rugosidad espacial ni drenaje urbano.

## Desarrollo futuro para simulación hidráulica comparable
1. Importar y preparar malla 2D, con límite computacional realista y motor en WASM/servidor.
2. Incluir esquemas numéricos conservativos para aguas someras 2D, CFL y test de balance de masa.
3. Configurar Manning, condiciones de entrada y salida, hidrogramas de lluvia y condiciones iniciales.
4. Calibrar/validar contra casos de referencia de HEC-RAS u observaciones.
5. Animar campos calculados de profundidad, velocidad y extensión de inundación con trazado de partículas basadas en el campo `(u,v)`.
