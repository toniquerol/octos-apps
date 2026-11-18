# OcToS — Patrón corporativo de cabecera y controles (versión 1, 18/11/2026)

**Estado: APROBADO. Uso obligatorio como referencia en todas las aplicaciones OcToS nuevas y en cualquier modificación solicitada de sus cabeceras.**

## Fuente de diseño

Captura de la barra superior de **OcToS AERO — TÚNEL DE VIENTO CFD**, facilitada y aprobada por el usuario el 18/11/2026 (2048 × 68 px). Esta barra es la **referencia visual canónica**; los textos y las funciones varían por aplicación, no el lenguaje visual ni la distribución.

## Anatomía obligatoria (escritorio)

1. **Franja horizontal única**, fondo oscuro uniforme, borde inferior discreto; altura de referencia: **68 px**.
2. **Extremo izquierdo, navegación:** tres botones con icono, en este orden: **Inicio**, **Menú de apps**, **Atrás**. Cuadrados de ~40 px, esquinas redondeadas, borde fino naranja y pictogramas naranjas. Mantener funciones reales de navegación.
3. **Izquierda, menús de aplicación:** desplegables compactos con fondo oscuro y borde naranja. Por ejemplo, en Aero: Flujo, Ambiente, Túnel, Geometría. Los nombres y el número de menús son específicos de cada aplicación.
4. **Centro absoluto del ancho de ventana, identidad:** bloque de marca **centrado como conjunto**, sin depender del ancho de los controles laterales. El **monograma T blanco oficial** está a la izquierda del título **OcToS [APP]**. Debajo se muestra un subtítulo funcional pequeño, con espaciado ampliado. La palabra de aplicación puede emplear el naranja como acento (ej. AERO).
5. **Derecha, herramientas:** primero botones secundarios de vistas/modos/exportación, después acciones principales (reproducir/pausa/parar/velocidad, cuando corresponda). Fondo #2A2B2F o gris más oscuro, texto claro; acento naranja solo en control principal, estado activo o resaltado. No inventar botones que una aplicación no necesite.
6. **Prioridad de composición:** navegación fija → menús funcionales → marca centrada → vistas/opciones → acciones; preservar aire y grupos separados.

## Tokens visuales

| Token | Valor oficial/de referencia |
|---|---|
| `--octos-bg` | `#171719` — barra de la captura |
| `--octos-canvas` | `#0E0E10` — fondo general oscuro |
| `--octos-panel` | `#2A2B2F` — botones/paneles secundarios |
| `--octos-text` | `#F1F1EF` — texto claro |
| `--octos-accent` | `#FF6A1A` — contorno, iconos y estados destacados |
| `--octos-stroke` | `#34353B` — bordes secundarios |
| `--octos-header-h` | `68px` — escritorio |
| `--octos-radius` | `7px` — controles compactos |
| `--octos-gap` | `7px` — separación mínima dentro del grupo |

**No introducir paletas diferentes ni gradientes llamativos en la cabecera.** Emplear la familia tipográfica de la identidad corporativa ya aprobada, respetando jerarquía: título marcado, subtítulo pequeño, botones compactos. No imponer una nueva fuente si la app ya utiliza la tipografía oficial.

## Comportamiento y criterios de implementación

- El bloque central de marca se centra respecto al viewport (ej. `position:absolute; left:50%; transform:translateX(-50%);`), no por distribución `justify-content:space-between` que mueva el logo cuando cambian botones.
- Los grupos laterales no deben invadir el logo. En anchos estrechos se compactan, ocultan detrás del botón Menú o pasan a panel desplegable. Conservar visibles la navegación esencial y la identidad sin solapamientos.
- Iconos de trazo delgado coherentes; borde naranja para navegación/menús principales, gris oscuro para controles auxiliares.
- Estado `hover`/seleccionado: resalte sutil en naranja; estado `disabled`: menor contraste sin alterar tamaño.
- El logotipo «T» **es el archivo maestro aprobado**, blanco, transparente, sin deformaciones, sin reemplazarlo por una letra tipográfica ni redibujarlo.
- Los controles deben ser funcionales y accesibles (etiquetas/title/aria-label, foco visible, clic real).
- Si el programa es un **HTML único local**, incrustar el CSS/imagen maestra necesarios dentro del HTML; no exigir un servidor propio ni rutas relativas ausentes.
- Cada aplicación conserva sus controles específicos y arquitectura. La normalización afecta solo al marco común; evitar refactorizaciones y cambios de comportamiento no pedidos.
- **No actualizar masivamente apps ya publicadas sin petición específica**; adoptar el estándar al crear nuevas o cuando se solicite modificar la cabecera de una app existente.

## Esqueleto de referencia

```html
<header class="octos-header">
  <nav class="octos-nav" aria-label="Navegación">
    <!-- Inicio / Menú / Atrás -->
  </nav>
  <div class="octos-menus"><!-- Desplegables de esta app --></div>
  <div class="octos-brand" aria-label="Identidad OcToS">
    <!-- T blanca maestra + OcToS [APP] + subtítulo -->
  </div>
  <div class="octos-views"><!-- Vistas y modos, si existen --></div>
  <div class="octos-actions"><!-- Acciones de esta app --></div>
</header>
```

La composición y tokens son la **regla permanente OcToS**. Ante una discrepancia con una variante anterior, usar esta referencia salvo instrucción posterior explícita del usuario.
