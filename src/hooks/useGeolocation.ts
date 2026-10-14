import { useCallback, useEffect, useState } from 'react';

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
export interface Fix {
  lat: number;
  lng: number;
  /** metres, 68% confidence (from the browser) */
  accuracy: number;
}

let lastKnown: Fix | null = null;

function getPosition(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

/**
 * mode 'if-granted' – read location only if already allowed (never shows a prompt)
 * mode 'manual'     – wait for request()
 * request() asks for a precise GPS fix first and falls back to a quick network
 * fix if GPS is slow (indoors, old phones).
 */
export function useGeolocation(mode: 'if-granted' | 'manual' = 'manual') {
  const [loc, setLoc] = useState<Fix | null>(lastKnown);
  const [status, setStatus] = useState<GeoStatus>(lastKnown ? 'granted' : 'idle');

  const request = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return null;
    }
    setStatus('requesting');
    const save = (p: GeolocationPosition) => {
      lastKnown = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
      setLoc(lastKnown);
      setStatus('granted');
      return lastKnown;
    };
    try {
      return save(await getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }));
    } catch (e) {
      const err = e as GeolocationPositionError;
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('denied');
        return null;
      }
      try {
        return save(await getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60000 }));
      } catch {
        setStatus('unavailable');
        return null;
      }
    }
  }, []);

  useEffect(() => {
    if (lastKnown || mode !== 'if-granted' || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'granted') void request();
      })
      .catch(() => {});
  }, [mode, request]);

  return { loc, status, request };
}
