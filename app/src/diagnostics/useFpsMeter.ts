import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mesure le fps réel à partir des horodatages caméra (en secondes) des images reçues.
 * On compte les images sur la dernière seconde de temps caméra : la gigue du thread JS
 * n'influence donc pas la mesure, seul le moment de l'affichage en dépend.
 */
export function useFpsMeter(refreshMs = 500) {
  const timestamps = useRef<number[]>([]);
  const dropped = useRef(0);
  const [fps, setFps] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);

  const onFrameTimestamp = useCallback((timestamp: number) => {
    const list = timestamps.current;
    list.push(timestamp);
    while (list.length > 0 && timestamp - list[0] > 1) list.shift();
  }, []);

  const onFrameDropped = useCallback(() => {
    dropped.current += 1;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const list = timestamps.current;
      if (list.length >= 2) {
        const span = list[list.length - 1] - list[0];
        setFps(span > 0 ? (list.length - 1) / span : 0);
      }
      setDroppedCount(dropped.current);
    }, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return { fps, droppedCount, onFrameTimestamp, onFrameDropped };
}
