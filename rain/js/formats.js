// Capabilities describe the application, never just the file extension.
export const FORMATS = [
 ['GeoTIFF', '.tif / .tiff', 'Directo condicionado', 'MDT numérico, coberturas o imagen', 'Una banda métrica para hidrología; RGB solo visual. Validar CRS, unidades y NoData.'],
 ['COG', '.tif', 'Lectura TIFF; optimización por verificar', 'Elevaciones', 'No se identifica COG por extensión. Lectura remota parcial sujeta a Range y CORS.'],
 ['LAS / LAZ', '.las / .laz', 'Requiere conversión', 'Nube LiDAR', 'Clasificar suelo y generar MDT GeoTIFF; no usar vegetación como terreno.'],
 ['GeoPackage', '.gpkg', 'No disponible', 'Vector y ráster', 'Pendiente lector SQLite y selección de capas.'],
 ['GeoJSON', '.geojson', 'No disponible para importar', 'Áreas, cuencas y cauces', 'La exportación existente no implica capacidad de importación.'],
 ['Shapefile', '.shp + asociados', 'Requiere conversión', 'Vector', 'Reunir .shp, .shx, .dbf y .prj; .cpg recomendado. Lector pendiente.'],
 ['KML / KMZ', '.kml / .kmz', 'No disponible', 'Geometrías', 'Pendiente XML, ZIP y transformación de geometrías.'],
 ['ASCII Grid', '.asc', 'Requiere conversión', 'Elevaciones', 'Convertir a GeoTIFF conservando NoData, CRS y unidades.'],
 ['NetCDF', '.nc', 'No disponible', 'Meteorología', 'Pendiente selección de variable, tiempo, unidades y malla.'],
 ['CSV', '.csv', 'No disponible para importar', 'Series y estaciones', 'Exportación disponible; importación requiere esquema y unidades explícitas.'],
 ['WMS / WMTS', 'Servicio', 'Visualización condicionada', 'Mapas oficiales', 'Los servicios ya configurados son visuales; no proporcionan cotas para D8.'],
 ['WFS / OGC API Features', 'Servicio', 'No disponible', 'Vector', 'Pendiente consulta, paginación y validación de CRS.'],
 ['WCS / OGC API Coverages', 'Servicio', 'No disponible como cliente genérico', 'Coberturas', 'Un enlace al servicio no constituye importación; descargar GeoTIFF compatible.'],
 ['3D Tiles / glTF', '.json / .gltf / .glb', 'No disponible', 'Modelos 3D', 'El visor genera su propia malla desde el MDT; no lee estos formatos.']
];
export async function identify(file) {
 const bytes=new Uint8Array(await file.slice(0,512).arrayBuffer());
 const ascii=new TextDecoder().decode(bytes);
 const ext=file.name.split('.').pop().toLowerCase();
 const tiff=bytes.length>=4&&((bytes[0]===73&&bytes[1]===73&&(bytes[2]===42||bytes[2]===43)&&bytes[3]===0)||(bytes[0]===77&&bytes[1]===77&&bytes[2]===0&&(bytes[3]===42||bytes[3]===43)));
 if(tiff)return {format:'GeoTIFF/TIFF',readable:true,message:'Firma TIFF reconocida. El lector debe comprobar georreferencia, bandas y unidades; COG sin verificar.'};
 if(['tif','tiff'].includes(ext))throw Error('La extensión TIFF no coincide con la firma del archivo.');
 if(ascii.startsWith('LASF'))return {format:'LAS/LAZ',readable:false,message:'Firma LiDAR reconocida; requiere conversión a MDT.'};
 if(ascii.startsWith('SQLite format 3'))return {format:'SQLite/GeoPackage candidato',readable:false,message:'No se han validado las tablas GeoPackage; lector no disponible.'};
 return {format:ext.toUpperCase(),readable:false,message:'Formato no habilitado para análisis. Consulta la matriz; extensión sin validar.'};
}
export function shapefileParts(files){
 const groups=new Map();
 for(const f of files){const m=f.name.match(/^(.*)\.(shp|shx|dbf|prj|cpg)$/i);if(m){const key=m[1].toLowerCase();if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(m[2].toLowerCase());}}
 return [...groups].map(([name,parts])=>({name,missing:['shp','shx','dbf','prj'].filter(p=>!parts.has(p))}));
}
