/** Tipo de árbol que pide el profesor (determina cómo se genera el árbol esperado). */
export type TreeType = 'COMPLETE' | 'BST' | 'AVL';

/** Tipo de datos del conjunto: números o letras/palabras. */
export type DataType = 'NUMBER' | 'STRING';

/** Criterio de altura: EDGES => un solo nodo tiene altura 0, LEVELS => altura 1. */
export type HeightMode = 'EDGES' | 'LEVELS';

/**
 * Árbol "plano" (mapa de nodos). Es el formato en que se guarda el árbol del alumno
 * en Firestore: evita el límite de 20 niveles de anidación de mapas de Firestore
 * y facilita la edición inmutable.
 */
export interface FlatNode {
  v: string;
  l: string | null;
  r: string | null;
}

export interface FlatTree {
  rootId: string | null;
  nodes: Record<string, FlatNode>;
}

/** Árbol anidado, usado por los algoritmos (generación, recorridos y comparación). */
export interface BNode {
  id: string;
  val: string;
  left: BNode | null;
  right: BNode | null;
}

export interface EvalSettings {
  heightMode: HeightMode;
  /** Si es true, la raíz (cuando tiene hijos) cuenta como nodo interno/rama. */
  rootIsInternal: boolean;
}

/** Tipo de ejercicio: árbol (por defecto, si no se indica) o estructura lineal. */
export type ExerciseKind = 'TREE' | 'LINEAR';

/** Estructura lineal sobre la que se ejecuta la secuencia de operaciones. */
export type LinearStructure = 'LIST' | 'STACK' | 'QUEUE';

/** Configuración de un ejercicio de estructura lineal. */
export interface LinearConfig {
  structure: LinearStructure;
  /** Secuencia de operaciones, p. ej. ["add(5)", "remove(0)", "head()"]. */
  ops: string[];
}

export interface Exercise {
  id: string;
  title: string;
  /** Si se omite, el ejercicio es de árbol (compatibilidad con actividades anteriores). */
  kind?: ExerciseKind;
  treeType: TreeType;
  dataType: DataType;
  /** Árbol: datos a insertar. Estructura lineal: contenido inicial de la estructura. */
  dataset: string[];
  /** Solo para kind === 'LINEAR'. */
  linear?: LinearConfig;
}

/** Respuestas del alumno en un ejercicio de estructura lineal. */
export interface LinearAnswers {
  /** Estado final de la estructura (elementos separados por coma, en orden). */
  finalState: string;
  /** Datos extraídos/devueltos por las operaciones, en orden. */
  extracted: string;
}

export const EMPTY_LINEAR_ANSWERS: LinearAnswers = { finalState: '', extracted: '' };

export interface Answers {
  root: string;
  leaves: string;
  internals: string;
  height: string;
  preorder: string;
  inorder: string;
  postorder: string;
}

export type AnswerKey = keyof Answers;

export const EMPTY_ANSWERS: Answers = {
  root: '',
  leaves: '',
  internals: '',
  height: '',
  preorder: '',
  inorder: '',
  postorder: '',
};

export const EMPTY_TREE: FlatTree = { rootId: null, nodes: {} };

export const TREE_TYPE_LABEL: Record<TreeType, string> = {
  COMPLETE: 'Binario (por niveles)',
  BST: 'Binario de búsqueda (BST)',
  AVL: 'AVL',
};

export const TREE_TYPE_HINT: Record<TreeType, string> = {
  COMPLETE: 'Inserta los datos de arriba hacia abajo y de izquierda a derecha, en el orden dado.',
  BST: 'Inserta en orden: menores a la izquierda; mayores o IGUALES a la derecha.',
  AVL: 'Inserta como BST (iguales a la derecha) y rebalancea con rotaciones tras cada inserción.',
};
