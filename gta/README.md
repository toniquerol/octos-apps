# OcToS GTA V1

Exploración geográfica 3D jugable desde un navegador. Implementación independiente en gta/. La conducción BMW E46 utiliza las ecuaciones validadas del prototipo local del coche, sin cambiar el renderizador ni el mundo geográfico.

## Requisitos
Navegador moderno con WebGL 2, JavaScript y conexión a Internet para teselas geográficas y CDN. Sin instalación de motores ni servidor propio. GitHub Pages sirve el juego mediante HTTPS.

## Controles
A pie: W/S avanzar y retroceder, A/D desplazamiento lateral, Q/E orientar, Mayús correr.
En BMW E46: W acelerar, S frenar o retroceder, A/D girar, Espacio freno de mano; C alternar tres cámaras; E entrar/salir cerca del coche y a baja velocidad. A pie: Q/E permiten orientar el personaje cuando está lejos del coche; E entra al acercarse. V conserva la alternancia de vistas.
Ajustes: calidad, relieve, edificios, proveedor de elevaciones, coordenadas, ciudades y guardado local.

## Fuentes
OpenFreeMap (estilo dark, datos de OpenStreetMap), Mapterhorn (Terrarium), Mapzen/AWS Terrain Tiles (alternativa). Three.js 0.160.1 para personaje y vehículo 3D. La geometría exterior, ruedas y materiales del BMW proceden del GLB original, optimizado en diez fragmentos binarios comprimidos (11 MB); el navegador requiere DecompressionStream. Si Three.js no carga, el jugador continúa como marcador simplificado.
MapLibre GL JS 4.7.1 para geografía y visualización. No se requieren claves API.

## Limitaciones
- Demostración jugable inicial; no es un GTA completo.
- Circulación libre sin colisiones, peatones, tráfico IA, misiones ni simulación vehicular rígida avanzada. El freno de mano utiliza una deriva lateral arcade; el resto de la cinemática conserva las constantes del prototipo.
- Los edificios proceden de OpenStreetMap y su altura puede ser estimada donde faltan datos.
- El relieve puede tardar en cargarse o no estar disponible.
- El guardado usa localStorage y solo existe en el navegador del usuario.
- Los servicios de terceros pueden fallar o cambiar sus condiciones.
- El PIN de OcToS Apps no protege contenidos públicos de GitHub Pages.

## Pruebas
1. Cargar aplicación desde GitHub Pages y confirmar cartografía.
2. Activar/desactivar terreno y edificios y alternar proveedor.
3. Caminar hasta el BMW, pulsar E, conducir con WASD, probar frenada y derrape con Espacio, alternar tres cámaras con C y salir con E a baja velocidad.
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
- actor.js: escena 3D, personaje y vehículo aparcado/conducible.
- vehicle.js: físicas validadas, freno de mano, modelo exterior y animación de ruedas.
- vehicles/: mallas y materiales originales comprimidos.
- main.js: arranque.

Datos geográficos: © OpenStreetMap contributors y proveedores atribuidos en pantalla.
