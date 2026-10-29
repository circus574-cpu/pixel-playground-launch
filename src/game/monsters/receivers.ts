import type { Point } from "../navigation";
import type { Enemy, FxSpec } from "./types";
import type { HurtKind } from "./system";

/** A genuine damage receiver. Registration and AI focus belong to the current monster system. */
export type MonsterReceiver = {
  readonly id: string;
  readonly body: Point & { hp: number; dead: boolean };
  readonly maxHp: number;
  valid(): boolean;
  hurt(
    raw: number,
    from: Enemy,
    kind: HurtKind,
    fixed?: boolean,
  ): { dealt: number; evaded: boolean };
  applyFx(fx: FxSpec, from: Enemy): void;
};
