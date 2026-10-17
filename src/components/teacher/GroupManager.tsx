import { useEffect, useRef, useState } from 'react';
import type { Group, UserProfile } from '../../lib/models';
import {
  createGroup,
  deleteGroup,
  subscribeStudents,
  updateStudentName,
  removeStudent,
  fetchCredentials,
} from '../../lib/db';
import {
  createStudents,
  downloadCsv,
  parseStudentsCsv,
  resetStudentPassword,
  type CreateResult,
} from '../../lib/accounts';
import { normalizeControlNumber } from '../../lib/firebase';
import { ConfirmDialog, Modal, PageHeader, Spinner, cx } from '../ui';

export function GroupManager({ groups }: { groups: Group[] }) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => groups[0]?.id || '');

  // Modales
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isCreatingUsers, setIsCreatingUsers] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(null);

  // Alta directa de alumno individual
  const [isSingleStudentModalOpen, setIsSingleStudentModalOpen] = useState(false);
  const [singleCn, setSingleCn] = useState('');
  const [singleFullName, setSingleFullName] = useState('');
  const [singleGroupId, setSingleGroupId] = useState('');
  const [isAddingSingleStudent, setIsAddingSingleStudent] = useState(false);
  const [singleStudentSuccess, setSingleStudentSuccess] = useState<{
    controlNumber: string;
    fullName: string;
    tempPassword?: string;
  } | null>(null);
  const [copiedTemp, setCopiedTemp] = useState(false);

  const [resettingStudent, setResettingStudent] = useState<UserProfile | null>(null);
  const [resetSuccessPass, setResetSuccessPass] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingStudent, setDeletingStudent] = useState<UserProfile | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubS = subscribeStudents((s) => setStudents(s));
    return () => {
      unsubS();
    };
  }, []);

  const activeGroup = groups.find((g) => g.id === selectedGroupId);
  const studentsInGroup = students.filter((s) =>
    selectedGroupId ? s.groupIds?.includes(selectedGroupId) : true
  );

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const id = await createGroup(newGroupName);
      setSelectedGroupId(id);
      setNewGroupName('');
      setIsNewGroupOpen(false);
    } catch (err) {
      alert('Error al crear grupo: ' + err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup || isDeletingGroup) return;
    setIsDeletingGroup(true);
    setDeleteGroupError('');
    try {
      await deleteGroup(deletingGroup.id);
      setSelectedGroupId((current) => current === deletingGroup.id ? '' : current);
      setDeletingGroup(null);
    } catch (error) {
      setDeleteGroupError(error instanceof Error ? error.message : 'No se pudo eliminar el grupo. Intenta de nuevo.');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setCsvText(content);
      const parsed = parseStudentsCsv(content);
      setCsvErrors(parsed.errors);
    };
    reader.readAsText(file);
  };

  const handleProcessCsv = async () => {
    const parsed = parseStudentsCsv(csvText);
    if (parsed.rows.length === 0) {
      alert('No se encontraron alumnos válidos en el CSV.');
      return;
    }
    setIsCreatingUsers(true);
    setCreateProgress({ done: 0, total: parsed.rows.length });

    try {
      const targetGroupIds = selectedGroupId ? [selectedGroupId] : [];
      const results: CreateResult[] = await createStudents(
        parsed.rows,
        students,
        targetGroupIds,
        (done, total) => setCreateProgress({ done, total })
      );

      // Descargar automáticamente el archivo con credenciales iniciales
      const createdRows = results
        .filter((r) => r.status === 'created' && r.tempPassword)
        .map((r) => [r.controlNumber, r.fullName, r.tempPassword!]);

      if (createdRows.length > 0) {
        downloadCsv(
          `credenciales_iniciales_${activeGroup?.name || 'alumnos'}.csv`,
          ['NumeroControl', 'Nombre', 'PasswordTemporal'],
          createdRows
        );
      }

      alert(
        `Proceso finalizado.\nCreados: ${createdRows.length}\nOmitidos/existentes: ${
          results.filter((r) => r.status === 'exists').length
        }\nErrores: ${results.filter((r) => r.status === 'error').length}`
      );
      setIsCsvModalOpen(false);
      setCsvText('');
    } catch (err) {
      alert('Error en alta masiva: ' + err);
    } finally {
      setIsCreatingUsers(false);
      setCreateProgress(null);
    }
  };

  const handleResetPassword = async (student: UserProfile) => {
    try {
      const newTemp = await resetStudentPassword(student);
      setResettingStudent(null);
      setResetSuccessPass(newTemp);
    } catch (err) {
      alert('Error al restablecer contraseña: ' + err);
    }
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cn = normalizeControlNumber(singleCn);
    const name = singleFullName.trim();
    if (!cn || !name) {
      alert('Por favor introduce el número de control y el nombre completo.');
      return;
    }

    setIsAddingSingleStudent(true);
    try {
      const targetGroupIds = singleGroupId ? [singleGroupId] : (selectedGroupId ? [selectedGroupId] : []);
      const results = await createStudents(
        [{ controlNumber: cn, fullName: name }],
        students,
        targetGroupIds
      );

      const res = results[0];
      if (res.status === 'created') {
        setSingleStudentSuccess({
          controlNumber: res.controlNumber,
          fullName: res.fullName,
          tempPassword: res.tempPassword,
        });
        setSingleCn('');
        setSingleFullName('');
        setIsSingleStudentModalOpen(false);
      } else if (res.status === 'exists') {
        alert(`El alumno con número de control ${cn} ya está registrado en el sistema.`);
      } else {
        alert('Error al registrar alumno: ' + (res.message || 'Error desconocido'));
      }
    } catch (err) {
      alert('Error al crear alumno: ' + err);
    } finally {
      setIsAddingSingleStudent(false);
    }
  };

  const handleDownloadAllCredentials = async () => {
    try {
      const creds = await fetchCredentials();
      if (creds.length === 0) {
        alert('No hay credenciales registradas aún.');
        return;
      }
      downloadCsv(
        'todas_las_credenciales_temporales.csv',
        ['NumeroControl', 'Nombre', 'PasswordTemporal'],
        creds.map((c) => [c.controlNumber, c.fullName, c.tempPassword])
      );
    } catch (err) {
      alert('Error al descargar credenciales: ' + err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Grupos y Alumnos"
        subtitle="Administra tus clases, da de alta alumnos directamente o con CSV, y gestiona sus contraseñas."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadAllCredentials}
              className="btn-secondary text-xs"
              title="Descarga el historial de contraseñas iniciales de todos los alumnos"
            >
              📥 Descargar Credenciales
            </button>
            <button
              id="btn-add-single-student"
              onClick={() => {
                setSingleGroupId(selectedGroupId);
                setIsSingleStudentModalOpen(true);
              }}
              className="btn-primary text-xs font-semibold"
            >
              + Añadir Alumno
            </button>
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="btn-secondary text-xs font-semibold"
            >
              📤 Subir por CSV
            </button>
            <button
              onClick={() => setIsNewGroupOpen(true)}
              className="btn-secondary text-xs"
            >
              + Nuevo Grupo
            </button>
          </div>
        }
      />

      {/* Selector de Grupo */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline pb-4">
        <span className="text-xs font-medium text-text-muted">Grupo:</span>
        <button
          onClick={() => setSelectedGroupId('')}
          className={cx(
            'rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200',
            !selectedGroupId
              ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
              : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
          )}
        >
          Todos los alumnos ({students.length})
        </button>
        {groups.map((g) => {
          const count = students.filter((s) => s.groupIds?.includes(g.id)).length;
          const isSel = g.id === selectedGroupId;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className={cx(
                'rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200',
                isSel
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                  : 'text-text-secondary hover:bg-surface-variant hover:text-text-primary'
              )}
            >
              {g.name} ({count})
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <div className="flex justify-end">
          <button
            className="btn-danger btn-sm"
            onClick={() => { setDeletingGroup(activeGroup); setDeleteGroupError(''); }}
          >
            Eliminar grupo
          </button>
        </div>
      )}

      {/* Tabla de Alumnos */}
      <div className="card overflow-hidden !p-0 border-outline bg-surface-container">
        <div className="flex items-center justify-between border-b border-outline px-5 py-3.5">
          <div className="text-sm font-semibold text-text-primary">
            {activeGroup ? `Alumnos de ${activeGroup.name}` : 'Todos los Alumnos Registrados'}
            <span className="ml-2 font-mono text-xs text-text-muted">
              ({studentsInGroup.length})
            </span>
          </div>
          <button
            onClick={() => {
              setSingleGroupId(selectedGroupId);
              setIsSingleStudentModalOpen(true);
            }}
            className="btn-tonal btn-sm text-xs font-semibold"
          >
            + Añadir Alumno
          </button>
        </div>

        {studentsInGroup.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <p className="mb-3">
              No hay alumnos {activeGroup ? `en el grupo "${activeGroup.name}"` : 'registrados aún'}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setSingleGroupId(selectedGroupId);
                  setIsSingleStudentModalOpen(true);
                }}
                className="btn-primary text-xs font-semibold"
              >
                + Añadir Alumno Directo
              </button>
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="btn-secondary text-xs"
              >
                📤 Subir Alumnos por CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th>No. Control</th>
                  <th>Nombre Completo</th>
                  <th>Grupos Asignados</th>
                  <th>Estado Contraseña</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {studentsInGroup.map((s) => (
                  <tr key={s.uid}>
                    <td className="font-mono text-xs font-semibold text-mint-300">
                      {s.controlNumber}
                    </td>
                    <td className="font-medium text-white">{s.fullName}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {s.groupIds?.map((gid) => {
                          const gName = groups.find((g) => g.id === gid)?.name || gid;
                          return (
                            <span
                              key={gid}
                              className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              {gName}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {s.mustChangePassword ? (
                        <span className="badge border border-sun-400/30 bg-sun-400/10 text-sun-300">
                          Temporal (pendiente de cambio)
                        </span>
                      ) : (
                        <span className="badge border border-mint-400/30 bg-mint-400/10 text-mint-300">
                          ✓ Personalizada
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setResettingStudent(s)}
                          className="btn-ghost btn-sm text-xs text-iris-300 hover:text-iris-200"
                          title="Genera una nueva contraseña temporal sin perder sus entregas"
                        >
                          Restablecer Contraseña
                        </button>
                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setEditName(s.fullName);
                          }}
                          className="btn-ghost btn-sm text-xs text-slate-400 hover:text-white"
                          title="Editar nombre"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeletingStudent(s)}
                          className="btn-ghost btn-sm text-xs text-coral-400 hover:bg-coral-400/10"
                          title="Dar de baja alumno"
                        >
                          Baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!deletingGroup}
        onClose={() => { if (!isDeletingGroup) setDeletingGroup(null); }}
        title="Eliminar grupo"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" disabled={isDeletingGroup} onClick={() => setDeletingGroup(null)}>Cancelar</button>
            <button className="btn-danger" disabled={isDeletingGroup} onClick={handleDeleteGroup}>
              {isDeletingGroup ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>¿Eliminar el grupo <b>{deletingGroup?.name}</b>? Esta acción no se puede deshacer.</p>
          <p>Se conservarán las cuentas, contraseñas y entregas de los alumnos, así como sus otros grupos. Los alumnos que solo pertenecían a este grupo quedarán sin grupo asignado.</p>
          <p>Si tiene actividades asignadas, primero debes moverlas a otro grupo o eliminarlas.</p>
          {deleteGroupError && <p role="alert" className="text-coral-400">{deleteGroupError}</p>}
        </div>
      </Modal>

      {/* Modal Nuevo Grupo */}
      <Modal
        open={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        title="Crear Nuevo Grupo"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setIsNewGroupOpen(false)}>
              Cancelar
            </button>
            <button
              id="btn-save-group"
              className="btn-primary"
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
            >
              Guardar Grupo
            </button>
          </>
        }
      >
        <div>
          <label className="label" htmlFor="group-name-input">
            Nombre del Grupo
          </label>
          <input
            id="group-name-input"
            className="input"
            placeholder="Ej: Estructura de Datos - 3A"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal Subir CSV */}
      <Modal
        open={isCsvModalOpen}
        onClose={() => !isCreatingUsers && setIsCsvModalOpen(false)}
        title="Subir Alumnos por CSV"
        size="lg"
        footer={
          <>
            <button
              className="btn-ghost"
              disabled={isCreatingUsers}
              onClick={() => setIsCsvModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              id="btn-process-csv"
              className="btn-primary font-semibold"
              disabled={isCreatingUsers || !csvText.trim()}
              onClick={handleProcessCsv}
            >
              {isCreatingUsers ? (
                <>
                  <Spinner className="h-4 w-4" /> Creando usuarios ({createProgress?.done}/
                  {createProgress?.total})...
                </>
              ) : (
                'Procesar y Descargar Contraseñas'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Sube un archivo <b className="text-white">.csv</b> o pega su contenido abajo. El sistema generará una contraseña temporal de 6 caracteres para cada alumno y descargará automáticamente un archivo <code className="text-mint-300">credenciales_iniciales.csv</code> para que se las entregues.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleCsvFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-xs"
            >
              📁 Seleccionar archivo .csv
            </button>
            <span className="text-xs text-slate-400">
              Formato esperado: Columnas <code className="text-slate-200">NumeroControl, Nombre</code>
            </span>
          </div>

          <div>
            <label className="label" htmlFor="csv-content-textarea">
              O pega el contenido aquí:
            </label>
            <textarea
              id="csv-content-textarea"
              rows={6}
              className="input-mono text-xs"
              placeholder={`NumeroControl, Nombre\n22010456, Juan Pérez López\n22010457, María Gómez Silva`}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                const p = parseStudentsCsv(e.target.value);
                setCsvErrors(p.errors);
              }}
            />
          </div>

          {csvErrors.length > 0 && (
            <div className="rounded-xl border border-coral-400/30 bg-coral-400/10 p-3 text-xs text-coral-400">
              <div className="font-semibold">Advertencias en el CSV:</div>
              <ul className="list-disc pl-4">
                {csvErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedGroupId && (
            <div className="rounded-xl border border-mint-400/30 bg-mint-400/10 p-2.5 text-xs text-mint-300">
              ✓ Los nuevos alumnos serán asignados automáticamente al grupo{' '}
              <b>{activeGroup?.name}</b>.
            </div>
          )}
        </div>
      </Modal>

      {/* Confirmar Restablecer Contraseña */}
      <ConfirmDialog
        open={!!resettingStudent}
        title="Restablecer Contraseña Temporal"
        message={
          <>
            Se generará una nueva contraseña temporal para{' '}
            <b className="text-white">{resettingStudent?.fullName}</b> (No. Control:{' '}
            <code className="text-mint-300">{resettingStudent?.controlNumber}</code>). El alumno
            conservará todas sus actividades y entregas previas.
          </>
        }
        confirmLabel="Generar Nueva Contraseña"
        onConfirm={() => resettingStudent && handleResetPassword(resettingStudent)}
        onClose={() => setResettingStudent(null)}
      />

      {/* Modal Mostrar Contraseña Restablecida */}
      <Modal
        open={!!resetSuccessPass}
        onClose={() => setResetSuccessPass(null)}
        title="Contraseña Temporal Generada"
        size="sm"
        footer={
          <button className="btn-primary" onClick={() => setResetSuccessPass(null)}>
            Entendido
          </button>
        }
      >
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-300">
            Entrega esta contraseña temporal a tu alumno. Se le pedirá cambiarla al entrar:
          </p>
          <div className="rounded-xl border border-mint-400/40 bg-ink-950 p-4 font-mono text-2xl font-bold tracking-widest text-mint-300 select-all">
            {resetSuccessPass}
          </div>
        </div>
      </Modal>

      {/* Editar Nombre */}
      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="Editar Datos del Alumno"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditingStudent(null)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                if (editingStudent && editName.trim()) {
                  await updateStudentName(editingStudent.uid, editingStudent.controlNumber, editName.trim());
                  setEditingStudent(null);
                }
              }}
            >
              Guardar Cambios
            </button>
          </>
        }
      >
        <div>
          <label className="label">Nombre Completo</label>
          <input
            className="input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>
      </Modal>

      {/* Dar de Baja Alumno */}
      <ConfirmDialog
        open={!!deletingStudent}
        title="Dar de baja a alumno"
        danger
        confirmLabel="Confirmar Baja"
        message={
          <>
            ¿Seguro que deseas dar de baja a{' '}
            <b className="text-white">{deletingStudent?.fullName}</b>? Su cuenta de acceso será
            desactivada, pero sus entregas pasadas se mantendrán en el sistema.
          </>
        }
        onConfirm={() => deletingStudent && removeStudent(deletingStudent)}
        onClose={() => setDeletingStudent(null)}
      />

      {/* Modal Añadir Alumno Directo */}
      <Modal
        open={isSingleStudentModalOpen}
        onClose={() => !isAddingSingleStudent && setIsSingleStudentModalOpen(false)}
        title="Añadir Alumno Directo"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              disabled={isAddingSingleStudent}
              onClick={() => setIsSingleStudentModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-add-single-student"
              className="btn-primary font-semibold"
              disabled={isAddingSingleStudent || !singleCn.trim() || !singleFullName.trim()}
            >
              {isAddingSingleStudent ? (
                <>
                  <Spinner className="h-4 w-4" /> Registrando...
                </>
              ) : (
                'Registrar Alumno'
              )}
            </button>
          </>
        }
      >
        <form id="form-add-single-student" onSubmit={handleAddSingleStudent} className="space-y-4">
          <p className="text-xs text-slate-300">
            Ingresa el número de control y nombre del alumno. El sistema creará su cuenta y generará una contraseña temporal de 6 caracteres para su primer acceso.
          </p>

          <div>
            <label className="label" htmlFor="single-cn-input">
              Número de Control / Matrícula <span className="text-coral-400">*</span>
            </label>
            <input
              id="single-cn-input"
              className="input font-mono"
              placeholder="Ej: 22010456"
              value={singleCn}
              onChange={(e) => setSingleCn(e.target.value)}
              required
              autoFocus
            />
            <p className="mt-1 text-[11px] text-slate-400">
              El alumno iniciará sesión escribiendo únicamente este número de control.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="single-name-input">
              Nombre Completo <span className="text-coral-400">*</span>
            </label>
            <input
              id="single-name-input"
              className="input"
              placeholder="Ej: Juan Pérez López"
              value={singleFullName}
              onChange={(e) => setSingleFullName(e.target.value)}
              required
            />
          </div>

          {groups.length > 0 && (
            <div>
              <label className="label" htmlFor="single-group-select">
                Asignar al Grupo
              </label>
              <select
                id="single-group-select"
                className="input"
                value={singleGroupId}
                onChange={(e) => setSingleGroupId(e.target.value)}
              >
                <option value="">Sin grupo asignado (general)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-mint-400/30 bg-mint-400/10 p-3 text-xs text-mint-300">
            💡 <b>Nota:</b> Al registrarlo se te mostrará en pantalla la contraseña temporal generada para que se la puedas entregar o copiar.
          </div>
        </form>
      </Modal>

      {/* Modal Éxito Alta Alumno */}
      <Modal
        open={!!singleStudentSuccess}
        onClose={() => setSingleStudentSuccess(null)}
        title="Alumno Registrado Exitosamente"
        size="md"
        footer={
          <div className="flex w-full items-center justify-between">
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setSingleStudentSuccess(null);
                setSingleCn('');
                setSingleFullName('');
                setIsSingleStudentModalOpen(true);
              }}
            >
              + Añadir Otro Alumno
            </button>
            <button
              className="btn-primary"
              onClick={() => setSingleStudentSuccess(null)}
            >
              Listo
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs">
            <div className="flex-1">
              <div className="text-slate-400">Alumno:</div>
              <div className="font-semibold text-white">{singleStudentSuccess?.fullName}</div>
            </div>
            <div>
              <div className="text-slate-400">No. Control:</div>
              <div className="font-mono font-semibold text-mint-300">
                {singleStudentSuccess?.controlNumber}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <p className="text-xs text-slate-300">
              Contraseña temporal asignada (se le pedirá cambiarla en su primer inicio de sesión):
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="rounded-xl border border-mint-400/40 bg-ink-950 px-6 py-3 font-mono text-2xl font-bold tracking-widest text-mint-300 select-all">
                {singleStudentSuccess?.tempPassword}
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  if (singleStudentSuccess?.tempPassword) {
                    navigator.clipboard.writeText(singleStudentSuccess.tempPassword);
                    setCopiedTemp(true);
                    setTimeout(() => setCopiedTemp(false), 2000);
                  }
                }}
              >
                {copiedTemp ? '✓ ¡Copiado!' : '📋 Copiar'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-slate-400">
            ℹ️ Entrega estos datos a tu alumno. Podrá ingresar directamente escribiendo su número de control y esta contraseña temporal.
          </div>
        </div>
      </Modal>
    </div>
  );
}
