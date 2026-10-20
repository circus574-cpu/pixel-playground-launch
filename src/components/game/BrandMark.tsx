import "./brand.css";
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={"ki-brand " + (compact ? "ki-brand-compact" : "")}
      role="img"
      aria-label="KI LEGENDS"
    >
      <svg viewBox="0 0 72 72" aria-hidden="true" fill="none">
        <path d="M36 3L65 36 36 69 7 36Z" stroke="currentColor" opacity=".35" />
        <path d="M36 12L56 36 36 60 16 36Z" stroke="currentColor" />
        <path d="M36 20L44 35 36 49 28 35Z" fill="currentColor" />
        <path
          d="M36 0V9M36 63V72M0 36H11M61 36H72M18 18L24 24M48 48L54 54M54 18L48 24M24 48L18 54"
          stroke="currentColor"
        />
        <path d="M20 44Q14 32 23 25M52 44Q58 32 49 25" stroke="currentColor" opacity=".5" />
      </svg>
      <span aria-hidden="true">
        <strong>
          KI <span>LEGENDS</span>
        </strong>
        {!compact && <small>CZTERY ŚWIATY. JEDNA LEGENDA.</small>}
      </span>
    </div>
  );
}
