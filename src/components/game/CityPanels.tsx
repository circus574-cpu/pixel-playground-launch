import { useState, type ReactNode } from "react";
import { ITEMS, ITEM_IDS, MATERIALS, type GameViewState, type Command } from "../../game/session";
import { WORLDS } from "../../game/world/worlds";
import type { CityDefinition } from "../../game/city/types";

type Send = (command: Command) => void;
export function CityDirectory({
  city,
  send,
  close,
}: {
  city: CityDefinition;
  send: Send;
  close: () => void;
}) {
  return (
    <section className="ki-city-directory" aria-label="Usługi miasta">
      <h3>{city.name} · dzielnice i budynki</h3>
      <p>Wybierz budynek. Postać przejdzie ulicami do wejścia i wejdzie do środka.</p>
      <div className="ki-city-services">
        {city.buildings.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              close();
              send({ type: "enter", building: b.id });
            }}
          >
            <small>{b.district}</small>
            <strong>
              {b.name} <span aria-hidden>↗</span>
            </strong>
            <span>{b.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function DepotPanel({
  state,
  send,
  feedback,
}: {
  state: GameViewState;
  send: Send;
  feedback?: ReactNode;
}) {
  const [quantity, setQuantity] = useState(1);
  const p = state.player;
  const materials = [...new Set([...Object.keys(p.materials), ...Object.keys(p.depot.materials)])];
  const row = (id: string) => {
    const item = ITEMS[id as keyof typeof ITEMS];
    const bag = item ? p.items[id as keyof typeof p.items] : (p.materials[id] ?? 0);
    const chest = item ? p.depot.items[id as keyof typeof p.items] : (p.depot.materials[id] ?? 0);
    const reserved = p.weapon === id || p.armor === id ? 1 : 0;
    return (
      <article
        className="ki-city-depot-row"
        key={id}
        aria-label={item?.name ?? MATERIALS[id]?.name ?? id}
      >
        <div>
          <strong>{item?.name ?? MATERIALS[id]?.name ?? id}</strong>
          <small>
            Plecak: {bag} · Skrzynia: {chest}
            {id === "sword" && p.depot.upgrade ? " · w skrzyni ostrze +1" : ""}
          </small>
        </div>
        <div className="ki-trade-actions">
          <button
            disabled={bag - reserved < quantity || chest + quantity > 99}
            onClick={() => send({ type: "depot", item: id, quantity, withdraw: false })}
          >
            Odłóż {quantity}
          </button>
          <button
            disabled={chest < quantity || bag + quantity > 99}
            onClick={() => send({ type: "depot", item: id, quantity, withdraw: true })}
          >
            Odbierz {quantity}
          </button>
        </div>
      </article>
    );
  };
  return (
    <div className="ki-modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Twoja skrzynia"
        className="ki-modal ki-frame ki-depot-panel"
      >
        <header>
          <h2>Twoja skrzynia · {p.name ?? "Wędrowiec"}</h2>
          <button
            autoFocus
            aria-label="Zamknij skrzynię"
            onClick={() => send({ type: "storage-close" })}
          >
            ×
          </button>
        </header>
        {feedback}
        <div className="ki-adventure-panel">
          <p>
            Depozyt tej postaci w {WORLDS[p.continent].settlement}. Przedmioty pozostają tutaj po
            odświeżeniu gry.
          </p>
          <label className="ki-depot-quantity">
            Liczba przedmiotów{" "}
            <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          {ITEM_IDS.map(row)}
          {materials.map(row)}
          <p className="ki-panel-caption">
            Stos do 99. Wyposażenie trzeba najpierw zdjąć. Skrzynia nie jest współdzielona między
            postaciami ani urządzeniami.
          </p>
        </div>
      </section>
    </div>
  );
}
