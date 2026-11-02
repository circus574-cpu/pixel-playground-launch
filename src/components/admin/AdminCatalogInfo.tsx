import { useEffect, useRef, useState } from "react";
import { catalog, monsterVisual } from "@/game/assets/catalog";
import { getItemById } from "@/game/items";
import { PASSIVE_BUFF_SET_BONUSES } from "@/game/items/catalog";
import { itemBonuses, itemSources, monsterDrops, percent } from "@/game/admin/contentCatalog";
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
export function ItemHoverTooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const item = getItemById(id);
  const runtimeItem = id in ITEMS ? ITEMS[id as ItemId] : undefined;
  const material = id in MATERIALS ? MATERIALS[id] : undefined;

  const name = item?.name ?? runtimeItem?.name ?? material?.name ?? id;
  const category = item?.category ?? runtimeItem?.type ?? (material ? "material" : "Inne");
  const rarity = item?.rarity ?? (material ? "uncommon" : "common");
  const bonuses = itemBonuses(item?.stats);
  const sources = itemSources(id);

  // Runtime item base stats if not in catalog
  const runtimeStats: string[] = [];
  if (runtimeItem) {
    if (runtimeItem.attack > 0) runtimeStats.push(`Atak: +${runtimeItem.attack}`);
    if (runtimeItem.defense > 0) runtimeStats.push(`Obrona: +${runtimeItem.defense}`);
  }
  if (material) {
    runtimeStats.push(`Poziom materiału: ${material.level}`);
  }

  const allStatBonuses = bonuses.length > 0 ? bonuses : runtimeStats;

  return (
    <div
      className="ki-item-tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <div className={`ki-item-tooltip ki-rarity-${rarity}`} role="tooltip">
          {/* Header */}
          <div className="ki-tooltip-header">
            <div className={`ki-tooltip-icon-box ki-border-${rarity}`}>
              <img
                src={item?.iconUrl ?? `/game/items/${encodeURIComponent(id)}.webp`}
                alt={name}
                className="ki-tooltip-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="ki-tooltip-title-area">
              <strong className={`ki-tooltip-title ki-text-${rarity}`}>{name}</strong>
              <div className="ki-tooltip-tags">
                <span className={`ki-tag-rarity ki-bg-${rarity}`}>
                  {RARITY_NAMES[rarity] ?? rarity}
                </span>
                <span className="ki-tag-category">{CATEGORY_NAMES[category] ?? category}</span>
                {item?.level != null && (
                  <span className="ki-tag-level">Wym. poz. {item.level}</span>
                )}
              </div>
              <small className="ki-tooltip-id">ID: {id}</small>
            </div>
          </div>

          {/* Statystyki & Co daje dany przedmiot */}
          <div className="ki-tooltip-body">
            <div className="ki-tooltip-section-title">Co daje ten przedmiot:</div>
            {allStatBonuses.length > 0 ? (
              <div className="ki-tooltip-stats-grid">
                {allStatBonuses.map((b) => (
                  <div key={b} className="ki-tooltip-stat-pill">
                    <span className="ki-stat-bullet">✦</span> {b}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ki-tooltip-no-stats">
                Przedmiot fabularny lub rzemieślniczy bez bezpośrednich premii liczbowych.
              </div>
            )}

            {/* Pasywny Buff */}
            {item?.buff && (
              <div className="ki-tooltip-buff">
                <strong>✨ Efekt pasywny:</strong>{" "}
                {itemBonuses({ [item.buff.effect]: item.buff.value }).join(" · ")}
                <div className="ki-tooltip-hint">Działa stale po założeniu w oknie ekwipunku.</div>
              </div>
            )}

            {/* Opis Działania / Efekt */}
            {item?.effectDescription && (
              <div className="ki-tooltip-effect">
                <strong>Działanie:</strong> {item.effectDescription}
              </div>
            )}

            {/* Zestaw Przedmiotów */}
            {item?.setId && (
              <div className="ki-tooltip-set">
                <strong>💎 Zestaw: {item.setId}</strong>
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

            {/* Ceny Monet */}
            <div className="ki-tooltip-prices">
              {(item?.price ?? runtimeItem?.price) !== undefined && (
                <span>
                  Kupno: <b>{item?.price ?? runtimeItem?.price}</b> monet
                </span>
              )}
              {(runtimeItem?.sell ?? material?.sell) !== undefined && (
                <span>
                  Sprzedaż: <b>{runtimeItem?.sell ?? material?.sell}</b> monet
                </span>
              )}
            </div>

            {/* Gdzie zdobyć (Drop / Receptura / Zadanie) */}
            {sources.length > 0 && (
              <div className="ki-tooltip-sources">
                <strong>Skąd zdobyć:</strong>
                <ul>
                  {sources.slice(0, 3).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  {sources.length > 3 && (
                    <li className="ki-sources-more">+ {sources.length - 3} innych źródeł...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ItemCatalogInfo({ id }: { id: string }) {
  const item = getItemById(id),
    sources = itemSources(id),
    bonuses = itemBonuses(item?.stats);
  const [failed, setFailed] = useState(false);

  return (
    <div className="ki-catalog-info">
      <ItemHoverTooltip id={id}>
        <div
          className="ki-catalog-item-wrapper"
          title="Najedź, aby zobaczyć szczegóły i statystyki przedmiotu"
        >
          {!failed ? (
            <img
              className="ki-catalog-item ki-catalog-item-interactive"
              loading="lazy"
              src={item?.iconUrl ?? `/game/items/${encodeURIComponent(id)}.webp`}
              alt={`Grafika: ${item?.name ?? id}`}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="ki-catalog-item ki-catalog-item-placeholder">
              <small>Brak ikony</small>
            </div>
          )}
          <span className="ki-hover-hint-badge" aria-hidden="true">
            Najedź
          </span>
        </div>
      </ItemHoverTooltip>

      {bonuses.length > 0 && <p className="ki-bonuses-preview">{bonuses.join(" · ")}</p>}
      {item?.buff && (
        <p>
          Buff pasywny: {itemBonuses({ [item.buff.effect]: item.buff.value }).join(" · ")}; działa
          po założeniu, do zdjęcia.
        </p>
      )}
      {item?.effectDescription && <p>{item.effectDescription}</p>}
      {item?.setId && (
        <div>
          <p>Zestaw: {item.setId}</p>
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
      <strong>Skąd zdobyć</strong>
      {sources.length ? (
        <ul>
          {sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p>
          Brak skonfigurowanego źródła w tabelach dropu, zadań i receptur. Sama obecność w katalogu
          nie oznacza dostępności w grze.
        </p>
      )}
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
