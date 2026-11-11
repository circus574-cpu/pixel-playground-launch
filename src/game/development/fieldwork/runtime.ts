import type { GameSession, Player } from "../../session";
import { Navigation, distance, type Point } from "../../navigation";
import { cityRoom } from "../../city/room";
import { RACES } from "../../world/races";
import {
  FIELDWORK,
  FIELDWORK_BY_ID,
  previousField,
  fieldGrade,
  type FieldDefinition,
} from "./catalog";
import { domainRank } from "../trials/catalog";
import { earnedSources } from "./knowledge";
import { RecoveryUnit } from "../trials/recoveryUnit";
import { ResourceControlTrial, type ResourceTrialKind } from "../trials/resourceControl";
import { BreakWindows } from "../trials/body";
import { EscortActivity, escortRoute } from "../heritage/escort";
import { ProtectionActivity } from "../heritage/protection";
import { RestraintActivity } from "../heritage/restraint";
import { HeritageBindings, type HeritageHome, type HeritageTarget } from "../heritage/bindings";
import { combatGround, combatNavigation } from "../heritage/encounter";
import type { DevelopmentState } from "../state";

export type FieldworkCommand = {
  type: "fieldwork";
  action: "go" | "start" | "act" | "leave";
  id: string;
  answer?: string;
};
type Commit = (change: (d: DevelopmentState, p: Player) => void) => boolean;
type Active = {
  def: FieldDefinition;
  owner: string;
  target: HeritageTarget;
  serial: number;
  channelSeen: boolean;
  channelInProgress: boolean;
  started: number;
  escort?: EscortActivity;
  protect?: ProtectionActivity;
  restraint?: RestraintActivity;
  resource?: ResourceControlTrial;
  break?: BreakWindows;
  measured?: string[];
};
/** Per-character contacts and bounded real-engine activities. No world JSON edits and no extra reward source. */
export class FieldworkRuntime {
  private readonly bindings: HeritageBindings;
  private active: Active | null = null;
  private reading: { title: string; text: string } | null = null;
  private readonly targetCache = new Map<string, HeritageTarget[]>();
  private signature = "";
  constructor(
    private readonly s: GameSession,
    private readonly commit: Commit,
    readonly feature: string,
    home: HeritageHome,
    private readonly outside: Navigation,
  ) {
    this.bindings = new HeritageBindings(s.world, structuredClone(home), outside);
    if (s.saves) this.refresh();
  }
  private targets(d: FieldDefinition) {
    const cached = this.targetCache.get(d.id);
    if (cached) return cached;
    const combat = d.mode === "protect" || d.mode === "escort";
    const values = this.bindings.resolve(
      {
        id: d.id,
        label: d.name,
        kind: "inspect",
        site: combat ? "trail" : d.site,
        documents: [],
        targets: Array.from({ length: d.steps }, (_, i) => d.action + " · " + (i + 1)),
        observations: [],
      },
      d.world,
    );
    const domains = [...new Set(FIELDWORK.filter((f) => f.race === d.race).map((f) => f.domain))];
    const slot = domains.indexOf(d.domain);
    if (values[0]?.interior) {
      const room = cityRoom(values[0].interior, d.world),
        nav = new Navigation(room.width, room.height, room.obstacles);
      const anchor = {
        x: (room.width * ((slot % 2) + 1)) / 3,
        y: (room.height * (Math.floor(slot / 2) + 1)) / 3,
      };
      for (const [i, t] of values.entries())
        t.point = nav.safe({ x: anchor.x + (i % 2) * 100, y: anchor.y + Math.floor(i / 2) * 90 });
    } else if (values[0] && (d.site === "trail" || combat)) {
      for (const t of values)
        t.point = this.outside.safe({ x: t.point.x + slot * 260, y: t.point.y + 80 });
    }
    this.targetCache.set(d.id, values);
    return values;
  }
  private progress(d: FieldDefinition) {
    return this.s.player.development?.fieldwork[d.id] ?? { step: 0, done: false };
  }
  private available(d: FieldDefinition) {
    const s = this.s,
      p = s.player;
    if (d.race !== p.race || d.world !== this.feature)
      return "To miejsce należy do innej ścieżki kulturowej.";
    if (!s.saves || p.dead) return "Potrzebna jest aktywna, żywa postać z zapisem.";
    if (domainRank(p.development?.trials ?? {}, d.race, d.domain) < d.tier)
      return `Najpierw zdobądź stopień ${d.tier} dziedziny ${d.name}.`;
    const prev = previousField(d);
    if (prev && !p.development?.fieldwork[prev]?.done)
      return "Najpierw zakończ wcześniejszy etap pracy w terenie.";
    if (this.progress(d).done) return "To działanie zostało już zapisane.";
    if (d.mode === "evidence" && !this.source(d))
      return `Najpierw poznaj i zweryfikuj świadectwo w rozdziale ${2 * d.tier - 1} dziedzictwa.`;
    const required =
      d.mode === "channel"
        ? "C1"
        : d.mode === "break"
          ? "B1"
          : d.mode === "core-windows"
            ? "C1"
            : d.mode === "ember-windows"
              ? "C4"
              : null;
    if (required && !p.skills.includes(required))
      return `To opcjonalne stanowisko korzysta z Twojej zdolności ${required}. Najpierw poznaj ją w drzewku; nie resetuje ono umiejętności.`;
    return "";
  }
  private source(d: FieldDefinition) {
    return earnedSources(d.race, this.s.player.development).find(
      (s) => s.chapter >= 2 * d.tier - 1,
    );
  }
  private near(t: HeritageTarget | undefined) {
    const s = this.s;
    return (
      !!t &&
      t.feature === this.feature &&
      t.interior === s.player.interior &&
      distance(t.point, s.player) <= 130 &&
      s.nav.visible(s.player, t.point)
    );
  }
  private point(a: Active) {
    return (
      a.escort?.nextTarget() ??
      a.protect?.nextTarget() ??
      this.targets(a.def)[Math.min(this.progress(a.def).step, this.targets(a.def).length - 1)]!
    );
  }
  private advance(d: FieldDefinition, step: number) {
    const before = this.progress(d);
    if (step !== before.step + 1 || step > d.steps) return false;
    const okay = this.commit((next) => {
      next.fieldwork[d.id] = { step, done: step === d.steps };
    });
    if (okay) {
      this.refresh();
      this.s.say(
        step === d.steps
          ? `${d.action}: zapisano efekt w świecie. Bez dodatkowej nagrody praktyki.`
          : `${d.action}: etap ${step}/${d.steps} zapisany.`,
      );
    }
    return okay;
  }
  private finish(d: FieldDefinition) {
    return this.commit((next) => {
      next.fieldwork[d.id] = { step: d.steps, done: true };
    });
  }
  private inspect(d: FieldDefinition) {
    if (!["evidence", "recovery", "allocation", "circuit"].includes(d.mode)) return null;
    const step = this.progress(d).step;
    if (d.mode === "evidence") {
      const source = this.source(d);
      return source
        ? {
            title: source.title,
            text: source.text + "\nZapisana decyzja: " + source.decision,
            options: [
              { id: source.id, label: `Zachowaj źródło: ${source.title}` },
              { id: "erase", label: "Zastąp świadectwo własnym domysłem" },
            ],
          }
        : null;
    }
    if (d.mode === "recovery") {
      const unit = new RecoveryUnit(fieldGrade(d.tier));
      for (let i = 0; i < step; i++) unit.execute(unit.steps[i]!);
      return {
        title: "Dobrowolny ratunek jednostki",
        text: "Pamięci jednostki nie wolno resetować. Procedura: " + unit.steps.join(" → "),
        options: [...unit.steps, "RESETUJ PAMIĘĆ"].map((id) => ({ id, label: id })),
      };
    }
    if (d.mode === "allocation") {
      const total = d.tier + 4,
        first = d.tier + 1;
      return {
        title: d.action,
        text: `Dostępny przepływ: ${total}. Pierwszy odbiorca wymaga ${first}, drugi ${total - first}. Rozdziel całość bez tworzenia dodatkowej wody.`,
        options: [],
        allocation: { total, first, second: total - first },
      };
    }
    const labels = Array.from({ length: d.steps }, (_, i) => "Węzeł " + (i + 1));
    return {
      title: d.action,
      text: `Schemat miejscowego układu: ${labels.join(" → ")}. Jesteś przy stanowisku ${step + 1}. Połączenie zmienia stan tego elementu instalacji.`,
      options: labels.map((id) => ({ id, label: id })),
    };
  }
  command(c: FieldworkCommand) {
    const d = FIELDWORK_BY_ID.get(c.id);
    if (!d) return;
    const s = this.s;
    const target =
      this.active?.def.id === d.id
        ? this.point(this.active)
        : this.targets(d)[Math.min(this.progress(d).step, d.steps - 1)];
    if (c.action === "leave") {
      this.cancel();
      return;
    }
    if (c.action === "go") {
      if (d.world === this.feature && target) s.heritage.goTo(target);
      return;
    }
    const reason = this.available(d);
    if (reason) return s.say(reason);
    if (s.combatIn > 0 && !this.active) return s.say("Rozpocznij po zakończeniu walki.");
    if (!this.near(target))
      return s.say("Podejdź do oznaczonego obiektu. Nie można obsługiwać go przez przeszkodę.");
    if (c.action === "start") {
      if (s.kit.channel)
        return s.say("Zakończ aktualnie przygotowywaną zdolność przed uruchomieniem stanowiska.");
      this.cancel();
      s.expeditions.interrupt("Rozpoczęto działanie dziedziny.");
      const owner = `field:${d.id}`;
      const a: Active = {
        def: d,
        owner,
        target: target!,
        serial: s.kit.channelResult?.serial ?? 0,
        channelSeen: false,
        channelInProgress: false,
        started: s.nowMs,
      };
      this.active = a;
      try {
        if (d.mode === "escort") {
          const route = escortRoute(combatNavigation(s), target!.point, d.steps, d.id, (p) =>
            combatGround(s, p),
          );
          a.escort = new EscortActivity(
            s,
            {
              id: owner,
              kind: "escort",
              site: "trail",
              label: d.action,
              documents: [],
              actor: `Podróżny ${RACES[d.race].name}`,
              checkpoints: d.steps,
              minHealthFraction: 0.5,
              combat: true,
            },
            s.saves!.identity,
            target!,
            route,
            this.progress(d).step,
            (proof) =>
              this.active === a &&
              proof.combatCleared === true &&
              proof.healthFraction >= 0.5 &&
              this.advance(d, proof.checkpoint),
          );
        } else if (d.mode === "protect") {
          a.protect = new ProtectionActivity(
            s,
            {
              id: owner,
              kind: "protect",
              site: "trail",
              label: d.action,
              documents: [],
              points: d.steps,
              waves: d.steps,
              minHealthFraction: 0.5,
            },
            s.saves!.identity,
            target!,
            this.progress(d).step,
            (proof) =>
              this.active === a &&
              proof.healthFraction >= 0.5 &&
              this.advance(d, proof.protectedPoints),
          );
        } else if (d.mode === "restraint") {
          a.restraint = new RestraintActivity(
            s,
            {
              id: owner,
              kind: "restraint",
              site: d.site,
              label: d.action,
              documents: [],
              windows: d.steps,
              maxErrors: 1,
              surrender: true,
            },
            owner,
            target!.point,
          );
        } else if (d.mode === "break")
          a.break = new BreakWindows(s, fieldGrade(d.tier), owner, target!.point);
        else if (["core-band", "ember-band", "core-windows", "ember-windows"].includes(d.mode))
          a.resource = new ResourceControlTrial(
            s,
            d.mode as ResourceTrialKind,
            fieldGrade(d.tier),
            owner,
            target!.point,
          );
        else if (d.mode === "measure") {
          a.measured = [];
          for (const t of this.targets(d).slice(this.progress(d).step))
            s.practiceTargets.add(
              owner,
              t.label,
              t.point,
              s.player.interior,
              s.nowMs,
              (contact) => {
                if (
                  this.active !== a ||
                  contact.hit.indirect ||
                  contact.hit.ability !== "R" ||
                  a.measured!.includes(t.id)
                )
                  return;
                const next = this.targets(d)[this.progress(d).step];
                if (next?.id !== t.id || !this.near(t)) return;
                if (this.advance(d, this.progress(d).step + 1)) {
                  a.measured!.push(t.id);
                  this.reading = {
                    title: "Pomiar rzeczywistej konfiguracji",
                    text: `Trafienie ${Math.round(contact.raw)}, ATK ${s.kit.stats.attack}, KI ${Math.round(s.player.ki)}/${s.kit.stats.maxKi}, ${s.kit.resource()?.label ?? "zasób"}: ${s.kit.resource()?.value ?? 0}/${s.kit.resource()?.max ?? 0}. Zmiana zasobu i koszt pochodzą z Twojego kitu.`,
                  };
                  const body = s.practiceTargets
                    .list(s.player.interior)
                    .find((p) => p.owner === owner && p.name === t.label);
                  if (body) body.hp = 0;
                }
              },
            );
        }
        s.say(
          d.mode === "channel"
            ? "Stań przy węźle i dokończ własne C1. Obowiązują prawdziwe koszty, cooldown i przerywanie."
            : d.action + ". Postęp i następne stanowisko znajdziesz w Rozwój → Świat.",
        );
      } catch (e) {
        this.cancel();
        s.say(e instanceof Error ? e.message : "Nie można rozpocząć tego działania.");
      }
      return;
    }
    if (this.active?.def.id !== d.id)
      return s.say("Najpierw rozpocznij działanie przy stanowisku.");
    if (c.action !== "act" || !["circuit", "allocation", "evidence", "recovery"].includes(d.mode))
      return;
    const step = this.progress(d).step;
    let valid = false;
    if (d.mode === "evidence") valid = c.answer === this.source(d)?.id;
    else if (d.mode === "recovery") {
      const unit = new RecoveryUnit(fieldGrade(d.tier));
      for (let i = 0; i < step; i++) unit.execute(unit.steps[i]!);
      valid = unit.execute(c.answer ?? "");
    } else if (d.mode === "allocation") valid = c.answer === `${d.tier + 1},3`;
    else valid = c.answer === `Węzeł ${step + 1}`;
    if (!valid)
      return s.say("Wynik nie jest zgodny ze źródłem lub schematem. Stan obiektu zachowano.");
    if (this.advance(d, step + 1) && this.progress(d).done) {
      this.reading = {
        title: d.action,
        text:
          d.mode === "evidence"
            ? this.source(d)!.text
            : "Obiekt działa w sprawdzonym układzie. Ten stan zostanie odtworzony po powrocie.",
      };
      this.cancel(false);
    }
  }
  tick() {
    const a = this.active,
      s = this.s;
    if (!a || s.paused) return;
    if (s.player.dead || s.player.interior !== a.target.interior || s.nowMs - a.started > 240000) {
      s.say(
        "Działanie przerwano przez śmierć, zmianę miejsca lub limit 4 aktywnych minut. Ukończone etapy zachowano.",
      );
      this.cancel();
      return;
    }
    a.escort?.update();
    a.protect?.update();
    a.restraint?.update();
    a.resource?.update();
    a.break?.update();
    const result =
      a.escort?.snapshot() ??
      a.protect?.snapshot() ??
      a.restraint?.snapshot() ??
      a.resource?.snapshot() ??
      a.break?.snapshot();
    if (result?.phase === "failed") {
      s.say(
        (this.activityView(a)?.message || "Działanie przerwane.") +
          " Zapisane checkpointy zachowano; rozpocznij ponownie.",
      );
      this.cancel(false);
      return;
    }
    if (result?.phase === "passed" && !this.progress(a.def).done) {
      if (!this.finish(a.def)) return;
    }
    if (a.def.mode === "trace" || a.def.mode === "shortcut") {
      const t = this.point(a);
      if (this.near(t) && distance(s.player, t.point) <= 45)
        this.advance(a.def, this.progress(a.def).step + 1);
    }
    if (a.def.mode === "channel") {
      if (s.kit.channel?.id === "C1") {
        if (!a.channelInProgress) a.channelSeen = this.near(this.point(a));
        else a.channelSeen &&= this.near(this.point(a));
        a.channelInProgress = true;
      }
      const r = s.kit.channelResult;
      if (r && r.serial > a.serial && r.id === "C1") {
        a.serial = r.serial;
        if (r.completed && a.channelSeen && this.near(this.point(a)))
          this.advance(a.def, this.progress(a.def).step + 1);
        else s.say("Przepływ przerwany lub poza węzłem. Zapisane etapy zachowano.");
        a.channelInProgress = false;
        a.channelSeen = false;
      }
    }
    if (this.progress(a.def).done) {
      this.refresh();
      s.say(a.def.action + ": zapisano wykonanie.");
      this.cancel(false);
    }
  }
  cancel(clearReading = true) {
    const a = this.active;
    if (a) {
      a.escort?.dispose();
      a.protect?.dispose();
      a.restraint?.dispose();
      a.resource?.dispose();
      a.break?.dispose();
      this.s.practiceTargets.removeOwner(a.owner);
    }
    this.active = null;
    if (clearReading) this.reading = null;
  }
  refresh() {
    const s = this.s,
      d = s.player.development;
    if (!s.saves) return;
    const signature = JSON.stringify(d?.fieldwork ?? {});
    if (signature === this.signature) return;
    this.signature = signature;
    // Only the small local shortcut prop is mutable. It is never a continental barrier.
    const gates = FIELDWORK.filter(
      (f) => f.race === s.player.race && f.world === this.feature && f.mode === "shortcut",
    ).flatMap((f) => {
      if (d?.fieldwork[f.id]?.done) return [];
      const t = this.targets(f)[0];
      if (!t || t.interior) return [];
      const o = { x: t.point.x + 55, y: t.point.y - 16, width: 40, height: 32 };
      if (
        !this.outside.canonicalWalkable({ x: o.x + 20, y: o.y + 16 }) ||
        (!s.player.interior &&
          Math.abs(s.player.x - o.x - 20) < 40 &&
          Math.abs(s.player.y - o.y - 16) < 40)
      )
        return [];
      return [o];
    });
    this.outside.setLocalObstacles("development-fieldwork", gates);
    s.enemyNavigation?.setLocalObstacles("development-fieldwork", gates);
  }
  markers() {
    this.refresh();
    const s = this.s;
    if (this.active) return [this.point(this.active)];
    return FIELDWORK.filter(
      (d) =>
        d.race === s.player.race &&
        d.world === this.feature &&
        !this.progress(d).done &&
        !this.available(d),
    )
      .map((d) => this.targets(d)[Math.min(this.progress(d).step, d.steps - 1)]!)
      .filter((t) => t?.interior === s.player.interior);
  }
  props() {
    this.refresh();
    const s = this.s;
    if (!s.saves) return [];
    return FIELDWORK.filter((d) => d.race === s.player.race && d.world === this.feature)
      .flatMap((d) => {
        const progress = this.progress(d);
        if (!progress.step && !progress.done && d.mode !== "shortcut") return [];
        return this.targets(d).map((target, i) => ({
          id: target.id,
          target,
          completed: i < progress.step,
          gate: d.mode === "shortcut" && !progress.done,
        }));
      })
      .filter(
        (p) => p.target.interior === s.player.interior && distance(p.target.point, s.player) < 900,
      )
      .slice(0, 48);
  }
  dispose() {
    this.cancel();
    this.outside.setLocalObstacles("development-fieldwork", []);
    this.s.enemyNavigation?.setLocalObstacles("development-fieldwork", []);
  }
  private activityView(a: Active) {
    const value =
      a.escort?.snapshot() ??
      a.protect?.snapshot() ??
      a.restraint?.snapshot() ??
      a.resource?.snapshot() ??
      a.break?.snapshot();
    if (!value) return null;
    const message = String(
      "message" in value ? value.message : "reason" in value ? value.reason : "",
    );
    return {
      ...value,
      message:
        message ||
        (value.phase === "window"
          ? "TERAZ — wykonaj wskazane działanie"
          : value.phase === "hold"
            ? "Utrzymuj wymagany przedział zasobu"
            : "Pracuj przy oznaczonym stanowisku i obserwuj zapowiedzi."),
    };
  }
  snapshot() {
    const s = this.s,
      a = this.active;
    return {
      reading: this.reading,
      active: a
        ? {
            id: a.def.id,
            mode: a.def.mode,
            target: this.point(a),
            activity: this.activityView(a),
          }
        : null,
      entries: FIELDWORK.filter((d) => d.race === s.player.race).map((d) => ({
        id: d.id,
        name: d.name,
        tier: d.tier,
        action: d.action,
        mode: d.mode,
        steps: d.steps,
        progress: this.progress(d),
        locked: this.available(d),
        target: this.targets(d)[Math.min(this.progress(d).step, d.steps - 1)] ?? null,
        near: this.near(this.targets(d)[Math.min(this.progress(d).step, d.steps - 1)]),
        puzzle: this.active?.def.id === d.id ? this.inspect(d) : null,
      })),
    };
  }
}
