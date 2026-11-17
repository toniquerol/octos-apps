/* OcToS GTA · Luz solar sin sombras proyectadas. */
const clock = value => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours + minutes / 60;
};
function solarPosition(hour) {
  const day = hour >= 6 && hour < 20;
  const progress = Math.max(0, Math.min(1, (hour - 6) / 14));
  return {day, elevation: day ? 60 * Math.sin(progress * Math.PI) : -8,
    azimuth: 90 + progress * 180};
}
export function createDaylight(map) {
  function setTime(value) {
    const hour = clock(value);
    if (hour === null) return false;
    const sun = solarPosition(hour);
    const twilight = sun.day && sun.elevation < 16;
    const colors = !sun.day
      ? {sky: '#101626', horizon: '#20273a', fog: '#1c2534', light: '#95a7cd', intensity: 0.16}
      : twilight
        ? {sky: '#566e9d', horizon: '#ce9374', fog: '#ad8691', light: '#ffd19f', intensity: 0.46}
        : {sky: '#689cc9', horizon: '#c7d7df', fog: '#a9bccc', light: '#fff2dc', intensity: 0.63};
    try {
      map.setLight({
        anchor: 'map',
        position: [1.4, sun.azimuth, 90 - Math.max(0, sun.elevation)],
        color: colors.light,
        intensity: colors.intensity
      });
      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-color': colors.sky,
          'horizon-color': colors.horizon,
          'fog-color': colors.fog,
          'sky-horizon-blend': 0.45,
          'horizon-fog-blend': 0.48,
          'fog-ground-blend': 0.35,
          'atmosphere-blend': 1
        });
      }
    } catch (error) {
      console.warn('OcToS GTA · iluminación:', error);
      return false;
    }
    return true;
  }
  // API conservada para los cambios de mapa; no se genera ninguna sombra.
  return {setTime, setBuildings(){}, setQuality(){}, refreshShadows(){}};
}
