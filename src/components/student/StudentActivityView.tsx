import { useEffect, useMemo, useState } from 'react';
import type { Activity, ExerciseSubmission, Submission } from '../../lib/models';
import type { Answers, FlatTree } from '../../lib/tree/types';
import { EMPTY_ANSWERS, EMPTY_TREE, TREE_TYPE_HINT, TREE_TYPE_LABEL } from '../../lib/tree/types';
import { treeValues } from '../../lib/tree/edit';
import { valueKey } from '../../lib/tree/values';
import { evaluateExercise, type Evaluation } from '../../lib/tree/evaluate';
import { saveExerciseSubmission, subscribeSubmission } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { TreeCanvas } from '../tree/TreeCanvas';
import { ExerciseQuestions } from './ExerciseQuestions';
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

  const activeExercise = activity.exercises[activeExIndex] || activity.exercises[0];
  const exId = activeExercise?.id;

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
      if (remoteData.score !== undefined) {
        setLastEval(evaluateExercise(activeExercise, activity.settings, remoteData.tree, remoteData.answers));
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
        return;
      }
    } catch {
      /* ignore */
    }

    // 3. Si es nuevo, inicializar vacío
    setCurrentTree(EMPTY_TREE);
    setCurrentAnswers(EMPTY_ANSWERS);
    setLastEval(null);
  }, [exId, submission, localBackupKey, activeExercise, activity.settings]);

  // Guardado local y remoto
  const persistChanges = (tree: FlatTree, answers: Answers, evalRes?: Evaluation) => {
    // 1. LocalStorage inmediato
    try {
      localStorage.setItem(
        localBackupKey,
        JSON.stringify({ tree, answers, updatedAt: Date.now() })
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
        submitted: !!evalRes,
        submittedAt: evalRes ? Date.now() : undefined,
        attempts: (submission?.exercisesData?.[exId]?.attempts || 0) + (evalRes ? 1 : 0),
        score: evalRes?.total,
        structureExact: evalRes?.structureExact,
      };
      saveExerciseSubmission(
        { uid: profile.uid, controlNumber: profile.controlNumber, fullName: profile.fullName },
        activity.id,
        exId,
        payload
      );
    }
  };

  const handleTreeChange = (newTree: FlatTree) => {
    setCurrentTree(newTree);
    persistChanges(newTree, currentAnswers);
  };

  const handleAnswersChange = (newAnswers: Answers) => {
    setCurrentAnswers(newAnswers);
    persistChanges(currentTree, newAnswers);
  };

  const handleSaveAndEvaluate = (evalResult: Evaluation) => {
    setLastEval(evalResult);
    persistChanges(currentTree, currentAnswers, evalResult);
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
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-ink-950">
      {/* Barra Superior de la Actividad y Pestañas de Ejercicios */}
      <div className="border-b border-white/[0.08] bg-ink-900/60 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="btn-ghost btn-sm text-slate-400 hover:text-white"
                title="Volver a lista de actividades"
              >
                ← Volver
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {activity.title}
              </h2>
              <div className="text-xs text-slate-400">
                Tipo pedido:{' '}
                <span className="font-semibold text-mint-300">
                  {TREE_TYPE_LABEL[activeExercise.treeType]}
                </span>
                {' · '}
                <span className="text-slate-400">{TREE_TYPE_HINT[activeExercise.treeType]}</span>
              </div>
            </div>
          </div>

          {/* Selector de Vistas en Móvil */}
          <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:hidden">
            <button
              onClick={() => setMobileTab('tree')}
              className={cx(
                'rounded-lg px-3 py-1 text-xs font-medium transition',
                mobileTab === 'tree' ? 'bg-mint-400/20 text-mint-300' : 'text-slate-400'
              )}
            >
              🌳 Ver Árbol
            </button>
            <button
              onClick={() => setMobileTab('questions')}
              className={cx(
                'rounded-lg px-3 py-1 text-xs font-medium transition',
                mobileTab === 'questions' ? 'bg-mint-400/20 text-mint-300' : 'text-slate-400'
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

            return (
              <button
                key={ex.id}
                onClick={() => {
                  setActiveExIndex(idx);
                }}
                className={cx(
                  'flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150',
                  isSelected
                    ? 'border-mint-400/60 bg-mint-400/15 text-white shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-200'
                )}
              >
                <span>{ex.title || `Ejercicio ${idx + 1}`}</span>
                {isCompleted && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-mint-400/20 text-[10px] text-mint-400 font-bold"
                    title="Ejercicio evaluado"
                  >
                    ✓
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/[0.04]">
          <span className="text-xs font-medium text-slate-400">Datos a insertar:</span>
          {activeExercise.dataset.map((val, i) => {
            const k = valueKey(val, activeExercise.dataType);
            const n = (seenChip.get(k) ?? 0) + 1;
            seenChip.set(k, n);
            const isUsed = n <= (usedCount.get(k) ?? 0);

            return (
              <span
                key={`${val}-${i}`}
                className={cx(
                  'rounded px-2 py-0.5 font-mono text-xs transition select-none',
                  isUsed
                    ? 'border border-white/5 bg-white/[0.02] text-slate-600 line-through'
                    : 'border border-mint-400/30 bg-mint-400/10 text-mint-300 font-semibold'
                )}
                title={isUsed ? 'Ya colocado en tu árbol' : 'Pendiente de insertar'}
              >
                {val}
              </span>
            );
          })}
        </div>
      </div>

      {/* Contenedor Principal: 70% Árbol Izquierda / 30% Formulario Derecha (PC) */}
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
            editable={!activity.settings.open ? false : true}
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
            readOnly={!activity.settings.open}
            lastEvaluation={lastEval}
          />
        </div>
      </div>
    </div>
  );
}
