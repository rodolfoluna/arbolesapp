import { useMemo, useState } from 'react';
import type { Activity, ActivitySettings, Group } from '../../lib/models';
import { DEFAULT_SETTINGS } from '../../lib/models';
import type { DataType, Exercise, TreeType } from '../../lib/tree/types';
import { TREE_TYPE_LABEL } from '../../lib/tree/types';
import { newActivityId, saveActivity } from '../../lib/db';
import { parseDataset, randomDataset } from '../../lib/tree/values';
import { buildExpected } from '../../lib/tree/generate';
import { computeProps, toFlat } from '../../lib/tree/analyze';
import { TreeCanvas } from '../tree/TreeCanvas';
import { LinearExerciseEditor } from './LinearExerciseEditor';
import { exerciseBadge, isLinearExercise, linearExerciseErrors, newLinearExercise } from '../../lib/linear/linear';
import { PageHeader, Toggle, cx } from '../ui';

interface Props {
  groups: Group[];
  activityToEdit?: Activity | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ActivityBuilder({ groups, activityToEdit, onSaved, onCancel }: Props) {
  const [groupId, setGroupId] = useState(
    activityToEdit?.groupId || (groups.length > 0 ? groups[0].id : '')
  );
  const [title, setTitle] = useState(activityToEdit?.title || '');
  const [description, setDescription] = useState(activityToEdit?.description || '');
  const [settings, setSettings] = useState<ActivitySettings>(
    activityToEdit?.settings || DEFAULT_SETTINGS
  );

  const [exercises, setExercises] = useState<Exercise[]>(
    activityToEdit?.exercises || [
      {
        id: 'ex1',
        title: 'Ejercicio 1',
        treeType: 'BST',
        dataType: 'NUMBER',
        dataset: ['50', '30', '70', '20', '40', '60', '80'],
      },
    ]
  );

  const [selectedExIndex, setSelectedExIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const activeEx = exercises[selectedExIndex] || exercises[0];

  // Cálculo en vivo del Árbol Canónico y sus Propiedades para la Vista Previa del Profesor
  const preview = useMemo(() => {
    if (!activeEx || isLinearExercise(activeEx)) return null;
    const root = buildExpected(activeEx.treeType, activeEx.dataset, activeEx.dataType);
    const flat = toFlat(root);
    const props = computeProps(root, settings.heightMode, settings.rootIsInternal);
    return { flat, props };
  }, [activeEx, settings.heightMode, settings.rootIsInternal]);

  const updateActiveEx = (patch: Partial<Exercise>) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === selectedExIndex ? { ...ex, ...patch } : ex))
    );
  };

  const handleAddExercise = (kind: 'TREE' | 'LINEAR' = 'TREE') => {
    const nextNum = exercises.length + 1;
    const id = `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEx: Exercise =
      kind === 'LINEAR'
        ? newLinearExercise(id, `Ejercicio ${nextNum}`)
        : {
            id,
            title: `Ejercicio ${nextNum}`,
            treeType: 'AVL',
            dataType: 'NUMBER',
            dataset: ['45', '20', '60', '10', '30', '25'],
          };
    setExercises((prev) => [...prev, newEx]);
    setSelectedExIndex(exercises.length);
  };

  const handleRemoveExercise = (idx: number) => {
    if (exercises.length <= 1) {
      alert('La actividad debe tener al menos un ejercicio.');
      return;
    }
    setExercises((prev) => prev.filter((_, i) => i !== idx));
    setSelectedExIndex((prev) => Math.max(0, prev - 1));
  };

  const handleRandomData = () => {
    const data = randomDataset({
      count: 7,
      dataType: activeEx.dataType,
      min: 10,
      max: 99,
      unique: true,
    });
    updateActiveEx({ dataset: data });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Por favor escribe un título para la actividad.');
      return;
    }
    if (!groupId) {
      alert('Por favor selecciona un grupo para asignar la actividad.');
      return;
    }
    const linearErrors = exercises.flatMap(linearExerciseErrors);
    if (linearErrors.length > 0) {
      alert('Corrige estos ejercicios antes de publicar:\n\n' + linearErrors.slice(0, 8).join('\n'));
      return;
    }

    setIsSaving(true);
    try {
      const payload: Activity = {
        id: activityToEdit?.id || newActivityId(),
        groupId,
        title: title.trim(),
        description: description.trim(),
        settings,
        exercises,
        createdAt: activityToEdit?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      await saveActivity(payload);
      onSaved();
    } catch (err) {
      alert('Error al guardar actividad: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={activityToEdit ? 'Editar Actividad' : 'Nueva Actividad'}
        subtitle="Configura ejercicios de árboles (por niveles, BST o AVL) o de estructuras lineales (lista, pila, cola) y revisa la solución esperada en tiempo real."
        actions={
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn-ghost">
              Cancelar
            </button>
            <button
              id="btn-save-activity"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary font-semibold"
            >
              {isSaving ? 'Guardando...' : 'Publicar Actividad'}
            </button>
          </div>
        }
      />

      {/* Datos Generales de la Actividad */}
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="act-title">
              Título de la Actividad
            </label>
            <input
              id="act-title"
              className="input"
              placeholder="Ej: Práctica 1: Árboles Binarios y AVL"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="act-group">
              Asignar al Grupo
            </label>
            <select
              id="act-group"
              className="input"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-ink-950">
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="act-desc">
            Instrucciones o Descripción (opcional)
          </label>
          <input
            id="act-desc"
            className="input"
            placeholder="Ej: Lee con atención y construye cada árbol siguiendo las reglas indicadas."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Criterios de Evaluación */}
        <div className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
          <div>
            <label className="label">Cálculo de Altura</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, heightMode: 'LEVELS' })}
                className={cx(
                  'btn-sm flex-1 border transition',
                  settings.heightMode === 'LEVELS'
                    ? 'border-mint-400/40 bg-mint-400/10 text-mint-300'
                    : 'border-white/5 bg-white/[0.02] text-slate-400'
                )}
              >
                Por Niveles (Raíz = 1)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, heightMode: 'EDGES' })}
                className={cx(
                  'btn-sm flex-1 border transition',
                  settings.heightMode === 'EDGES'
                    ? 'border-mint-400/40 bg-mint-400/10 text-mint-300'
                    : 'border-white/5 bg-white/[0.02] text-slate-400'
                )}
              >
                Por Aristas (Raíz = 0)
              </button>
            </div>
          </div>

          <div className="flex items-center pt-5">
            <Toggle
              id="toggle-root-internal"
              checked={settings.rootIsInternal}
              onChange={(checked) => setSettings({ ...settings, rootIsInternal: checked })}
              label="Raíz cuenta como nodo interno"
              hint="Si tiene al menos un hijo"
            />
          </div>

          <div className="flex items-center pt-5">
            <Toggle
              id="toggle-show-feedback"
              checked={settings.showFeedback}
              onChange={(checked) => setSettings({ ...settings, showFeedback: checked })}
              label="Mostrar retroalimentación"
              hint="El alumno ve su nota al evaluar"
            />
          </div>
        </div>

        {/* Intentos de Respuesta y Corrección */}
        <div className="border-t border-white/[0.06] pt-4">
          <label className="label" htmlFor="act-max-attempts">
            Oportunidades de Respuesta y Corrección (Intentos por ejercicio)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                id="act-max-attempts"
                type="number"
                min="0"
                max="99"
                className="input w-24 text-center font-mono font-bold"
                value={settings.maxAttempts ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  setSettings({ ...settings, maxAttempts: val });
                }}
              />
              <span className="text-xs text-slate-400 font-mono">
                {(settings.maxAttempts ?? 0) === 0
                  ? 'intentos (0 = infinitos)'
                  : (settings.maxAttempts ?? 0) === 1
                  ? 'intento'
                  : 'intentos'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, maxAttempts: 0 })}
                className={cx(
                  'btn-sm text-xs rounded-lg border transition',
                  (settings.maxAttempts ?? 0) === 0
                    ? 'border-mint-400/50 bg-mint-400/15 text-mint-300 font-semibold'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200'
                )}
              >
                0 (Ilimitados / Corregir)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, maxAttempts: 1 })}
                className={cx(
                  'btn-sm text-xs rounded-lg border transition',
                  settings.maxAttempts === 1
                    ? 'border-mint-400/50 bg-mint-400/15 text-mint-300 font-semibold'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200'
                )}
              >
                1 (Sin corrección)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, maxAttempts: 2 })}
                className={cx(
                  'btn-sm text-xs rounded-lg border transition',
                  settings.maxAttempts === 2
                    ? 'border-mint-400/50 bg-mint-400/15 text-mint-300 font-semibold'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200'
                )}
              >
                2 (1 corrección)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, maxAttempts: 3 })}
                className={cx(
                  'btn-sm text-xs rounded-lg border transition',
                  settings.maxAttempts === 3
                    ? 'border-mint-400/50 bg-mint-400/15 text-mint-300 font-semibold'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200'
                )}
              >
                3 intentos
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {(settings.maxAttempts ?? 0) === 0
              ? '💡 Los alumnos pueden verificar su respuesta, revisar aciertos y errores, y corregirla cuantas veces lo deseen.'
              : (settings.maxAttempts ?? 0) === 1
              ? '🔒 Solo 1 intento: al pulsar "Guardar y Evaluar", el ejercicio se califica definitivamente y el alumno no podrá corregirlo.'
              : `🎯 Los alumnos tienen un máximo de ${settings.maxAttempts} intentos para verificar y corregir cada ejercicio de esta actividad.`}
          </p>
        </div>
      </div>

      {/* Gestor de Ejercicios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Ejercicios de la Actividad</h3>
            <span className="text-xs text-slate-400">({exercises.length})</span>
          </div>
          <div className="flex gap-2">
            <button
              id="btn-add-tree-exercise"
              type="button"
              onClick={() => handleAddExercise('TREE')}
              className="btn-secondary btn-sm"
            >
              + 🌳 Ejercicio de árbol
            </button>
            <button
              id="btn-add-linear-exercise"
              type="button"
              onClick={() => handleAddExercise('LINEAR')}
              className="btn-secondary btn-sm"
            >
              + 📋 Lista / Pila / Cola
            </button>
          </div>
        </div>

        {/* Pestañas de Ejercicios */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {exercises.map((ex, idx) => (
            <div
              key={ex.id}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer',
                idx === selectedExIndex
                  ? 'border-mint-400/60 bg-mint-400/15 text-white'
                  : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200'
              )}
              onClick={() => setSelectedExIndex(idx)}
            >
              <span>{ex.title}</span>
              <span className="font-mono text-[10px] text-iris-300">[{exerciseBadge(ex)}]</span>
              {exercises.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveExercise(idx);
                  }}
                  className="ml-1 text-slate-500 hover:text-coral-400"
                  title="Eliminar este ejercicio"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Editor del Ejercicio Seleccionado + Vista Previa Canónica */}
        {isLinearExercise(activeEx) ? (
          <LinearExerciseEditor key={activeEx.id} exercise={activeEx} onChange={updateActiveEx} />
        ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuración del Ejercicio */}
          <div className="card space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Título del Ejercicio</label>
                <input
                  className="input"
                  value={activeEx.title}
                  onChange={(e) => updateActiveEx({ title: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Tipo de Árbol Requerido</label>
                <select
                  className="input"
                  value={activeEx.treeType}
                  onChange={(e) => updateActiveEx({ treeType: e.target.value as TreeType })}
                >
                  <option value="COMPLETE" className="bg-ink-950">
                    Binario Completo (por niveles)
                  </option>
                  <option value="BST" className="bg-ink-950">
                    Binario de Búsqueda (BST)
                  </option>
                  <option value="AVL" className="bg-ink-950">
                    Árbol AVL (auto-balanceado)
                  </option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label">Conjunto de Datos (en orden de inserción)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextType: DataType = activeEx.dataType === 'NUMBER' ? 'STRING' : 'NUMBER';
                      const sample =
                        nextType === 'NUMBER'
                          ? ['45', '20', '60', '10', '30', '25']
                          : ['M', 'D', 'Z', 'B', 'H', 'P'];
                      updateActiveEx({ dataType: nextType, dataset: sample });
                    }}
                    className="text-xs text-iris-300 hover:underline"
                  >
                    Cambiar a {activeEx.dataType === 'NUMBER' ? 'Letras' : 'Números'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomData}
                    className="text-xs text-mint-300 hover:underline"
                  >
                    🎲 Aleatorio
                  </button>
                </div>
              </div>

              <input
                className="input-mono text-sm"
                placeholder="Valores separados por coma o espacio (ej: 45, 20, 60, 10, 30, 25)"
                value={activeEx.dataset.join(', ')}
                onChange={(e) => {
                  const p = parseDataset(e.target.value, activeEx.dataType);
                  updateActiveEx({ dataset: p.values });
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Los alumnos deben insertar los datos manualmente uno a uno en este orden exacto.
              </p>
            </div>

            {/* Ficha Técnica Esperada */}
            {preview && (
              <div className="rounded-xl border border-white/[0.08] bg-ink-950/60 p-4 space-y-2 text-xs">
                <div className="font-semibold text-mint-300">
                  Valores que el Evaluador Oculto espera que el alumno responda:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-400">Raíz:</span>{' '}
                    <b className="font-mono text-white">{preview.props.root || '—'}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">Altura:</span>{' '}
                    <b className="font-mono text-white">{preview.props.height}</b>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Hojas:</span>{' '}
                    <span className="font-mono text-white">
                      {preview.props.leaves.join(', ') || '—'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Internos:</span>{' '}
                    <span className="font-mono text-white">
                      {preview.props.internals.join(', ') || 'ninguno (-)'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Preorden:</span>{' '}
                    <span className="font-mono text-iris-300">
                      {preview.props.preorder.join(', ')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Enorden:</span>{' '}
                    <span className="font-mono text-iris-300">
                      {preview.props.inorder.join(', ')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Postorden:</span>{' '}
                    <span className="font-mono text-iris-300">
                      {preview.props.postorder.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vista Previa del Árbol Canónico Esperado */}
          <div className="card flex flex-col justify-between overflow-hidden !p-0">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-300">
                Vista Previa del Árbol Canónico Esperado ({TREE_TYPE_LABEL[activeEx.treeType]})
              </span>
              <span className="rounded bg-mint-400/10 px-2 py-0.5 font-mono text-[11px] text-mint-400">
                {activeEx.dataset.length} nodos
              </span>
            </div>
            <div className="h-[360px] w-full">
              {preview && (
                <TreeCanvas
                  tree={preview.flat}
                  editable={false}
                  dataType={activeEx.dataType}
                  className="h-full w-full"
                  idPrefix="preview-canonical"
                />
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
