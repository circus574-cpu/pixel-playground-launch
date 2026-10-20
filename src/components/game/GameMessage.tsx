export function GameMessage({
  text,
  onDismiss,
  warning = false,
}: {
  text: string;
  onDismiss: () => void;
  warning?: boolean;
}) {
  return (
    <section
      className={"ki-game-message " + (warning ? "ki-save-warning" : "ki-game-feedback")}
      role={warning ? "alert" : "status"}
      aria-label={warning ? "Problem z zapisem" : "Komunikat gry"}
    >
      <p>{text}</p>
      <button
        type="button"
        aria-label={warning ? "Zamknij ostrzeżenie o zapisie" : "Zamknij komunikat"}
        onClick={onDismiss}
      >
        ×
      </button>
    </section>
  );
}
