/**
 * Motor de audio.
 *
 * - Tres timbres, como el paper: un piano para entrenar, otro piano distinto para
 *   los tests (para medir "piano" y no un sample) y guitarra como timbre no entrenado.
 * - Clips de 800 ms con rampa de 100 ms.
 * - Devuelve el instante de inicio real de la nota, para medir el tiempo de respuesta
 *   desde el inicio (como el paper) y no desde que termina.
 * - Tono de Shepard descendente para borrar la memoria de trabajo antes de niveles sin feedback.
 */

import Soundfont from 'soundfont-player';
import type { Timbre } from '../protocol/curriculum';
import { NOTE_DURATION_MS, NOTE_RAMP_MS, SHEPARD_DURATION_MS } from '../protocol/params';

const INSTRUMENTS: Record<Timbre, { soundfont: 'MusyngKite' | 'FluidR3_GM'; name: string }> = {
  'piano-train': { soundfont: 'MusyngKite', name: 'acoustic_grand_piano' },
  'piano-test': { soundfont: 'FluidR3_GM', name: 'acoustic_grand_piano' },
  'guitar-test': { soundfont: 'FluidR3_GM', name: 'acoustic_guitar_nylon' },
};

/** Margen para programar la nota en el reloj de audio sin cortes. */
const SCHEDULE_AHEAD_S = 0.05;

// soundfont-player no trae tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Player = any;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private players = new Map<Timbre, Promise<Player>>();
  private activeNodes: Player[] = [];
  private shepardSource: AudioBufferSourceNode | null = null;

  private context(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  /** Hay que llamarlo desde un gesto del usuario (clic) por la política de autoplay. */
  async unlock(): Promise<void> {
    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  load(timbre: Timbre): Promise<Player> {
    let player = this.players.get(timbre);
    if (!player) {
      const { soundfont, name } = INSTRUMENTS[timbre];
      player = Soundfont.instrument(this.context(), name as never, { soundfont });
      player.catch(() => this.players.delete(timbre));
      this.players.set(timbre, player);
    }
    return player;
  }

  async preload(timbres: readonly Timbre[]): Promise<void> {
    await Promise.all(timbres.map((t) => this.load(t)));
  }

  /** Toca una nota y devuelve el momento (performance.now) en que empieza a sonar. */
  async playMidi(midi: number, timbre: Timbre): Promise<number> {
    const player = await this.load(timbre);
    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();
    this.stopNotes();

    const when = ctx.currentTime + SCHEDULE_AHEAD_S;
    const ramp = NOTE_RAMP_MS / 1000;
    const node = player.play(midi, when, {
      duration: (NOTE_DURATION_MS - NOTE_RAMP_MS) / 1000,
      attack: ramp,
      release: ramp,
      gain: 2,
    });
    this.activeNodes.push(node);
    return performance.now() + SCHEDULE_AHEAD_S * 1000;
  }

  stopNotes(): void {
    for (const node of this.activeNodes) {
      try {
        node?.stop?.();
      } catch {
        // ya terminó
      }
    }
    this.activeNodes = [];
  }

  /**
   * Tono de Shepard: sinusoides a una octava de distancia que bajan sin parar, con una
   * envolvente fija en frecuencia, así nunca se percibe una nota estable.
   * Resuelve cuando termina o cuando se corta con stopShepard.
   */
  async playShepard(durationMs: number = SHEPARD_DURATION_MS): Promise<void> {
    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();
    this.stopShepard();

    const sampleRate = ctx.sampleRate;
    const length = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const components = 9;
    const minFreq = 27.5; // A0
    const cycleSeconds = 10; // cada componente baja una octava cada 10 s
    const fade = Math.min(sampleRate, length / 4);
    const phases = new Float64Array(components);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const shift = (t / cycleSeconds) % 1;
      let sample = 0;
      for (let k = 0; k < components; k++) {
        let position = k - shift;
        if (position < 0) position += components;
        const freq = minFreq * 2 ** position;
        const x = (position - components / 2) / (components / 5);
        const amp = Math.exp(-0.5 * x * x);
        phases[k] += (2 * Math.PI * freq) / sampleRate;
        sample += amp * Math.sin(phases[k]);
      }
      const edge = Math.min(1, i / fade, (length - i) / fade);
      data[i] = (sample / components) * 0.6 * edge;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    this.shepardSource = source;
    return new Promise((resolve) => {
      source.onended = () => {
        if (this.shepardSource === source) this.shepardSource = null;
        resolve();
      };
      source.start();
    });
  }

  stopShepard(): void {
    try {
      this.shepardSource?.stop();
    } catch {
      // ya terminó
    }
    this.shepardSource = null;
  }

  stopAll(): void {
    this.stopNotes();
    this.stopShepard();
  }
}

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
