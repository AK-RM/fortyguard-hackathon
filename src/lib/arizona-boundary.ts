/**
 * Simplified Arizona state boundary (lng, lat vertices).
 * Used for point-in-polygon validation — not a bounding rectangle.
 */
export const ARIZONA_SIMPLIFIED_POLYGON: Array<[number, number]> = [
  [-114.816, 32.492],
  [-114.722, 32.717],
  [-114.524, 32.755],
  [-114.47, 32.843],
  [-114.507, 33.029],
  [-114.661, 33.034],
  [-114.739, 33.407],
  [-114.877, 33.697],
  [-114.809, 34.248],
  [-114.633, 34.448],
  [-114.576, 34.815],
  [-114.303, 34.998],
  [-114.136, 35.001],
  [-114.06, 35.529],
  [-114.05, 36.196],
  [-112.466, 36.604],
  [-111.047, 36.998],
  [-109.045, 36.999],
  [-109.045, 31.332],
  [-111.074, 31.332],
  [-114.816, 32.492],
];

export function isPointInPolygon(
  latitude: number,
  longitude: number,
  polygon: Array<[number, number]>
): boolean {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[previous];
    const [x2, y2] = polygon[index];

    const intersects =
      y1 > latitude !== y2 > latitude &&
      longitude <
        ((x2 - x1) * (latitude - y1)) / (y2 - y1 + Number.EPSILON) + x1;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function isPointInArizona(latitude: number, longitude: number): boolean {
  return isPointInPolygon(latitude, longitude, ARIZONA_SIMPLIFIED_POLYGON);
}
