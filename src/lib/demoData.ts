import type { Activity, Group, UserProfile } from './models';
import { DEFAULT_SETTINGS } from './models';

export const DEMO_GROUPS: Group[] = [
  { id: 'gpo-ed-3a', name: 'Estructura de Datos - 3A', createdAt: Date.now() },
  { id: 'gpo-ed-3b', name: 'Estructura de Datos - 3B', createdAt: Date.now() },
];

export const DEMO_STUDENTS: UserProfile[] = [
  {
    uid: 'demo-student-1',
    role: 'student',
    controlNumber: '22010456',
    fullName: 'Juan Pérez López',
    email: '22010456@arboles.app',
    groupIds: ['gpo-ed-3a'],
    mustChangePassword: false,
  },
  {
    uid: 'demo-student-2',
    role: 'student',
    controlNumber: '22010457',
    fullName: 'María Gómez Silva',
    email: '22010457@arboles.app',
    groupIds: ['gpo-ed-3a'],
    mustChangePassword: false,
  },
  {
    uid: 'demo-student-3',
    role: 'student',
    controlNumber: '22010458',
    fullName: 'Carlos Morales Díaz',
    email: '22010458@arboles.app',
    groupIds: ['gpo-ed-3b'],
    mustChangePassword: true,
  },
];

export const DEMO_ACTIVITIES: Activity[] = [
  {
    id: 'act-practica-1',
    groupId: 'gpo-ed-3a',
    title: 'Práctica 1: Árboles Binarios, BST y AVL',
    description:
      'Construye manualmente cada árbol nodo por nodo a partir del conjunto de datos e identifica sus propiedades teóricas y recorridos.',
    settings: {
      ...DEFAULT_SETTINGS,
      heightMode: 'LEVELS',
      rootIsInternal: false,
      showFeedback: true,
      open: true,
    },
    exercises: [
      {
        id: 'ex1',
        title: 'Ejercicio 1: Binario por Niveles',
        treeType: 'COMPLETE',
        dataType: 'NUMBER',
        dataset: ['10', '20', '30', '40', '50', '60'],
      },
      {
        id: 'ex2',
        title: 'Ejercicio 2: Árbol BST',
        treeType: 'BST',
        dataType: 'NUMBER',
        dataset: ['50', '30', '70', '20', '40', '60', '80'],
      },
      {
        id: 'ex3',
        title: 'Ejercicio 3: Árbol AVL (Balanceado)',
        treeType: 'AVL',
        dataType: 'NUMBER',
        dataset: ['45', '20', '60', '10', '30', '25'],
      },
      {
        id: 'ex4',
        title: 'Ejercicio 4: BST con Letras',
        treeType: 'BST',
        dataType: 'STRING',
        dataset: ['M', 'D', 'Z', 'B', 'H', 'P'],
      },
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
];
