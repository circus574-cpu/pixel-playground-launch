import { HeritageWeaponCard } from "./HeritageWeaponCard";
import { useState, type ReactNode } from "react";
import { ITEMS, ITEM_IDS, MATERIALS, type GameViewState, type Command } from "../../game/session";
import { getItemById } from "../../game/items";
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
  const [goldAmount, setGoldAmount] = useState<number>(10);
  const p = state.player;
  const depotGold = p.depot.gold ?? 0;

  const materials = [...new Set([...Object.keys(p.materials), ...Object.keys(p.depot.materials)])];
  const customItems = [
    ...new Set([...Object.keys(p.bagItems ?? {}), ...Object.keys(p.depot.bagItems ?? {})]),
  ];

  const row = (id: string) => {
    const item = ITEMS[id as keyof typeof ITEMS];
    const catItem = getItemById(id);
    const isMaterial = id in MATERIALS;
    const bag = item
      ? p.items[id as keyof typeof p.items]
      : isMaterial
        ? (p.materials[id] ?? 0)
        : (p.bagItems?.[id] ?? 0);
    const chest = item
      ? p.depot.items[id as keyof typeof p.items]
      : isMaterial
        ? (p.depot.materials[id] ?? 0)
        : (p.depot.bagItems?.[id] ?? 0);
    const isEquipped =
      p.weapon === id ||
      p.armor === id ||
      Object.values(p.equipment ?? {}).includes(id);
    const reserved = item && (p.weapon === id || p.armor === id) ? 1 : 0;
    const name = item?.name ?? catItem?.name ?? MATERIALS[id]?.name ?? id;

    let subtext = `Plecak: ${bag} · Skrzynia: ${chest}`;
    if (id === "sword" && p.depot.upgrade) subtext += " · w skrzyni ostrze +1";
    if (catItem) {
      const infoParts: string[] = [];
      if (catItem.stats?.atkBonus) infoParts.push(`+${catItem.stats.atkBonus} ataku`);
      if (catItem.stats?.defBonus) infoParts.push(`+${catItem.stats.defBonus} obrony`);
      if (catItem.stats?.hpBonus) infoParts.push(`+${catItem.stats.hpBonus} HP`);
      if (catItem.slot) infoParts.push(`[${catItem.slot}]`);
      if (infoParts.length > 0) subtext += ` · (${infoParts.join(" ")})`;
    }

    return (
      <article
        className="ki-city-depot-row"
        key={id}
        aria-label={name}
      >
        <div>
          <strong>{name}</strong>
          <small>{subtext}</small>
        </div>
        <div className="ki-trade-actions">
          <button
            disabled={
              bag - reserved < quantity ||
              chest + quantity > 99 ||
              (!item && !isMaterial && isEquipped && bag <= quantity)
            }
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
          <h2>Twoja skrzynia i skarbiec · {p.name ?? "Wędrowiec"}</h2>
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
          <HeritageWeaponCard state={state} send={send} depot />
          <p>
            Depozyt tej postaci w {WORLDS[p.continent].settlement}. Pieniądze i przedmioty pozostają
            tutaj bezpieczne po odświeżeniu gry.
          </p>

          <fieldset
            style={{
              background: "#162b25",
              border: "1px solid #4a6857",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
            }}
          >
            <legend style={{ color: "#f4e3b0", fontWeight: "bold", padding: "0 6px" }}>
              Skarbiec miejski (Złoto)
            </legend>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontSize: "14px",
              }}
            >
              <span>
                Sakiewka: <b style={{ color: "#ffd700" }}>{p.gold}</b> monet
              </span>
              <span>
                W skarbcu: <b style={{ color: "#ffd700" }}>{depotGold}</b> monet
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                min={1}
                max={Math.max(p.gold, depotGold, 1)}
                value={goldAmount}
                onChange={(e) => setGoldAmount(Math.max(1, Number(e.target.value) || 0))}
                style={{
                  width: "90px",
                  background: "#0f201b",
                  border: "1px solid #4a6857",
                  color: "#f4e3b0",
                  padding: "6px 8px",
                  borderRadius: "4px",
                }}
              />
              <button
                type="button"
                disabled={p.gold < goldAmount || goldAmount <= 0}
                onClick={() => send({ type: "depot-gold", amount: goldAmount, withdraw: false })}
                style={{
                  background: "#244c3c",
                  color: "#f4e3b0",
                  border: "1px solid #7d9a75",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: p.gold >= goldAmount ? "pointer" : "not-allowed",
                }}
              >
                Wpłać {goldAmount}
              </button>
              <button
                type="button"
                disabled={p.gold <= 0}
                onClick={() => send({ type: "depot-gold", amount: p.gold, withdraw: false })}
                style={{
                  background: "#1d3b32",
                  color: "#d4b870",
                  border: "1px solid #5d7a65",
                  padding: "6px 10px",
                  borderRadius: "4px",
                }}
              >
                Wpłać wszystko
              </button>
              <button
                type="button"
                disabled={depotGold < goldAmount || goldAmount <= 0}
                onClick={() => send({ type: "depot-gold", amount: goldAmount, withdraw: true })}
                style={{
                  background: "#244c3c",
                  color: "#f4e3b0",
                  border: "1px solid #7d9a75",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: depotGold >= goldAmount ? "pointer" : "not-allowed",
                }}
              >
                Wypłać {goldAmount}
              </button>
              <button
                type="button"
                disabled={depotGold <= 0}
                onClick={() => send({ type: "depot-gold", amount: depotGold, withdraw: true })}
                style={{
                  background: "#1d3b32",
                  color: "#d4b870",
                  border: "1px solid #5d7a65",
                  padding: "6px 10px",
                  borderRadius: "4px",
                }}
              >
                Wypłać wszystko
              </button>
            </div>
          </fieldset>

          <label className="ki-depot-quantity">
            Liczba przedmiotów do transferu{" "}
            <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          {ITEM_IDS.map(row)}
          {customItems.map(row)}
          {materials.map(row)}
          <p className="ki-panel-caption">
            Stos do 99. Założone wyposażenie należy najpierw zdjąć. Skrzynia i skarbiec są przypisane
            do tej postaci w bieżącej osadzie.
          </p>
        </div>
      </section>
    </div>
  );
}
