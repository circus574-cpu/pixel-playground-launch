import { useEffect, useRef, useState } from "react";
import { catalog, monsterVisual } from "@/game/assets/catalog";
import { getItemById } from "@/game/items";
import { PASSIVE_BUFF_SET_BONUSES } from "@/game/items/catalog";
import { itemBonuses, itemSources, monsterDrops, percent } from "@/game/admin/contentCatalog";
import { monsterDef } from "@/game/monsters/catalog";
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
export function ItemCatalogInfo({ id }: { id: string }) {
  const item = getItemById(id),
    sources = itemSources(id),
    bonuses = itemBonuses(item?.stats);
  const [failed, setFailed] = useState(false);
  return (
    <div className="ki-catalog-info">
      {!failed ? (
        <img
          className="ki-catalog-item"
          loading="lazy"
          src={item?.iconUrl ?? `/game/items/${encodeURIComponent(id)}.webp`}
          alt={`Grafika: ${item?.name ?? id}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <small>Brak przypisanej grafiki</small>
      )}
      {bonuses.length > 0 && <p>{bonuses.join(" · ")}</p>}
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
export function MonsterCatalogInfo({ id, names }: { id: string; names?: string[] }) {
  const m = monsterDef(id);
  return (
    <div className="ki-catalog-info">
      <p>
        {WORLDS[m.world].name} · {m.xp} XP · złoto {m.gold[0]}–{m.gold[1]} · odrodzenie{" "}
        {m.respawn / 1000} s
      </p>
      <strong>Łupy — niezależny rzut dla każdej pozycji</strong>
      <ul>
        {monsterDrops(id, names).map((d, i) => (
          <li key={`${d.id}-${i}`}>
            {d.name} ({d.id}) · {percent(d.chance)} · 1 szt.
          </li>
        ))}
      </ul>
      <small>
        Wartości z definicji silnika. Lokalne edycje panelu nie publikują zmian na serwerze gry.
      </small>
    </div>
  );
}
