import { useEffect, useMemo, useState } from 'react';
import type { Activity, ExerciseSubmission, Submission } from '../../lib/models';
import type { Answers, FlatTree, LinearAnswers } from '../../lib/tree/types';
import { EMPTY_ANSWERS, EMPTY_LINEAR_ANSWERS, EMPTY_TREE, TREE_TYPE_HINT, TREE_TYPE_LABEL } from '../../lib/tree/types';
import { treeValues } from '../../lib/tree/edit';
import { valueKey } from '../../lib/tree/values';
import { evaluateExercise, type Evaluation } from '../../lib/tree/evaluate';
import { saveExerciseSubmission, subscribeSubmission } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { TreeCanvas } from '../tree/TreeCanvas';
import { ExerciseQuestions } from './ExerciseQuestions';
import { LinearExercisePanel } from './LinearExercisePanel';
import {
  STRUCTURE_LABEL,
  STRUCTURE_ORDER_HINT,
  evaluateLinear,
  isLinearExercise,
  type LinearEvaluation,
} from '../../lib/linear/linear';
import { cx, ScorePill } from '../ui';

interface Props {
  activity: Activity;
  onBack?: () => void;
}

export function StudentActivityView({ activity, onBack }: Props) {
  const { profile } = useAuth();
  const [activeExIndex, setActiveExIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<'tree' | 'questions'>('tree');
  const [submission, setSubmission] = useState<Submission | null>(null);

  // Estados locales del ejercicio actual para interactividad inmediata y offline
  const [currentTree, setCurrentTree] = useState<FlatTree>(EMPTY_TREE);
  const [currentAnswers, setCurrentAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [lastEval, setLastEval] = useState<Evaluation | null>(null);
  const [currentLinear, setCurrentLinear] = useState<LinearAnswers>(EMPTY_LINEAR_ANSWERS);
  const [lastLinearEval, setLastLinearEval] = useState<LinearEvaluation | null>(null);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  const activeExercise = activity.exercises[activeExIndex] || activity.exercises[0];
  const exId = activeExercise?.id;
  const isLinear = isLinearExercise(activeExercise);

  const maxAttempts = activity.settings?.maxAttempts ?? 0;
  const hasExhaustedAttempts = maxAttempts > 0 && currentAttempts >= maxAttempts;
  const isReadOnly = !activity.settings.open || hasExhaustedAttempts;

  // Clave de almacenamiento local de respaldo
  const localBackupKey = `tree_sub_${activity.id}_${profile?.controlNumber || 'anon'}_${exId}`;

  // Suscribirse a la entrega en Firestore (funciona desde caché sin conexión)
  useEffect(() => {
    if (!profile?.controlNumber || !activity.id) return;
    const unsub = subscribeSubmission(activity.id, profile.controlNumber, (sub) => {
      setSubmission(sub);
    });
    return () => unsub();
  }, [activity.id, profile?.controlNumber]);

  // Cargar estado del ejercicio activo desde Firestore o LocalStorage
  useEffect(() => {
    if (!exId) return;

    // 1. Intentar desde Firestore (o caché de Firestore)
    const remoteData = submission?.exercisesData?.[exId];
    if (remoteData) {
      setCurrentTree(remoteData.tree || EMPTY_TREE);
      setCurrentAnswers(remoteData.answers || EMPTY_ANSWERS);
      setCurrentLinear(remoteData.linearAnswers || EMPTY_LINEAR_ANSWERS);
      setCurrentAttempts(remoteData.attempts ?? 0);
      if (remoteData.score !== undefined && isLinearExercise(activeExercise)) {
        setLastLinearEval(evaluateLinear(activeExercise, remoteData.linearAnswers));
        setLastEval(null);
      } else if (remoteData.score !== undefined) {
        setLastEval(evaluateExercise(activeExercise, activity.settings, remoteData.tree, remoteData.answers));
        setLastLinearEval(null);
      } else {
        setLastEval(null);
        setLastLinearEval(null);
      }
      return;
    }

    // 2. Si no hay en Firestore, revisar respaldo en LocalStorage
    try {
      const raw = localStorage.getItem(localBackupKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setCurrentTree(parsed.tree || EMPTY_TREE);
        setCurrentAnswers(parsed.answers || EMPTY_ANSWERS);
        setCurrentLinear(parsed.linearAnswers || EMPTY_LINEAR_ANSWERS);
        setCurrentAttempts(parsed.attempts ?? 0);
        setLastEval(null);
        setLastLinearEval(null);
        return;
      }
    } catch {
      /* ignore */
    }

    // 3. Si es nuevo, inicializar vacío
    setCurrentTree(EMPTY_TREE);
    setCurrentAnswers(EMPTY_ANSWERS);
    setCurrentLinear(EMPTY_LINEAR_ANSWERS);
    setCurrentAttempts(0);
    setLastEval(null);
    setLastLinearEval(null);
  }, [exId, submission, localBackupKey, activeExercise, activity.settings]);

  // Guardado local y remoto
  const persistChanges = (
    tree: FlatTree,
    answers: Answers,
    linearAnswers: LinearAnswers,
    evalRes?: { total: number; structureExact: boolean },
    overrideAttempts?: number
  ) => {
    const prevSub = submission?.exercisesData?.[exId];
    const resolvedAttempts =
      overrideAttempts !== undefined
        ? overrideAttempts
        : (prevSub?.attempts ?? currentAttempts ?? 0) + (evalRes ? 1 : 0);

    // 1. LocalStorage inmediato
    try {
      localStorage.setItem(
        localBackupKey,
        JSON.stringify({
          tree,
          answers,
          linearAnswers,
          attempts: resolvedAttempts,
          submitted: !!evalRes || (prevSub?.submitted ?? false),
          score: evalRes ? evalRes.total : prevSub?.score,
          updatedAt: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }

    // 2. Firestore (encola automáticamente si está offline)
    if (profile?.controlNumber && profile?.uid) {
      const payload: ExerciseSubmission = {
        tree,
        answers,
        updatedAt: Date.now(),
        submitted: !!evalRes || (prevSub?.submitted ?? false),
        attempts: resolvedAttempts,
      };
      if (isLinear) payload.linearAnswers = linearAnswers;
      if (evalRes) {
        payload.submittedAt = Date.now();
        payload.score = evalRes.total;
        payload.structureExact = evalRes.structureExact;
      } else if (prevSub?.submitted) {
        if (prevSub.submittedAt !== undefined) payload.submittedAt = prevSub.submittedAt;
        if (prevSub.score !== undefined) payload.score = prevSub.score;
        if (prevSub.structureExact !== undefined) payload.structureExact = prevSub.structureExact;
      }
      saveExerciseSubmission(
        { uid: profile.uid, controlNumber: profile.controlNumber, fullName: profile.fullName },
        activity.id,
        exId,
        payload
      );
    }
  };

  const handleTreeChange = (newTree: FlatTree) => {
    if (isReadOnly) return;
    setCurrentTree(newTree);
    persistChanges(newTree, currentAnswers, currentLinear);
  };

  const handleAnswersChange = (newAnswers: Answers) => {
    if (isReadOnly) return;
    setCurrentAnswers(newAnswers);
    persistChanges(currentTree, newAnswers, currentLinear);
  };

  const handleLinearChange = (newAnswers: LinearAnswers) => {
    if (isReadOnly) return;
    setCurrentLinear(newAnswers);
    persistChanges(currentTree, currentAnswers, newAnswers);
  };

  const handleSaveAndEvaluate = (evalResult: Evaluation) => {
    if (isReadOnly) return;
    const nextAttempts = currentAttempts + 1;
    setCurrentAttempts(nextAttempts);
    setLastEval(evalResult);
    persistChanges(currentTree, currentAnswers, currentLinear, evalResult, nextAttempts);
  };

  const handleSaveAndEvaluateLinear = (evalResult: LinearEvaluation) => {
    if (isReadOnly) return;
    const nextAttempts = currentAttempts + 1;
    setCurrentAttempts(nextAttempts);
    setLastLinearEval(evalResult);
    persistChanges(currentTree, currentAnswers, currentLinear, evalResult, nextAttempts);
  };

  // Nodos usados en el árbol para tachar chips
  const usedInTree = useMemo(() => treeValues(currentTree), [currentTree]);
  const usedCount = useMemo(() => {
    const map = new Map<string, number>();
    usedInTree.forEach((v) => {
      const k = valueKey(v, activeExercise.dataType);
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return map;
  }, [usedInTree, activeExercise.dataType]);

  const seenChip = new Map<string, number>();

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-bg-app text-text-primary">
      {/* Barra Superior de la Actividad y Pestañas de Ejercicios */}
      <div className="border-b border-outline bg-surface-container px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="btn-ghost btn-sm text-text-secondary hover:text-text-primary rounded-full"
                title="Volver a lista de actividades"
              >
                ← Volver
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary sm:text-lg">
                  {activity.title}
                </h2>
                {maxAttempts > 0 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {maxAttempts === 1 ? '🔒 1 intento' : `🎯 Máx ${maxAttempts} intentos`}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-muted">
                {isLinear ? (
                  <>
                    Estructura:{' '}
                    <span className="font-semibold text-primary">
                      {STRUCTURE_LABEL[activeExercise.linear!.structure]}
                    </span>
                    {' · '}
                    <span>Ejecuta las operaciones en orden y responde (elementos {STRUCTURE_ORDER_HINT[activeExercise.linear!.structure]}).</span>
                  </>
                ) : (
                  <>
                    Tipo pedido:{' '}
                    <span className="font-semibold text-primary">
                      {TREE_TYPE_LABEL[activeExercise.treeType]}
                    </span>
                    {' · '}
                    <span>{TREE_TYPE_HINT[activeExercise.treeType]}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Selector de Vistas en Móvil */}
          <div className={cx('flex rounded-full border border-outline bg-surface-variant p-1 sm:hidden', isLinear && '!hidden')}>
            <button
              onClick={() => setMobileTab('tree')}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                mobileTab === 'tree' ? 'bg-primary text-on-primary shadow-xs' : 'text-text-secondary'
              )}
            >
              🌳 Ver Árbol
            </button>
            <button
              onClick={() => setMobileTab('questions')}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                mobileTab === 'questions' ? 'bg-primary text-on-primary shadow-xs' : 'text-text-secondary'
              )}
            >
              📝 Preguntas
            </button>
          </div>
        </div>

        {/* Barra de pestañas horizontal deslizante: Ejercicio 1 | Ejercicio 2 | ... */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {activity.exercises.map((ex, idx) => {
            const isSelected = idx === activeExIndex;
            const exData = submission?.exercisesData?.[ex.id];
            const isCompleted = exData?.submitted;
            const score = exData?.score;
            const exAttempts = exData?.attempts ?? 0;
            const isExhausted = maxAttempts > 0 && exAttempts >= maxAttempts;

            return (
              <button
                key={ex.id}
                onClick={() => {
                  setActiveExIndex(idx);
                }}
                className={cx(
                  'flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary-container text-on-primary-container font-semibold shadow-xs'
                    : 'border-outline bg-surface text-text-secondary hover:bg-surface-variant hover:text-text-primary'
                )}
              >
                <span>{ex.title || `Ejercicio ${idx + 1}`}</span>
                {isCompleted && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold"
                    title={`Ejercicio evaluado (${exAttempts} intento${exAttempts === 1 ? '' : 's'})`}
                  >
                    ✓
                  </span>
                )}
                {isExhausted && (
                  <span
                    className="text-[11px]"
                    title={`Intentos agotados (${exAttempts}/${maxAttempts})`}
                  >
                    🔒
                  </span>
                )}
                {score !== undefined && (
                  <ScorePill score={score} />
                )}
              </button>
            );
          })}
        </div>

        {/* Chips del Conjunto de Datos de Referencia */}
        {!isLinear && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1 border-t border-outline">
          <span className="text-xs font-medium text-text-muted">Datos a insertar:</span>
          {activeExercise.dataset.map((val, i) => {
            const k = valueKey(val, activeExercise.dataType);
            const n = (seenChip.get(k) ?? 0) + 1;
            seenChip.set(k, n);
            const isUsed = n <= (usedCount.get(k) ?? 0);

            return (
              <span
                key={`${val}-${i}`}
                className={cx(
                  'rounded-full px-2.5 py-0.5 font-mono text-xs transition select-none',
                  isUsed
                    ? 'border border-outline bg-surface-variant text-text-muted line-through'
                    : 'border border-primary/40 bg-primary-container/40 text-primary font-bold'
                )}
                title={isUsed ? 'Ya colocado en tu árbol' : 'Pendiente de insertar'}
              >
                {val}
              </span>
            );
          })}
        </div>
        )}
      </div>

      {isLinear ? (
        <div className="relative flex-1 overflow-hidden">
          <LinearExercisePanel
            exercise={activeExercise}
            settings={activity.settings}
            answers={currentLinear}
            onChangeAnswers={handleLinearChange}
            onSaveAndEvaluate={handleSaveAndEvaluateLinear}
            readOnly={isReadOnly}
            lastEvaluation={lastLinearEval}
            attempts={currentAttempts}
            maxAttempts={maxAttempts}
          />
        </div>
      ) : (
      /* Contenedor Principal: 70% Árbol Izquierda / 30% Formulario Derecha (PC) */
      <div className="relative flex flex-1 overflow-hidden">
        {/* Lienzo del Árbol */}
        <div
          className={cx(
            'h-full flex-1 transition-all sm:block',
            mobileTab === 'tree' ? 'block w-full' : 'hidden sm:block sm:w-[68%]'
          )}
        >
          <TreeCanvas
            tree={currentTree}
            editable={!isReadOnly}
            onChange={handleTreeChange}
            dataType={activeExercise.dataType}
            dataset={activeExercise.dataset}
            className="h-full w-full"
            idPrefix={`student-ex-${activeExercise.id}`}
          />
        </div>

        {/* Formulario de Preguntas Lateral */}
        <div
          className={cx(
            'border-l border-white/[0.08] bg-ink-900/40 sm:block sm:w-[32%] sm:min-w-[340px] sm:max-w-[440px]',
            mobileTab === 'questions' ? 'block h-full w-full' : 'hidden sm:block'
          )}
        >
          <ExerciseQuestions
            exercise={activeExercise}
            settings={activity.settings}
            tree={currentTree}
            answers={currentAnswers}
            onChangeAnswers={handleAnswersChange}
            onSaveAndEvaluate={handleSaveAndEvaluate}
            readOnly={isReadOnly}
            lastEvaluation={lastEval}
            attempts={currentAttempts}
            maxAttempts={maxAttempts}
          />
        </div>
      </div>
      )}
    </div>
  );
}
