import type { DataStore, Row, Filter } from './store.ts';

/** Test-only repository. It is never selected by the deployed server. */
export function memoryStore(seed: Record<string, Row[]> = {}): DataStore {
  let data = structuredClone(seed);
  const get = async (collection: string, id: string) => structuredClone((data[collection] || []).find((item) => item.id === id) || null);
  const list = async (collection: string, filters: Filter[] = []) => structuredClone((data[collection] || []).filter((row) => filters.every(([field, op, value]) => op === '==' ? row[field] === value : row[field]?.includes(value))));
  const store: DataStore = {
    get, list,
    async put(collection, id, value) {
      data[collection] = [...(data[collection] || []).filter((item) => item.id !== id), structuredClone({ ...value, id })];
    },
    async remove(collection, id) { data[collection] = (data[collection] || []).filter((item) => item.id !== id); },
    async atomic(action) {
      const before = structuredClone(data);
      try { return await action(store); } catch (error) { data = before; throw error; }
    },
  };
  return store;
}
