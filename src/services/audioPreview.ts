import type { AudioAsset, CurveSetKind, Track } from "@/types/track";
import { sampleCurve } from "@/utils/curves";

const AUDIO_PARAM_SMOOTHING_TIME = 0.05;
const AUDIO_PARAM_TARGET_EPSILON = 0.0001;

interface PlayingTrack {
  source: AudioBufferSourceNode;
  gain: GainNode;
  targetPitch: number;
  targetGain: number;
}

export class AudioPreviewEngine {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pendingLoads = new Map<string, Promise<AudioBuffer | null>>();
  private playing = new Map<string, PlayingTrack>();

  async loadAsset(asset: AudioAsset): Promise<AudioBuffer | null> {
    if (this.buffers.has(asset.id)) {
      return this.buffers.get(asset.id) ?? null;
    }

    const existingLoad = this.pendingLoads.get(asset.id);
    if (existingLoad) {
      return existingLoad;
    }

    const objectUrl = asset.objectUrl;
    if (!objectUrl) return null;

    const loadPromise = (async () => {
      const context = this.getContext();
      const response = await fetch(objectUrl);
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data.slice(0));
      this.buffers.set(asset.id, buffer);
      return buffer;
    })();

    this.pendingLoads.set(asset.id, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.pendingLoads.delete(asset.id);
    }
  }

  async preloadAssets(assets: AudioAsset[]): Promise<void> {
    await Promise.allSettled(assets.map((asset) => this.loadAsset(asset)));
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
    await this.preloadAssets(assets);

    const warnings: string[] = [];
    const activeTracks = this.filterAudibleTracks(tracks);
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const now = context.currentTime;

    for (const track of activeTracks) {
      const asset = track.assetId ? assetById.get(track.assetId) : null;

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
        const pitch = this.normalizePitch(
          sampleCurve(track.curveSets[curveSet].pitch, speed),
        );
        const volume = this.normalizeVolume(
          sampleCurve(track.curveSets[curveSet].volume, speed),
        );

        source.buffer = buffer;
        source.loop = true;
        this.setImmediateValue(source.playbackRate, pitch, now);
        this.setImmediateValue(gain.gain, volume, now);
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
        this.playing.set(track.id, {
          source,
          gain,
          targetPitch: pitch,
          targetGain: volume,
        });
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
    const trackById = new Map(tracks.map((track) => [track.id, track]));
    const now = this.context.currentTime;

    this.playing.forEach((nodes, trackId) => {
      const track = trackById.get(trackId);
      const shouldPlay = track ? audibleIds.has(track.id) : false;
      const pitch = this.normalizePitch(
        track ? sampleCurve(track.curveSets[curveSet].pitch, speed) : 1,
      );
      const volume = this.normalizeVolume(
        shouldPlay && track
          ? sampleCurve(track.curveSets[curveSet].volume, speed)
          : 0,
      );

      nodes.targetPitch = this.scheduleSmoothedValue(
        nodes.source.playbackRate,
        nodes.targetPitch,
        pitch,
        now,
      );
      nodes.targetGain = this.scheduleSmoothedValue(
        nodes.gain.gain,
        nodes.targetGain,
        volume,
        now,
      );
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

  async dispose() {
    this.stop();
    this.buffers.clear();
    const context = this.context;
    this.context = null;

    if (context && context.state !== "closed") {
      await context.close();
    }
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    return this.context;
  }

  private setImmediateValue(param: AudioParam, value: number, atTime: number) {
    param.cancelScheduledValues(atTime);
    param.setValueAtTime(value, atTime);
  }

  private scheduleSmoothedValue(
    param: AudioParam,
    previousTarget: number,
    nextTarget: number,
    atTime: number,
  ): number {
    if (Math.abs(previousTarget - nextTarget) <= AUDIO_PARAM_TARGET_EPSILON) {
      return previousTarget;
    }

    const currentValue = param.value;
    param.cancelScheduledValues(atTime);
    param.setValueAtTime(currentValue, atTime);
    param.setTargetAtTime(nextTarget, atTime, AUDIO_PARAM_SMOOTHING_TIME);
    return nextTarget;
  }

  private filterAudibleTracks(tracks: Track[]): Track[] {
    return tracks.filter(
      (track) => track.enabled && !track.mute && track.visible !== false,
    );
  }

  private normalizePitch(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0.01;
    }

    return Math.max(0.01, value);
  }

  private normalizeVolume(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, value);
  }
}
