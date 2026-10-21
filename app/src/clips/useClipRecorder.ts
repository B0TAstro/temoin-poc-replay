import { useEffect, useMemo, useState } from 'react';
import type { CameraVideoOutput } from 'react-native-vision-camera';

import { ClipRecorder, type ClipStats } from './ClipRecorder';

/** Records one clip per point while `recording` is true, and exposes stats for the overlay. */
export function useClipRecorder(videoOutput: CameraVideoOutput, recording: boolean, maxSaved: number) {
  const clips = useMemo(() => new ClipRecorder(videoOutput, maxSaved), [videoOutput, maxSaved]);
  const [stats, setStats] = useState<ClipStats>(() => clips.getStats());

  useEffect(() => {
    if (recording) clips.start();
    else clips.stop();
  }, [clips, recording]);

  useEffect(() => {
    const id = setInterval(() => setStats(clips.getStats()), 500);
    return () => {
      clearInterval(id);
      // Nothing outlives the match: every clip is deleted (GDPR).
      clips.discard();
    };
  }, [clips]);

  return { stats, clips };
}
