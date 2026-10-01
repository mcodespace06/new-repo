/**
 * Haversine Distance Calculator
 * Computes great-circle distance between two points on a sphere given latitude and longitude.
 * Used for emergency SOS nearest police station and security unit dispatch (ARCHITECTURE.md §9).
 */

const EARTH_RADIUS_KM = 6371.0;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates distance in kilometers between two geo-coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((EARTH_RADIUS_KM * c).toFixed(3));
}

export interface GeoLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  email?: string;
  phone?: string;
  active?: boolean;
}

export interface NearestStation<T extends GeoLocation = GeoLocation> {
  station: T;
  distanceKm: number;
}

/**
 * Finds and sorts the nearest N active stations ordered by proximity.
 */
export function findNearestPoliceStations<T extends GeoLocation>(
  userLat: number,
  userLng: number,
  stations: T[],
  limit: number = 2
): NearestStation<T>[] {
  const activeStations = stations.filter((s) => s.active !== false);

  const withDistances = activeStations.map((station) => {
    const distanceKm = calculateHaversineDistanceKm(userLat, userLng, station.lat, station.lng);
    return { station, distanceKm };
  });

  withDistances.sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistances.slice(0, limit);
}
