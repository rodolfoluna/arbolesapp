import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';

export type Row = Record<string, any> & { id: string };
export type Filter = [string, '==' | 'array-contains', unknown];
export interface DataStore {
  get(collection: string, id: string): Promise<Row | null>;
  list(collection: string, filters?: Filter[]): Promise<Row[]>;
  put(collection: string, id: string, value: Record<string, any>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  atomic<T>(action: (store: DataStore) => Promise<T>): Promise<T>;
}

export function firestoreStore(db: Firestore = getFirestore(), transaction?: Transaction): DataStore {
  const store: DataStore = {
    async get(collection, id) {
      const ref = db.collection(collection).doc(id);
      const result = transaction ? await transaction.get(ref) : await ref.get();
      return result.exists ? { ...result.data(), id: result.id } : null;
    },
    async list(collection, filters = []) {
      let query: FirebaseFirestore.Query = db.collection(collection);
      for (const [field, op, value] of filters) query = query.where(field, op, value);
      const result = transaction ? await transaction.get(query) : await query.get();
      return result.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    },
    async put(collection, id, value) {
      const { id: _ignored, ...data } = value;
      const strip = (value: any): any => {
        if (Array.isArray(value)) return value.map(strip);
        if (value && Object.getPrototypeOf(value) === Object.prototype) {
          return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, strip(item)]));
        }
        return value;
      };
      const clean = strip(data);
      const ref = db.collection(collection).doc(id);
      if (transaction) transaction.set(ref, clean); else await ref.set(clean);
    },
    async remove(collection, id) {
      const ref = db.collection(collection).doc(id);
      if (transaction) transaction.delete(ref); else await ref.delete();
    },
    atomic: (action) => transaction ? action(store) : db.runTransaction((tx) => action(firestoreStore(db, tx))),
  };
  return store;
}
