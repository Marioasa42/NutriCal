import { describe, expect, it, vi } from 'vitest';

import { stopMediaStream } from '@/features/food-search/camera-stream';

/** Un `MediaStream` de mentira: lo único que hace falta es `getTracks()`. */
function fakeStream(trackCount: number) {
  const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  return { stream, tracks };
}

describe('stopMediaStream', () => {
  it('detiene cada pista de la transmisión', () => {
    const { stream, tracks } = fakeStream(2);
    stopMediaStream(stream);
    for (const track of tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
  });

  it('no falla si la transmisión no tiene pistas', () => {
    const { stream } = fakeStream(0);
    expect(() => {
      stopMediaStream(stream);
    }).not.toThrow();
  });
});
