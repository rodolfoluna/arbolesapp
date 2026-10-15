import { describe, expect, it } from 'vitest';
import type { Exercise } from '../tree/types';
import { evaluateLinear, linearExerciseErrors, simulate, simulateExercise, tokenizeOps } from './linear';

const ex = (over: Partial<Exercise> & { structure?: 'LIST' | 'STACK' | 'QUEUE'; ops: string[] }): Exercise => ({
  id: 'l1',
  title: 'L1',
  kind: 'LINEAR',
  treeType: 'BST',
  dataType: 'NUMBER',
  dataset: over.dataset ?? [],
  linear: { structure: over.structure ?? 'LIST', ops: over.ops },
});

describe('tokenizeOps', () => {
  it('lee operaciones separadas por comas y por líneas', () => {
    const r = tokenizeOps('add(5), add( 0 ,7)\nremove(0)\n head ()');
    expect(r.ops).toEqual(['add(5)', 'add(0, 7)', 'remove(0)', 'head()']);
    expect(r.leftover).toBe('');
  });

  it('reporta texto no reconocido', () => {
    expect(tokenizeOps('add(5) foo').leftover).toBe('foo');
  });
});

describe('lista', () => {
  it('simula add, remove, get, head, set, indexOf, size e isEmpty', () => {
    const sim = simulate('LIST', 'NUMBER', ['1'], [
      'add(5)', // [1,5]
      'add(0, 9)', // [9,1,5]
      'remove(1)', // -> 1  [9,5]
      'get(1)', // -> 5
      'head()', // -> 9
      'tail()', // -> 5
      'set(0, 4)', // [4,5]
      'indexOf(5)', // -> 1
      'size()', // -> 2
      'isEmpty()', // -> false
    ]);
    expect(sim.errorCount).toBe(0);
    expect(sim.finalState).toEqual(['4', '5']);
    expect(sim.extracted).toEqual(['1', '5', '9', '5', '1', '2', 'false']);
  });

  it('acepta getElementAt como alias de get', () => {
    const sim = simulate('LIST', 'NUMBER', ['3', '4'], ['getElementAt(1)']);
    expect(sim.extracted).toEqual(['4']);
  });

  it('marca error en posiciones fuera de rango y en estructura vacía', () => {
    const sim = simulate('LIST', 'NUMBER', [], ['remove(0)', 'head()', 'add(1, 5)']);
    expect(sim.errorCount).toBe(3);
  });

  it('normaliza números ("07" -> 7)', () => {
    const sim = simulate('LIST', 'NUMBER', [], ['add(07)']);
    expect(sim.finalState).toEqual(['7']);
  });
});

describe('pila y cola', () => {
  it('pila: LIFO con estado de fondo a tope', () => {
    const sim = simulate('STACK', 'NUMBER', [], ['push(1)', 'push(2)', 'push(3)', 'pop()', 'peek()', 'size()']);
    expect(sim.finalState).toEqual(['1', '2']);
    expect(sim.extracted).toEqual(['3', '2', '2']);
  });

  it('cola: FIFO con estado de frente a final', () => {
    const sim = simulate('QUEUE', 'STRING', [], ['enqueue(a)', 'enqueue(b)', 'enqueue(c)', 'dequeue()', 'front()', 'isEmpty()']);
    expect(sim.finalState).toEqual(['b', 'c']);
    expect(sim.extracted).toEqual(['a', 'b', 'false']);
  });

  it('rechaza operaciones de otra estructura', () => {
    const sim = simulate('STACK', 'NUMBER', [], ['enqueue(1)']);
    expect(sim.errorCount).toBe(1);
    expect(sim.steps[0].error).toMatch(/no existe/);
  });

  it('valida argumentos y su cantidad', () => {
    expect(simulate('STACK', 'NUMBER', [], ['push()']).errorCount).toBe(1);
    expect(simulate('STACK', 'NUMBER', [], ['push(a)']).errorCount).toBe(1);
    expect(simulate('LIST', 'NUMBER', [], ['get(x)']).errorCount).toBe(1);
  });
});

describe('evaluateLinear', () => {
  const e = ex({ structure: 'STACK', ops: ['push(1)', 'push(2)', 'pop()', 'push(3)'] });
  // estado final: 1, 3 ; extraídos: 2

  it('califica 100 con respuestas correctas (tolerando corchetes y espacios)', () => {
    const r = evaluateLinear(e, { finalState: '[1, 3]', extracted: '2' });
    expect(r.total).toBe(100);
    expect(r.structureExact).toBe(true);
  });

  it('da 50 si solo acierta una parte', () => {
    expect(evaluateLinear(e, { finalState: '3, 1', extracted: '2' }).total).toBe(50);
    expect(evaluateLinear(e, { finalState: '1, 3', extracted: '' }).total).toBe(50);
  });

  it('respuestas vacías no dan puntos aunque lo esperado sea vacío; hay que escribir "-"', () => {
    const none = ex({ structure: 'QUEUE', ops: ['enqueue(1)', 'dequeue()'] });
    // final: vacía; extraído: 1
    expect(evaluateLinear(none, { finalState: '', extracted: '1' }).total).toBe(50);
    expect(evaluateLinear(none, { finalState: '-', extracted: '1' }).total).toBe(100);
    expect(evaluateLinear(none, { finalState: '[]', extracted: '1' }).total).toBe(100);
  });

  it('compara true/false sin distinguir mayúsculas', () => {
    const b = ex({ ops: ['isEmpty()'] });
    expect(evaluateLinear(b, { finalState: '-', extracted: 'TRUE' }).total).toBe(100);
  });
});

describe('linearExerciseErrors / simulateExercise', () => {
  it('ejercicio de árbol no es lineal', () => {
    const tree: Exercise = { id: 't', title: 'T', treeType: 'BST', dataType: 'NUMBER', dataset: ['1'] };
    expect(simulateExercise(tree)).toBeNull();
    expect(linearExerciseErrors(tree)).toEqual([]);
  });

  it('detecta operaciones imposibles y secuencias vacías', () => {
    expect(linearExerciseErrors(ex({ ops: [] }))).toHaveLength(1);
    expect(linearExerciseErrors(ex({ ops: ['remove(3)'] }))).toHaveLength(1);
    expect(linearExerciseErrors(ex({ ops: ['add(1)', 'remove(0)'] }))).toEqual([]);
  });
});
