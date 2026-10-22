import { NODES, skillId } from "../../game/progression/catalog";
import { skillCost } from "../../game/progression/model";
import type { Command, GameViewState } from "../../game/session";
import { SkillGlyph } from "./SkillTree";
import { Droplets, Swords, Zap } from "lucide-react";
import "./race-skillbar.css";

export function RaceSkillBar({
  state,
  send,
  disabled,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  disabled: boolean;
}) {
  const p = state.player,
    tree = p.progression!;
  const form = NODES[skillId(p.race, "T")]!;
  const common =
    disabled || p.dead || Boolean(state.dialogue) || Boolean(state.progression?.locked);
  return (
    <nav className="ki-race-actionbar" aria-label="Umiejętności rasy">
      {tree.loadout.map((id, slot) => {
        const node = id ? NODES[id] : undefined,
          cooldown = id ? (tree.cooldowns[id] ?? 0) : 0;
        return (
          <button
            key={slot}
            className={`ki-race-skill ${node?.kind === "ultimate" ? "is-ultimate" : ""}`}
            title={
              node
                ? `${node.name} · ${node.cost} Ki · ${node.cooldown / 1000} s`
                : `Miejsce ${slot + 1} · wybierz umiejętność w Rozwoju`
            }
            aria-label={node?.name ?? `Puste miejsce ${slot + 1}`}
            disabled={
              common ||
              !node ||
              cooldown > 0 ||
              (node ? skillCost(node, tree, Boolean(state.progression?.free)) > p.ki : false)
            }
            onClick={(e) => {
              send({ type: "skill-slot", slot });
              e.currentTarget.blur();
            }}
          >
            <span>{node ? <SkillGlyph node={node} /> : "+"}</span>
            <kbd>{slot + 1}</kbd>
            {cooldown > 0 && (
              <strong className="ki-race-cooldown">{Math.ceil(cooldown / 1000)}</strong>
            )}
            <small>{node?.name ?? "Wybierz"}</small>
          </button>
        );
      })}
      <span className="ki-race-bar-divider" />
      <button
        className="ki-race-skill"
        aria-label={NODES[skillId(p.race, "R")]!.name}
        title="Atak podstawowy · Spacja"
        disabled={common || p.cooldowns.attack > 0 || tree.overheat > 0}
        onClick={(e) => {
          send({ type: "ability", ability: "attack" });
          e.currentTarget.blur();
        }}
      >
        <span>
          <Swords />
        </span>
        <kbd>␣</kbd>
        {state.autoAttack && <strong className="ki-race-auto">AUTO</strong>}
        <small>Atak</small>
      </button>
      <button
        className="ki-race-skill is-form"
        aria-label={form.name}
        title={`${form.name} · T`}
        disabled={
          common ||
          !tree.learned.includes(form.id) ||
          (tree.cooldowns[form.id] ?? 0) > 0 ||
          p.ki < skillCost(form, tree, false)
        }
        onClick={(e) => {
          send({ type: "cast-skill", id: form.id });
          e.currentTarget.blur();
        }}
      >
        <span>
          <Zap />
        </span>
        <kbd>T</kbd>
        {(tree.cooldowns[form.id] ?? 0) > 0 && (
          <strong className="ki-race-cooldown">{Math.ceil(tree.cooldowns[form.id]! / 1000)}</strong>
        )}
        <small>Tryb KI</small>
      </button>
      <button
        className="ki-race-skill is-potion"
        aria-label="Mikstura życia"
        title="Mikstura życia · Q"
        disabled={
          common || p.items.potion <= 0 || p.cooldowns.potion > 0 || p.hp >= state.stats.maxHp
        }
        onClick={(e) => {
          send({ type: "ability", ability: "potion" });
          e.currentTarget.blur();
        }}
      >
        <span>
          <Droplets />
        </span>
        <kbd>Q</kbd>
        <strong className="ki-race-potion-count">{p.items.potion}</strong>
        {p.cooldowns.potion > 0 && (
          <strong className="ki-race-cooldown">{Math.ceil(p.cooldowns.potion / 1000)}</strong>
        )}
        <small>Mikstura</small>
      </button>
    </nav>
  );
}
