import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceKm, findNearestPoliceStations, GeoLocation } from '../../src/services/sos/haversine';

describe('Haversine Distance Calculator (ARCHITECTURE.md §9)', () => {
  it('calculates accurate distance between two known coordinates', () => {
    // Gateway of India (18.9220, 72.8347) to Marine Drive (18.9438, 72.8232) is ~2.72 km
    const dist = calculateHaversineDistanceKm(18.9220, 72.8347, 18.9438, 72.8232);
    expect(dist).toBeGreaterThan(2.5);
    expect(dist).toBeLessThan(3.0);
  });

  it('returns 0 for identical coordinates', () => {
    const dist = calculateHaversineDistanceKm(19.0760, 72.8777, 19.0760, 72.8777);
    expect(dist).toBe(0);
  });

  it('correctly ranks stations by proximity to student', () => {
    const userLat = 19.0760;
    const userLng = 72.8777;

    const stations: GeoLocation[] = [
      { id: '1', name: 'Far Station (North)', lat: 19.1200, lng: 72.8900, active: true },
      { id: '2', name: 'Closest Station (Campus Post)', lat: 19.0765, lng: 72.8780, active: true },
      { id: '3', name: 'Medium Station (Market)', lat: 19.0850, lng: 72.8800, active: true },
      { id: '4', name: 'Decommissioned Station', lat: 19.0761, lng: 72.8778, active: false },
    ];

    const nearest = findNearestPoliceStations(userLat, userLng, stations, 2);

    expect(nearest.length).toBe(2);
    expect(nearest[0].station.name).toBe('Closest Station (Campus Post)');
    expect(nearest[0].distanceKm).toBeLessThan(0.2); // ~60m away
    expect(nearest[1].station.name).toBe('Medium Station (Market)');
    
    // Inactive station must be ignored
    expect(nearest.some((s) => s.station.id === '4')).toBe(false);
  });
});
