import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  commandDigest,
  type CharacterRecord,
  type CharacterState,
  type Principal,
  type PgCharacterRepository,
} from "./repository";
import { onlineCommand } from "./commands";
import { prepareServerSimulation } from "./superiorSimulation";

type Simulation = Awaited<ReturnType<typeof prepareServerSimulation>>;
type Repository = Pick<
  PgCharacterRepository,
  "read" | "acquire" | "release" | "commit" | "receipt"
>;
/** One exclusive, serialized server simulation. No caller can supply delta time or a checkpoint. */
export class OnlineSession {
  /** Fixed ticks are written to PostgreSQL at most this often (a full transaction per 50 ms tick
   * took longer than the tick itself and made walking choppy). Commands and closing always write. */
  static checkpointEveryMs = 2000;
  readonly id: string;
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private failed = false;
  private pending = 0;
  private direction = { x: 0, y: 0, until: 0 };
  private elapsed = 0;
  private sequence = 0;
  private frameSeq = 0;
  private lastCheckpointAt = Number.NEGATIVE_INFINITY;
  private dirty = false;
  private receipts = new Map<string, { digest: string; revision: number }>();
  private constructor(
    private repository: Repository,
    private owner: Principal,
    private record: CharacterRecord,
    private leaseId: string,
    private simulation: Simulation,
    private publicRoot: string,
  ) {
    this.id = record.id;
  }

  static async open(
    repository: Repository,
    owner: Principal,
    id: string,
    publicRoot: string,
    factory: typeof prepareServerSimulation = prepareServerSimulation,
  ) {
    // Ownership checked before acquiring resources or disclosing another character's lease.
    await repository.read(owner, id);
    const leaseId = randomUUID();
    await repository.acquire(owner, id, leaseId);
    try {
      const record = await repository.read(owner, id);
      const simulation = await factory(record, publicRoot);
      return new OnlineSession(repository, owner, record, leaseId, simulation, publicRoot);
    } catch (error) {
      await repository.release(id, leaseId).catch(() => {});
      throw error;
    }
  }

  setStaff(role: "admin" | "gm" | undefined) {
    this.simulation.session.staff = role ?? null;
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    if (this.stopped || this.failed) return Promise.reject(Error("SESSION_CLOSED"));
    if (this.pending >= 32) return Promise.reject(Error("TOO_MANY_COMMANDS"));
    this.pending++;
    const next = this.queue.then(async () => {
      if (this.stopped || this.failed) throw Error("SESSION_CLOSED");
      return task();
    });
    this.queue = next
      .catch(() => {})
      .finally(() => {
        this.pending--;
      });
    return next;
  }

  private async checkpoint(
    operationId: string,
    digest: string,
    checkpointOnly = false,
    stateOverride?: CharacterState,
  ) {
    try {
      const state = stateOverride ?? this.simulation.capture();
      const result = await this.repository.commit({
        principal: this.owner,
        characterId: this.record.id,
        expectedRevision: this.record.revision,
        operationId,
        commandDigest: digest,
        state,
        leaseId: this.leaseId,
        checkpointOnly,
      });
      this.record = { id: this.record.id, revision: result.revision, state };
      this.lastCheckpointAt = performance.now();
      this.dirty = false;
      return result.revision;
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }

  async command(operationId: string, input: unknown) {
    z.string().uuid().parse(operationId);
    const command = onlineCommand(input, !!this.simulation.session.staff),
      digest = commandDigest(command);
    return this.serialize(async () => {
      const old = this.receipts.get(operationId);
      if (old) {
        if (old.digest !== digest) throw Error("OPERATION_REUSED");
        return { revision: old.revision, duplicate: true, frame: this.view() };
      }
      const durable = await this.repository.receipt(
        this.owner,
        this.record.id,
        operationId,
        digest,
      );
      if (durable !== null) return { revision: durable, duplicate: true, frame: this.view() };
      if (this.receipts.size >= 1000) this.receipts.delete(this.receipts.keys().next().value!);
      let replacement: Simulation | undefined;
      let state: CharacterState | undefined;
      if (command.type === "travel" || command.type === "staff-travel") {
        state = await this.simulation.travel(
          command.destination,
          command.type === "staff-travel",
          command.type === "staff-travel" ? command.point : undefined,
        );
        replacement = await prepareServerSimulation({ ...this.record, state }, this.publicRoot);
        replacement.session.staff = this.simulation.session.staff;
        state = replacement.capture();
      } else this.simulation.command(command);
      if (
        command.type === "exam-start" ||
        command.type === "exam-action" ||
        command.type === "trial-start" ||
        command.type === "trial-action"
      )
        this.direction = { x: 0, y: 0, until: 0 };
      let revision: number;
      try {
        revision = await this.checkpoint(operationId, digest, false, state);
      } catch (error) {
        replacement?.dispose();
        throw error;
      }
      if (replacement) {
        this.simulation.dispose();
        this.simulation = replacement;
        this.direction = { x: 0, y: 0, until: 0 };
      }
      this.receipts.set(operationId, { digest, revision });
      return { revision, duplicate: false, frame: this.view() };
    });
  }

  /** Manual input is a bounded direction, not coordinates, speed or elapsed time from the client. */
  setDirection(x: number, y: number) {
    z.number().finite().min(-1).max(1).parse(x);
    z.number().finite().min(-1).max(1).parse(y);
    const length = Math.max(1, Math.hypot(x, y));
    this.direction = { x: x / length, y: y / length, until: this.elapsed + 200 };
  }

  tick(dt = 50) {
    z.number().finite().min(1).max(250).parse(dt);
    return this.serialize(async () => {
      this.elapsed += dt;
      if (
        this.direction.until >= this.elapsed &&
        Math.hypot(this.direction.x, this.direction.y) > 0
      )
        this.simulation.activeSession.manual(this.direction.x, this.direction.y, dt);
      await this.simulation.tick(dt);
      // Fixed server tick: written on a fixed period; a failed write still stops the session.
      if (performance.now() - this.lastCheckpointAt >= OnlineSession.checkpointEveryMs)
        await this.checkpoint(randomUUID(), commandDigest({ serverTick: ++this.sequence }), true);
      else this.dirty = true;
      return this.view();
    });
  }

  view() {
    if (this.failed || this.stopped) throw Error("SESSION_CLOSED");
    const s = this.simulation.session;
    const e = this.simulation.exam;
    const t = this.simulation.trial;
    return {
      trial: t
        ? {
            instanceId: t.instanceId,
            id: t.trialId,
            tier: t.tier,
            started: t.started,
            suspended: t.session.paused,
            result: t.snapshot(),
            view: t.session.snapshot(),
            facing: { ...t.session.facing },
            moving: t.session.moving,
            events: t.session.events.splice(0),
            enemies: structuredClone(t.session.enemies),
            nowMs: t.session.nowMs,
          }
        : null,
      exam: e
        ? {
            instanceId: e.instanceId,
            spec: e.spec,
            race: e.race,
            rehearsal: e.rehearsal,
            result: e.snapshot(),
            windowOpen: e.windowOpen,
            currentPoint: e.currentPoint ?? null,
            view: e.session.snapshot(),
            facing: e.session.facing,
            moving: e.session.moving,
            events: e.session.events.splice(0),
            enemies: structuredClone(e.session.enemies),
            nowMs: e.session.nowMs,
          }
        : null,
      characterId: this.record.id,
      revision: this.record.revision,
      // Frames between two durable writes share a revision; `seq` keeps them in order.
      seq: ++this.frameSeq,
      feature: this.simulation.feature,
      view: s.snapshot(),
      enemies: structuredClone(s.enemies),
      loot: structuredClone(s.loot),
      facing: { ...s.facing },
      moving: s.moving,
      events: s.events.splice(0),
      checkpoint: this.record.state,
      targetId: s.targetId,
      nowMs: s.nowMs,
    };
  }

  async close() {
    if (this.stopped) return;
    this.stopped = true;
    await this.queue;
    // Progress made since the last periodic write is saved before the lease is released.
    if (this.dirty && !this.failed)
      await this.checkpoint(
        randomUUID(),
        commandDigest({ serverTick: ++this.sequence }),
        true,
      ).catch(() => {});
    this.simulation.dispose();
    await this.repository.release(this.record.id, this.leaseId);
  }
}
