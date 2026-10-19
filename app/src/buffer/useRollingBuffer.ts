import { useEffect, useMemo, useState } from 'react';
import type { CameraVideoOutput } from 'react-native-vision-camera';

import { type BufferStats, RollingBuffer } from './RollingBuffer';

export { BUFFER_SECONDS, type BufferStats } from './RollingBuffer';

/** Runs a RollingBuffer while `recording` is true and exposes its stats for the overlay. */
export function useRollingBuffer(videoOutput: CameraVideoOutput, recording: boolean) {
  const buffer = useMemo(() => new RollingBuffer(videoOutput), [videoOutput]);
  const [stats, setStats] = useState<BufferStats>(() => buffer.getStats());

  useEffect(() => {
    if (recording) buffer.start();
    else buffer.stop();
  }, [buffer, recording]);

  useEffect(() => {
    const id = setInterval(() => setStats(buffer.getStats()), 500);
    return () => {
      clearInterval(id);
      // Nothing outlives the screen: every segment is deleted.
      buffer.discard();
    };
  }, [buffer]);

  return { stats, buffer };
}
