import { useEffect, useMemo, useState } from 'react';
import type { Activity, Group, Submission, UserProfile } from '../../lib/models';
import type { Exercise } from '../../lib/tree/types';
import { fetchSubmissionsByActivity, resetExerciseSubmission } from '../../lib/db';
import { evaluateExercise } from '../../lib/tree/evaluate';
import {
  STRUCTURE_LABEL,
  STRUCTURE_ORDER_HINT,
  evaluateLinear,
  exerciseBadge,
  isLinearExercise,
} from '../../lib/linear/linear';
import { buildExpected } from '../../lib/tree/generate';
import { toFlat } from '../../lib/tree/analyze';
import { downloadCsv } from '../../lib/accounts';
import { TreeCanvas } from '../tree/TreeCanvas';
import { Modal, ScorePill, cx } from '../ui';

interface Props {
  activity: Activity;
  group?: Group;
  students: UserProfile[];
}

/** Rubro revisado (común a ejercicios de árbol y de estructura lineal). */
interface ReviewItem {
  key: string;
  label: string;
  correct: boolean;
  points: number;
  max: number;
  expected: string;
  given: string;
}

interface DetailModalState {
  student: UserProfile;
  exercise: Exercise;
  submission: Submission | null;
  evalResult: { total: number; structureExact: boolean; items: ReviewItem[] };
}

export function ProgressMatrix({ activity, group, students }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);

  // Una consulta al abrir o actualizar; sin lecturas por cada cambio de los alumnos.
  useEffect(() => {
    if (!activity.id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSubmissions([]);
    fetchSubmissionsByActivity(activity.id)
      .then((subs) => { if (!cancelled) setSubmissions(subs); })
      .catch(() => { if (!cancelled) setLoadError('No se pudieron cargar las entregas. Intenta actualizar de nuevo.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activity.id, refreshVersion]);

  const studentsInGroup = useMemo(() => {
    return students.filter((s) => s.groupIds?.includes(activity.groupId));
  }, [students, activity.groupId]);

  const handleOpenDetail = (student: UserProfile, exercise: Exercise) => {
    const sub = submissions.find((s) => s.controlNumber === student.controlNumber) || null;
    const exData = sub?.exercisesData?.[exercise.id];
    const evalResult = isLinearExercise(exercise)
      ? evaluateLinear(exercise, exData?.linearAnswers)
      : evaluateExercise(exercise, activity.settings, exData?.tree, exData?.answers);
    setDetailModal({ student, exercise, submission: sub, evalResult });
  };

  const handleExportCsv = () => {
    const header = [
      'NumeroControl',
      'Nombre',
      ...activity.exercises.map((e, idx) => e.title || `Ej ${idx + 1}`),
      'Promedio',
    ];

    const rows = studentsInGroup.map((s) => {
      const sub = submissions.find((sub) => sub.controlNumber === s.controlNumber);
      let total = 0;
      let count = 0;

      const exerciseScores = activity.exercises.map((e) => {
        const exData = sub?.exercisesData?.[e.id];
        if (exData?.submitted && exData.score !== undefined) {
          total += exData.score;
          count++;
          return String(exData.score);
        }
        return 'Pendiente';
      });

      const avg = count > 0 ? (total / count).toFixed(1) : '—';
      return [s.controlNumber, s.fullName, ...exerciseScores, avg];
    });

    downloadCsv(
      `calificaciones_${activity.title.replace(/\s+/g, '_')}.csv`,
      header,
      rows
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline pb-3">
        <div>
          <h3 className="font-semibold text-text-primary">
            Matriz de Avances: {activity.title}
          </h3>
          <p className="text-xs text-text-muted">
            Grupo: <b className="text-text-primary">{group?.name || 'General'}</b> · Alumnos:{' '}
            {studentsInGroup.length}
          </p>
        </div>

        <button className="btn-secondary btn-sm" disabled={loading}
          onClick={() => setRefreshVersion((v) => v + 1)}>
          {loading ? 'Cargando…' : 'Actualizar avances'}
        </button>
        <button
          onClick={handleExportCsv}
          disabled={loading || !!loadError}
          className="btn-secondary btn-sm text-xs font-semibold"
        >
          📥 Exportar Calificaciones (CSV)
        </button>
      </div>

      <p className="text-xs text-text-muted" role="status">
        {loadError || 'Las entregas se consultan al abrir esta matriz. Pulsa Actualizar avances para ver cambios nuevos.'}
      </p>

      {/* Tabla de Matriz */}
      {!loading && !loadError && <div className="card overflow-hidden !p-0 border-outline bg-surface-container">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr className="bg-surface-variant">
                <th>No. Control</th>
                <th>Nombre del Alumno</th>
                {activity.exercises.map((ex, idx) => (
                  <th key={ex.id} className="text-center font-mono">
                    {ex.title || `Ej ${idx + 1}`}
                  </th>
                ))}
                <th className="text-center">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {studentsInGroup.length === 0 ? (
                <tr>
                  <td
                    colSpan={activity.exercises.length + 3}
                    className="p-8 text-center text-xs text-text-muted"
                  >
                    No hay alumnos asignados a este grupo aún.
                  </td>
                </tr>
              ) : (
                studentsInGroup.map((st) => {
                  const sub = submissions.find(
                    (s) => s.controlNumber === st.controlNumber
                  );
                  let sumScores = 0;
                  let scoredCount = 0;

                  return (
                    <tr key={st.uid}>
                      <td className="font-mono text-xs font-semibold text-primary">
                        {st.controlNumber}
                      </td>
                      <td className="font-medium text-text-primary">{st.fullName}</td>

                      {activity.exercises.map((ex) => {
                        const exData = sub?.exercisesData?.[ex.id];
                        const isSubmitted = exData?.submitted;
                        const score = exData?.score;

                        if (isSubmitted && score !== undefined) {
                          sumScores += score;
                          scoredCount++;
                        }

                        return (
                          <td key={ex.id} className="text-center">
                            <button
                              onClick={() => handleOpenDetail(st, ex)}
                              className="rounded-lg p-1 transition hover:bg-white/[0.06]"
                              title={`Toca para ver el detalle. Intentos: ${exData?.attempts ?? 0}${activity.settings.maxAttempts ? ` / ${activity.settings.maxAttempts}` : ''}`}
                            >
                              {isSubmitted ? (
                                <ScorePill score={score} />
                              ) : (
                                <span className="font-mono text-xs text-slate-500">
                                  Pendiente
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}

                      {/* Promedio */}
                      <td className="text-center">
                        {scoredCount > 0 ? (
                          <ScorePill
                            score={Math.round(sumScores / scoredCount)}
                          />
                        ) : (
                          <span className="font-mono text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}
      {/* Modal Lado a Lado: Árbol del Alumno vs Árbol Esperado */}
      {detailModal && (
        <Modal
          open={true}
          onClose={() => setDetailModal(null)}
          title={
            <div className="flex items-center gap-3">
              <span>Revisión de Ejercicio:</span>
              <span className="font-mono text-mint-300">
                {detailModal.student.fullName} ({detailModal.student.controlNumber})
              </span>
            </div>
          }
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={async () => {
                  if (
                    confirm(
                      `¿Habilitar reintento para ${detailModal.student.fullName} en este ejercicio?`
                    )
                  ) {
                    await resetExerciseSubmission(
                      activity.id,
                      detailModal.student.controlNumber,
                      detailModal.exercise.id
                    );
                    setDetailModal(null);
                    setRefreshVersion((v) => v + 1);
                  }
                }}
                className="btn-danger btn-sm text-xs"
              >
                🔄 Permitir Reintento (Resetear entrega)
              </button>
              <button
                className="btn-primary"
                onClick={() => setDetailModal(null)}
              >
                Cerrar
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-white">
                  {detailModal.exercise.title} [{exerciseBadge(detailModal.exercise)}]
                </h4>
                <div className="text-xs text-slate-400">
                  {isLinearExercise(detailModal.exercise)
                    ? `Estado inicial: ${detailModal.exercise.dataset.join(', ') || `${STRUCTURE_LABEL[detailModal.exercise.linear!.structure]} vacía`}`
                    : `Conjunto de datos: ${detailModal.exercise.dataset.join(', ')}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-outline bg-surface-variant px-2.5 py-1 text-xs text-text-muted font-mono">
                  Intentos:{' '}
                  <strong className="text-text-primary">
                    {detailModal.submission?.exercisesData?.[detailModal.exercise.id]?.attempts ?? 0}
                  </strong>
                  {activity.settings.maxAttempts ? ` / ${activity.settings.maxAttempts}` : ' (ilimitados)'}
                </span>
                <ScorePill score={detailModal.evalResult.total} />
              </div>
            </div>

            {isLinearExercise(detailModal.exercise) ? (
              <div className="card space-y-2 text-xs">
                <div className="font-semibold text-text-primary">
                  {STRUCTURE_LABEL[detailModal.exercise.linear!.structure]} · elementos {STRUCTURE_ORDER_HINT[detailModal.exercise.linear!.structure]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detailModal.exercise.linear!.ops.map((op, i) => (
                    <code key={i} className="rounded-lg border border-outline bg-surface px-2 py-1 font-mono text-primary">
                      {i + 1}. {op}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Árbol del Alumno */}
              <div className="card overflow-hidden !p-0">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
                  <span className="text-xs font-semibold text-iris-300">
                    Árbol Construido por el Alumno
                  </span>
                  <span
                    className={cx(
                      'text-xs font-semibold',
                      detailModal.evalResult.structureExact
                        ? 'text-mint-400'
                        : 'text-coral-400'
                    )}
                  >
                    {detailModal.evalResult.structureExact
                      ? '✓ Topología exacta'
                      : '✗ Topología incorrecta'}
                  </span>
                </div>
                <div className="h-[280px] w-full">
                  <TreeCanvas
                    tree={
                      detailModal.submission?.exercisesData?.[
                        detailModal.exercise.id
                      ]?.tree || { rootId: null, nodes: {} }
                    }
                    editable={false}
                    dataType={detailModal.exercise.dataType}
                    emptyLabel="El alumno no construyó ningún árbol"
                    idPrefix="side-student"
                  />
                </div>
              </div>

              {/* Árbol Canónico Esperado */}
              <div className="card overflow-hidden !p-0">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
                  <span className="text-xs font-semibold text-mint-300">
                    Árbol Canónico Esperado (Solución Oficial)
                  </span>
                  <span className="text-xs text-slate-400">
                    {detailModal.exercise.treeType}
                  </span>
                </div>
                <div className="h-[280px] w-full">
                  <TreeCanvas
                    tree={toFlat(
                      buildExpected(
                        detailModal.exercise.treeType,
                        detailModal.exercise.dataset,
                        detailModal.exercise.dataType
                      )
                    )}
                    editable={false}
                    dataType={detailModal.exercise.dataType}
                    idPrefix="side-expected"
                  />
                </div>
              </div>
            </div>
            )}

            {/* Desglose de Respuestas del Cuestionario */}
            <div className="card overflow-hidden !p-0">
              <div className="border-b border-white/[0.08] px-4 py-2 text-xs font-semibold text-white">
                {isLinearExercise(detailModal.exercise)
                  ? 'Evaluación de Estado Final y Datos Extraídos'
                  : 'Comparación de Respuestas Teóricas y Recorridos'}
              </div>
              <table className="table-base text-xs">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th>Rubro</th>
                    <th>Respuesta del Alumno</th>
                    <th>Respuesta Esperada</th>
                    <th className="text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.evalResult.items.map((it) => (
                    <tr key={it.key}>
                      <td className="font-medium text-slate-300">{it.label}</td>
                      <td
                        className={cx(
                          'font-mono',
                          it.correct ? 'text-mint-300' : 'text-coral-400 font-semibold'
                        )}
                      >
                        {it.given || <span className="text-slate-600">(vacío)</span>}
                      </td>
                      <td className="font-mono text-slate-400">{it.expected}</td>
                      <td className="text-right font-mono">
                        <span
                          className={it.correct ? 'text-mint-300' : 'text-coral-400'}
                        >
                          {it.points}
                        </span>
                        /{it.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
