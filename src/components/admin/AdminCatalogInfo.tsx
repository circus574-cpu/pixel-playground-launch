import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { catalog, monsterVisual } from "@/game/assets/catalog";
import { getItemById } from "@/game/items";
import { PASSIVE_BUFF_SET_BONUSES } from "@/game/items/catalog";
import { itemBonuses, itemSourceGroups, monsterDrops, percent } from "@/game/admin/contentCatalog";
import { monsterDef } from "@/game/monsters/catalog";
import { MATERIALS } from "@/game/monsters/materials";
import { ITEMS, type ItemId } from "@/game/session";
import { WORLDS } from "@/game/world/worlds";
import "./admin-catalog.css";

type Rect = { x: number; y: number; w: number; h: number };
type Atlas = {
  frames: Record<string, { frame: Rect; rotated?: boolean }>;
  meta: { size: { w: number; h: number } };
};
const atlases = new Map<string, Promise<Atlas>>();
function atlas(url: string) {
  let pending = atlases.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => {
      if (!r.ok) throw Error("Atlas unavailable");
      return r.json() as Promise<Atlas>;
    });
    atlases.set(url, pending);
    pending.catch(() => atlases.delete(url));
  }
  return pending;
}

/** One actual idle frame, no Phaser instance or animation loop. Atlases load only in view. */
export function MonsterThumbnail({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{
    url: string;
    rect: Rect;
    width: number;
    height: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false,
      started = false;
    setPreview(null);
    setFailed(false);
    const load = async () => {
      if (started) return;
      started = true;
      try {
        const actor = monsterVisual(id),
          clip = actor.clips.idle!;
        const frame = clip.directions.down?.[0] ?? Object.values(clip.directions)[0]?.[0];
        const asset = catalog.assets.get(clip.asset);
        if (!asset) throw Error("Missing texture");
        let rect: Rect,
          width = asset.width ?? 1,
          height = asset.height ?? 1;
        if (asset.atlasUrl) {
          const data = await atlas(asset.atlasUrl);
          const f = data.frames[String(frame)];
          if (!f || f.rotated) throw Error("Missing frame");
          rect = f.frame;
          width = data.meta.size.w;
          height = data.meta.size.h;
        } else {
          const crop = asset.crops?.find((c) => c.name === frame);
          if (crop) rect = { x: crop.x, y: crop.y, w: crop.width, h: crop.height };
          else if (asset.frameWidth && asset.frameHeight) {
            const columns = asset.grid?.columns ?? Math.floor(width / asset.frameWidth);
            rect = {
              x: (Number(frame) % columns) * asset.frameWidth,
              y: Math.floor(Number(frame) / columns) * asset.frameHeight,
              w: asset.frameWidth,
              h: asset.frameHeight,
            };
          } else rect = { x: 0, y: 0, w: width, h: height };
        }
        if (!cancelled) setPreview({ url: asset.url, rect, width, height });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void load();
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [id]);
  return (
    <div
      ref={ref}
      className="ki-catalog-thumbnail"
      role="img"
      aria-label={`Grafika: ${monsterDef(id).name}`}
    >
      {preview ? (
        <svg viewBox={`0 0 ${preview.rect.w} ${preview.rect.h}`} aria-hidden>
          <image
            href={preview.url}
            x={-preview.rect.x}
            y={-preview.rect.y}
            width={preview.width}
            height={preview.height}
            onError={() => {
              setPreview(null);
              setFailed(true);
            }}
          />
        </svg>
      ) : (
        <small>{failed ? "Brak podglądu" : "Wczytywanie…"}</small>
      )}
    </div>
  );
}

const RARITY_NAMES: Record<string, string> = {
  common: "Pospolity",
  uncommon: "Niezwykły",
  rare: "Rzadki",
  epic: "Epicki",
  legendary: "Legendarny",
  mythic: "Mityczny",
};

const CATEGORY_NAMES: Record<string, string> = {
  weapon: "Broń",
  armor: "Zbroja / Pancerz",
  chest: "Pancerz korpusu",
  helmet: "Hełm / Nakrycie głowy",
  boots: "Buty / Obuwie",
  gloves: "Rękawice",
  legs: "Spodnie / Nagolenniki",
  ring: "Pierścień",
  amulet: "Amulet / Naszyjnik",
  consumable: "Przedmiot użytkowy",
  potion: "Mikstura",
  tool: "Narzędzie",
  material: "Materiał rzemieślniczy",
  quest: "Przedmiot zadaniowy",
  key: "Klucz / Dostęp",
  "boss-artifact": "Artefakt bossa",
};

/**
 * Rich Item Hover Tooltip explaining exactly what an item gives (stats, passives, effects, value, sources).
 */
/** Click or tap an item anywhere in the admin panel to open its details in a centred window. */
export function ItemHoverTooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        className="ki-item-tooltip-anchor"
        role="button"
        tabIndex={0}
        title="Kliknij, aby zobaczyć szczegóły przedmiotu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </span>
      {open && <ItemDetailsModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ItemDetailsModal({ id, onClose }: { id: string; onClose: () => void }) {
  const item = getItemById(id);
  const runtimeItem = id in ITEMS ? ITEMS[id as ItemId] : undefined;
  const material = id in MATERIALS ? MATERIALS[id] : undefined;
  const name = item?.name ?? runtimeItem?.name ?? material?.name ?? id;
  const category = item?.category ?? runtimeItem?.type ?? (material ? "material" : "Inne");
  const rarity = item?.rarity ?? (material ? "uncommon" : "common");
  const runtimeStats: string[] = [];
  if (runtimeItem?.attack) runtimeStats.push(`Atak: +${runtimeItem.attack}`);
  if (runtimeItem?.defense) runtimeStats.push(`Obrona: +${runtimeItem.defense}`);
  if (material) runtimeStats.push(`Poziom materiału: ${material.level}`);
  const bonuses = itemBonuses(item?.stats);
  const stats = bonuses.length > 0 ? bonuses : runtimeStats;
  const groups = itemSourceGroups(id);
  const price = (item?.price ?? runtimeItem?.price) || undefined;
  const sell = (runtimeItem?.sell ?? material?.sell) || undefined;
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="ki-item-modal-backdrop"
      onClick={onClose}
      role="presentation"
      data-testid="item-modal-backdrop"
    >
      <div
        className={`ki-item-modal ki-rarity-${rarity}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Szczegóły przedmiotu: ${name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ki-item-modal-head">
          <div className={`ki-item-modal-icon ki-border-${rarity}`}>
            {!iconFailed ? (
              <img
                src={item?.iconUrl ?? `/game/items/${encodeURIComponent(id)}.webp`}
                alt=""
                onError={() => setIconFailed(true)}
              />
            ) : (
              <small>Brak ikony</small>
            )}
          </div>
          <div className="ki-item-modal-title">
            <strong className={`ki-text-${rarity}`}>{name}</strong>
            <div className="ki-tooltip-tags">
              <span className={`ki-tag-rarity ki-bg-${rarity}`}>
                {RARITY_NAMES[rarity] ?? rarity}
              </span>
              <span className="ki-tag-category">{CATEGORY_NAMES[category] ?? category}</span>
              {item?.level != null && <span className="ki-tag-level">Wym. poz. {item.level}</span>}
            </div>
            <small className="ki-tooltip-id">ID: {id}</small>
          </div>
          <button className="ki-item-modal-close" onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        </header>

        <div className="ki-item-modal-body">
          {item?.description && <p className="ki-item-modal-desc">{item.description}</p>}

          <h4>Co daje</h4>
          {stats.length > 0 ? (
            <div className="ki-tooltip-stats-grid">
              {stats.map((b) => (
                <div key={b} className="ki-tooltip-stat-pill">
                  <span className="ki-stat-bullet">✦</span> {b}
                </div>
              ))}
            </div>
          ) : (
            <p className="ki-tooltip-no-stats">Bez bezpośrednich premii liczbowych.</p>
          )}
          {item?.buff && (
            <p className="ki-tooltip-buff">
              <strong>Efekt pasywny:</strong>{" "}
              {itemBonuses({ [item.buff.effect]: item.buff.value }).join(" · ")} — działa po
              założeniu.
            </p>
          )}
          {item?.effectDescription && (
            <p className="ki-tooltip-effect">
              <strong>Działanie:</strong> {item.effectDescription}
            </p>
          )}
          {item?.setId && (
            <div className="ki-tooltip-set">
              <strong>Zestaw {item.setId}</strong>
              <ul>
                {(PASSIVE_BUFF_SET_BONUSES[item.setId] ?? []).map((rule) => (
                  <li key={rule.requiredPieces}>
                    {rule.requiredPieces} części:{" "}
                    {itemBonuses({ [rule.effect]: rule.value }).join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(price !== undefined || sell !== undefined) && (
            <p className="ki-tooltip-prices">
              {price !== undefined && (
                <span>
                  Cena: <b>{price}</b> monet
                </span>
              )}
              {sell !== undefined && (
                <span>
                  Sprzedaż: <b>{sell}</b> monet
                </span>
              )}
            </p>
          )}

          <h4>Skąd zdobyć</h4>
          {groups.shop !== null && <p>Kupiec w osadzie: {groups.shop} monet (bez losowania).</p>}
          {groups.drops.length > 0 && (
            <div className="ki-table-scroll">
              <table className="ki-admin-table ki-compact-table">
                <thead>
                  <tr>
                    <th>Potwór</th>
                    <th>Kraina</th>
                    <th>Poz.</th>
                    <th>Szansa</th>
                    <th>Rodzaj</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.drops.map((d) => (
                    <tr key={d.monster + d.random}>
                      <td>{d.monster}</td>
                      <td>{d.world}</td>
                      <td>{d.level}</td>
                      <td>{percent(d.chance)}</td>
                      <td>{d.random ? "losowy" : "stały łup"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {groups.bosses.map((b) => (
            <p key={b.boss}>
              Boss {b.boss} ({b.location}): {b.chancePercent}%, {b.min}–{b.max} szt.
            </p>
          ))}
          {groups.recipes.map((r) => (
            <p key={r.name}>
              Receptura „{r.name}” ({r.station}, poz. {r.level}, {r.coins} monet): {r.ingredients}
            </p>
          ))}
          {groups.quests.map((q) => (
            <p key={q.title}>
              Zadanie „{q.title}”: nagroda ×{q.count}
            </p>
          ))}
          {groups.shop === null &&
            !groups.drops.length &&
            !groups.bosses.length &&
            !groups.recipes.length &&
            !groups.quests.length && <p>Brak źródła w tabelach dropu, zadań i receptur.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ItemCatalogInfo({ id }: { id: string }) {
  const item = getItemById(id),
    groups = itemSourceGroups(id),
    bonuses = itemBonuses(item?.stats);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const randomDrops = groups.drops.filter((d) => d.random).length;
  const fixedDrops = groups.drops.length - randomDrops;
  const summary = [
    groups.shop !== null ? "kupiec" : "",
    randomDrops ? `losowy drop: ${randomDrops} potw.` : "",
    fixedDrops ? `stały łup: ${fixedDrops} potw.` : "",
    groups.bosses.length ? `bossowie: ${groups.bosses.length}` : "",
    groups.recipes.length ? `receptury: ${groups.recipes.length}` : "",
    groups.quests.length ? `zadania: ${groups.quests.length}` : "",
  ].filter(Boolean);

  return (
    <div className="ki-catalog-info">
      <button
        type="button"
        className="ki-catalog-item-wrapper"
        onClick={() => setOpen(true)}
        aria-label={`Szczegóły: ${item?.name ?? id}`}
      >
        {!failed ? (
          <img
            className="ki-catalog-item ki-catalog-item-interactive"
            loading="lazy"
            src={item?.iconUrl ?? `/game/items/${encodeURIComponent(id)}.webp`}
            alt=""
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="ki-catalog-item ki-catalog-item-placeholder">
            <small>Brak ikony</small>
          </div>
        )}
      </button>
      {bonuses.length > 0 && <p className="ki-bonuses-preview">{bonuses.join(" · ")}</p>}
      <p className="ki-sources-summary">
        <strong>Źródła:</strong> {summary.length ? summary.join(" · ") : "brak"}
      </p>
      <button type="button" className="ki-details-button" onClick={() => setOpen(true)}>
        Szczegóły
      </button>
      {open && <ItemDetailsModal id={id} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function MonsterCatalogInfo({
  id,
  names,
  lootChances,
  onLootChanceChange,
}: {
  id: string;
  names?: string[] | undefined;
  lootChances?: Record<string, number> | undefined;
  onLootChanceChange?: ((itemKey: string, newChancePercent: number) => void) | undefined;
}) {
  const m = monsterDef(id);
  const drops = monsterDrops(id, names);

  return (
    <div className="ki-catalog-info">
      <p>
        {WORLDS[m.world].name} · {m.xp} XP · złoto {m.gold[0]}–{m.gold[1]} · odrodzenie{" "}
        {m.respawn / 1000} s
      </p>
      <strong>Łupy — szanse i edycja procentu dropu</strong>
      <ul className="ki-loot-drops-list">
        {drops.map((d, i) => {
          // If custom chance override is present
          const customFraction =
            lootChances?.[d.name] ?? lootChances?.[d.id] ?? lootChances?.[String(i)];
          const currentFraction = customFraction !== undefined ? customFraction : d.chance;
          const currentPercent = Math.round(currentFraction * 1000) / 10;

          return (
            <li key={`${d.id}-${i}`} className="ki-loot-drop-item">
              <div className="ki-loot-info-row">
                <ItemHoverTooltip id={d.id}>
                  <span className="ki-loot-name-hoverable">
                    <b>{d.name}</b> ({d.id})
                  </span>
                </ItemHoverTooltip>
                <span className="ki-loot-chance-tag">{percent(currentFraction)}</span>
              </div>

              {onLootChanceChange ? (
                <div className="ki-loot-chance-editor">
                  <label className="ki-loot-input-label">
                    <span>Szansa:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="ki-loot-chance-input"
                      value={currentPercent}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        onLootChanceChange(d.name, val);
                      }}
                    />
                    <span>%</span>
                  </label>
                  <div className="ki-loot-quick-buttons">
                    <button
                      type="button"
                      className="ki-loot-quick-btn"
                      onClick={() => onLootChanceChange(d.name, Math.max(0, currentPercent - 10))}
                    >
                      -10%
                    </button>
                    <button
                      type="button"
                      className="ki-loot-quick-btn"
                      onClick={() => onLootChanceChange(d.name, Math.min(100, currentPercent + 10))}
                    >
                      +10%
                    </button>
                    <button
                      type="button"
                      className="ki-loot-quick-btn"
                      onClick={() => onLootChanceChange(d.name, 100)}
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      className="ki-loot-quick-btn"
                      onClick={() => onLootChanceChange(d.name, 0)}
                    >
                      0%
                    </button>
                  </div>
                </div>
              ) : (
                <small className="ki-loot-static-text">1 szt. na pokonanie</small>
              )}
            </li>
          );
        })}
      </ul>
      <small>
        Wartości modyfikowane w panelu zapisują się lokalnie i natychmiast zmieniają tabele dropu
        potwora.
      </small>
    </div>
  );
}
