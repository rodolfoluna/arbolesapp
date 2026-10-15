import { useEffect, useMemo, useState } from 'react';
import type { Activity, Group, Submission, UserProfile } from '../../lib/models';
import type { Exercise } from '../../lib/tree/types';
import { subscribeSubmissionsByActivity, resetExerciseSubmission } from '../../lib/db';
import { evaluateExercise, type Evaluation } from '../../lib/tree/evaluate';
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

interface DetailModalState {
  student: UserProfile;
  exercise: Exercise;
  submission: Submission | null;
  evalResult: Evaluation;
}

export function ProgressMatrix({ activity, group, students }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);

  // Escuchar entregas de la actividad en tiempo real
  useEffect(() => {
    if (!activity.id) return;
    const unsub = subscribeSubmissionsByActivity(activity.id, (subs) => {
      setSubmissions(subs);
    });
    return () => unsub();
  }, [activity.id]);

  const studentsInGroup = useMemo(() => {
    return students.filter((s) => s.groupIds?.includes(activity.groupId));
  }, [students, activity.groupId]);

  const handleOpenDetail = (student: UserProfile, exercise: Exercise) => {
    const sub = submissions.find((s) => s.controlNumber === student.controlNumber) || null;
    const exData = sub?.exercisesData?.[exercise.id];
    const evalResult = evaluateExercise(
      exercise,
      activity.settings,
      exData?.tree,
      exData?.answers
    );
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

        <button
          onClick={handleExportCsv}
          className="btn-secondary btn-sm text-xs font-semibold"
        >
          📥 Exportar Calificaciones (CSV)
        </button>
      </div>

      {/* Tabla de Matriz */}
      <div className="card overflow-hidden !p-0 border-outline bg-surface-container">
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
                              title="Toca para ver el árbol del alumno lado a lado con el correcto"
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
      </div>

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
                  {detailModal.exercise.title} [{detailModal.exercise.treeType}]
                </h4>
                <div className="text-xs text-slate-400">
                  Conjunto de datos: {detailModal.exercise.dataset.join(', ')}
                </div>
              </div>
              <ScorePill score={detailModal.evalResult.total} />
            </div>

            {/* Comparación Visual de Árboles Lado a Lado */}
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

            {/* Desglose de Respuestas del Cuestionario */}
            <div className="card overflow-hidden !p-0">
              <div className="border-b border-white/[0.08] px-4 py-2 text-xs font-semibold text-white">
                Comparación de Respuestas Teóricas y Recorridos
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
