import { describe, expect, it } from 'vitest';
import { answerOptions, generateSpecialStimuli, generateTrainingStimuli, introductionOrder, outOfBoundSet, trainedSet } from '../curriculum';
import { OUT_OF_BOUND, chromaDistance, type Answer } from '../notes';
import { LEVEL_LADDER, TEST_MIN_SEMITONE_GAP, baseWindowMs } from '../params';
import { createRng } from '../rng';
import {
  INITIAL_PROGRESS,
  applyAttempt,
  canRetreat,
  retreat,
  scoreTrial,
  specialExerciseDue,
  summarize,
  type AttemptSummary,
  type ProgressState,
} from '../progression';
import { generateTestSequence, reportTest } from '../assessment';

function summaryWith(accuracy: number, trainedAccuracy = accuracy): AttemptSummary {
  return { total: 30, correct: Math.round((accuracy / 100) * 30), accuracy, trainedAccuracy, meanErrorSemitones: null, meanCorrectRtMs: null };
}

describe('curriculum', () => {
  it('agrega notas desde F alternando abajo y arriba, como el paper', () => {
    expect(introductionOrder().slice(0, 5)).toEqual(['F', 'E', 'F#', 'D#', 'G']);
    expect(new Set(introductionOrder()).size).toBe(12);
  });

  it('con una sola nota suenan cinco alturas: F y sus cuatro vecinas fuera de rango', () => {
    expect(trainedSet(1)).toEqual(['F']);
    expect(outOfBoundSet(['F']).sort()).toEqual(['D#', 'E', 'F#', 'G'].sort());
    expect(answerOptions(['F'])).toEqual(['F', OUT_OF_BOUND]);
  });

  it('los fuera de rango se corren con el set y desaparecen con 12 notas', () => {
    expect(outOfBoundSet(trainedSet(2)).sort()).toEqual(['D', 'D#', 'F#', 'G'].sort());
    expect(outOfBoundSet(trainedSet(11))).toHaveLength(1);
    expect(outOfBoundSet(trainedSet(12))).toHaveLength(0);
    expect(answerOptions(trainedSet(12))).not.toContain(OUT_OF_BOUND);
  });

  it('en un intento de nivel 1 al menos la mitad de los trials son la nota aprendida', () => {
    const stimuli = generateTrainingStimuli(createRng(1), ['F'], 30);
    const trained = stimuli.filter((s) => s.expected === 'F').length;
    expect(trained).toBeGreaterThanOrEqual(15);
    expect(stimuli.some((s) => s.expected === OUT_OF_BOUND)).toBe(true);
    stimuli.forEach((s, i) => i > 0 && expect(s.midi).not.toBe(stimuli[i - 1].midi));
    stimuli.forEach((s) => expect([4, 5, 6]).toContain(s.octave));
  });

  it('nunca aparecen notas que no sean aprendidas ni vecinas fuera de rango', () => {
    const trained = trainedSet(4);
    const allowed = [...trained, ...outOfBoundSet(trained)];
    generateTrainingStimuli(createRng(7), trained, 200).forEach((s) => expect(allowed).toContain(s.chroma));
  });

  it('el ejercicio especial es mitad nota objetivo', () => {
    const stimuli = generateSpecialStimuli(createRng(3), 'G', trainedSet(6), 22);
    expect(stimuli.filter((s) => s.expected === 'G')).toHaveLength(11);
  });
});

describe('ventanas y escalera', () => {
  it('la ventana final crece con la cantidad de notas: 1.183 ms a 2.028 ms', () => {
    expect(baseWindowMs(1)).toBe(1183);
    expect(baseWindowMs(12)).toBe(2028);
    expect(baseWindowMs(3)).toBe(1305); // OSM Table 1
    expect(baseWindowMs(6)).toBeGreaterThan(baseWindowMs(5));
  });

  it('24 niveles, exigencia de 20% a 90%, primero con feedback y después sin', () => {
    expect(LEVEL_LADDER).toHaveLength(24);
    expect(LEVEL_LADDER[0]).toMatchObject({ minAccuracy: 20, feedback: true });
    expect(LEVEL_LADDER[23]).toMatchObject({ minAccuracy: 90, feedback: false, windowFactor: 1 });
    const firstNoFeedback = LEVEL_LADDER.findIndex((l) => !l.feedback);
    expect(LEVEL_LADDER.slice(firstNoFeedback).every((l) => !l.feedback)).toBe(true);
  });
});

describe('puntaje', () => {
  it('responder fuera de la ventana es error aunque la nota sea correcta', () => {
    const s = generateTrainingStimuli(createRng(2), ['F'], 1)[0];
    expect(scoreTrial(s, s.expected, 900, 1000).correct).toBe(true);
    expect(scoreTrial(s, s.expected, 1100, 1000).correct).toBe(false);
    expect(scoreTrial(s, null, null, 1000).correct).toBe(false);
  });

  it('apretar siempre "fuera de rango" no alcanza para pasar', () => {
    const stimuli = generateTrainingStimuli(createRng(5), ['F'], 30);
    const trials = stimuli.map((s) => scoreTrial(s, OUT_OF_BOUND, 500, 2000));
    const summary = summarize(trials);
    expect(summary.trainedAccuracy).toBe(0);
    const { passed } = applyAttempt(INITIAL_PROGRESS, summary);
    expect(passed).toBe(false);
  });

  it('el error en semitonos es circular y va de 0 a 6', () => {
    expect(chromaDistance('C', 'B')).toBe(1);
    expect(chromaDistance('C', 'F#')).toBe(6);
  });
});

describe('avance', () => {
  it('pasar un nivel avanza uno', () => {
    const { state, outcome } = applyAttempt(INITIAL_PROGRESS, summaryWith(25));
    expect(outcome).toBe('passed');
    expect(state.level).toBe(2);
  });

  it('sacar 90% en un nivel fácil salta al nivel siguiente al primero que pide 90%', () => {
    const { state, outcome } = applyAttempt(INITIAL_PROGRESS, summaryWith(95));
    expect(outcome).toBe('jumped');
    expect(state.level).toBe(9);
    const noFeedback = applyAttempt({ ...INITIAL_PROGRESS, level: 13 }, summaryWith(92));
    expect(noFeedback.state.level).toBe(21);
  });

  it('pasar el nivel 24 agrega una nota', () => {
    const { state, outcome } = applyAttempt({ ...INITIAL_PROGRESS, level: 24 }, summaryWith(95));
    expect(outcome).toBe('stage-up');
    expect(state).toMatchObject({ stage: 2, level: 1 });
  });

  it('cierre: 3 pases seguidos del nivel final y un pase en frío', () => {
    let state: ProgressState = { ...INITIAL_PROGRESS, stage: 12, level: 24 };
    state = applyAttempt(state, summaryWith(95)).state;
    state = applyAttempt(state, summaryWith(80)).state; // falla: la racha se corta
    expect(state.finalStreak).toBe(0);
    for (let i = 0; i < 3; i++) state = applyAttempt(state, summaryWith(95)).state;
    expect(state.awaitingColdPass).toBe(true);
    expect(state.completed).toBe(false);
    const failCold = applyAttempt(state, summaryWith(85));
    expect(failCold.outcome).toBe('cold-pass-failed');
    expect(failCold.state.finalStreak).toBe(0);
    const passCold = applyAttempt(state, summaryWith(92));
    expect(passCold.state.completed).toBe(true);
  });

  it('después de 10 intentos fallidos se ofrece retroceder', () => {
    let state: ProgressState = { ...INITIAL_PROGRESS, level: 16 };
    for (let i = 0; i < 10; i++) state = applyAttempt(state, summaryWith(10)).state;
    expect(canRetreat(state)).toBe(true);
    expect(retreat(state).level).toBe(9);
  });

  it('ejercicio especial cada 15 intentos con 5 notas o más', () => {
    expect(specialExerciseDue({ ...INITIAL_PROGRESS, stage: 4, attemptsSinceSpecial: 15 })).toBe(false);
    expect(specialExerciseDue({ ...INITIAL_PROGRESS, stage: 5, attemptsSinceSpecial: 15 })).toBe(true);
  });
});

describe('pre-test y post-test', () => {
  it('144 trials, piano primero, guitarra después, cada nota y octava dos veces por timbre', () => {
    const seq = generateTestSequence(createRng(11));
    expect(seq).toHaveLength(144);
    expect(seq.slice(0, 72).every((s) => s.timbre === 'piano-test')).toBe(true);
    expect(seq.slice(72).every((s) => s.timbre === 'guitar-test')).toBe(true);
    const counts = new Map<string, number>();
    seq.forEach((s) => counts.set(`${s.timbre}-${s.midi}`, (counts.get(`${s.timbre}-${s.midi}`) ?? 0) + 1));
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
    expect(counts.size).toBe(72);
  });

  it('notas consecutivas siempre a más de 12 semitonos (muchas semillas)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const seq = generateTestSequence(createRng(seed));
      seq.forEach((s, i) => i > 0 && expect(Math.abs(s.midi - seq[i - 1].midi)).toBeGreaterThanOrEqual(TEST_MIN_SEMITONE_GAP));
    }
  });

  it('reporta acierto, error en semitonos y tiempo por timbre', () => {
    const seq = generateTestSequence(createRng(4));
    const trials = seq.map((s, i) => {
      const answer: Answer = i % 2 === 0 ? s.chroma : 'C';
      return scoreTrial(s, answer, 1500, 5000);
    });
    const report = reportTest(trials);
    expect(report.overall.total).toBe(144);
    expect(report.byTimbre['piano-test'].total).toBe(72);
    expect(report.overall.meanErrorSemitones).toBeGreaterThan(0);
    expect(report.overall.meanCorrectRtMs).toBe(1500);
  });
});
