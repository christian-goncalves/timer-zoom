import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type TimeUnit = 'hours' | 'minutes' | 'seconds';

type TimeUnitControlProps = {
  unit: TimeUnit;
  label: string;
  value: string;
  editable: boolean;
  selected: boolean;
  showLabel?: boolean;
  onSelect: (unit: TimeUnit) => void;
  onAdjust: (unit: TimeUnit, direction: -1 | 1) => void;
  onSetValue: (unit: TimeUnit, value: number) => void;
};

function Chevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {direction === 'up' ? <path d="m7 14 5-5 5 5" /> : <path d="m7 10 5 5 5-5" />}
    </svg>
  );
}

export function TimeUnitControl({ unit, label, value, editable, selected, showLabel = true, onSelect, onAdjust, onSetValue }: TimeUnitControlProps) {
  const [hovered, setHovered] = useState(false);
  const digitBuffer = useRef('');
  const digitBufferTimeout = useRef<number | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      digitBuffer.current = '';
      onAdjust(unit, event.key === 'ArrowUp' ? 1 : -1);
      return;
    }

    if (!/^\d$/.test(event.key)) return;
    event.preventDefault();
    onSelect(unit);

    const digits = `${digitBuffer.current}${event.key}`.slice(-2);
    digitBuffer.current = digits;
    onSetValue(unit, Number(digits));

    if (digitBufferTimeout.current !== null) window.clearTimeout(digitBufferTimeout.current);
    if (digits.length === 2) {
      digitBuffer.current = '';
      digitBufferTimeout.current = null;
    } else {
      digitBufferTimeout.current = window.setTimeout(() => {
        digitBuffer.current = '';
        digitBufferTimeout.current = null;
      }, 2_000);
    }
  }

  return (
    <div
      className={`time-unit-column ${editable ? 'time-unit-editable' : ''} ${selected ? 'time-unit-selected' : ''} ${hovered ? 'time-unit-hovered' : ''}`}
      onPointerEnter={(event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={(event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse') setHovered(false);
      }}
    >
      {editable ? (
        <>
          <button
            className="time-stepper time-stepper-up"
            type="button"
            aria-label={`Aumentar ${label}`}
            tabIndex={0}
            onClick={() => onAdjust(unit, 1)}
          >
            <Chevron direction="up" />
          </button>
          <button
            className="time-unit-value"
            type="button"
            aria-label={`Selecionar ${label}: ${value}`}
            aria-pressed={selected}
            onPointerDown={(event) => {
              if (event.pointerType !== 'mouse') onSelect(unit);
            }}
            onFocus={() => onSelect(unit)}
            onTouchStart={() => onSelect(unit)}
            onKeyDown={handleKeyDown}
          >
            {value}
          </button>
          <button
            className="time-stepper time-stepper-down"
            type="button"
            aria-label={`Diminuir ${label}`}
            tabIndex={0}
            onClick={() => onAdjust(unit, -1)}
          >
            <Chevron direction="down" />
          </button>
          {showLabel ? <span className="time-unit-label">{label}</span> : null}
        </>
      ) : (
        <span className="time-unit-value" aria-label={`${label}: ${value}`}>{value}</span>
      )}
    </div>
  );
}
