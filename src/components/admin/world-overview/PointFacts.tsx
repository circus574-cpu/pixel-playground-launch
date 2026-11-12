import type { MonsterDef } from "@/game/monsters/types";
import type { AuthoredSpawn } from "@/game/world/generated/spawnStream";
import { overviewCatalog, type Entry } from "./model";
export function PointFacts({ entry }: { entry: Entry }) {
  if (entry.layer === "spawns") {
    const d = entry.details as { spawn: AuthoredSpawn; monster: MonsterDef | null };
    const m = d.monster;
    if (!m) return null;
    return (
      <div className="ki-overview-facts">
        <div className="ki-overview-monster-stats">
          {[
            ["Poziom", m.level],
            ["HP", m.hp],
            ["ATK", m.atk],
            ["DEF", m.def],
            ["XP", m.xp],
            ["Agro", m.agro],
          ].map(([key, value]) => (
            <span key={key}>
              <small>{key}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        <p>
          Odrodzenie: <b>{d.spawn.respawnMs / 1000} s</b> · obszar powrotu:{" "}
          <b>{d.spawn.homeLeash} j.</b>
        </p>
        <h4>Łupy</h4>
        {m.loot.map((l, i) => (
          <p key={i}>
            {l.name} <b>{(l.chance * 100).toLocaleString("pl-PL")}%</b>
          </p>
        ))}
        {(overviewCatalog.equipmentDrops[m.id] ?? []).map((l) => (
          <p key={l.itemId}>
            {l.name} <b>{(l.chance * 100).toLocaleString("pl-PL")}%</b> · sprzęt
          </p>
        ))}
        <h4>Zdolności i sygnalizacja</h4>
        {m.skills.map((s) => (
          <p key={s.id}>
            <b>{s.name}</b> · zasięg {s.range} · odnowienie {s.cd / 1000} s
            {s.telegraph ? ` · telegraf ${s.telegraph / 1000} s` : ""}
          </p>
        ))}
      </div>
    );
  }
  if (entry.layer === "development") {
    const d = entry.details as {
      note: string;
      definition: {
        kind: string;
        spawnPolicy?: string;
        variants?: { encounterId: string; name: string; level: number; hp: number }[];
      };
    };
    return (
      <div className="ki-overview-facts">
        <p>{d.note}</p>
        {d.definition.spawnPolicy && <p>{d.definition.spawnPolicy}</p>}
        {d.definition.variants?.map((v) => (
          <p key={v.encounterId}>
            <b>{v.name}</b> · poziom {v.level} · HP {v.hp} · {v.encounterId}
          </p>
        ))}
      </div>
    );
  }
  if (entry.layer === "npcs") {
    const npc = entry.details as {
      role: string;
      dialogue?: string;
      dialogueDefinition?: { greetings?: string[] };
      building?: string;
      questNpc?: { storyConnection?: string };
    };
    return (
      <div className="ki-overview-facts">
        <p>
          <b>{npc.role}</b>
          {npc.building ? ` · budynek: ${npc.building}` : " · na zewnątrz"}
        </p>
        {(npc.dialogueDefinition?.greetings?.[0] ?? npc.dialogue) && (
          <blockquote>{npc.dialogueDefinition?.greetings?.[0] ?? npc.dialogue}</blockquote>
        )}
        {npc.questNpc?.storyConnection && <p>{npc.questNpc.storyConnection}</p>}
      </div>
    );
  }
  return null;
}
