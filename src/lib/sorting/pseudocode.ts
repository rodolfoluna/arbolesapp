import type { SortAlgorithm } from './sorting';
export const PSEUDOCODE: Record<SortAlgorithm, string> = {
  BUBBLE: `para fin = n-1 hasta 1:
  para j = 0 hasta fin-1:
    comparar A[j] y A[j+1]
    si A[j] > A[j+1]: intercambiar
  siguiente pasada`,
  SELECTION: `para i = 0 hasta n-2:
  minimo = i
  para j = i+1 hasta n-1:
    comparar A[minimo] y A[j]
    si A[j] < A[minimo]: marcar minimo = j
  si minimo != i: intercambiar A[i], A[minimo]
  siguiente pasada`,
  INSERTION: `para i = 1 hasta n-1:
  extraer clave = A[i]; hueco = i
  mientras hueco >= 1:
    comparar A[hueco-1] y clave
    si A[hueco-1] <= clave: salir
    desplazar A[hueco-1] al hueco
    hueco = hueco-1
  insertar clave en hueco
  siguiente pasada`,
  SHELL: `salto = floor(n/2)
mientras salto > 0:
  para i = salto hasta n-1:
    extraer clave = A[i]; hueco = i
    mientras hueco >= salto:
      comparar A[hueco-salto] y clave
      si A[hueco-salto] <= clave: salir
      desplazar A[hueco-salto] al hueco
      hueco = hueco-salto
    insertar clave en hueco
    siguiente pasada
  salto = floor(salto/2)`,
  HEAP: `hundir(raiz, tamaño):
  mientras raiz tiene hijo izquierdo:
    mayor = raiz
    comparar A[mayor] con hijo izquierdo
    si hijo izquierdo es mayor: mayor = izquierdo
    si existe hijo derecho:
      comparar A[mayor] con hijo derecho
      si derecho es mayor: mayor = derecho
    si mayor == raiz: salir
    intercambiar A[raiz], A[mayor]; raiz = mayor
para padre = floor(n/2)-1 hasta 0: hundir(padre,n)
siguiente pasada
para fin = n-1 hasta 1:
  extraer máximo: intercambiar raíz y A[fin]
  hundir(0,fin)
  siguiente pasada`,
  QUICK: `quick(izq,der):
  si izq >= der: regresar
  elegir pivote = A[der]; i = izq
  para j = izq hasta der-1:
    comparar A[j] con pivote
    si A[j] <= pivote:
      si i != j: intercambiar A[i], A[j]
      i = i+1
  si i != der: intercambiar A[i], A[der]
  siguiente pasada
  quick(izq,i-1)
  quick(i+1,der)`,
  MERGE: `merge(izq,der):
  si izq >= der: regresar
  medio = floor((izq+der)/2)
  dividir (seleccionar extremos izq y der)
  merge(izq,medio); merge(medio+1,der)
  recorrer las dos mitades desde el inicio:
    si ambas tienen pendientes: comparar sus primeras tarjetas
    copiar al auxiliar la menor (en empate, izquierda)
    si una mitad se agotó: copiar las restantes de la otra
  escribir el auxiliar en A[izq..der], de izquierda a derecha
  siguiente pasada`,
  BUCKET: `para cada tarjeta, de izquierda a derecha:
  enviar a cubeta floor(valor/10)
siguiente pasada
para cubeta = 0 hasta 9:
  para i = 1 hasta tamaño(cubeta)-1:
    j = i
    mientras j > 0:
      comparar cubeta[j-1], cubeta[j]
      si están en orden: salir
      intercambiar; j = j-1
para cubeta = 0 hasta 9:
  recoger sus tarjetas desde el inicio a A[0..n-1]
siguiente pasada`,
  RADIX: `potencia = 1
mientras potencia <= max(1,máximo):
  para cada tarjeta de A, de izquierda a derecha:
    dígito = floor(valor/potencia) mod 10
    enviar a cubeta dígito
  siguiente pasada
  para cubeta = 0 hasta 9:
    recoger FIFO (primero en entrar, primero en salir)
    colocar consecutivamente en A[0..n-1]
  siguiente pasada
  potencia = potencia*10`,
  COUNTING: `C[0..máximo] = 0
para cada tarjeta de izquierda a derecha:
  contar: C[valor] = C[valor]+1
siguiente pasada
para k = 1 hasta máximo:
  acumular: C[k] = C[k]+C[k-1]
siguiente pasada
para i = n-1 hasta 0:
  destino = C[A[i]]-1
  colocar A[i] en salida[destino]
  C[A[i]] = C[A[i]]-1
siguiente pasada
para i = 0 hasta n-1:
  escribir salida[i] en A[i]
siguiente pasada`,
};
