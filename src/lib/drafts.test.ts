import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { latestExercise, persistExerciseDraft } from './drafts';
import type { ExerciseSubmission } from './models';
import { EMPTY_ANSWERS, EMPTY_TREE } from './tree/types';

const draft = (updatedAt: number): ExerciseSubmission => ({
  tree: EMPTY_TREE, answers: EMPTY_ANSWERS, updatedAt, submitted: false, attempts: 0,
});

describe('ahorro de escrituras y conservación de borradores', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('100 ediciones no escriben en la nube; evaluar produce un solo envío', () => {
    const send = vi.fn();
    for (let i = 1; i <= 100; i++) persistExerciseDraft('ejercicio', draft(i), 'edit', send);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(storage.get('ejercicio')!).updatedAt).toBe(100);
    const evaluated = { ...draft(101), submitted: true, attempts: 1, score: 90 };
    persistExerciseDraft('ejercicio', evaluated, 'evaluate', send);
    expect(send).toHaveBeenCalledExactlyOnceWith(evaluated);
  });

  it('guardar en la nube conserva un borrador sin consumir intentos', () => {
    const send = vi.fn();
    const data = draft(100);
    expect(persistExerciseDraft('ejercicio', data, 'save', send)).toBe(true);
    expect(send).toHaveBeenCalledExactlyOnceWith(data);
    expect(data.attempts).toBe(0);
    expect(data.submitted).toBe(false);
  });

  it('permite enviar una evaluación aunque falle el almacenamiento local', () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const send = vi.fn();
    const data = { ...draft(1), submitted: true, score: 100, attempts: 1 };
    expect(persistExerciseDraft('ejercicio', data, 'evaluate', send)).toBe(false);
    expect(send).toHaveBeenCalledExactlyOnceWith(data);
  });

  it('una respuesta tardía de Firebase no reemplaza el trabajo local más reciente', () => {
    const local = draft(200);
    expect(latestExercise(draft(100), local)).toBe(local);
    expect(latestExercise(undefined, local)).toBe(local);
  });

  it('recupera entregas remotas y respeta un reinicio de intentos posterior', () => {
    const local = { ...draft(100), submitted: true, attempts: 3 };
    const reset = draft(200);
    expect(latestExercise(reset, local)).toBe(reset);
    expect(latestExercise(reset, undefined)).toBe(reset);
    expect(latestExercise(reset, draft(200))).toBe(reset);
  });
});
