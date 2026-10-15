import { useSyncExternalStore } from 'react';

/**
 * Rastrea las escrituras a Firestore que aún no confirma el servidor.
 * Sin conexión, la promesa de setDoc() no se resuelve hasta que vuelve la red,
 * así que "pendientes > 0" significa "guardado en el dispositivo, falta subir".
 */
interface WriteSnapshot {
  pending: number;
  lastError: string | null;
}

let pending = 0;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let snapshot: WriteSnapshot = { pending, lastError };

function emit() {
  snapshot = { pending, lastError };
  listeners.forEach((l) => l());
}

export function trackWrite<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit();
  return p
    .then((v) => {
      lastError = null;
      return v;
    })
    .catch((e: unknown) => {
      lastError = e instanceof Error ? e.message : String(e);
      throw e;
    })
    .finally(() => {
      pending = Math.max(0, pending - 1);
      emit();
    });
}

/** Igual que trackWrite pero sin propagar errores (para guardados en segundo plano). */
export function fireAndForget(p: Promise<unknown>) {
  trackWrite(p).catch((e) => console.warn('[sync] escritura fallida', e));
}

export function useWriteQueue() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}
