import { RestraintActivity } from "./restraint";
import { HeritageProjects } from "./projects";
import type { GameSession, Player } from "../../session";
import type { DevelopmentState } from "../state";
import { type WorldId } from "../../world/races";
import { distance, type Navigation } from "../../navigation";
import { cityRoom } from "../../city/room";
import { HeritageBindings, type HeritageHome, type HeritageTarget } from "./bindings";
import { HERITAGE_QUESTS, WORLD_PROJECTS } from "./catalog";
import {
  emptyHeritageProgress,
  type HeritageContentId,
  type HeritageGoal,
  type HeritageProgress,
  type WorldProjectId,
} from "./types";
import { heritageDefinition, heritageReceipt } from "./state";
import {
  advanceHeritage,
  reduceGoal,
  rememberGoalEvent,
  type GoalCommand,
  type GoalContext,
} from "./reducer";

export type HeritageInteraction =
  | { kind: "talk"; responseId: string }
  | { kind: "inspect" }
  | { kind: "solve"; answerId: string }
  | { kind: "recover" }
  | { kind: "craft" }
  | { kind: "consent"; granted: boolean; mode: "named" | "anonymous" }
  | { kind: "name-weapon"; name: string }
  | { kind: "forge"; operationId: string }
  | { kind: "retry" };
export type HeritageCommand = { type: "heritage" } & (
  | { action: "start"; id: HeritageContentId }
  | { action: "activity-start" | "activity-finish" | "activity-leave"; id: HeritageContentId }
  | { action: "go"; id: HeritageContentId; targetId: string }
  | {
      action: "act";
      id: HeritageContentId;
      goalId: string;
      targetId: string;
      revision: number;
      interaction: HeritageInteraction;
    }
  | { action: "claim"; id: HeritageContentId; choiceId: string | null }
);
type Commit = (change: (development: DevelopmentState, player: Player) => void) => boolean;
export const HERITAGE_WEAPON_NAMES = {
  planetary: "Ostrze Żywego Szlaku",
  sage: "Kostur Pierwszego Źródła",
  android: "Emiter Własnego Sygnału",
  legend: "Ostrze Własnej Przysięgi",
} as const;
export const heritageWeaponAttack = (stage: number) => 6 + stage * 2;

/** Owns source proofs and publishes only whole-character transactions. No independent reward store. */
export class HeritageRuntime {
  private readonly bindings: HeritageBindings;
  readonly projects: HeritageProjects;
  private observeIn = 0;
  private activity: { content: HeritageContentId; attempt: RestraintActivity } | null = null;
  cancelActivities(cancelRoute = true) {
    this.activity?.attempt.dispose();
    this.activity = null;
    if (cancelRoute) this.cancelRoute();
  }
  activitySnapshot() {
    return this.activity?.attempt.snapshot() ?? null;
  }
  private pendingRoute: { target: HeritageTarget; phase: "exit" | "entrance" | "enter" } | null =
    null;
  cancelRoute() {
    this.pendingRoute = null;
  }
  private routeTo(target: HeritageTarget) {
    const s = this.session,
      p = s.player;
    this.pendingRoute = null;
    if (p.interior === target.interior) {
      s.command({ type: "move", ...target.point });
      return;
    }
    if (p.interior !== null) {
      s.command({ type: "exit" });
      this.pendingRoute = { target, phase: "exit" };
      return;
    }
    if (target.interior && target.entrance && distance(p, target.entrance) > 165) {
      s.command({ type: "move", ...target.entrance });
      this.pendingRoute = { target, phase: "entrance" };
      return;
    }
    if (target.interior) {
      s.command({ type: "enter", building: target.interior });
      this.pendingRoute = { target, phase: "enter" };
    }
  }
  private updateRoute() {
    const route = this.pendingRoute,
      s = this.session;
    if (!route) return;
    if (
      (route.phase === "exit" && s.player.interior === null) ||
      (route.phase === "entrance" &&
        !!route.target.entrance &&
        distance(s.player, route.target.entrance) <= 165) ||
      (route.phase === "enter" && s.player.interior === route.target.interior)
    )
      this.routeTo(route.target);
  }
  constructor(
    private readonly session: GameSession,
    private readonly commit: Commit,
    readonly feature: string,
    home: HeritageHome,
    outside: Navigation,
  ) {
    this.bindings = new HeritageBindings(session.world, structuredClone(home), outside);
    this.projects = new HeritageProjects(this.bindings, outside, session.enemyNavigation);
    this.projects.refresh(session.player, feature);
  }
  refreshProjects() {
    this.projects.refresh(this.session.player, this.feature);
  }
  private progress(id: HeritageContentId) {
    const h = this.session.player.development?.heritage;
    return id.startsWith("H-") ? h?.quests[id] : h?.projects[id];
  }
  private table(d: DevelopmentState, id: HeritageContentId) {
    return id.startsWith("H-") ? d.heritage.quests : d.heritage.projects;
  }
  private available(id: HeritageContentId): string {
    const def = heritageDefinition(id),
      p = this.session.player;
    if (!def || def.race !== p.race)
      return "To dziedzictwo poznajesz jako gość, bez cudzych tytułów i nagród.";
    if (def.prerequisite && this.progress(def.prerequisite)?.status !== "done")
      return "Najpierw ukończ: " + heritageDefinition(def.prerequisite)!.name + ".";
    if ("chapter" in def && def.chapter === 1 && p.quests.steps !== "done")
      return "Najpierw zakończ miejscowe pierwsze kroki i odbierz nagrodę u przewodnika.";
    return "";
  }
  private targets(goal: HeritageGoal, world: WorldId) {
    return this.bindings.resolve(goal, goal.world ?? world);
  }
  private near(target: HeritageTarget | null | undefined) {
    const s = this.session;
    return (
      !!target &&
      target.feature === this.feature &&
      target.interior === s.player.interior &&
      distance(target.point, s.player) <= 130 &&
      s.nav.visible(s.player, target.point)
    );
  }
  private goalContext(goal: HeritageGoal, target: HeritageTarget | null): GoalContext {
    const s = this.session,
      h = s.player.development?.heritage;
    return {
      owner: s.saves?.identity ?? "",
      race: s.player.race,
      feature: s.world.id,
      interior: s.player.interior,
      player: s.player,
      target: target ? { ...target } : null,
      visible: (a, b) => s.nav.visible(a, b),
      materials: h?.materials ?? {},
      currentKi: s.player.ki,
      kiCostMultiplier: s.kit.stats.kiCostMul,
      completedProjects: new Set(
        Object.entries(h?.projects ?? {})
          .filter(([, p]) => p.status === "done")
          .map(([id]) => id as WorldProjectId),
      ),
      approvedActivities: new Map(),
      approvedObservations: new Map(),
      approvedHits: new Map(),
      weaponOwned: !!h?.weapon,
    };
  }
  command(c: HeritageCommand) {
    const s = this.session,
      p = s.player;
    if (!s.saves || p.dead || s.combatIn > 0 || !heritageDefinition(c.id))
      return s.say("Poczekaj na koniec walki. Dziedzictwo wymaga aktywnego zapisu postaci.");
    const reason = this.available(c.id);
    if (reason) return s.say(reason);
    const def = heritageDefinition(c.id)!;
    if (c.action === "start") {
      if (this.progress(c.id)) return;
      // Start at the mentor's actual position; project instructions are posted at that project's first site.
      const first = def.goals[0]!,
        target = this.targets(first, def.world)[0];
      if (!this.near(target))
        return s.say("Podejdź do pierwszego rozmówcy lub oznaczonego miejsca zlecenia.");
      if (
        this.commit((d) => {
          this.table(d, c.id)[c.id] = emptyHeritageProgress();
        })
      )
        s.say("Przyjęto: " + def.name);
      return;
    }
    const progress = this.progress(c.id);
    if (c.action === "activity-leave") {
      this.activity?.attempt.dispose();
      this.activity = null;
      return;
    }
    if (c.action === "activity-start" || c.action === "activity-finish") {
      if (!progress || progress.status !== "active") return;
      const goal = def.goals[progress.step]!;
      if (goal.kind !== "restraint") return s.say("Ten etap korzysta z innego rodzaju próby.");
      if (c.action === "activity-start") {
        const target = this.targets(goal, def.world)[0];
        if (!this.near(target)) return s.say("Podejdź do wskazanego stanowiska ćwiczebnego.");
        this.activity?.attempt.dispose();
        this.activity = {
          content: c.id,
          attempt: new RestraintActivity(s, goal, s.saves.identity, target!.point),
        };
        s.command({ type: "move", ...s.nav.safe({ x: target!.point.x, y: target!.point.y + 65 }) });
        return;
      }
      const activity = this.activity;
      if (!activity || activity.content !== c.id || activity.attempt.goal.id !== goal.id) return;
      const proof = activity.attempt.proof();
      if (!proof) return s.say("Próba nie jest jeszcze ukończona.");
      const context = this.goalContext(goal, null);
      context.approvedActivities = new Map([[activity.attempt.id, proof]]);
      const before = progress.step;
      this.apply(
        c.id,
        goal,
        progress,
        {
          owner: s.saves.identity,
          goalId: goal.id,
          eventId: crypto.randomUUID(),
          targetId: "",
          expectedRevision: progress.goal.revision,
          kind: "activity",
          source: "activity-runtime",
          attemptId: activity.attempt.id,
        },
        context,
      );
      if (this.progress(c.id)?.step !== before) {
        activity.attempt.dispose();
        this.activity = null;
      }
      return;
    }
    if (c.action === "go") {
      const goal = def.goals[progress?.step ?? 0] ?? def.goals.at(-1)!;
      const target = this.targets(goal, def.world).find((t) => t.id === c.targetId);
      if (!target)
        return s.say(
          "Cel znajduje się na innym kontynencie. Skorzystaj z istniejącej podróży na " +
            { verdant: "Verdantię", aether: "Aetherię", nexus: "Nexus-9", pyra: "Pyrę" }[
              goal.world ?? def.world
            ] +
            ".",
        );
      if (s.paused) return s.say("Zamknij okno rozwoju, aby wyruszyć.");
      this.routeTo(target);
      return;
    }
    if (!progress || progress.status === "done") return;
    if (c.action === "claim") {
      if (progress.status !== "ready")
        return s.say("Zakończ wszystkie czynności bieżącego rozdziału.");
      const choice =
        "choices" in def ? def.choices.find((choice) => choice.id === c.choiceId) : null;
      if ("choices" in def && !choice) return s.say("Wybierz sposób zapisania świadectwa.");
      const last = def.goals.at(-1)!;
      if (!this.targets(last, def.world).some((target) => this.near(target)))
        return s.say("Odbierz wynik przy ostatnim stanowisku zlecenia.");
      const key = heritageReceipt(c.id);
      if (p.development?.rewardReceipts[key]) return;
      const previousLevel = p.level;
      const committed = this.commit((d, candidate) => {
        const h = d.heritage,
          progress = this.table(d, c.id)[c.id]!;
        progress.status = "done";
        progress.choiceId = choice?.id ?? null;
        d.rewardReceipts[key] = {
          practice: def.reward.practice,
          ...("xp" in def.reward ? { xp: def.reward.xp, gold: def.reward.gold } : {}),
        };
        d.practiceEarned += def.reward.practice;
        if ("xp" in def.reward) {
          candidate.xp += def.reward.xp;
          candidate.gold += def.reward.gold;
          while (candidate.level < 100 && candidate.xp >= 100 + (candidate.level - 1) * 60) {
            candidate.xp -= 100 + (candidate.level - 1) * 60;
            candidate.level++;
          }
        }
        const androidCooling =
          h.quests["H-N02"]?.status === "done" && h.projects["P-N1"]?.status === "done";
        if (p.race === "android" && androidCooling && !d.unlockedModules.includes("mn-cooling"))
          d.unlockedModules.push("mn-cooling");
        if ("weaponStage" in def) {
          if (!h.weapon) {
            h.weapon = {
              instanceId: crypto.randomUUID(),
              owner: s.saves!.identity,
              race: p.race,
              stage: 1,
              name: HERITAGE_WEAPON_NAMES[p.race],
              history: [c.id],
              location:
                Object.values(candidate.items).filter((q) => q > 0).length < 12 ? "bag" : "depot",
            };
          } else {
            h.weapon.stage = def.weaponStage;
            h.weapon.history.push(c.id);
          }
          if (
            p.race === "android" &&
            def.chapter === 1 &&
            !d.unlockedModules.includes("mn-scanner")
          )
            d.unlockedModules.push("mn-scanner");
        }
      });
      if (committed) {
        s.say(
          choice
            ? choice.reply
            : "effect" in def
              ? def.effect.description
              : "Zapisano zakończenie rozdziału.",
        );
        if (p.level > previousLevel) s.emit({ type: "level", ...p, text: "Poziom " + p.level });
      }
      return;
    }
    if (progress.status !== "active") return;
    const goal = def.goals[progress.step]!;
    if (c.action !== "act") return;
    if (c.goalId !== goal.id || c.revision !== progress.goal.revision) return;
    const target = this.targets(goal, def.world).find((t) => t.id === c.targetId) ?? null;
    const event: GoalCommand = {
      ...c.interaction,
      owner: s.saves.identity,
      goalId: goal.id,
      eventId: crypto.randomUUID(),
      expectedRevision: c.revision,
      targetId: c.targetId,
    };
    this.apply(c.id, goal, progress, event, this.goalContext(goal, target));
  }
  private apply(
    id: HeritageContentId,
    goal: HeritageGoal,
    progress: HeritageProgress,
    event: GoalCommand,
    context: GoalContext,
  ) {
    const s = this.session,
      h = s.player.development?.heritage;
    if (h?.recentEventIds.includes(event.eventId)) return;
    const result = reduceGoal(goal, progress.goal, event, context);
    if (!result.changed) {
      if (result.reason) s.say(result.reason);
      return;
    }
    const def = heritageDefinition(id)!;
    if (
      this.commit((d, p) => {
        this.table(d, id)[id] = advanceHeritage(progress, result.next, def.goals.length);
        for (const [id, delta] of Object.entries(result.materials))
          d.heritage.materials[id] = (d.heritage.materials[id] ?? 0) + delta;
        d.heritage.recentEventIds = rememberGoalEvent(d.heritage.recentEventIds, event.eventId);
        if (result.preparedWeaponStage !== null)
          d.heritage.preparedWeaponStage = result.preparedWeaponStage;
        if (result.weaponName && d.heritage.weapon) {
          d.heritage.weapon.name = result.weaponName;
          d.heritage.preparedWeaponStage = 4;
        }
        p.ki -= result.kiDebit;
      })
    ) {
      if (result.reason) s.say(result.reason);
    }
  }
  tick(dt: number) {
    const s = this.session;
    if (s.player.dead) {
      this.cancelRoute();
      return;
    }
    if (!s.saves) return;
    this.updateRoute();
    this.activity?.attempt.update();
    this.observeIn += dt;
    if (this.observeIn < 1000) return;
    this.observeIn = 0;
    for (const def of [...HERITAGE_QUESTS, ...WORLD_PROJECTS]) {
      const progress = this.progress(def.id);
      if (!progress || progress.status !== "active") continue;
      const goal = def.goals[progress.step]!;
      if ((goal.world ?? def.world) !== this.feature) continue;
      const context = this.goalContext(goal, null);
      const base = {
        owner: s.saves.identity,
        goalId: goal.id,
        eventId: crypto.randomUUID(),
        expectedRevision: progress.goal.revision,
        targetId: "",
      };
      if (
        goal.kind === "projects" &&
        goal.required.every((id) => context.completedProjects.has(id))
      )
        this.apply(
          def.id,
          goal,
          progress,
          { ...base, kind: "projects", source: "committed-state" },
          context,
        );
      if (goal.kind === "observe" && !s.player.interior) {
        const enemy = s.enemies.find(
          (e) =>
            e.kind === goal.species &&
            e.hp > 0 &&
            !e.m.hidden &&
            distance(e, s.player) <= 650 &&
            s.nav.visible(s.player, e),
        );
        if (enemy) {
          context.approvedObservations = new Map([
            [
              base.eventId,
              {
                owner: base.owner,
                goalId: goal.id,
                species: enemy.kind,
                alive: true,
                point: enemy,
                feature: s.world.id,
              },
            ],
          ]);
          this.apply(
            def.id,
            goal,
            progress,
            { ...base, kind: "observe", source: "monster-runtime", species: enemy.kind },
            context,
          );
        }
      }
    }
  }
  weaponCommand(action: "equip" | "deposit" | "withdraw" | "unequip") {
    const s = this.session,
      p = s.player,
      w = p.development?.heritage.weapon;
    if (
      !w ||
      !s.saves ||
      w.owner !== s.saves.identity ||
      w.race !== p.race ||
      p.dead ||
      s.combatIn > 0
    )
      return s.say("Broń musi należeć do tej postaci. Zmień wyposażenie po walce.");
    if (action === "unequip") {
      if (p.weapon !== "heritage") return;
      if (
        this.commit((_d, candidate) => {
          candidate.weapon = null;
        })
      )
        s.say("Zdjęto osobistą broń.");
      return;
    }
    if (action === "equip") {
      if (w.location !== "bag") return s.say("Najpierw odbierz osobistą broń ze swojego depozytu.");
      if (
        this.commit((_d, candidate) => {
          candidate.weapon = "heritage";
        })
      )
        s.say("Założono: " + w.name);
      return;
    }
    if (
      !s.depotOpen ||
      p.interior !== "depot" ||
      distance(p, cityRoom("depot", p.continent).chest) > 115
    )
      return s.say("Otwórz własną skrzynię w depozycie.");
    if (action === "deposit" && p.weapon === "heritage")
      return s.say("Zdejmij broń przed odłożeniem.");
    if (
      (action === "deposit" && w.location !== "bag") ||
      (action === "withdraw" && w.location !== "depot")
    )
      return;
    if (action === "withdraw" && Object.values(p.items).filter((q) => q > 0).length >= 12)
      return s.say("Brak wolnego miejsca. Broń pozostaje bezpieczna w depozycie.");
    if (
      this.commit((d) => {
        d.heritage.weapon!.location = action === "deposit" ? "depot" : "bag";
      })
    )
      s.say(
        action === "deposit"
          ? "Odłożono osobistą broń. Jej historia i stopień są zachowane."
          : "Odebrano osobistą broń ze skrzyni.",
      );
  }
  snapshot() {
    const s = this.session;
    return [...HERITAGE_QUESTS, ...WORLD_PROJECTS]
      .filter((def) => def.race === s.player.race)
      .map((def) => {
        const progress = this.progress(def.id);
        const goal = def.goals[progress?.step ?? 0] ?? def.goals.at(-1)!;
        const targets = this.targets(goal, def.world).map((t) => ({
          ...t,
          near: this.near(t),
          distance:
            t.interior === s.player.interior ? Math.round(distance(t.point, s.player)) : null,
        }));
        return {
          id: def.id,
          locked: this.available(def.id),
          status: progress?.status ?? "available",
          goal,
          targets,
          near: targets.some((t) => t.near),
          progress: progress ?? null,
        };
      });
  }
  markers(): HeritageTarget[] {
    return this.snapshot()
      .filter((v) => v.status === "active" || v.status === "ready")
      .flatMap((v) => v.targets.filter((t) => t.interior === this.session.player.interior));
  }
}
