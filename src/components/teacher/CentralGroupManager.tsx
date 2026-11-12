import { useEffect, useState } from 'react';
import type { Group, UserProfile } from '../../lib/models';
import { createGroup, deleteGroup, setGroupMembership, subscribeStudents } from '../../lib/db';
import { centralFetch, centralUrl, refreshCentralData } from '../../lib/central';
import { Modal, PageHeader } from '../ui';

export interface CentralStudent { id: string; control_number: string; full_name: string; active: boolean }
interface Directory { students: CentralStudent[]; total: number; page: number; page_size: number }
export function CentralGroupManager({ groups }: { groups: Group[] }) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [groupId, setGroupId] = useState('');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [selected, setSelected] = useState<Map<string, CentralStudent>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [confirm, setConfirm] = useState<{ type: 'group' | 'member'; id: string; name: string } | null>(null);
  useEffect(() => subscribeStudents(setStudents, () => setError('No se pudieron cargar los alumnos locales. Actualiza los datos.')), []);
  const group = groups.find((item) => item.id === groupId);
  const members = students.filter((item) => !groupId || item.groupIds.includes(groupId));
  const search = async (searchTerm: string, page = 1) => {
    setBusy(true); setError('');
    try {
      const result = await centralFetch<Directory>(`/api/students?search=${encodeURIComponent(searchTerm)}&page=${page}`);
      setDirectory(result); setQuery(searchTerm);
      setSelected((current) => {
        const next = new Map(current);
        result.students.forEach((item) => { if (!item.active) next.delete(item.id); });
        return next;
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo consultar el catálogo.'); }
    finally { setBusy(false); }
  };
  const add = async () => {
    if (!groupId || !selected.size) return;
    setBusy(true); setError(''); setNotice('');
    let count = 0;
    try {
      for (const student of selected.values()) {
        await centralFetch('/api/import-student', { centralId: student.id, controlNumber: student.control_number, groupId });
        count++;
        setSelected((current) => { const next = new Map(current); next.delete(student.id); return next; });
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo incorporar al alumno.'); }
    finally { setNotice(`Se incorporaron ${count} alumnos al grupo. Los demás seleccionados se pueden reintentar.`); refreshCentralData(); setBusy(false); }
  };
  const confirmAction = async () => {
    if (!confirm || busy) return;
    setBusy(true); setError('');
    try {
      if (confirm.type === 'group') { await deleteGroup(confirm.id); setGroupId(''); }
      else await setGroupMembership([confirm.id], groupId, false);
      setConfirm(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <PageHeader title="Grupos locales y catálogo central" subtitle="Las actividades y membresías de esta app se administran aquí. Las cuentas y contraseñas se administran en Aula Identidad." />
    <a className="btn-secondary" href={centralUrl}>Registrar alumnos, cargar CSV o administrar accesos</a>
    {error && !confirm && <p role="alert" className="text-coral-400">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="flex flex-wrap gap-2" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('');
      try { const id = await createGroup(newGroupName); setGroupId(id); setNewGroupName(''); }
      catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.'); }
      finally { setBusy(false); }
    }}>
      <label>Nombre del grupo <input className="input" value={newGroupName} maxLength={200} onChange={(event) => setNewGroupName(event.target.value)} /></label>
      <button className="btn-secondary" disabled={busy || !newGroupName.trim()}>Crear grupo local</button>
    </form>
    <label className="block">Grupo local
      <select className="input" disabled={busy} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
        <option value="">Todos los alumnos locales</option>
        {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {group && <button className="btn-danger" disabled={busy} onClick={() => { setError(''); setConfirm({ type: 'group', id: group.id, name: group.name }); }}>Eliminar grupo</button>}
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Alumnos {group ? `de ${group.name}` : 'locales'}</h2>
      {members.length === 0 && <p>No hay alumnos en esta selección.</p>}
      <ul className="space-y-2">{members.map((student) => <li key={student.uid} className="flex flex-wrap items-center justify-between gap-2">
        <span>{student.fullName} · {student.controlNumber} {!student.central_user_id && '(vinculación central pendiente)'}</span>
        {group && <button className="btn-ghost" disabled={busy} onClick={() => { setError(''); setConfirm({ type: 'member', id: student.uid, name: student.fullName }); }}>Retirar de este grupo</button>}
      </li>)}</ul>
    </section>
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">Seleccionar alumnos de Aula Identidad</h2>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void search(term); }}>
        <label>Buscar por nombre o número de control<input className="input" maxLength={100} value={term} onChange={(event) => setTerm(event.target.value)} /></label>
        <button className="btn-secondary" disabled={busy}>Buscar en el catálogo central</button>
      </form>
      {busy && <p role="status">Consultando… El servicio central puede tardar en iniciar.</p>}
      {directory && <>
        <p>Página {directory.page} · {directory.total} resultados</p>
        <ul className="space-y-2">{directory.students.map((student) => <li key={student.id}>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={busy || !student.active} checked={selected.has(student.id)} onChange={(event) => {
            const checked = event.target.checked;
            setSelected((current) => { const next = new Map(current); if (checked) next.set(student.id, student); else next.delete(student.id); return next; });
          }} />{student.full_name} · {student.control_number}{!student.active && ' (cuenta suspendida)'}</label>
        </li>)}</ul>
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={busy || directory.page <= 1} onClick={() => search(query, directory.page - 1)}>Página anterior</button>
          <button className="btn-ghost" disabled={busy || directory.page * directory.page_size >= directory.total} onClick={() => search(query, directory.page + 1)}>Página siguiente</button>
        </div>
      </>}
      <p>{selected.size} seleccionados. Elige un grupo local para incorporarlos.</p>
      <button className="btn-primary" disabled={busy || !group || !selected.size} onClick={add}>Incorporar al grupo local</button>
    </section>
    <Modal open={!!confirm} title={confirm?.type === 'group' ? 'Eliminar grupo local' : 'Retirar alumno del grupo'} size="sm"
      onClose={() => { if (!busy) setConfirm(null); }} footer={<>
        <button className="btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button>
        <button className="btn-danger" disabled={busy} onClick={confirmAction}>{busy ? 'Procesando…' : 'Confirmar'}</button>
      </>}>
      <p>{confirm?.name}: {confirm?.type === 'group'
        ? 'se eliminará el grupo y sus membresías locales. Primero debes mover o eliminar sus actividades. Las cuentas y entregas se conservarán.'
        : 'se retirará únicamente de este grupo. Su cuenta central, otras membresías y entregas se conservarán.'}</p>
      {error && <p role="alert" className="text-coral-400">{error}</p>}
    </Modal>
  </div>;
}
