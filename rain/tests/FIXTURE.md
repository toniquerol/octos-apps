# Synthetic GeoTIFF fixture

`fixture-utm.tif` is a **synthetic mathematical test**, not a measured terrain model or an IGN product. Its apparent location is chosen only to test EPSG:25830 coordinate transformations.

It contains a 5 × 5 Float32 grid at 2 m spacing. Upper-left cell edge: E 500000 m, N 4400000 m. Elevation at column c and row r is `100 + 2*c + 4*r` metres, except bottom-right is NoData (-9999). RasterPixelIsArea is used.

Regenerate and verify with `node tests/geotiff-integration.test.mjs`. The integration test runs the bundled GeoTIFF parser and proj4, including real binary Float32 loading, NoData, window cropping and coordinate round-trips. Node supplies a minimal FileReader adapter; these tests do not claim browser UI coverage.
