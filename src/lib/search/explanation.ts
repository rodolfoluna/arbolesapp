import type { SearchAlgorithm } from './search';
export const SEARCH_EXPLANATION: Record<SearchAlgorithm, { text: string; pseudocode: string }> = {
  BINARY: {
    text: 'La búsqueda binaria necesita datos ordenados. Mantén dos límites: bajo y alto. Calcula medio = floor((bajo + alto) / 2), compara el valor central con el objetivo y descarta la mitad que no puede contenerlo. Si el central es menor, descarta la mitad izquierda INCLUYENDO el central; si es mayor, descarta la derecha INCLUYENDO el central. Si coinciden, está encontrado. Si bajo supera a alto, no está en el arreglo. Cada decisión reduce aproximadamente a la mitad el intervalo; por eso requiere O(log n) comparaciones en el peor caso.',
    pseudocode: `para cada objetivo:
  bajo = 0; alto = n - 1
  mientras bajo <= alto:
    medio = floor((bajo + alto) / 2)
    elegir medio y comparar A[medio] con objetivo
    si son iguales: declarar Encontrado y terminar búsqueda
    si A[medio] < objetivo: descartar izquierda; bajo = medio + 1
    si A[medio] > objetivo: descartar derecha; alto = medio - 1
  si bajo > alto: declarar No encontrado`,
  },
  CHAINING: {
    text: 'Una tabla hash transforma cada clave en un índice de cubeta. Aquí h(k) = k mod m: el resto de dividir k entre el número de cubetas m. Por ejemplo, 17 mod 7 = 3 porque 17 = 2 × 7 + 3. Si dos claves tienen el mismo resultado, hay una colisión: se guardan como nodos distintos en la misma cadena; nunca se sobrescribe la clave anterior. En esta variante las inserciones van al final, en el orden dado. Para buscar, calcula otra vez h(k), entra únicamente a esa cubeta y compara desde el primer nodo. Avanza de uno en uno hasta encontrar la clave o llegar a ∅. Una cubeta vacía permite declarar ausencia inmediatamente. Una buena distribución mantiene las cadenas cortas; en el peor caso todas las claves colisionan y la búsqueda cuesta O(n).',
    pseudocode: `crear m cubetas vacías, numeradas de 0 a m-1
para cada clave k en el orden indicado:
  escribir h(k) = k mod m
  seleccionar cubeta h(k)
  seleccionar tarjeta k e insertar al final de esa cadena
para cada objetivo k:
  escribir h(k) = k mod m
  seleccionar cubeta h(k)
  si está vacía: declarar No encontrado
  si no: visitar su primer nodo (posición 0)
  mientras no se llegue a ∅:
    comparar nodo actual con k
    si coincide: declarar Encontrado y terminar búsqueda
    avanzar al siguiente nodo
  si se llegó a ∅: declarar No encontrado`,
  },
};
