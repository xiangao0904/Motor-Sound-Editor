import type { AudioAsset, CurveSetKind, Track, TrackCurve } from "@/types/track";

interface PlayingTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

function sampleCurve(curve: TrackCurve, speed: number): number {
  const keyframes = [...curve.keyframes].sort((a, b) => a.speed - b.speed);

  if (keyframes.length === 0) return curve.kind === "pitch" ? 1 : 0;
  if (speed <= keyframes[0].speed) return keyframes[0].value;

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const next = keyframes[index];

    if (speed <= next.speed) {
      const span = next.speed - previous.speed;
      const ratio = span === 0 ? 0 : (speed - previous.speed) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }

  return keyframes[keyframes.length - 1].value;
}

export class AudioPreviewEngine {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private playing = new Map<string, PlayingTrack>();

  async loadAsset(asset: AudioAsset): Promise<AudioBuffer | null> {
    if (this.buffers.has(asset.id)) {
      return this.buffers.get(asset.id) ?? null;
    }

    if (!asset.objectUrl) return null;

    const context = this.getContext();
    const response = await fetch(asset.objectUrl);
    const data = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    this.buffers.set(asset.id, buffer);
    return buffer;
  }

  async start(
    tracks: Track[],
    assets: AudioAsset[],
    curveSet: CurveSetKind,
    speed: number,
  ): Promise<string[]> {
    const context = this.getContext();
    await context.resume();
    this.stop();

    const warnings: string[] = [];
    const activeTracks = this.filterAudibleTracks(tracks);

    for (const track of activeTracks) {
      const asset = assets.find((item) => item.id === track.assetId);

      if (!asset) {
        warnings.push(`${track.name} has no audio file`);
        continue;
      }

      try {
        const buffer = await this.loadAsset(asset);
        if (!buffer) {
          warnings.push(`${track.name} audio is unavailable`);
          continue;
        }

        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
        this.playing.set(track.id, { source, gain });
      } catch {
        warnings.push(`${track.name} audio could not be decoded`);
      }
    }

    this.update(tracks, curveSet, speed);
    return warnings;
  }

  update(tracks: Track[], curveSet: CurveSetKind, speed: number) {
    if (!this.context) return;

    const audibleIds = new Set(this.filterAudibleTracks(tracks).map((track) => track.id));
    const now = this.context.currentTime;

    this.playing.forEach((nodes, trackId) => {
      const track = tracks.find((item) => item.id === trackId);
      const shouldPlay = track ? audibleIds.has(track.id) : false;
      const pitch = track ? sampleCurve(track.curveSets[curveSet].pitch, speed) : 1;
      const volume = track ? sampleCurve(track.curveSets[curveSet].volume, speed) : 0;

      nodes.source.playbackRate.setTargetAtTime(Math.max(0.01, pitch), now, 0.03);
      nodes.gain.gain.setTargetAtTime(shouldPlay ? volume : 0, now, 0.03);
    });
  }

  stop() {
    this.playing.forEach(({ source }) => {
      try {
        source.stop();
      } catch {
        // Already stopped nodes are harmless.
      }
    });
    this.playing.clear();
  }

  dispose() {
    this.stop();
    this.buffers.clear();
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    return this.context;
  }

  private filterAudibleTracks(tracks: Track[]): Track[] {
    return tracks.filter(
      (track) => track.enabled && !track.mute && track.visible !== false,
    );
  }
}
