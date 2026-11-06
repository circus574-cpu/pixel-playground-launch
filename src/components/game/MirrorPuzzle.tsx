import { useState } from "react";
import { traceMirrors, type MirrorBoard } from "../../game/development/trials/mirrors";

export function MirrorPuzzle({
  board,
  submit,
}: {
  board: MirrorBoard;
  submit: (answer: string) => void;
}) {
  const [orientations, setOrientations] = useState(() => board.mirrors.map(() => "/"));
  const trace = traceMirrors(board, orientations.join(","));
  const at = (n: number) => 40 + n * 40;
  const labels = {
    receiver: "odbiornik",
    protected: "chroniony punkt — zmień trasę",
    outside: "poza planszą",
    loop: "pętla",
    invalid: "nieprawidłowy układ",
  };
  return (
    <fieldset>
      <legend>Zwierciadła — jawny podgląd trasy</legend>
      <svg
        role="img"
        aria-label="Układ zwierciadeł i promienia"
        viewBox="0 0 360 360"
        width="320"
        height="320"
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        <rect x="15" y="15" width="330" height="330" rx="12" fill="#0b1f29" />
        {Array.from({ length: board.size }, (_, i) => (
          <g key={i} stroke="#35505c" strokeWidth="1">
            <line x1={at(i)} y1="40" x2={at(i)} y2="320" />
            <line x1="40" y1={at(i)} x2="320" y2={at(i)} />
          </g>
        ))}
        <polyline
          points={trace.path.map((p) => `${at(p.x)},${at(p.y)}`).join(" ")}
          fill="none"
          stroke={trace.outcome === "protected" ? "#ff817e" : "#72efff"}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {[
          { ...board.source, label: "Ź", color: "#72efff" },
          { ...board.receiver, label: "O", color: "#95efaa" },
          { ...board.protected, label: "!", color: "#ff817e" },
        ].map((p) => (
          <g key={p.label}>
            <circle
              cx={at(p.x)}
              cy={at(p.y)}
              r="16"
              fill="#102a35"
              stroke={p.color}
              strokeWidth="3"
            />
            <text x={at(p.x)} y={at(p.y) + 5} textAnchor="middle" fill={p.color} fontSize="18">
              {p.label}
            </text>
          </g>
        ))}
        {board.mirrors.map((p, i) => (
          <g key={i}>
            <line
              x1={at(p.x) - 12}
              y1={at(p.y) + (orientations[i] === "/" ? 12 : -12)}
              x2={at(p.x) + 12}
              y2={at(p.y) + (orientations[i] === "/" ? -12 : 12)}
              stroke="#ffe0a2"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <text x={at(p.x) + 19} y={at(p.y) - 15} fill="#ffe0a2" fontSize="16">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <p aria-live="polite">
        Podgląd: {labels[trace.outcome]}. Ź — źródło, O — odbiornik, ! — chroniony punkt.
      </p>
      <div className="ki-development-tabs">
        {orientations.map((orientation, i) => (
          <button
            key={i}
            aria-label={`Obróć zwierciadło ${i + 1}`}
            onClick={() =>
              setOrientations((old) => old.map((v, n) => (n === i ? (v === "/" ? "\\" : "/") : v)))
            }
          >
            {i + 1}: {orientation}
          </button>
        ))}
        <button onClick={() => submit(orientations.join(","))}>Uruchom promień</button>
      </div>
    </fieldset>
  );
}
