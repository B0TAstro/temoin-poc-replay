import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measures the real fps from the camera timestamps (in seconds) of the received frames.
 * Frames are counted over the last second of camera time, so JS thread jitter does not
 * affect the measurement — only when it gets displayed.
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
