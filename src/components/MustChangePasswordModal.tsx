import { useState } from 'react';
import { Modal, Spinner } from './ui';
import { useAuth } from '../lib/auth';

export function MustChangePasswordModal() {
  const { profile, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!profile?.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Verifícalas.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={() => {}} // No se puede cerrar hasta que cambie la contraseña obligatoria
      title="🔒 Primer Inicio de Sesión: Cambio Obligatorio"
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-sun-400/30 bg-sun-400/10 p-3 text-sm text-sun-300">
          Hola <b className="text-white">{profile.fullName}</b>. Tu profesor te asignó una contraseña temporal. Por tu seguridad y privacidad, debes definir tu propia contraseña antes de acceder a tus actividades.
        </div>

        {error && (
          <div className="rounded-xl border border-coral-400/30 bg-coral-400/10 p-3 text-sm text-coral-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-password-input">
              Nueva Contraseña
            </label>
            <input
              id="new-password-input"
              type="password"
              className="input font-mono"
              placeholder="Mínimo 6 caracteres"
              required
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="confirm-password-input">
              Confirmar Nueva Contraseña
            </label>
            <input
              id="confirm-password-input"
              type="password"
              className="input font-mono"
              placeholder="Repite la contraseña"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-new-password"
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4" /> Guardando...
                </>
              ) : (
                'Actualizar Contraseña y Continuar'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
