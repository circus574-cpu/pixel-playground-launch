import type { EscortCheckpoint } from "./escort";
import { distance, type Point } from "../../navigation";
import type { RaceId, WorldId } from "../../world/races";
import {
  emptyGoalProgress,
  type GoalProgress,
  type HeritageGoal,
  type HeritageProgress,
  type WorldProjectId,
} from "./types";

export type GoalCommand = {
  owner: string;
  goalId: string;
  eventId: string;
  expectedRevision: number;
  targetId: string;
} & (
  | { kind: "talk"; responseId: string }
  | { kind: "inspect" }
  | { kind: "solve"; answerId: string }
  | { kind: "recover" }
  | { kind: "craft" }
  | { kind: "consent"; granted: boolean; mode: "named" | "anonymous" }
  | { kind: "name-weapon"; name: string }
  | { kind: "forge"; operationId: string }
  | { kind: "retry" }
  // These three sources are constructed by the kit/observer/owned activity, never by a UI command.
  | { kind: "measure"; source: "kit"; damage: number }
  | { kind: "observe"; source: "monster-runtime"; species: string }
  | { kind: "activity"; source: "activity-runtime"; attemptId: string }
  | { kind: "escort-checkpoint"; source: "activity-runtime"; attemptId: string }
  | { kind: "projects"; source: "committed-state" }
);
export type ApprovedActivity = {
  owner: string;
  goalId: string;
  outcome: "passed";
  checkpoints: number;
  protectedPoints: number;
  windows: number;
  healthFraction: number;
  errors: number;
  surrendered: boolean;
};
export type ApprovedObservation = {
  owner: string;
  goalId: string;
  species: string;
  alive: boolean;
  point: Point;
  feature: WorldId;
};
export type ApprovedHit = { owner: string; goalId: string; targetId: string; damage: number };
export type GoalContext = {
  owner: string;
  race: RaceId;
  feature: WorldId | `island-${1 | 2 | 3 | 4 | 5 | 6}`;
  interior: string | null;
  player: Point;
  target: { id: string; point: Point; feature: WorldId; interior: string | null } | null;
  visible: (a: Point, b: Point) => boolean;
  materials: Readonly<Record<string, number>>;
  currentKi: number;
  kiCostMultiplier: number;
  completedProjects: ReadonlySet<WorldProjectId>;
  approvedActivities: ReadonlyMap<string, ApprovedActivity>;
  approvedEscortCheckpoints?: ReadonlyMap<string, EscortCheckpoint>;
  approvedObservations: ReadonlyMap<string, ApprovedObservation>;
  approvedHits: ReadonlyMap<string, ApprovedHit>;
  weaponOwned: boolean;
};
export type GoalReduction = {
  next: GoalProgress;
  changed: boolean;
  reason: string;
  materials: Record<string, number>;
  kiDebit: number;
  weaponName: string | null;
  preparedWeaponStage: number | null;
};
export const goalTargetIds = (goal: HeritageGoal): string[] => {
  const count =
    goal.kind === "talk" ||
    goal.kind === "inspect" ||
    goal.kind === "solve" ||
    goal.kind === "recover"
      ? goal.targets.length
      : goal.kind === "consent"
        ? goal.witnesses.length
        : goal.kind === "measure"
          ? goal.hits
          : goal.kind === "observe" || goal.kind === "projects"
            ? 0
            : 1;
  return Array.from({ length: count }, (_, i) => `${goal.id}:target:${i}`);
};
export function weaponNameError(value: string): string {
  const text = value.normalize("NFKC").trim();
  if ([...text].length < 3 || [...text].length > 24)
    return "Nazwa broni powinna mieć od 3 do 24 znaków.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*[\p{L}\p{N}]$/u.test(text))
    return "Użyj liter, cyfr, spacji, apostrofu, kropki lub łącznika. Bez znaczników i znaków sterujących.";
  return "";
}
export type ForgeOperation = { id: string; label: string };
export function forgeProcedure(
  goal: Extract<HeritageGoal, { kind: "forge" }>,
  race: RaceId,
): ForgeOperation[] {
  if (goal.stage === 1)
    return [
      { id: "edge", label: "Sprawdź krawędź" },
      { id: "grip", label: "Sprawdź uchwyt i izolację" },
      { id: "mark", label: "Zachowaj pierwotny znak" },
    ];
  if (goal.stage === 2)
    return [
      { id: "align", label: "Wyrównaj uszkodzone połączenie" },
      { id: "seat", label: "Osadź część naprawczą" },
      { id: "lock", label: "Sprawdź mocowanie bez usuwania znaku" },
    ];
  if (goal.stage === 3)
    return [
      { id: "source", label: "Odczytaj zachowany wzorzec" },
      {
        id: "rhythm",
        label: race === "android" ? "Dopasuj własny sygnał" : "Zestrój narzędzie z własnym rytmem",
      },
      { id: "test", label: "Sprawdź zgodność i zapisz granicę pomiaru" },
    ];
  if (goal.stage === 5)
    return race === "android"
      ? [
          { id: "heat", label: "Odłącz sterowanie przy zachowanej pamięci" },
          { id: "even", label: "Przeprowadź równą kalibrację przepływu" },
          { id: "cool", label: "Przetestuj ręczny odłącznik" },
        ]
      : [
          {
            id: "heat",
            label: race === "sage" ? "Osłoń rdzeń kostura" : "Przygotuj równy żar paleniska",
          },
          { id: "even", label: "Sprawdź równomierne wzmocnienie" },
          {
            id: "cool",
            label:
              race === "sage"
                ? "Sprawdź zachowanie podpisów źródeł"
                : "Przeprowadź stopniowe chłodzenie",
          },
        ];
  return [1, 2, 3, 4, 5, 6].map((stage) => ({
    id: "history-" + stage,
    label: [
      "Odzyskanie narzędzia",
      "Naprawa oprawy",
      "Zestrojenie",
      "Własna nazwa",
      "Hartowanie lub kalibracja",
      "Historia dla następcy",
    ][stage - 1]!,
  }));
}
function materialRequirements(
  parts: readonly { material: string; quantity: number }[],
): Record<string, number> | null {
  const result: Record<string, number> = {};
  for (const part of parts) {
    if (!part.material || !Number.isSafeInteger(part.quantity) || part.quantity <= 0) return null;
    result[part.material] = (result[part.material] ?? 0) + part.quantity;
    if (!Number.isSafeInteger(result[part.material]) || result[part.material]! > 10000) return null;
  }
  return result;
}
function physical(goal: HeritageGoal, event: GoalCommand, context: GoalContext) {
  const target = context.target;
  return (
    target !== null &&
    target.id === event.targetId &&
    goalTargetIds(goal).includes(target.id) &&
    context.feature === target.feature &&
    context.interior === target.interior &&
    Number.isFinite(context.player.x) &&
    Number.isFinite(context.player.y) &&
    Math.hypot(context.player.x - target.point.x, context.player.y - target.point.y) <= 130 &&
    context.visible(context.player, target.point)
  );
}
/** Pure objective reducer. It proposes effects; only the session's whole-character CAS publishes them. */
export function reduceGoal(
  goal: HeritageGoal,
  previous: GoalProgress,
  event: GoalCommand,
  context: GoalContext,
): GoalReduction {
  const result: GoalReduction = {
    next: previous,
    changed: false,
    reason: "",
    materials: {},
    kiDebit: 0,
    weaponName: null,
    preparedWeaponStage: null,
  };
  const reject = (reason: string) => ({ ...result, reason });
  if (
    event.owner !== context.owner ||
    event.goalId !== goal.id ||
    event.expectedRevision !== previous.revision ||
    !Number.isSafeInteger(event.expectedRevision) ||
    event.eventId.length < 1 ||
    event.eventId.length > 160
  )
    return reject("Nieaktualna czynność. Otwórz bieżący etap ponownie.");
  if (event.kind === "retry") {
    if (previous.outcome !== "failed") return result;
    return {
      ...result,
      changed: true,
      next: { ...emptyGoalProgress(), revision: previous.revision + 1 },
      reason: "Etap przygotowany do ponowienia. Wcześniejsze dokonania i nagrody zachowano.",
    };
  }
  if (previous.outcome !== "active") return result;
  const automatic =
    event.kind === "projects" ||
    event.kind === "observe" ||
    event.kind === "activity" ||
    event.kind === "escort-checkpoint" ||
    event.kind === "measure";
  if (!automatic && !physical(goal, event, context))
    return reject("Podejdź do właściwego miejsca i sprawdź, czy nic nie zasłania interakcji.");
  if (event.kind === "measure" && !physical(goal, event, context))
    return reject("Trafienie nie należy do pobliskiego celu tego stanowiska.");
  const next = structuredClone(previous);
  const completeTarget = () => {
    if (next.completedTargetIds.includes(event.targetId)) return false;
    next.completedTargetIds.push(event.targetId);
    next.sequence = next.completedTargetIds.length;
    if (next.sequence >= goalTargetIds(goal).length) next.outcome = "done";
    return true;
  };
  const wrong = (reason: string, maxErrors: number | null) => {
    next.errors++;
    if (maxErrors !== null && next.errors > maxErrors) next.outcome = "failed";
    result.reason = reason;
  };
  switch (goal.kind) {
    case "talk": {
      if (event.kind !== "talk" || !goal.responses.some((r) => r.id === event.responseId))
        return reject("Wybierz odpowiedź w rozmowie z właściwą osobą.");
      if (!completeTarget()) return result;
      result.reason = goal.responses.find((r) => r.id === event.responseId)!.reply;
      break;
    }
    case "inspect": {
      if (event.kind !== "inspect") return result;
      if (!completeTarget()) return result;
      result.reason = goal.observations[goalTargetIds(goal).indexOf(event.targetId)]!;
      break;
    }
    case "solve": {
      if (event.kind !== "solve") return result;
      const index = goalTargetIds(goal).indexOf(event.targetId);
      if (index !== previous.sequence)
        return reject("Najpierw zakończ poprzedni element podanej kolejności.");
      const puzzle = goal.puzzles[index];
      if (!puzzle || !puzzle.options.some((o) => o.id === event.answerId))
        return reject("Wybierz jedną z odpowiedzi urządzenia.");
      if (puzzle.answerId !== event.answerId)
        wrong(puzzle.options.find((o) => o.id === event.answerId)!.reply, goal.maxErrors);
      else {
        completeTarget();
        result.reason = puzzle.options.find((o) => o.id === event.answerId)!.reply;
      }
      break;
    }
    case "recover": {
      if (event.kind !== "recover") return result;
      if (!Number.isSafeInteger(goal.quantityPerTarget) || goal.quantityPerTarget <= 0)
        return reject("Nieprawidłowa ilość części; niczego nie dodano.");
      if (!completeTarget()) return result;
      result.materials[goal.material] = goal.quantityPerTarget;
      result.reason =
        "Odzyskano: " +
        goal.materialName +
        ". Część należy do tego zlecenia i nie trafia do handlu.";
      break;
    }
    case "craft": {
      if (event.kind !== "craft") return result;
      const requirements = materialRequirements(goal.recipe);
      if (!requirements) return reject("Nieprawidłowa receptura. Niczego nie zużyto.");
      for (const [material, quantity] of Object.entries(requirements))
        if (
          !Number.isSafeInteger(context.materials[material] ?? 0) ||
          (context.materials[material] ?? 0) < quantity
        )
          return reject(
            "Brakuje przygotowanych części. Sprawdź wcześniejsze oznaczone miejsca tego zlecenia.",
          );
      const cost = Math.round((goal.kiCost ?? 0) * context.kiCostMultiplier);
      if (!Number.isFinite(cost) || cost < 0 || context.currentKi < cost)
        return reject("Za mało KI do tej pracy. Niczego nie zużyto.");
      if (!completeTarget()) return result;
      for (const [material, quantity] of Object.entries(requirements))
        result.materials[material] = -quantity;
      result.kiDebit = cost;
      result.reason = "Praca wykonana. Zużyto wyłącznie wskazane części i koszt KI.";
      break;
    }
    case "consent": {
      if (event.kind !== "consent") return result;
      if (!event.granted)
        return reject("Nie udzielono zgody. Świadectwo nie zostanie zapisane jako zaakceptowane.");
      if (!completeTarget()) return result;
      next.consent[event.targetId] = event.mode;
      result.reason = event.mode === "named" ? goal.namedReply : goal.anonymousReply;
      break;
    }
    case "projects": {
      if (event.kind !== "projects" || event.source !== "committed-state") return result;
      if (!goal.required.every((id) => context.completedProjects.has(id)))
        return reject("Najpierw ukończ wskazane projekty odbudowy.");
      next.outcome = "done";
      next.sequence = goal.required.length;
      result.reason = "Wymagane projekty są ukończone i zapisane.";
      break;
    }
    case "observe": {
      if (
        event.kind !== "observe" ||
        event.source !== "monster-runtime" ||
        event.species !== goal.species
      )
        return result;
      const observation = context.approvedObservations.get(event.eventId);
      if (
        !observation ||
        observation.owner !== context.owner ||
        observation.goalId !== goal.id ||
        observation.species !== goal.species ||
        !observation.alive ||
        observation.feature !== context.feature ||
        Math.hypot(context.player.x - observation.point.x, context.player.y - observation.point.y) >
          650 ||
        !context.visible(context.player, observation.point)
      )
        return reject("Brakuje rzeczywistej obserwacji żywego celu w zasięgu wzroku.");
      next.outcome = "done";
      next.sequence = 1;
      result.reason = "Zaobserwowano właściwego żywego przeciwnika w rzeczywistym świecie.";
      break;
    }
    case "measure": {
      if (
        event.kind !== "measure" ||
        event.source !== "kit" ||
        !Number.isFinite(event.damage) ||
        event.damage <= 0
      )
        return result;
      const hit = context.approvedHits.get(event.eventId);
      if (
        !hit ||
        hit.owner !== context.owner ||
        hit.goalId !== goal.id ||
        hit.targetId !== event.targetId ||
        hit.damage !== event.damage ||
        hit.damage <= 0
      )
        return reject("Brakuje potwierdzonego trafienia z systemu walki.");
      if (!completeTarget()) return result;
      result.reason =
        "Zapisano rzeczywiste trafienie i odczyt zestawu. Nie przyznano praktyki za strzał.";
      break;
    }
    case "name-weapon": {
      if (event.kind !== "name-weapon" || !context.weaponOwned)
        return reject("Najpierw odzyskaj własną broń w poprzednich rozdziałach.");
      const reason = weaponNameError(event.name);
      if (reason) return reject(reason);
      next.outcome = "done";
      next.sequence = 1;
      result.weaponName = event.name.normalize("NFKC").trim();
      result.reason = "Zapisano własną nazwę broni.";
      break;
    }
    case "forge": {
      if (event.kind !== "forge" || (goal.stage > 1 && !context.weaponOwned))
        return reject("Pracuj na własnej broni, zachowując kolejność jej etapów.");
      const procedure = forgeProcedure(goal, context.race);
      const step = procedure[next.sequence];
      if (!step) return result;
      if (event.operationId !== step.id)
        wrong(
          "Ta czynność nie odpowiada następnemu krokowi instrukcji. Sprawdź zaznaczoną kolejność.",
          2,
        );
      else {
        if (next.sequence === procedure.length - 1) {
          const requirements = materialRequirements(goal.recipe);
          if (!requirements) return reject("Nieprawidłowy zestaw kowalski. Niczego nie zużyto.");
          for (const [material, quantity] of Object.entries(requirements))
            if (
              !Number.isSafeInteger(context.materials[material] ?? 0) ||
              (context.materials[material] ?? 0) < quantity
            )
              return reject(
                "Brakuje przygotowanego zestawu kowalskiego. Odbierz go w oznaczonym miejscu tego zlecenia.",
              );
          for (const [material, quantity] of Object.entries(requirements))
            result.materials[material] = -quantity;
        }
        next.sequence++;
        if (next.sequence === procedure.length) {
          next.outcome = "done";
          result.preparedWeaponStage = goal.stage;
        }
        result.reason = "Kowal potwierdza: " + step.label + ".";
      }
      break;
    }
    case "escort": {
      if (event.kind !== "escort-checkpoint") {
        // Combat escorts still require the separate, final protected-actor proof below.
        if (!goal.combat) return result;
        if (event.kind !== "activity" || event.source !== "activity-runtime") return result;
        const proof = context.approvedActivities.get(event.attemptId);
        if (
          !proof ||
          proof.owner !== context.owner ||
          proof.goalId !== goal.id ||
          proof.outcome !== "passed" ||
          proof.checkpoints < goal.checkpoints ||
          proof.healthFraction < goal.minHealthFraction
        )
          return reject("Brakuje rzeczywistego wyniku eskorty bojowej.");
        next.sequence = goal.checkpoints;
        next.outcome = "done";
        break;
      }
      const proof = context.approvedEscortCheckpoints?.get(event.attemptId);
      if (
        goal.combat ||
        !proof ||
        proof.owner !== context.owner ||
        proof.goalId !== goal.id ||
        ![
          proof.actor.x,
          proof.actor.y,
          proof.player.x,
          proof.player.y,
          proof.healthFraction,
          proof.checkpoint,
        ].every(Number.isFinite) ||
        !Number.isInteger(proof.checkpoint) ||
        proof.healthFraction > 1 ||
        distance(proof.player, context.player) > 1 ||
        proof.checkpoint !== previous.sequence + 1 ||
        proof.checkpoint > goal.checkpoints ||
        proof.healthFraction < goal.minHealthFraction ||
        distance(proof.actor, proof.player) > 150 ||
        !context.visible(proof.actor, proof.player)
      )
        return reject("Niepotwierdzony punkt eskorty.");
      next.sequence = proof.checkpoint;
      if (next.sequence === goal.checkpoints) next.outcome = "done";
      result.reason = "Punkt eskorty zapisany: " + next.sequence + "/" + goal.checkpoints;
      break;
    }
    case "protect":
    case "restraint": {
      if (event.kind !== "activity" || event.source !== "activity-runtime") return result;
      const proof = context.approvedActivities.get(event.attemptId);
      if (
        !proof ||
        proof.owner !== context.owner ||
        proof.goalId !== goal.id ||
        proof.outcome !== "passed"
      )
        return reject("Brakuje zatwierdzonego wyniku bieżącej próby.");
      const valid =
        goal.kind === "protect"
          ? proof.protectedPoints >= goal.points && proof.healthFraction >= goal.minHealthFraction
          : proof.windows >= goal.windows &&
            proof.errors <= goal.maxErrors &&
            (!goal.surrender || proof.surrendered);
      if (!valid) return reject("Wynik nie spełnia warunków tego etapu.");
      next.outcome = "done";
      next.sequence = 1;
      result.reason = "Rzeczywisty wynik próby został zatwierdzony.";
      break;
    }
  }
  next.revision++;
  return { ...result, next, changed: true };
}

export function advanceHeritage(
  progress: HeritageProgress,
  goal: GoalProgress,
  goalCount: number,
): HeritageProgress {
  if (goal.outcome !== "done") return { ...progress, goal };
  const step = progress.step + 1;
  return {
    ...progress,
    step,
    completedGoals: [...progress.completedGoals, goal],
    goal: emptyGoalProgress(),
    status: step >= goalCount ? "ready" : "active",
  };
}

/** Persist only this bounded raw-event window; permanent rewards use finite business receipts. */
export function rememberGoalEvent(recent: readonly string[], id: string): string[] {
  if (recent.includes(id)) return [...recent];
  return [...recent.slice(-63), id];
}
