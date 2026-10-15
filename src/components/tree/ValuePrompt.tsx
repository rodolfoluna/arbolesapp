import { useEffect, useRef, useState } from 'react';
import { Modal, cx } from '../ui';
import type { DataType } from '../../lib/tree/types';
import { isValidValue, normalizeValue, valueKey } from '../../lib/tree/values';

/** Diálogo para capturar el dato de un nodo. Ofrece los datos del ejercicio como chips. */
export function ValuePrompt({
  open,
  title,
  initial = '',
  dataType,
  dataset = [],
  usedValues = [],
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial?: string;
  dataType: DataType;
  dataset?: string[];
  usedValues?: string[];
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initial);
      setTouched(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, initial]);

  const valid = isValidValue(value, dataType);
  const submit = (v = value) => {
    setTouched(true);
    if (!isValidValue(v, dataType)) return;
    onSubmit(normalizeValue(v, dataType));
  };

  // Cuenta cuántas veces se usa cada valor para marcar los chips ya colocados.
  const usedCount = new Map<string, number>();
  usedValues.forEach((v) => usedCount.set(valueKey(v, dataType), (usedCount.get(valueKey(v, dataType)) ?? 0) + 1));
  const seen = new Map<string, number>();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button id="value-prompt-ok" className="btn-primary" onClick={() => submit()} disabled={!value.trim()}>
            Aceptar
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="label" htmlFor="node-value-input">
          Dato del nodo
        </label>
        <input
          id="node-value-input"
          ref={inputRef}
          className="input-mono text-center text-2xl"
          inputMode={dataType === 'NUMBER' ? 'decimal' : 'text'}
          autoComplete="off"
          autoCapitalize="characters"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={dataType === 'NUMBER' ? 'p. ej. 45' : 'p. ej. M'}
        />
        {touched && !valid && (
          <p className="mt-2 text-xs text-coral-400">
            {dataType === 'NUMBER' ? 'Escribe un número válido (sin espacios).' : 'Escribe un valor sin espacios ni comas.'}
          </p>
        )}
      </form>
      {dataset.length > 0 && (
        <div className="mt-4">
          <div className="label">Datos del ejercicio (toca para usar)</div>
          <div className="flex flex-wrap gap-1.5">
            {dataset.map((d, i) => {
              const k = valueKey(d, dataType);
              const n = (seen.get(k) ?? 0) + 1;
              seen.set(k, n);
              const used = n <= (usedCount.get(k) ?? 0);
              return (
                <button
                  key={i}
                  type="button"
                  className={cx(used ? 'chip-off' : 'chip-on', 'cursor-pointer')}
                  onClick={() => submit(d)}
                  title={used ? 'Ya está en tu árbol' : 'Usar este dato'}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
