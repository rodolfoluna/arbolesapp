import { useState } from 'react';
import type { Submission } from '../../lib/models';
import { deleteOrphanSubmissions, fetchOrphanSubmissions } from '../../lib/db';
import { Modal, PageHeader } from '../ui';

export function OrphanSubmissions() {
  const [items, setItems] = useState<Submission[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selection, setSelection] = useState<Submission[]>([]);
  const groups = new Map<string, Submission[]>();
  items.forEach((item) => groups.set(item.activityId, [...(groups.get(item.activityId) || []), item]));

  const search = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      setItems(await fetchOrphanSubmissions());
      setSearched(true);
    } catch {
      setError('No se pudieron consultar las entregas. Comprueba tu conexión y vuelve a buscar.');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selection.length || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const count = await deleteOrphanSubmissions(selection[0].activityId, selection.map((item) => item.id));
      const deleted = new Set(selection.map((item) => item.id));
      setItems((current) => current.filter((item) => !deleted.has(item.id)));
      setNotice(`Se eliminaron ${count} entregas. Las cuentas de los alumnos se conservaron.`);
      setSelection([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar las entregas. Intenta de nuevo.');
    } finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <PageHeader title="Entregas sin actividad" subtitle="Elimina entregas guardadas cuya actividad ya no existe." />
    <p className="text-sm text-text-secondary">La búsqueda consulta las actividades y todas las entregas de Firebase una sola vez al pulsar el botón. No se ejecuta automáticamente ni mantiene una escucha activa.</p>
    <button className="btn-secondary" disabled={busy} onClick={search}>{busy ? 'Procesando…' : 'Buscar entregas sin actividad'}</button>
    {notice && <p role="status" className="text-sm text-text-secondary">{notice}</p>}
    {error && !selection.length && <p role="alert" className="text-coral-400">{error}</p>}
    {searched && !items.length && <p>No hay entregas de actividades eliminadas.</p>}
    {[...groups].map(([activityId, submissions]) => <div key={activityId} className="card space-y-3">
      <h2 className="font-semibold">Actividad eliminada: <span className="font-mono break-all">{activityId}</span></h2>
      <p>{submissions.length} entregas · {submissions.slice(0, 5).map((item) => item.fullName || item.controlNumber).join(', ')}{submissions.length > 5 ? '…' : ''}</p>
      <button className="btn-danger" disabled={busy} onClick={() => { setError(''); setSelection(submissions.slice(0, 200)); }}>
        Eliminar {Math.min(submissions.length, 200)} entregas
      </button>
      {submissions.length > 200 && <p className="text-xs">Se eliminan hasta 200 por operación; después puedes continuar con las restantes.</p>}
    </div>)}
    <Modal open={!!selection.length} title="Eliminar entregas sin actividad" size="sm"
      onClose={() => { if (!busy) setSelection([]); }}
      footer={<>
        <button className="btn-ghost" disabled={busy} onClick={() => setSelection([])}>Cancelar</button>
        <button className="btn-danger" disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</button>
      </>}>
      <div className="space-y-3 text-sm">
        <p>Se eliminarán permanentemente {selection.length} entregas de la actividad <b className="break-all">{selection[0]?.activityId}</b>, incluidos sus borradores en la nube, respuestas, calificaciones e intentos. Esta acción no se puede deshacer.</p>
        <p>Las cuentas y las entregas de otras actividades se conservarán. Antes de borrar se comprobará otra vez que la actividad no existe.</p>
        {error && <p role="alert" className="text-coral-400">{error}</p>}
      </div>
    </Modal>
  </div>;
}
