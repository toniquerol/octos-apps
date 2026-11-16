# OcToS Aero · Integración con OpenFOAM (piloto técnico)

**Estado:** preparación e intercambio de archivos implementados en la rama piloto. **El cálculo automático para cualquier GLB todavía NO está validado.** No confundir el modo ilustrativo de Aero con un cálculo físico.

## Arquitectura

`Aero (GLB + posición/rotación/escala) → STL y manifiesto → caso OpenFOAM en Windows/WSL2 → malla → cálculo → campo U → ParaView CSV en rejilla regular → conversor JSON octos-cfd-v1 → importación manual en Aero`.

- Aero/GitHub Pages **no puede iniciar OpenFOAM de forma nativa**. Esta primera fase entrega los archivos al usuario; no usa API, claves ni servidores.
- El solver real es OpenFOAM Foundation 14 en WSL2. Los casos se ejecutan en el sistema de archivos Linux. No se incluye ni se instala el solver desde la web.
- El exportador STL utiliza la geometría **ya transformada** en metros, X longitudinal (morro -X), flujo +X, Y vertical (suelo Y=0), Z transversal.
- El STL puede no ser estanco o contener solapes (ruedas/carrocería). Requiere inspección/reparación antes de mallar; exportar no certifica calidad geométrica.
- El manifiesto `octos-cfd-case-v1` contiene archivo STL esperado, identidad del vehículo, transformaciones y velocidad de entrada; **no es** un caso OpenFOAM ejecutable completo.
- El lector `octos-cfd-v1` requiere hasta 2 millones de nodos uniformes y un máximo de 110 MB; X es el índice más rápido, luego Y y Z. El CFD y el GLB deben usar exactamente el mismo sistema espacial.

## Paso 1: En Aero (web)

1. Crear proyecto, importar GLB, ajustar orientación, escala y altura.
2. En «Campo CFD» elegir la velocidad del viento en m/s.
3. Descargar **Exportar geometría STL** y **Exportar configuración CFD**.
4. Comprobar el STL en un editor de mallas. El formato no tiene unidades internas: OcToS exporta los valores en **metros**.

## Paso 2: OpenFOAM en Windows/WSL2

Instalar WSL2 con Ubuntu y la versión oficial de OpenFOAM según https://openfoam.org/download/windows/ ; confirmar que los ejecutables de OpenFOAM están en `PATH`. Preparar primero un caso aerodinámico funcional y controlado con `system/controlDict`, `fvSolution`, `fvSchemes`, `blockMeshDict`, `snappyHexMeshDict`, campos iniciales y propiedades físicas. El manifiesto no genera dichos diccionarios.

Ejecutar desde la consola Ubuntu/WSL2, dentro de un entorno OpenFOAM ya cargado:

```bash
python3 aero/tools/openfoam_local.py --case /home/usuario/foam/caso --manifest /home/usuario/descargas/vehiculo-cfd-case.json --stage prepare --stl /home/usuario/descargas/vehiculo-aero.stl
python3 aero/tools/openfoam_local.py --case /home/usuario/foam/caso --manifest /home/usuario/descargas/vehiculo-cfd-case.json --stage mesh
python3 aero/tools/openfoam_local.py --case /home/usuario/foam/caso --manifest /home/usuario/descargas/vehiculo-cfd-case.json --stage solve
```

Este lanzador ejecuta comandos fijos sin `shell=True`, registra errores en `CASO/.octos-cfd/logs` y **no marca la simulación como convergida automáticamente**. Las condiciones de contorno, turbulencia k-ω SST, refinamiento, y+ y criterio de convergencia son responsabilidad de la configuración del caso.

OpenFOAM Foundation 14 dispone de `snappyHexMeshConfig` para generar una propuesta de configuración de mallado desde superficies STL, pero el mallado, los contornos de entrada/salida/suelo y la ubicación de la región fluida deben revisarse manualmente. Referencia: https://cpp.openfoam.org/v14/snappyHexMeshConfig_8C.html

## Paso 3: exportar velocidades sin inventar datos

En ParaView abrir el caso calculado y elegir el instante validado. Aplicar **Resample To Image** con una rejilla uniforme que cubra entrada, techo, laterales, suelo y estela. Exportar las columnas X/Y/Z y Ux/Uy/Uz a CSV.

- Confirmar que las unidades sean m/s y los ejes sean X/Y/Z de Aero.
- **No interpretar valores rellenados artificialmente en celdas sólidas o fuera del dominio como CFD resuelto.** Verificar máscaras de validez y muestrear región fluida; las velocidades inválidas deben excluirse o tratarse antes de producir el JSON.
- En el borde del vehículo, evaluar visualmente que la geometría y las velocidades están registradas.
- Reducir resolución/alcance para cumplir el límite de memoria y tamaño del JSON.

Conversión asociada al manifiesto:

```bash
python3 aero/tools/openfoam_local.py --case /home/usuario/foam/caso --manifest /home/usuario/descargas/vehiculo-cfd-case.json --stage convert --csv /home/usuario/foam/resultado_uniforme.csv --output /home/usuario/foam/vehiculo-cfd.json
```

Se reutiliza `cfd_csv_to_json.py`. Con `--case-manifest` incorpora a la salida `case.vehicleFile`, `case.stl` y velocidad de referencia. El visor rechaza una asociación a un GLB cuyo nombre sea distinto. No puede probar automáticamente que la geometría STL y el campo CFD sean físicamente idénticos.

## Paso 4: Aero (web)

En el mismo proyecto y con el GLB correcto abrir «03 / Campo CFD → Importar campo CFD JSON». Guardar el proyecto `.octosaero` para registrar la referencia. **Ni el STL ni el campo CFD se cargan a GitHub Pages**: se conservan como archivos en el ordenador. Reabrir el proyecto requiere importar de nuevo el JSON si no está cargado.

## Revisión de Integración / Dirección: pendiente

- [ ] Arranque y prueba de un OpenFOAM Foundation 14 real instalado en Windows/WSL2.
- [ ] Caso de referencia simple, geometría cerrada, malla con `checkMesh` sin incidencias críticas.
- [ ] Caso de vehículo real sin superficies críticas abiertas, sin penetraciones de flujo en el sólido.
- [ ] Convergencia cuantitativa de residuales y estabilidad de fuerzas, sensibilidad a malla y coherencia de condiciones de contorno.
- [ ] CSV de muestra sin nodos inválidos y compatible con `octos-cfd-v1`, verificando correspondencia espacial.
- [ ] Importación del GLB + JSON, reabrir proyecto y probar memoria/performance.
- [ ] Decidir y auditar puente local para acción «Calcular CFD» desde navegador (token aleatorio, CORS limitado, localhost; ningún comando arbitrario).
- [ ] Revisión final de Dirección antes de certificar el ciclo completo, publicación solo después de tests completos.

El piloto prepara y transfiere datos, **no inicia todavía** el solver mediante un botón web y **no demuestra** que cualquier STL se pueda mallar. Ese paso requiere validación real en el PC.

## Fuentes

- https://openfoam.org/download/windows/
- https://openfoam.org/release/14/
- https://cpp.openfoam.org/v14/snappyHexMeshConfig_8C.html
- https://www.openfoam.com/documentation/user-guide/7-post-processing/7.4-sampling-data
