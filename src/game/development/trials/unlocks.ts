import { domainRank, type TrialGrades, type TrialDefinition } from "./catalog";
import type { VariantId, ModuleId } from "../state";

/** Shared reward/validation policy: earned unlocks are never auto-equipped. */
const MASTERY: readonly {
  race: TrialDefinition["race"];
  domain: TrialDefinition["domain"];
  variant: VariantId;
  module?: ModuleId;
}[] = [
  { race: "planetary", domain: "care", variant: "mv-root" },
  { race: "planetary", domain: "trails", variant: "mv-trail" },
  { race: "planetary", domain: "earth", variant: "mv-earth" },
  { race: "sage", domain: "focus", variant: "ma-focus" },
  { race: "sage", domain: "barriers", variant: "ma-barrier" },
  { race: "sage", domain: "seals", variant: "ma-seal" },
  { race: "android", domain: "thermals", variant: "mn-discharge", module: "mn-routing" },
  { race: "android", domain: "calibration", variant: "mn-mark", module: "mn-optics" },
  { race: "android", domain: "construction", variant: "mn-barrier", module: "mn-shield" },
  { race: "legend", domain: "body", variant: "mp-break" },
  { race: "legend", domain: "ember", variant: "mp-burst" },
  { race: "legend", domain: "duel", variant: "mp-cuts" },
];
export function requiredTrialUnlocks(grades: TrialGrades) {
  const variants: VariantId[] = [],
    modules: ModuleId[] = [];
  for (const rule of MASTERY) {
    if (domainRank(grades, rule.race, rule.domain) < 2) continue;
    variants.push(rule.variant);
    if (rule.module) modules.push(rule.module);
  }
  if ((grades.TN03 ?? 0) >= 2) modules.push("mn-precision");
  return { variants, modules };
}
