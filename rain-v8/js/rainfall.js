// Modelo simplificado de lluvia-escorrentía por evento. No es un modelo hidráulico.
export function eventEstimate(areaM2,{rainMm,durationH,runoffCoefficient}) {
  if(!Number.isFinite(areaM2)||areaM2<=0)throw Error('Área de cuenca no válida.');
  if(!Number.isFinite(rainMm)||rainMm<0||rainMm>10000)throw Error('Lluvia fuera de rango (0–10.000 mm).');
  if(!Number.isFinite(durationH)||durationH<=0||durationH>1000)throw Error('Duración fuera de rango (0–1.000 h).');
  if(!Number.isFinite(runoffCoefficient)||runoffCoefficient<0||runoffCoefficient>1)throw Error('El coeficiente debe estar entre 0 y 1.');
  const totalM3=areaM2*rainMm/1000,runoffM3=totalM3*runoffCoefficient;
  return {areaM2,rainMm,durationH,runoffCoefficient,totalM3,runoffM3,
    retainedM3:totalM3-runoffM3,effectiveMm:rainMm*runoffCoefficient,
    averageEquivalentM3s:runoffM3/(durationH*3600),
    averageIntensityMmh:rainMm/durationH};
}
export function areaPerCell(d) {return d.dx*d.dy*(d.areaFactor||1);}
