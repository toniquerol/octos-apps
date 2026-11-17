# OcToS GTA V1

Exploración geográfica 3D jugable desde un navegador. Implementación independiente en gta/, sin código reutilizado de OcToS Drive.

## Requisitos
Navegador moderno con WebGL 2, JavaScript y conexión a Internet para teselas geográficas y CDN. Sin instalación de motores ni servidor propio. GitHub Pages sirve el juego mediante HTTPS.

## Controles
A pie: W/S avanzar y retroceder, A/D desplazamiento lateral, Q/E orientar, Mayús correr.
En vehículo: W acelerar, S frenar o retroceder, A/D girar.
Espacio: entrar o salir del vehículo. V: alternar vista de seguimiento y cenital.
Ajustes: calidad, relieve, edificios, proveedor de elevaciones, coordenadas, ciudades y guardado local.

## Fuentes
OpenFreeMap (estilo dark, datos de OpenStreetMap), Mapterhorn (Terrarium), Mapzen/AWS Terrain Tiles (alternativa). Three.js 0.160.1 para personaje y vehículo 3D; si no carga, el jugador continúa como marcador simplificado.
MapLibre GL JS 4.7.1 para geografía y visualización. No se requieren claves API.

## Limitaciones
- Demostración jugable inicial; no es un GTA completo.
- Circulación libre sin colisiones, peatones, tráfico IA, misiones, disparos ni simulación vehicular avanzada.
- Los edificios proceden de OpenStreetMap y su altura puede ser estimada donde faltan datos.
- El relieve puede tardar en cargarse o no estar disponible.
- El guardado usa localStorage y solo existe en el navegador del usuario.
- Los servicios de terceros pueden fallar o cambiar sus condiciones.
- El PIN de OcToS Apps no protege contenidos públicos de GitHub Pages.

## Pruebas
1. Cargar aplicación desde GitHub Pages y confirmar cartografía.
2. Activar/desactivar terreno y edificios y alternar proveedor.
3. WASD, Q/E, Espacio y V.
4. Viajar a Barcelona, Tarragona y coordenadas personalizadas.
5. Recargar y comprobar persistencia.
6. Simular bloqueo de CDN Three.js y comprobar marcador alternativo.
7. Probar calidad baja/alta, WebGL no disponible y pantalla pequeña.
8. Revisar catálogo y navegación.

## Arquitectura
- index.html: interfaz de juego.
- style.css: interfaz responsive.
- world.js: mapa, relieve y edificios.
- game.js: estado, movimiento y persistencia.
- actor.js: modelos 3D y alternativa ligera.
- main.js: arranque.

Datos geográficos: © OpenStreetMap contributors y proveedores atribuidos en pantalla.
