import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { MustChangePasswordModal } from './components/MustChangePasswordModal';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { FullScreenLoader } from './components/ui';

function AppShell() {
  const { user, loading, isTeacher, enterDemoMode } = useAuth();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  if (loading) {
    return <FullScreenLoader label="Iniciando plataforma de árboles..." />;
  }

  if (!user) {
    return (
      <>
        <LoginView
          onOpenFirebaseGuide={() => setIsGuideOpen(true)}
          onEnterDemoMode={(role) => enterDemoMode(role)}
        />
        <FirebaseGuideModal
          open={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-ink-950 text-slate-100 selection:bg-mint-400/30">
      <Navbar onOpenFirebaseGuide={() => setIsGuideOpen(true)} />

      {/* Modal obligatorio si el alumno aún no cambia la contraseña inicial */}
      <MustChangePasswordModal />

      {/* Contenido principal según el rol */}
      <div className="flex-1">
        {isTeacher ? <TeacherDashboard /> : <StudentDashboard />}
      </div>

      <FirebaseGuideModal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
