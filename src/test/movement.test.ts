import { describe, expect, it } from 'vitest';
import { blockedAt, clearSight } from '../game/movement';

const wall = [{ x: 100, y: 100, width: 30, height: 80 }];
describe('forest collision and attack visibility', () => {
  it('keeps the entire foot collider outside obstacles, including corners', () => {
    expect(blockedAt(90, 120, wall)).toBe(true);
    expect(blockedAt(95, 95, wall)).toBe(true);
    expect(blockedAt(80, 120, wall)).toBe(false);
  });
  it('prevents attacks through an obstacle even when the target is nearby', () => {
    expect(clearSight(90, 140, 140, 140, wall)).toBe(false);
    expect(clearSight(90, 70, 140, 70, wall)).toBe(true);
  });
});
