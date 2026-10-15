import { Modal } from './ui';

export function FirebaseGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Guía: Configurar Firebase Gratis (5 minutos)"
      size="lg"
      footer={
        <button className="btn-primary" onClick={onClose}>
          Entendido
        </button>
      }
    >
      <div className="space-y-4 text-sm text-slate-300">
        <p>
          Esta aplicación utiliza los servicios <b>100% gratuitos</b> de Firebase (Authentication con correo/contraseña y Cloud Firestore con persistencia IndexedDB). Sigue estos sencillos pasos:
        </p>

        <ol className="list-decimal space-y-3 pl-5 text-xs text-slate-300">
          <li>
            Ve a{' '}
            <a
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-mint-300 underline"
            >
              console.firebase.google.com
            </a>{' '}
            e inicia sesión con tu cuenta de Google.
          </li>
          <li>
            Haz clic en <b>"Crear un proyecto"</b> (o "Agregar proyecto"), nómbralo (ej. <code>arboles-binarios</code>) y desactiva Google Analytics para agilizar.
          </li>
          <li>
            <b>Activar Authentication:</b> En el menú lateral, ve a <i>Compilación &gt; Authentication</i>, haz clic en "Comenzar" y activa el proveedor <b>Correo electrónico/contraseña</b> (habilita la primera casilla).
          </li>
          <li>
            <b>Activar Cloud Firestore:</b> En <i>Compilación &gt; Firestore Database</i>, haz clic en "Crear base de datos", selecciona la ubicación más cercana (ej. <code>us-central1</code>) y elige <b>"Comenzar en modo de producción"</b>.
          </li>
          <li>
            <b>Reglas de Seguridad:</b> En la pestaña <i>Reglas</i> de Firestore, pega el contenido del archivo <code className="text-mint-300">firestore.rules</code> que se encuentra en la raíz de este proyecto y presiona "Publicar".
          </li>
          <li>
            <b>Registrar la Web App:</b> En la página principal del proyecto (icono de engranaje &gt; Configuración del proyecto), baja a "Tus apps", haz clic en el icono <b>Web (&lt;/&gt;)</b>, nómbrala <code>arboles-web</code> y copia el objeto <code>firebaseConfig</code>.
          </li>
          <li>
            <b>Crear tu usuario Profesor:</b> En Authentication &gt; pestaña <i>Users</i>, haz clic en "Agregar usuario" y crea tu cuenta con tu correo y contraseña personal de profesor.
          </li>
          <li>
            <b>Pegar tus claves en el archivo .env.local:</b> Copia el archivo <code className="text-iris-300">.env.example</code> a <code className="text-iris-300">.env.local</code> y pega tus credenciales:
            <pre className="mt-1.5 rounded-lg bg-ink-950 p-2.5 font-mono text-[11px] text-mint-300 overflow-x-auto">
{`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_TEACHER_EMAIL=tu_correo_de_profesor@ejemplo.com
VITE_EMAIL_DOMAIN=arboles.app`}
            </pre>
          </li>
        </ol>

        <div className="rounded-xl border border-mint-400/30 bg-mint-400/10 p-3 text-xs text-mint-300">
          💡 <b>Nota técnica:</b> Al usar la arquitectura de correos sintéticos (<code>22010456@arboles.app</code>) e instancia secundaria de Auth en el navegador, no necesitas Cloud Functions de pago ni backend externo. Todo opera dentro del límite de 50,000 lecturas gratuitas al día.
        </div>
      </div>
    </Modal>
  );
}
