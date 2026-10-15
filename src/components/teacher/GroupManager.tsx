import { useEffect, useRef, useState } from 'react';
import type { Group, UserProfile } from '../../lib/models';
import {
  createGroup,
  subscribeGroups,
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
import { ConfirmDialog, Modal, PageHeader, Spinner, cx } from '../ui';

export function GroupManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Modales
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isCreatingUsers, setIsCreatingUsers] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(null);
  const [resettingStudent, setResettingStudent] = useState<UserProfile | null>(null);
  const [resetSuccessPass, setResetSuccessPass] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingStudent, setDeletingStudent] = useState<UserProfile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubG = subscribeGroups((g) => {
      setGroups(g);
      if (g.length > 0 && !selectedGroupId) {
        setSelectedGroupId(g[0].id);
      }
    });
    const unsubS = subscribeStudents((s) => setStudents(s));
    return () => {
      unsubG();
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
        subtitle="Administra tus clases, da de alta alumnos con CSV y gestiona sus contraseñas."
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
              onClick={() => setIsCsvModalOpen(true)}
              className="btn-primary text-xs font-semibold"
            >
              📤 Subir Alumnos por CSV
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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-4">
        <span className="text-xs font-medium text-slate-400">Grupo:</span>
        <button
          onClick={() => setSelectedGroupId('')}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition',
            !selectedGroupId
              ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
              : 'text-slate-400 hover:text-slate-200'
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
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                isSel
                  ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {g.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabla de Alumnos */}
      <div className="card overflow-hidden !p-0">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
          <div className="text-sm font-semibold text-white">
            {activeGroup ? `Alumnos de ${activeGroup.name}` : 'Todos los Alumnos Registrados'}
            <span className="ml-2 font-mono text-xs text-slate-400">
              ({studentsInGroup.length})
            </span>
          </div>
        </div>

        {studentsInGroup.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay alumnos en este grupo. Sube un archivo CSV con las columnas <b className="text-slate-300">NumeroControl, Nombre</b> para dar de alta a tus alumnos automáticamente.
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
    </div>
  );
}
