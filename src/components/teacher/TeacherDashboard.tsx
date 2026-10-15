import { useEffect, useState } from 'react';
import type { Activity, Group, UserProfile } from '../../lib/models';
import {
  deleteActivity,
  setActivityOpen,
  subscribeActivities,
  subscribeGroups,
  subscribeStudents,
} from '../../lib/db';
import { GroupManager } from './GroupManager';
import { ActivityBuilder } from './ActivityBuilder';
import { ProgressMatrix } from './ProgressMatrix';
import { ConfirmDialog, EmptyState, PageHeader, Spinner, cx } from '../ui';

type TeacherTab = 'activities' | 'matrix' | 'students';

export function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>('activities');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de vistas secundarias
  const [isBuildingActivity, setIsBuildingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [matrixActivityId, setMatrixActivityId] = useState<string | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let unsubActs = () => {};
    let unsubGroups = () => {};
    let unsubStudents = () => {};

    unsubActs = subscribeActivities('ALL', (acts) => {
      setActivities(acts);
      setLoading(false);
      if (acts.length > 0 && !matrixActivityId) {
        setMatrixActivityId(acts[0].id);
      }
    });

    unsubGroups = subscribeGroups((g) => setGroups(g));
    unsubStudents = subscribeStudents((s) => setStudents(s));

    return () => {
      unsubActs();
      unsubGroups();
      unsubStudents();
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
      {/* Navegación por Pestañas del Profesor */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('activities')}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === 'activities'
                ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                : 'text-slate-400 hover:text-white'
            )}
          >
            📋 Actividades y Prácticas
          </button>
          <button
            onClick={() => setTab('matrix')}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === 'matrix'
                ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                : 'text-slate-400 hover:text-white'
            )}
          >
            📊 Matriz de Avances
          </button>
          <button
            onClick={() => setTab('students')}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === 'students'
                ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                : 'text-slate-400 hover:text-white'
            )}
          >
            👥 Alumnos y Grupos
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
            subtitle="Configura prácticas con ejercicios de árboles binarios, BST y AVL para tus alumnos."
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
              Haz clic en "+ Nueva Actividad" para diseñar tu primera práctica con ejercicios de árboles binarios, BST y AVL.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map((act) => {
                const group = groups.find((g) => g.id === act.groupId);
                return (
                  <div
                    key={act.id}
                    className="card flex flex-col justify-between border-white/[0.08]"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                          Grupo: {group?.name || 'Sin grupo'}
                        </span>
                        <span
                          className={cx(
                            'badge border text-[11px]',
                            act.settings.open
                              ? 'border-mint-400/30 bg-mint-400/10 text-mint-300'
                              : 'border-white/10 bg-white/5 text-slate-500'
                          )}
                        >
                          {act.settings.open ? '● Abierta' : '○ Cerrada'}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-white">{act.title}</h3>
                      {act.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {act.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-1">
                        {act.exercises.map((ex, i) => (
                          <span
                            key={ex.id}
                            className="rounded bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                          >
                            Ej {i + 1}: {ex.treeType} ({ex.dataset.length})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/[0.06] pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <button
                          onClick={() => {
                            setMatrixActivityId(act.id);
                            setTab('matrix');
                          }}
                          className="btn-ghost btn-sm text-xs text-mint-300"
                        >
                          Ver Matriz →
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleOpen(act)}
                            className="btn-ghost btn-sm text-xs text-slate-400 hover:text-white"
                            title={act.settings.open ? 'Cerrar actividad' : 'Abrir actividad'}
                          >
                            {act.settings.open ? 'Cerrar' : 'Abrir'}
                          </button>
                          <button
                            onClick={() => setEditingActivity(act)}
                            className="btn-ghost btn-sm text-xs text-slate-400 hover:text-white"
                            title="Editar actividad"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingActivity(act)}
                            className="btn-ghost btn-sm text-xs text-coral-400 hover:bg-coral-400/10"
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
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
              <span className="text-xs font-medium text-slate-400">Actividad:</span>
              {activities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setMatrixActivityId(a.id)}
                  className={cx(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    a.id === selectedMatrixActivity?.id
                      ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {a.title}
                </button>
              ))}
            </div>
          )}

          {selectedMatrixActivity ? (
            <ProgressMatrix
              activity={selectedMatrixActivity}
              group={selectedMatrixGroup}
              students={students}
            />
          ) : (
            <EmptyState
              icon="📊"
              title="No hay actividades para monitorear"
            >
              Crea una actividad primero para visualizar las calificaciones y avances en tiempo real.
            </EmptyState>
          )}
        </div>
      )}

      {tab === 'students' && <GroupManager />}

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
