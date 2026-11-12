/** Bounded presentation leases for temporary encounter actors, separate from authored spawn slots. */
export function reconcileEncounterAssets(
  kinds: Iterable<string>,
  owners: Iterable<string>,
  acquire: (kind: string, owner: string) => void,
  release: (owner: string) => void,
) {
  const live = new Set([...kinds].map((kind) => "encounter:" + kind));
  const held = new Set(owners);
  for (const owner of held) if (owner.startsWith("encounter:") && !live.has(owner)) release(owner);
  for (const owner of live) if (!held.has(owner)) acquire(owner.slice("encounter:".length), owner);
}
