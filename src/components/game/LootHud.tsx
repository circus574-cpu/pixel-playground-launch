import { useEffect, useRef, useState } from "react";
import type { LootReceipt } from "../../game/session";
import { getItemIconName } from "./DiabloInventory";
import { lootHudDuration } from "./lootHudTiming";
import "./loot-hud.css";

function LootIcon({ item }: { item: string }) {
  return (
    <img
      className="ki-loot-icon"
      src={`/game/items/${item}.webp`}
      alt=""
      aria-hidden
      onError={(e) => {
        const fallback = `/game/icons-v2/${getItemIconName(item)}.webp`;
        if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback;
      }}
    />
  );
}

/**
 * Mały panel „co wypadło” po otwarciu łupu: ikona, nazwa w kolorze rzadkości i ilość, w jednym pionowym spisie
 * obok bohatera. Nie ma tła ani ramki; po kilku sekundach gaśnie sam. Pozycje, na które zabrakło miejsca w plecaku,
 * są przekreślone i opisane, bo zostają w łupie.
 */
export function LootHud({ receipt }: { receipt: LootReceipt | null }) {
  // Łup otwarty przed zamontowaniem panelu (np. po odświeżeniu widoku) nie wyskakuje ponownie.
  const seen = useRef(receipt?.id ?? 0);
  const timer = useRef<number | undefined>(undefined);
  const [shown, setShown] = useState<LootReceipt | null>(null);
  const id = receipt?.id ?? 0;
  useEffect(() => {
    if (!receipt || id === seen.current) return;
    seen.current = id;
    setShown(receipt);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setShown((cur) => (cur?.id === id ? null : cur)),
      lootHudDuration(receipt.lines.length, receipt.gold > 0),
    );
    // Odpowiada tylko numer otwarcia: ten sam łup w kolejnych migawkach nie zaczyna odliczania od nowa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!shown) return null;
  const ms = lootHudDuration(shown.lines.length, shown.gold > 0);
  const summary = [
    ...shown.lines.map((l) => l.name + " ×" + l.quantity + (l.kept ? "" : " (brak miejsca)")),
    ...(shown.gold > 0 ? [shown.gold + " monet"] : []),
  ].join(", ");
  return (
    <section
      key={shown.id}
      className="ki-loot"
      role="status"
      aria-label={"Łup: " + summary}
      style={{ ["--ki-loot-ms" as string]: ms + "ms" }}
    >
      <h3 aria-hidden>Łup</h3>
      <ul aria-hidden>
        {shown.lines.map((l, i) => (
          <li
            key={i}
            className={"ki-loot-line" + (l.kept ? "" : " is-left")}
            data-rarity={l.rarity ?? "common"}
            style={{ animationDelay: i * 130 + "ms" }}
          >
            <LootIcon item={l.item} />
            <span className="ki-loot-name">{l.name}</span>
            <b>×{l.quantity}</b>
            {!l.kept && <em>brak miejsca</em>}
          </li>
        ))}
        {shown.gold > 0 && (
          <li
            className="ki-loot-line ki-loot-gold"
            style={{ animationDelay: shown.lines.length * 130 + "ms" }}
          >
            <span className="ki-loot-coin" aria-hidden />
            <span className="ki-loot-name">Monety</span>
            <b>+{shown.gold}</b>
          </li>
        )}
      </ul>
    </section>
  );
}
