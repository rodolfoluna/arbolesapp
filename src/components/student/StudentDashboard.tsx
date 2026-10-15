import { useEffect, useState } from 'react';
import type { Activity, Submission } from '../../lib/models';
import { subscribeActivities, subscribeMySubmissions } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { StudentActivityView } from './StudentActivityView';
import { EmptyState, PageHeader, ScorePill, Spinner } from '../ui';

export function StudentDashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const groupIds = profile?.groupIds || [];

  useEffect(() => {
    if (!profile?.controlNumber) return;

    let unsubSubs = () => {};
    let unsubActs = () => {};

    unsubSubs = subscribeMySubmissions(profile.controlNumber, (subs) => {
      setSubmissions(subs);
    });

    if (groupIds.length > 0) {
      unsubActs = subscribeActivities(groupIds, (acts) => {
        setActivities(acts);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubSubs();
      unsubActs();
    };
  }, [profile?.controlNumber, JSON.stringify(groupIds)]);

  if (selectedActivity) {
    return (
      <StudentActivityView
        activity={selectedActivity}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={`¡Hola, ${profile?.fullName || 'Alumno'}!`}
        subtitle="Aquí puedes ver las prácticas y actividades asignadas a tu grupo de Árboles Binarios."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No tienes actividades pendientes"
        >
          {groupIds.length === 0
            ? 'Tu profesor aún no te ha asignado a ningún grupo escolar.'
            : 'Tu profesor aún no ha publicado actividades en tu grupo. Revisa más tarde.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((act) => {
            const sub = submissions.find((s) => s.activityId === act.id);
            const totalEx = act.exercises.length;
            let completedCount = 0;
            let totalScore = 0;
            let scoredCount = 0;

            act.exercises.forEach((ex) => {
              const exData = sub?.exercisesData?.[ex.id];
              if (exData?.submitted) {
                completedCount++;
                if (exData.score !== undefined) {
                  totalScore += exData.score;
                  scoredCount++;
                }
              }
            });

            const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;
            const isFinished = totalEx > 0 && completedCount === totalEx;

            return (
              <div
                key={act.id}
                onClick={() => setSelectedActivity(act)}
                className="card card-hover flex cursor-pointer flex-col justify-between border-white/[0.08] transition hover:border-mint-400/30"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                      {totalEx} {totalEx === 1 ? 'ejercicio' : 'ejercicios'}
                    </span>
                    {avgScore !== null ? (
                      <ScorePill score={avgScore} />
                    ) : (
                      <span className="rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-500">
                        Sin calificar
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white group-hover:text-mint-300">
                    {act.title}
                  </h3>
                  {act.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {act.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Avance:</span>
                    <span className="font-medium text-slate-200">
                      {completedCount} de {totalEx} completados
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full bg-linear-to-r from-mint-400 to-aqua-400 transition-all duration-300"
                      style={{
                        width: `${totalEx > 0 ? (completedCount / totalEx) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <button
                    className="btn-secondary w-full mt-4 text-xs font-semibold py-2 hover:border-mint-400/40"
                  >
                    {isFinished ? 'Ver Respuestas y Calificación →' : 'Comenzar Práctica →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
