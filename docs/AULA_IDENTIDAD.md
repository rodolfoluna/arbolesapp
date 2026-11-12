# Integración de Estructura de Datos APP con Aula Identidad

## Estado de esta entrega

Backend desplegado en [Render](https://arboles-api.onrender.com/health) el 11 de noviembre de 2026, con credencial administrativa configurada por el profesor como archivo secreto, plan Free y despliegues automáticos desactivados. `/health` respondió 200; las peticiones sin token o con token inválido, 401; un origen no permitido, 403. Se completó también el acceso OAuth real del profesor desde `http://localhost:5173`: consentimiento autorizado, retorno con URL limpia, validación de identidad y carga de las tres actividades mediante el backend. Se verificaron los dos grupos, el catálogo central (128 alumnos) y la matriz con 32 alumnos y notas/intentos existentes, mediante operaciones de lectura. La sesión se mantuvo al recargar y volvió a verificar el acceso contra el backend.

Se respaldó Firestore antes y después de aplicar **33 vínculos revisados (1 profesor y 32 alumnos)**. La comparación verificó que los 2 grupos y las 3 actividades permanecen idénticos y que se conservan IDs y contenido académico de las 88 entregas. Una entrega histórica cambió de propietario a la cuenta activa con autorización explícita; conserva su UID anterior como referencia. Siete perfiles locales sin coincidencia central permanecen conservados, sin vinculación automática. Los respaldos, planes y verificaciones contienen datos privados y permanecen excluidos de Git en `backups/` y `migration-private/`.

Los dos clientes públicos están creados en Supabase y habilitados en Aula Identidad. Por solicitud del profesor, el 11 de noviembre de 2026 se activa `VITE_AUTH_MODE=central` en GitHub Pages con el Client ID de producción y el backend real. Las reglas centrales ya están publicadas y bloquean el acceso directo de clientes Firebase antiguos, sin borrar cuentas ni datos académicos. El respaldo final del corte y las reglas anteriores permanecen privados en `backups/` y `migration-private/`. Las PWA abiertas o instaladas deben actualizarse para utilizar el nuevo acceso.

Fuentes: contrato revisado en `C:\ws\AuthApp\docs\INTEGRACION.md`, `docs\SEGURIDAD.md`, ejemplo PWA y `src/app.js` / `src/service.js`. No se leyó el `.env` de la central. Discovery público consultado el **11 de noviembre de 2026**: issuer, authorization/token/JWKS coinciden con el documento; admite `code`, clientes públicos `none`, PKCE `S256` y `openid profile`. No se solicita `offline_access` ni renovación automática.

## Corrección del callback público

El 12 de noviembre de 2026 se normalizó `BASE_PATH` para terminar siempre en `/`: `configure-pages` puede devolver `/arbolesapp`, pero el callback registrado exige `https://rodolfoluna.github.io/arbolesapp/?auth_callback=1`. La comprobación del bundle central ahora rechaza una ruta inicial sin barra final. El despliegue de la corrección `37494e5` terminó correctamente en GitHub Pages. El respaldo posterior confirma los 2 grupos, las 3 actividades, las 88 entregas y todas las membresías sin cambios respecto al corte. Se completó un ingreso real de alumno desde el origen público: consentimiento, callback limpio, portal con tres actividades y avances previos, y apertura de una entrega lineal con respuestas, nota 100 y dos intentos históricos intactos. El primer acceso agotó la espera durante el arranque de Render Free; se verificó el reingreso correcto con el backend activo. La sesión y los avances persistieron al recargar la página pública. No se enviaron respuestas ni evaluaciones.

## Verificación del docente en la página pública

El 12 de noviembre de 2026 se completó el ingreso OAuth de la cuenta central docente desde GitHub Pages, con consentimiento autorizado y retorno a la URL pública limpia. Se abrió la administración de grupos: aparecen los dos grupos anteriores, el curso muestra sus 32 alumnos y están disponibles los controles de creación, retiro y eliminación. La búsqueda en el catálogo central devolvió el alumno solicitado; seleccionarlo habilitó incorporar al grupo y se limpió la selección sin enviar cambios. Se cargó la matriz y se abrió una entrega lineal existente: respuestas del alumno y esperadas, nota 100, dos intentos históricos y control de reintento visibles. No se ejecutaron altas, eliminaciones, cambios de membresía ni restablecimientos; esta prueba acredita acceso y revisión, no ensaya mutaciones en producción. La sesión docente se mantuvo al recargar. El panel de entregas sin actividad también es accesible; no se repitió su consulta completa para evitar lecturas adicionales.

## Prueba real de administración de un grupo temporal

El 12 de noviembre de 2026 se ejecutó desde el panel docente público el ciclo completo: crear un grupo temporal único, incorporar un alumno ya vinculado, retirarlo y eliminar únicamente ese grupo vacío con confirmación del profesor. Al incorporarlo se verificó que la membresía original del alumno seguía presente; al retirarlo volvió a su estado anterior. La comparación del respaldo final con el respaldo previo confirmó idénticos los dos grupos originales, las tres actividades, las 88 entregas y los 33 vínculos centrales, así como todas las membresías. No se crearon actividades ni usuarios centrales, ni se enviaron respuestas, evaluaciones o restablecimientos. Los informes y respaldos con datos personales permanecen en los directorios privados excluidos de Git.

## Arquitectura y permisos

```text
PWA (GitHub Pages) → Supabase OAuth central (code + PKCE S256, state, nonce)
PWA → backend educativo (access token en Authorization)
backend → Aula Identidad /api/v1/me en CADA petición protegida
backend → permisos locales → Firestore existente mediante Admin SDK
```

- La firma del access token se verifica con JWKS central, issuer fijo, audience `authenticated`, ES256/RS256 y expiración. Se exige el Client ID configurado para el origen exacto. Además se consulta `/me` sin caché y se comprueba perfil activo, contraseña inicial completada y versión actual. No se concede acceso con un UUID, rol o estado enviado por el navegador.
- El ID token se valida en la PWA (firma, issuer, audience del cliente, expiración); la biblioteca valida state y nonce y efectúa el canje PKCE. No se usa el ID token como credencial de la API.
- El profesor debe estar vinculado a su documento local existente. No se crea un profesor automáticamente. Este proyecto mantiene el modelo de un único profesor y sus grupos anteriores; no se introduce un modelo multiinstitución.
- El alumno solo lee sus grupos, sus actividades y sus propias entregas de actividades asignadas. No consulta el catálogo ni administra miembros. Las entregas se identifican por el UID local vinculado, no por un número de control elegido en la petición.
- El profesor consulta el catálogo central por búsqueda/páginas de 50. Al incorporar un alumno, el backend vuelve a buscar su UUID en el catálogo y comprueba `active`; no acepta el estado ni el nombre del navegador. Las membresías se guardan como un conjunto, sin duplicados.
- Las cuentas suspendidas mantienen referencias históricas. Una suspensión central impide acceso en la siguiente petición. Las altas individuales/CSV, contraseñas y suspensiones se administran en la central, no se copian aquí.
- La evaluación local sirve para interacción inmediata; **en modo central, el servidor recalcula la nota y controla los intentos transaccionalmente**. Una falla no consume un intento local. Las operaciones sobre actividades cerradas o ajenas se rechazan.
- No hay sesiones Firebase ni custom tokens para el acceso central. Tras la activación, `firestore.central.rules` bloquea todo acceso directo desde SDKs web, incluso sesiones Firebase antiguas. El Admin SDK es exclusivamente del backend. La app no utiliza Storage.
- Las llamadas fallidas no autorizan operaciones. 401/403 invalidan la sesión local; red/CORS/5xx bloquean acceso y piden reingreso, sin bucles automáticos. 400/409 permiten corregir/reintentar. La central puede tardar en arrancar en Render Free; hay espera limitada y mensajes en español.

## Valores exactos para registro externo

| Campo | Producción | Desarrollo recomendado |
|---|---|---|
| Nombre | Estructura de Datos APP | Estructura de Datos APP — desarrollo |
| Tipo OAuth | Public, sin secret | Public, sin secret |
| URL pública | `https://rodolfoluna.github.io/arbolesapp/` | `http://localhost:5173/` |
| Origen | `https://rodolfoluna.github.io` | `http://localhost:5173` |
| Ruta base | `/arbolesapp/` | `/` |
| Callback exacto | `https://rodolfoluna.github.io/arbolesapp/?auth_callback=1` | `http://localhost:5173/?auth_callback=1` |
| Client ID real, registrado y habilitado | `412612be-1782-473c-be67-d2cc4aaeb06c` | `faa78c9c-eac5-4b0e-a0ba-ab7e82e10dc5` |

Se usa callback con query en la página raíz de la app para funcionar por acceso directo en GitHub Pages sin un servidor que resuelva `/callback`. Incluye exactamente la barra y `?auth_callback=1` en el registro. La biblioteca recibe después `code` y `state` y los retira de la URL, también si falla el callback.

En **Supabase central → Authentication → OAuth Server / OAuth Apps**, crear ambos clientes públicos con sus respectivos callbacks. Después, en **Aula Identidad → Aplicaciones**, registrar el **mismo Client ID** de cada uno, nombre y origen exacto; habilitarlo. Son necesarios ambos registros.

El issuer es `https://vtriyoxcumuygluqqstd.supabase.co/auth/v1`. La API central es `https://aula-identidad.onrender.com`. **No modificar** su Site URL ni su consentimiento `/oauth/consent`. La central gestiona `authorization_id`; esta app no lo genera ni usa sus APIs internas/cookies.

Si se usa `http://127.0.0.1:5173`, es **otro origen**. Hay que registrar otro cliente público y el origen correspondiente; no reutilizar el Client ID de localhost. Vite usa puerto 5173 estricto y no cambia silenciosamente a 5174.

## Backend: configuración en Render

El backend está activo en `https://arboles-api.onrender.com`, separado de Aula Identidad. Su configuración reproducible está en `render.yaml`:

- Node 22 o superior.
- Build: `npm ci --include=dev && npm run check:server`.
- Start: `npm run server`.
- Health check público sin datos: `/health`.
- Despliegue automático desactivado hasta terminar la transición.
- `FIREBASE_PROJECT_ID=eddt4-3b228` para producción; usar un proyecto/copia de ensayo antes.
- `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-admin.json`.
- En Render → Environment → Secret Files, montar `firebase-admin.json` con la credencial **del Firebase educativo**, nunca la de Supabase central. Alternativamente usar credenciales de aplicación predeterminadas del entorno con el IAM apropiado. El archivo no se sube a Git ni se pega en el chat.
- `AULA_CLIENTS_JSON`: objeto JSON con origen → Client ID real. No usar asteriscos ni placeholders. Valores públicos ya registrados:

```json
{
  "https://rodolfoluna.github.io": "412612be-1782-473c-be67-d2cc4aaeb06c",
  "http://localhost:5173": "faa78c9c-eac5-4b0e-a0ba-ab7e82e10dc5"
}
```

`server/main.ts` rechaza configuración vacía, placeholders, orígenes con rutas y reutilización del mismo Client ID entre orígenes. El backend solo conecta con las URLs centrales fijadas en código. Las respuestas protegidas llevan `Cache-Control: no-store`; CORS admite únicamente los orígenes configurados, sin cookies.

El backend requiere permisos de lectura/escritura de Firestore, no necesita administrar Firebase Auth ni acceder a las contraseñas. Revisar IAM con el administrador del proyecto antes de generar una clave. No configurar `FIRESTORE_EMULATOR_HOST` en producción.

## Configuración de la PWA

Copiar `.env.example` a `.env.local` en desarrollo. Para el modo central:

```dotenv
VITE_AUTH_MODE=central
VITE_AULA_CLIENT_ID=faa78c9c-eac5-4b0e-a0ba-ab7e82e10dc5
VITE_EDUCATIONAL_API_URL=http://localhost:3001
```

No se introducen claves administrativas en variables `VITE_*`. En modo central el SDK Firebase del navegador **no se inicializa**, incluso si quedan las variables públicas antiguas para una reversión controlada. Si falta configuración, el acceso central falla cerrado y no ofrece entrar en modo demo ni contraseña propia.

En GitHub → Settings → Secrets and variables → Actions → **Variables**, al terminar los ensayos:

```text
VITE_AUTH_MODE = central
VITE_AULA_CLIENT_ID = Client ID real de producción
VITE_EDUCATIONAL_API_URL = URL HTTPS real del nuevo backend
```

`PAGES_ENABLED=true` sigue controlando la publicación. El flujo conserva `BASE_PATH=/arbolesapp/`. No activar estas variables sobre usuarios reales antes del corte descrito abajo.

## Sesión, caché y trabajo offline

- Tokens y state en `sessionStorage` bajo el espacio `arboles.aula.*`, no localStorage. No se solicitan scopes de renovación ni se realiza silent refresh; al vencer, se exige reingreso. El cierre borra solo la sesión de esta app, **no cierra otras apps ni la sesión global central**.
- Una recarga exige verificar `/me` antes de mostrar los paneles. Las peticiones protegidas siempre pasan por el backend, incluso si el perfil visible ya se verificó.
- El service worker conserva recursos educativos estáticos. No tiene caché runtime de APIs; callback/code/state y `/api/` están excluidos del fallback de navegación. No guarda tokens, catálogo o respuestas protegidas en Cache Storage.
- La compilación central incluye CSP que permite scripts propios y conexiones solo al origen propio, central, issuer y backend configurado; no habilita scripts inline. GitHub Pages sirve HTML estático sin datos de identidad; la API tiene las cabeceras no-store que Pages no permite configurar por ruta.
- Los borradores educativos existentes se conservan localmente. Se puede trabajar sobre contenido ya abierto, pero **no hay nuevos envíos protegidos sin comprobar identidad en línea**. No se promete una cola de envíos offline para el modo central; el alumno debe reingresar y guardar/evaluar al recuperar conexión.
- Listados de grupos/actividades/perfiles se actualizan al cargar, al recuperar foco, cada 60 segundos con la pestaña visible y con **Actualizar datos**. Cada actualización valida identidad de nuevo; no es una escucha directa Firestore. La matriz conserva su consulta manual de entregas. No se cachea `/me` en el backend.
- En dispositivos compartidos, cerrar sesión y gestionar los datos locales del navegador según la política del aula. Borrar datos del sitio también elimina borradores no enviados. Una antigua PWA instalada no se retira al publicar una nueva versión: las reglas cerradas son la protección contra esa vía anterior.

## Respaldo y migración de vínculos

Ensayar **en una copia** de Firestore con datos existentes y conservar los IDs. No se han ejecutado estos comandos sobre la base remota. Requieren credenciales administrativas configuradas fuera de Git.

1. Obtener un catálogo central revisable con UUID, rol y número de control. En Supabase Table Editor puede exportarse `identity_profiles`, o en SQL Editor obtener solo estos campos:

```sql
select id, role, control_number, full_name, active
from public.identity_profiles
order by role, control_number;
```

Guardar el resultado como un **array JSON**, no como CSV, en `migration-private/central.json`. No exportar contraseñas, Auth ni claves. `identity_profiles.id` de la fila teacher es el UUID central del profesor. En Firebase Authentication/Firestore `users` identificar su UID de profesor anterior; no elegir un alumno ni crear un administrador por primer ingreso.

2. Respaldar las colecciones académicas y vínculos:

```powershell
$env:FIREBASE_PROJECT_ID = 'PROYECTO_DE_ENSAYO'
$env:GOOGLE_APPLICATION_CREDENTIALS = 'RUTA_PRIVADA_FUERA_DEL_REPOSITORIO'
npm run migration -- backup --out backups/antes-central.json
```

El archivo conserva tipos Firestore y las colecciones `users`, `groups`, `activities`, `submissions`, `identityLinks`. Es privado y está ignorado por Git. **No incluye Firebase Auth, `credentials` ni `logins`**: no los modifica ni copia contraseñas. Complementar con el respaldo administrativo habitual de Firebase y su configuración antes del corte. Para una instantánea consistente, detener escrituras durante el respaldo final; el exportador recorre colecciones y no es una instantánea transaccional global.

3. Generar el plan sin escribir:

```powershell
npm run migration -- plan --central migration-private/central.json --teacher-local-uid UID_FIREBASE_EXISTENTE --teacher-central-id UUID_CENTRAL_PROFESOR --out migration-private/plan.json
```

La comparación conserva números como texto, ceros iniciales y espacios internos; solo quita espacios exteriores y convierte a mayúsculas. Reporta duplicados locales/centrales, ausentes y vínculos contradictorios. Nunca vincula por nombre. Las propuestas **no se aplican automáticamente**.

4. Revisar el plan y crear `migration-private/links.json`, un array de vínculos autorizados:

```json
[
  { "localUid": "UID_FIREBASE_EXISTENTE", "centralId": "UUID_CENTRAL_REAL" }
]
```

Incluir al profesor explícitamente. Resolver discrepancias de rol antes de aplicar. Un UUID central solo puede asociarse a un UID local: se valida en preflight y en transacciones con el índice `identityLinks/{UUID}`. No hay foreign key a la base externa. No se alteran IDs, membresías ni documentos de grupos/actividades. El profesor vinculado conserva el acceso a los datos previos del proyecto de un único profesor; las nuevas actividades/grupos registran también su propiedad central.

5. Revisar `submissionConflicts`: restablecimientos antiguos pueden haber reemplazado UIDs conservando el número de control. No se concede acceso histórico por solo conocer ese número. Si corresponde unir una entrega al usuario revisado, crear opcionalmente `migration-private/transfers.json`:

```json
[
  { "submissionId": "ID_EXISTENTE", "fromUid": "UID_REEMPLAZADO", "toUid": "UID_LOCAL_VINCULADO" }
]
```

Solo se admite una transferencia revisada entre alumnos con el mismo número normalizado y un destino vinculado. Conserva ID de entrega, actividad, respuestas, intentos, notas y el UID anterior en `legacy_student_uid`. No lo hagas por coincidencia de nombre.

6. Aplicar en la copia, tras revisar respaldo, links y conflictos:

```powershell
npm run migration -- apply --central migration-private/central.json --teacher-local-uid UID_FIREBASE_EXISTENTE --teacher-central-id UUID_CENTRAL_PROFESOR --backup backups/antes-central.json --links migration-private/links.json
# Añadir --transfers migration-private/transfers.json solo si se revisaron transferencias históricas.
```

La operación es idempotente por vínculo; **no es una transacción global**. Si se interrumpe, revisar y repetir; cada vínculo conserva unicidad. Un alumno ausente/conflictivo no obtiene acceso hasta resolverlo. Un perfil local deshabilitado sigue bloqueado hasta una revisión explícita. No se sincronizan contraseñas ni se borran usuarios.

## Ensayo y activación definitiva

1. Registrar clientes y orígenes en Supabase y Aula Identidad. Desplegar el backend contra la copia y configurar el Client ID de desarrollo. Montar solo la credencial de esa copia durante el ensayo.
2. Verificar con profesor y alumno **existentes y acordados**, sin crear alumnos ficticios en producción: callback, IDs previos, grupos, selector, entrega propia, rechazo de entrega ajena, cambio inicial, suspensión/restablecimiento, versión, cliente deshabilitado, expiración, red, recarga y cierre local.
3. Guardar evidencia de las pruebas reales y aprobar la tabla de vínculos. Hasta entonces mantener el acceso de producción actual.
4. En ventana de mantenimiento, bloquear escrituras de los clientes antiguos aplicando las reglas centrales, respaldar la base final y aplicar los vínculos revisados en producción. El bloqueo debe alcanzar SDKs y PWA antiguas, no solo ocultar el login. Ejemplo **para ejecutar solo en el corte acordado**:

```powershell
npx firebase-tools deploy --only firestore:rules --config firebase.central.json --project eddt4-3b228
```

5. Cambiar el backend al Firebase de producción, configurar las variables centrales de Pages, compilar y desplegar. Verificar un ingreso real del profesor y alumno, propiedad/membresías, entrega propia y rechazo del acceso directo con una sesión Firebase anterior.
6. No dejar reglas anteriores ni otra publicación legacy como vía alternativa activa hacia esa base. Las cuentas antiguas pueden conservarse para respaldo/reversión, pero sus sesiones ya no deben leer/escribir datos. No borrar usuarios ni contraseñas para activar.

## Reversión

La publicación actual conserva el acceso legacy. Ya existen vínculos remotos respaldados; para deshacerlos usar el procedimiento específico siguiente. Después de activar:

- Si solo falla la UI, volver a una compilación central anterior y mantener las reglas cerradas; evita reabrir Firebase directo innecesariamente.
- Para revertir únicamente los vínculos aplicados, mantener mantenimiento, respaldar el estado actual y usar el respaldo anterior y **el mismo archivo links revisado**:

```powershell
npm run migration -- rollback-links --backup backups/antes-central.json --links migration-private/links.json
# Incluir el mismo --transfers si hubo transferencias históricas revisadas.
```

La herramienta revierte campos de identidad de esos usuarios y el índice correspondiente, no restaura actividades completas ni pisa respuestas/membresías nuevas. No toca usuarios importados posteriormente que no estén en links. Las transferencias opcionales revierten solo propiedad/UUID, conservando el contenido académico actualizado.

Volver a abrir el acceso Firebase anterior **reduce la garantía de suspensión central** y debe decidirse explícitamente durante una incidencia. Exige revisar cuentas habilitadas, restaurar la configuración/reglas anteriores respaldadas y probar el acceso anterior; no es un fallback automático del código. No desactivar una cuenta en la central suponiendo que eso revoca una sesión legacy.

## Pruebas reproducibles y límites

```powershell
npm ci
npm test
npm run check:server
npm run build
npm run lint
```

Se incluyen pruebas con repositorio local en memoria, servidor HTTP loopback y criptografía real de fixtures: roles, propiedad/pertenencia, rechazo del catálogo para alumnos, CORS, 401/403/503, estado/versión/cliente, firma/audience/expiración, PKCE/state/nonce de la biblioteca, callback directo y limpieza de URL, sesión/recarga/logout, selector con paginación y suspendidos, conservación de IDs y membresías, unicidad de vínculos, transferencias históricas, notas/intentos en servidor y borrador tras falla. Los tokens y usuarios de fixtures no se envían a la central real.

Resultado local de esta entrega: **113 pruebas aprobadas**. Comprobación TypeScript de frontend y backend y compilaciones legacy/central aprobadas. También se compiló una vista local con el Client ID de desarrollo y la URL real del backend; compilarla no acredita por sí solo el flujo OAuth. `node tools/check-public-bundle.mjs --central` comprueba CSP, exclusión del callback y ausencia de patrones de claves administrativas; no sustituye una auditoría completa de secretos.

**Los accesos reales del profesor y de un alumno existente están probados en local contra Render; las reglas centrales están desplegadas para el corte público.** El backend real, su conectividad administrativa y los vínculos remotos sí fueron comprobados mediante respaldo y comparación. La revocación por suspensión/restablecimiento está cubierta por pruebas automatizadas; no se modificaron cuentas reales para ensayarla. El ingreso de alumno en el origen público quedó verificado el 12 de noviembre de 2026. Los tests con repositorio en memoria no sustituyen esas comprobaciones. Tanto `firestore.rules` como `firestore.central.rules` contienen ahora el bloqueo de acceso directo; una reversión de seguridad no es automática.

Ensayo real de alumno (11 de noviembre de 2026): la cuenta central vinculada accedió al portal de estudiantes y recuperó las tres actividades de su grupo. Se observaron 10/15 ejercicios completados del problemario, incluidas notas de 100 y 90, y 2/10 ejercicios de estructuras lineales con nota 100, respuestas e intentos anteriores. El límite actual de un intento mantiene bloqueado un ejercicio con dos intentos históricos; no se reinició su contador. Una comparación administrativa puntual de seis documentos confirmó identidad local/central, pertenencia al grupo y contenido idéntico de las tres entregas respecto al respaldo, sin escrituras. La entrega de la actividad eliminada sigue conservada en Firestore y no se ofrece como actividad disponible al alumno. La sesión de alumno y los avances persistieron al recargar. Este ensayo no incluye nuevas evaluaciones, envíos, suspensión ni intentos de acceso a entregas ajenas.

Las dependencias preexistentes presentan avisos en `npm audit` (incluido Firebase); no se aplican downgrades mayores automáticos. Revisar la salida actual antes de activar y planear las actualizaciones incompatibles por separado.

Referencias primarias: [biblioteca OIDC](https://authts.github.io/oidc-client-ts/), [registro OAuth público Supabase](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [Firebase Admin](https://firebase.google.com/docs/admin/setup), [secrets en Render](https://render.com/docs/configure-environment-variables).
