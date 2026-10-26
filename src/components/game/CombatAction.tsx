import { useEffect, useRef, type ButtonHTMLAttributes, type PointerEvent } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onActivate: () => void;
};

/** One action per press. The existing session owns costs, cooldowns and damage. */
export function CombatAction({ onActivate, ...props }: Props) {
  const pointer = useRef<number | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (props.disabled && pointer.current !== null) {
      const id = pointer.current;
      pointer.current = null;
      if (button.current?.hasPointerCapture(id)) button.current.releasePointerCapture(id);
    }
  }, [props.disabled]);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <button
      {...props}
      ref={button}
      onPointerDown={(event) => {
        if (props.disabled || pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        onActivate();
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) event.stopPropagation();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        pointer.current = null;
      }}
      onClick={(event) => {
        // Keyboard/assistive activation has no preceding physical pointer press.
        if (event.detail === 0) onActivate();
        event.currentTarget.blur();
      }}
    />
  );
}
