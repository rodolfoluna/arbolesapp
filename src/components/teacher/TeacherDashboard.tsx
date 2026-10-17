import { useEffect, useState } from 'react';
import type { Activity, Group } from '../../lib/models';
import {
  deleteActivity,
  setActivityOpen,
  subscribeActivities,
  subscribeGroups,
} from '../../lib/db';
import { GroupManager } from './GroupManager';
import { ActivityBuilder } from './ActivityBuilder';
import { ProgressMatrix } from './ProgressMatrix';
import { OrphanSubmissions } from './OrphanSubmissions';
import { ConfirmDialog, EmptyState, PageHeader, Spinner, cx } from '../ui';
import { STRUCTURE_LABEL, isLinearExercise } from '../../lib/linear/linear';

type TeacherTab = 'activities' | 'matrix' | 'students' | 'cleanup';

export function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>('activities');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de vistas secundarias
  const [isBuildingActivity, setIsBuildingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [matrixActivityId, setMatrixActivityId] = useState<string | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let unsubActs = () => {};
    let unsubGroups = () => {};

    unsubActs = subscribeActivities('ALL', (acts) => {
      setActivities(acts);
      setLoading(false);
      setMatrixActivityId((current) => current && acts.some((a) => a.id === current)
        ? current : acts[0]?.id ?? null);
    });

    unsubGroups = subscribeGroups((g) => setGroups(g));
    return () => {
      unsubActs();
      unsubGroups();
    };
  }, []);

  const handleToggleOpen = async (activity: Activity) => {
    try {
      await setActivityOpen(activity.id, !activity.settings.open);
    } catch (err) {
      alert('Error al cambiar estado de la actividad: ' + err);
    }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivity) return;
    try {
      await deleteActivity(deletingActivity.id);
      setDeletingActivity(null);
    } catch (err) {
      alert('Error al eliminar actividad: ' + err);
    }
  };

  if (isBuildingActivity || editingActivity) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ActivityBuilder
          groups={groups}
          activityToEdit={editingActivity}
          onSaved={() => {
            setIsBuildingActivity(false);
            setEditingActivity(null);
          }}
          onCancel={() => {
            setIsBuildingActivity(false);
            setEditingActivity(null);
          }}
        />
      </main>
    );
  }

  const selectedMatrixActivity = activities.find((a) => a.id === matrixActivityId) || activities[0];
  const selectedMatrixGroup = groups.find((g) => g.id === selectedMatrixActivity?.groupId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Navegación por Pestañas del Profesor (Material 3 Navigation Pills) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-outline pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('activities')}
            className={cx(
              'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              tab === 'activities'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
            )}
          >
            📋 Actividades y Prácticas
          </button>
          <button
            onClick={() => setTab('matrix')}
            className={cx(
              'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              tab === 'matrix'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
            )}
          >
            📊 Matriz de Avances
          </button>
          <button
            onClick={() => setTab('students')}
            className={cx(
              'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              tab === 'students'
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
            )}
          >
            👥 Alumnos y Grupos
          </button>
          <button onClick={() => setTab('cleanup')}
            className={cx('rounded-full px-5 py-2 text-sm font-medium', tab === 'cleanup'
              ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
              : 'text-text-secondary hover:bg-surface-variant')}>
            Entregas sin actividad
          </button>
        </div>

        {tab === 'activities' && (
          <button
            onClick={() => setIsBuildingActivity(true)}
            className="btn-primary text-xs font-semibold"
          >
            + Nueva Actividad
          </button>
        )}
      </div>

      {/* Contenido de la pestaña */}
      {tab === 'activities' && (
        <div className="space-y-6">
          <PageHeader
            title="Actividades Creadas"
            subtitle="Configura prácticas con ejercicios de árboles o de estructuras lineales (listas, pilas y colas) para tus alumnos."
          />

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon="🌱"
              title="Aún no tienes actividades creadas"
            >
              Haz clic en "+ Nueva Actividad" para diseñar tu primera práctica con ejercicios de árboles o estructuras lineales.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map((act) => {
                const group = groups.find((g) => g.id === act.groupId);
                return (
                  <div
                    key={act.id}
                    className="card flex flex-col justify-between border-outline bg-surface-container hover:border-primary/60 transition-all duration-200"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-surface-variant px-3 py-1 text-[11px] font-medium text-text-secondary">
                            Grupo: {group?.name || 'Sin grupo'}
                          </span>
                          <span className="rounded-full border border-outline bg-surface-variant/60 px-2 py-0.5 text-[10px] text-text-muted font-medium">
                            {act.settings?.maxAttempts === 1
                              ? '🔒 1 intento'
                              : act.settings?.maxAttempts && act.settings.maxAttempts > 1
                              ? `🎯 ${act.settings.maxAttempts} intentos`
                              : '∞ Ilimitados'}
                          </span>
                        </div>
                        <span
                          className={cx(
                            'badge border text-[11px]',
                            act.settings.open
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'border-outline bg-surface-variant text-text-muted'
                          )}
                        >
                          {act.settings.open ? '● Abierta' : '○ Cerrada'}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-text-primary">{act.title}</h3>
                      {act.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                          {act.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {act.exercises.map((ex, i) => (
                          <span
                            key={ex.id}
                            className="rounded-full bg-surface-variant px-2.5 py-0.5 font-mono text-[10px] text-text-secondary"
                          >
                            {isLinearExercise(ex)
                              ? `Ej ${i + 1}: ${STRUCTURE_LABEL[ex.linear!.structure]} (${ex.linear!.ops.length} ops)`
                              : `Ej ${i + 1}: ${ex.treeType} (${ex.dataset.length})`}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-outline pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <button
                          onClick={() => {
                            setMatrixActivityId(act.id);
                            setTab('matrix');
                          }}
                          className="btn-tonal btn-sm text-xs font-semibold"
                        >
                          Ver Matriz →
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleOpen(act)}
                            className="btn-ghost btn-sm text-xs"
                            title={act.settings.open ? 'Cerrar actividad' : 'Abrir actividad'}
                          >
                            {act.settings.open ? 'Cerrar' : 'Abrir'}
                          </button>
                          <button
                            onClick={() => setEditingActivity(act)}
                            className="btn-ghost btn-sm text-xs"
                            title="Editar actividad"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingActivity(act)}
                            className="btn-ghost btn-sm text-xs text-red-500 hover:bg-red-500/10"
                            title="Eliminar actividad"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="space-y-6">
          {/* Selector de Actividad para ver su matriz */}
          {activities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-outline pb-3">
              <span className="text-xs font-medium text-text-muted">Actividad:</span>
              {activities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setMatrixActivityId(a.id)}
                  className={cx(
                    'rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200',
                    a.id === selectedMatrixActivity?.id
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                      : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
                  )}
                >
                  {a.title}
                </button>
              ))}
            </div>
          )}

          {selectedMatrixActivity ? (
            <ProgressMatrix
              key={selectedMatrixActivity.id}
              activity={selectedMatrixActivity}
              group={selectedMatrixGroup}
            />
          ) : (
            <EmptyState
              icon="📊"
              title="No hay actividades para monitorear"
            >
              Crea una actividad primero para consultar las calificaciones y avances.
            </EmptyState>
          )}
        </div>
      )}

      {tab === 'students' && <GroupManager groups={groups} />}
      {tab === 'cleanup' && <OrphanSubmissions />}

      {/* Confirmación de Eliminación de Actividad */}
      <ConfirmDialog
        open={!!deletingActivity}
        title="Eliminar Actividad"
        danger
        confirmLabel="Eliminar Actividad"
        message={
          <>
            ¿Seguro que deseas eliminar la actividad{' '}
            <b className="text-white">{deletingActivity?.title}</b>? Esta acción no se puede deshacer.
          </>
        }
        onConfirm={handleDeleteActivity}
        onClose={() => setDeletingActivity(null)}
      />
    </main>
  );
}
