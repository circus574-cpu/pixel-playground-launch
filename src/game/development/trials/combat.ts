import {
  HeritageEncounter,
  encounterMonsterKind,
  TRIAL_BATTLE_LEVELS,
} from "../heritage/encounter";
import { EscortActivity, escortRoute } from "../heritage/escort";
import type { GameSession } from "../../session";
import { distance, type Point } from "../../navigation";
import type { TrialTier } from "./catalog";

export type CombatTrialKind =
  "combat-waves" | "rescue-escort" | "retreat-defense" | "rescue-return";
export const COMBAT_ROOM = {
  restMs: 5000,
  limitMs: 480000,
  coverHoldMs: 1000,
  pointRadius: 180,
} as const;
const POSTS = [
  { x: 520, y: 550 },
  { x: 520, y: 170 },
  { x: 820, y: 620 },
  { x: 240, y: 170 },
];
/** Bounded trial encounters reuse world AI, receivers, navigation, kit damage and death handling. */
export class CombatTrial {
  readonly target: number;
  readonly duration: number;
  readonly enemyKind: string;
  readonly goalId: string;
  private phase:
    "travel" | "fight" | "rest" | "escort" | "decision" | "return" | "passed" | "failed" = "travel";
  private completed = 0;
  private elapsed = 0;
  private previousNow: number;
  private held = 0;
  private totalHeld = 0;
  private minHealth = 1;
  private until = 0;
  private reason = "";
  private encounter: HeritageEncounter | undefined;
  private escort: EscortActivity | undefined;
  private decisionAt: Point | undefined;
  private originalUse;
  readonly cover = { x: 280, y: 290 };
  readonly pursuitOrigin = { x: 480, y: 290 };
  constructor(
    private readonly session: GameSession,
    readonly kind: CombatTrialKind,
    readonly tier: TrialTier,
    private readonly owner: string,
  ) {
    this.target = kind === "rescue-escort" ? tier : tier + 1;
    this.duration = [45000, 60000, 75000][tier - 1]!;
    this.previousNow = session.nowMs;
    const number =
      kind === "combat-waves"
        ? "03"
        : kind === "rescue-escort"
          ? "10"
          : kind === "retreat-defense"
            ? "11"
            : "12";
    this.goalId = `trial:TP${number}:${tier}`;
    this.enemyKind = encounterMonsterKind(session.world.id, TRIAL_BATTLE_LEVELS[tier - 1]!).id;
    session.player.items.potion = 1; // One borrowed standard potion; normal 6 s cooldown, never copied back.
    this.originalUse = session.kit.use;
    session.kit.use = (id) => {
      const result = this.originalUse.call(session.kit, id);
      if (this.phase === "return" && id !== "potion" && !session.paused && result.ok)
        this.fail("Po decyzji o odwrocie przerwij ataki i wróć do osłony.");
      return result;
    };
    if (kind === "rescue-escort" || kind === "rescue-return") this.phase = "escort";
    if (!session.nav.walkable(this.cover) || session.nav.visible(this.pursuitOrigin, this.cover))
      throw Error("Brak rzeczywistej osłony sali.");
  }
  private fail(reason: string) {
    this.phase = "failed";
    this.reason = reason;
  }
  get point(): Point {
    if (this.phase === "decision") return this.decisionAt!;
    if (this.phase === "return") return this.cover;
    if (this.escort) return this.escort.nextTarget().point;
    return this.kind === "retreat-defense"
      ? POSTS[Math.min(this.completed, POSTS.length - 1)]!
      : POSTS[0]!;
  }
  get canDecide() {
    return this.phase === "decision";
  }
  choose(answer: string) {
    if (!this.canDecide) return false;
    if (answer !== "disengage") {
      this.fail("Kontynuowanie pościgu nie kończy zadania ratunkowego.");
      return false;
    }
    this.session.command({ type: "cancel" });
    this.encounter = new HeritageEncounter(
      this.session,
      this.goalId,
      "Punkt pościgu próby",
      this.pursuitOrigin,
      false,
    );
    this.encounter.startWave(0);
    for (const e of this.session.enemies)
      if (e.encounterOwner && e.hp > 0) this.session.monsters.setCombatTarget(e, null);
    this.phase = "return";
    this.held = 0;
    return true;
  }
  private startEscort() {
    const s = this.session,
      base = { x: s.player.x, y: s.player.y };
    const count = this.kind === "rescue-return" ? this.target - 1 : 2;
    const route = escortRoute(s.nav, base, count, this.goalId + ":" + this.completed);
    this.escort = new EscortActivity(
      s,
      {
        id: this.goalId,
        kind: "escort",
        label: "Ratunek jednostki ćwiczebnej",
        site: "trainer",
        documents: [],
        checkpoints: count,
        actor: `Podopieczny ${this.completed + 1}`,
        minHealthFraction: 0.5,
        combat: true,
      },
      this.owner,
      {
        id: this.goalId,
        label: "Podopieczny",
        point: base,
        feature: s.world.id,
        interior: null,
        npc: null,
        witness: false,
        entrance: null,
      },
      route,
      0,
      (proof) =>
        proof.owner === this.owner && proof.combatCleared === true && proof.healthFraction >= 0.5,
    );
  }
  update() {
    const s = this.session,
      dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (dt <= 0 || s.paused || this.phase === "passed" || this.phase === "failed") return;
    this.elapsed += dt;
    if (this.elapsed > COMBAT_ROOM.limitMs) {
      this.fail("Przekroczono jawny limit sali 480 s.");
      return;
    }
    if (this.phase === "decision") return;
    if (this.phase === "return") {
      this.encounter?.update(dt);
      const hidden =
        distance(s.player, this.cover) <= 60 &&
        !s.nav.visible(this.pursuitOrigin, s.player) &&
        s.enemies
          .filter((e) => e.encounterOwner && e.hp > 0 && e.mode !== "dead")
          .every((e) => !s.nav.visible(e, s.player));
      this.held = hidden ? this.held + dt : 0;
      if (this.held >= COMBAT_ROOM.coverHoldMs) {
        this.completed = this.target;
        this.phase = "passed";
      }
      return;
    }
    if (this.kind === "rescue-escort" || this.kind === "rescue-return") {
      if (!this.escort) this.startEscort();
      this.escort!.update();
      const r = this.escort!.snapshot();
      this.minHealth = Math.min(this.minHealth, r.healthFraction);
      if (r.phase === "failed") {
        this.fail(r.message);
        return;
      }
      if (r.phase === "passed") {
        if (this.kind === "rescue-return") {
          this.completed = this.target - 1;
          this.decisionAt = { ...r.actor };
          this.phase = "decision";
        } else {
          this.completed++;
          if (this.completed >= this.target) this.phase = "passed";
        }
        this.escort!.dispose();
        this.escort = undefined;
      }
      return;
    }
    if (this.kind === "combat-waves") {
      if (this.phase === "rest" && s.nowMs < this.until) return;
      if (!this.encounter)
        this.encounter = new HeritageEncounter(
          s,
          this.goalId,
          "Punkt treningu fal",
          POSTS[0]!,
          false,
        );
      if (this.phase !== "fight") {
        this.encounter.startWave(this.completed);
        for (const e of s.enemies)
          if (e.encounterOwner && e.hp > 0) s.monsters.setCombatTarget(e, null);
        this.phase = "fight";
      }
      this.encounter.update(dt);
      if (this.encounter.cleared) {
        this.completed++;
        if (this.completed >= this.target) this.phase = "passed";
        else {
          this.phase = "rest";
          this.until = s.nowMs + COMBAT_ROOM.restMs;
        }
      }
      return;
    }
    const post = this.point;
    if (!this.encounter) {
      if (distance(s.player, post) > COMBAT_ROOM.pointRadius) return;
      this.encounter = new HeritageEncounter(
        s,
        this.goalId,
        `Punkt odwrotu ${this.completed + 1}`,
        post,
        false,
      );
      this.encounter.startWave(0);
      this.phase = "fight";
      this.held = 0;
    }
    this.encounter.update(dt);
    this.minHealth = Math.min(this.minHealth, this.encounter.healthFraction);
    if (!this.encounter.actor.valid() || this.minHealth < 0.5) {
      this.fail("Chroniony obiekt utracił wymagane 50% HP.");
      return;
    }
    if (distance(s.player, post) > 650) {
      this.fail("Opuszczono chroniony punkt odwrotu.");
      return;
    }
    if (distance(s.player, post) <= COMBAT_ROOM.pointRadius && s.nav.visible(s.player, post)) {
      this.held += dt;
      this.totalHeld += dt;
    }
    if (this.held >= this.duration / this.target && this.encounter.cleared) {
      this.completed++;
      this.encounter.dispose();
      this.encounter = undefined;
      this.held = 0;
      this.phase = this.completed >= this.target ? "passed" : "travel";
    }
  }
  snapshot() {
    const escort = this.escort?.snapshot();
    const actor = this.encounter?.actor;
    return {
      kind: this.kind,
      phase: this.phase,
      completed: this.completed,
      target: this.target,
      point: this.point,
      reason: this.reason,
      minHealthFraction: this.minHealth,
      remainingMs:
        this.kind === "retreat-defense"
          ? Math.max(0, this.duration - this.totalHeld)
          : this.phase === "rest"
            ? Math.max(0, this.until - this.session.nowMs)
            : Math.max(0, COMBAT_ROOM.limitMs - this.elapsed),
      canDecide: this.canDecide,
      heldMs: this.held,
      enemyKind: this.enemyKind,
      companion: escort ? { ...escort.actor, hp: escort.healthFraction * 100, maxHp: 100 } : null,
      object:
        actor && this.kind === "retreat-defense"
          ? { ...actor.body, name: actor.name, maxHp: actor.maxHp }
          : null,
      cover: this.kind === "rescue-return" ? this.cover : null,
      enemies: this.session.enemies
        .filter((e) => e.encounterOwner && e.hp > 0 && e.mode !== "dead")
        .map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp })),
      message:
        escort?.message ??
        (this.phase === "decision"
          ? "Podejdź do podopiecznego, zbadaj stanowisko i wybierz przerwanie pościgu."
          : this.phase === "return"
            ? "Przerwij ataki. Wróć do zielonej osłony i utrzymaj ją przez 1 s poza widocznością pościgu."
            : this.phase === "rest"
              ? "Planowana przerwa 5 s. Masz tylko jedną standardową miksturę w tej sali."
              : "Pokonaj przeciwnika i osłoń wskazany punkt."),
    };
  }
  dispose() {
    this.session.kit.use = this.originalUse;
    this.escort?.dispose();
    this.escort = undefined;
    this.encounter?.dispose();
    this.encounter = undefined;
  }
}
