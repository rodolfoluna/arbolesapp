import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
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
    return <FullScreenLoader label="Iniciando plataforma de Estructura de Datos..." />;
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
    <div className="min-h-dvh flex flex-col bg-bg-app text-text-primary transition-colors duration-200">
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
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
