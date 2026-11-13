# Historial de OcToS Aero

## 2.0.0 — 2026-11-13

- Partículas de 1 a 3 píxeles con borde suave, limitadas en pantalla para evitar el aspecto de bolas al acercar la cámara.
- Estelas finas de tres segmentos con desvanecimiento y entrada/salida gradual del túnel.
- Densidad seleccionable: 2.000, 6.000, 12.000 y 24.000 trazadores; 6.000 por defecto.
- Animación en GPU mediante una textura de 480 trayectorias, sin actualizar posiciones de miles de partículas en la CPU cada fotograma.
- Modos de partículas, estelas o ambos; ajustes de tamaño, longitud, intensidad, paleta y emisión central.
- Marco de túnel, plataforma, marcas de suelo y luz de relleno. Encuadre inicial desde el frontal e iluminación con mapeado de tonos.
- Conserva la importación GLB, calibración, pausa y múltiples cámaras. Sigue siendo visualización aproximada sin CFD.

Pruebas de regresión e importación GLB; comprobaciones de recursos y buffers del motor de flujo. En navegador: carga de demo y GLB de prueba, modos, colores, emisión, pausa y cuatro vistas. El máximo de partículas depende del equipo; no se garantiza una tasa de FPS universal.

## 1.0.0 — 2026-11-13

Primera publicación de la aplicación independiente en `/aero/`.

- Coche de demostración e importación local GLB 2.0.
- Calibración dimensional, orientación y apoyo sobre el suelo.
- Partículas y trayectorias sobre una envolvente geométrica por secciones.
- Una, dos o cuatro cámaras con simulación compartida.
- Calidad baja inicial, pausa y suspensión en pestañas ocultas.
- HTML autónomo con bibliotecas incluidas y fuentes reproducibles.
- Indicación permanente de visualización aproximada, sin CFD.

Verificación automática: sintaxis, controles y carga de GLB válido/inválido con renderizador simulado. Sin métricas de precisión física.
