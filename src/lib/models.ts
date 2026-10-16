import type { Answers, EvalSettings, Exercise, FlatTree, LinearAnswers } from './tree/types';

export type Role = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  role: Role;
  controlNumber: string;
  fullName: string;
  email: string;
  groupIds: string[];
  mustChangePassword: boolean;
  /** Se marca true cuando el profesor restablece la contraseña (se crea una cuenta nueva). */
  disabled?: boolean;
  authVersion?: number;
  createdAt?: unknown;
}

export interface Group {
  id: string;
  name: string;
  createdAt?: unknown;
}

export interface ActivitySettings extends EvalSettings {
  /** El alumno ve su calificación y qué rubros tuvo bien/mal al evaluar. */
  showFeedback: boolean;
  /** Si es false, la actividad queda cerrada (solo lectura para el alumno). */
  open: boolean;
  /**
   * Número máximo de intentos permitidos por ejercicio para evaluar y corregir.
   * 0 (o no definido) = intentos ilimitados (puede corregir indefinidamente).
   * 1 = un solo intento (sin oportunidad de corregir).
   * > 1 = número específico de intentos.
   */
  maxAttempts?: number;
}

export const DEFAULT_SETTINGS: ActivitySettings = {
  heightMode: 'LEVELS',
  rootIsInternal: false,
  showFeedback: true,
  open: true,
  maxAttempts: 0,
};

export interface Activity {
  id: string;
  groupId: string;
  title: string;
  description: string;
  settings: ActivitySettings;
  exercises: Exercise[];
  createdAt?: number;
  updatedAt?: number;
}

export interface ExerciseSubmission {
  tree: FlatTree;
  answers: Answers;
  /** Solo en ejercicios de estructura lineal (lista/pila/cola). */
  linearAnswers?: LinearAnswers;
  /** Marca de tiempo del cliente (ms). Sirve para resolver conflictos local vs nube. */
  updatedAt: number;
  submitted: boolean;
  submittedAt?: number;
  attempts: number;
  score?: number;
  structureExact?: boolean;
}

export interface Submission {
  id: string;
  activityId: string;
  controlNumber: string;
  studentUid: string;
  fullName: string;
  lastUpdated?: unknown;
  exercisesData: Record<string, ExerciseSubmission>;
}

export interface Credential {
  controlNumber: string;
  fullName: string;
  tempPassword: string;
  createdAt?: unknown;
}

export const submissionId = (activityId: string, controlNumber: string) => `${activityId}_${controlNumber}`;
