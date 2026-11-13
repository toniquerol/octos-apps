# OcToS Rain V7.5 — navegación del terreno 3D

## Navegación
- Ratón izquierdo arrastrar: **girar** (modo predeterminado).
- Ratón derecho o central arrastrar: **desplazar lateralmente (pan)**.
- Mayús + botón izquierdo arrastrar: **pan**, independientemente del modo seleccionado.
- Botones **Girar / Mover** en el panel 3D: definen la acción del botón izquierdo.
- Rueda: **acercar/alejar**.
- Táctil: **un dedo gira o desplaza** según el modo; **dos dedos desplazan y permiten pellizcar para acercar/alejar**.
- Teclado cuando el 3D tiene foco: flechas / WASD para desplazar y +/- para zoom.
- **Recentrar terreno y cámara** recupera la posición y orientación iniciales.

## Cambios técnicos
- El pan se implementa como una traslación del objetivo de la cámara en el plano horizontal del terreno, escalada por FOV, distancia de cámara y tamaño de pantalla; no desplaza los datos o el mosaico MDT.
- Se conservan la textura, el estado de la simulación D8 y las partículas 3D.
- Cambiar la exageración vertical conserva la posición de pan X/Z, evitando saltos al centro.
- Compatibilidad con ratón, touch y teclado mediante Pointer Events, captura de punteros y gestos de dos contactos.
- Sintaxis JavaScript de app.js y terrain3d.js verificada; no faltan IDs de controles HTML.

## Validación pendiente
No se ha realizado prueba manual de navegación en un navegador con MDT real. El funcionamiento 3D y las capas de fondo de la V7 estaban confirmados por el usuario antes de esta actualización.
