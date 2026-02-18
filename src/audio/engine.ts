/**
 * Audio Engine for Absolute Pitch Training
 * Using soundfont-player for high-quality MIDI instrument sounds
 * 
 * Specifications:
 * - A4 = 440 Hz (fixed tuning via soundfont)
 * - Note duration: 4 seconds (per protocol)
 * - Instruments: Acoustic Piano, Synth Pad (warm)
 * - Octaves: 2, 3, 4, 5, 6 (full range for pitch training)
 * - High-quality soundfont samples from MusyngKite
 * - Constant volume across all notes
 */

import type { ChromaticNote, Timbre, Octave } from '../types';
import { CHROMATIC_NOTES } from '../types';
import Soundfont from 'soundfont-player';

/**
 * Mapping of chromatic notes to MIDI note offsets within an octave
 * C = 0, C# = 1, D = 2, etc. (Middle C = MIDI 60)
 */
const NOTE_MIDI_OFFSETS: { [key in ChromaticNote]: number } = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/**
 * Calculate MIDI note number from note and octave
 * Formula: MIDI note = (octave + 1) * 12 + note_offset
 * C4 (middle C) = MIDI 60
 */
function getMIDINote(note: ChromaticNote, octave: Octave): number {
  return (octave + 1) * 12 + NOTE_MIDI_OFFSETS[note];
}



/**
 * Main audio engine class using Soundfont
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private pianoInstrument: any = null;
  private synthInstrument: any = null;
  private isInitializing = false;
  private initializePromise: Promise<void> | null = null;
  private currentNoteController: AbortController | null = null;

  constructor() {
    // Initialize on first use to avoid SSR issues
    this.lazyInitializeAudioContext();
  }

  /**
   * Lazy initialization of AudioContext
   * Required due to browser autoplay policy
   */
  private lazyInitializeAudioContext(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return;
    }

    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume if suspended (common in modern browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          console.warn('AudioContext resume failed - will retry on first user interaction');
        });
      }

      this.audioContext = audioContext;
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  /**
   * Ensure instruments are loaded from soundfont
   */
  private async ensureInstrumentsLoaded(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    if (this.pianoInstrument && this.synthInstrument) {
      return;
    }

    this.initializePromise = this.loadInstruments();
    return this.initializePromise;
  }

  /**
   * Load soundfont instruments
   */
  private async loadInstruments(): Promise<void> {
    if (!this.audioContext) {
      this.lazyInitializeAudioContext();
      if (!this.audioContext) {
        throw new Error('AudioContext still not initialized');
      }
    }

    try {
      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('Loading soundfont instruments...');

      // Load instruments from MusyngKite CDN soundfont
      const pianoInstrument = await Soundfont.instrument(this.audioContext, 'acoustic_grand_piano', {
        soundfont: 'MusyngKite',
      });

      // Use violin_pad (synth) instead of synth_pad_warm which doesn't exist
      const synthInstrument = await Soundfont.instrument(this.audioContext, 'pad_2_warm', {
        soundfont: 'MusyngKite',
      });

      this.pianoInstrument = pianoInstrument;
      this.synthInstrument = synthInstrument;

      console.log('Soundfont instruments loaded successfully');
    } catch (error) {
      console.error('Failed to load soundfont instruments:', error);
      throw error;
    }
  }

  /**
   * Get instrument based on timbre
   */
  private getInstrument(timbre: Timbre): any {
    if (timbre === 'piano') {
      return this.pianoInstrument;
    } else if (timbre === 'sine') {
      return this.synthInstrument;
    }
    return null;
  }

  /**
   * Play a note with specified octave and timbre
   * @param note - Musical note (C-B chromatic)
   * @param octave - Octave (2, 3, 4, 5, or 6)
   * @param timbre - Timbre (piano or sine)
   * @param duration - Duration in seconds (default 4)
   * @returns Promise resolving when playback scheduled
   */
  async playNote(
    note: ChromaticNote,
    octave: Octave,
    timbre: Timbre,
    duration: number = 4
  ): Promise<void> {
    await this.ensureInstrumentsLoaded();

    // Cancel any currently playing note
    if (this.currentNoteController) {
      this.currentNoteController.abort();
    }

    // Create new abort controller for this note
    this.currentNoteController = new AbortController();
    const signal = this.currentNoteController.signal;

    const instrument = this.getInstrument(timbre);
    if (!instrument) {
      throw new Error(`Unknown timbre: ${timbre}`);
    }

    const midiNote = getMIDINote(note, octave);

    try {
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      // If already aborted, don't play
      if (signal.aborted) {
        return;
      }

      // Play the note for the specified duration
      await instrument.play(midiNote, this.audioContext.currentTime, {
        duration: duration,
        gain: 1.0, // Full volume for clear pitch perception
      });
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error(`Failed to play note ${note}${octave}:`, error);
      throw error;
    }
  }

  /**
   * Stop all currently playing notes
   */
  stopAll(): void {
    // Soundfont doesn't expose easy note stopping
    // Notes will stop naturally when duration expires
    console.warn('stopAll() is not fully supported with soundfont-player');
  }

  /**
   * Test the audio engine by playing A4
   */
  async testAudio(): Promise<void> {
    console.log('Testing audio with A4 (440 Hz)...');
    await this.playNote('A', 4, 'piano', 2);
  }

  /**
   * Dispose of audio resources
   */
  dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        console.warn('Failed to close AudioContext');
      });
    }
    this.audioContext = null;
    this.pianoInstrument = null;
    this.synthInstrument = null;
  }
}

/**
 * Global singleton instance
 */
let globalEngine: AudioEngine | null = null;

/**
 * Get or create global audio engine instance
 */
export function getAudioEngine(): AudioEngine {
  if (!globalEngine) {
    globalEngine = new AudioEngine();
  }
  return globalEngine;
}

/**
 * Test all notes in a given octave
 * Useful for debugging and verification
 */
export async function testAllNotes(octave: Octave = 4): Promise<void> {
  const engine = getAudioEngine();

  console.log(`Testing all notes in octave ${octave} with piano timbre...`);

  for (const note of CHROMATIC_NOTES) {
    console.log(`Playing ${note}${octave}`);
    await engine.playNote(note, octave, 'piano', 2);
    // Small delay between notes to avoid overlap
    await new Promise(resolve => setTimeout(resolve, 2200));
  }

  console.log('Test complete');
}
