import { describe, expect, it } from 'vitest';
import { uploadSketchSchema, sketchPathSchema } from '@/lib/sketches.validation';

describe('Sketch file rules', () => {
  it.each(['szkic.png', 'projekt.psd', 'model.blend', 'archiwum.zip', 'program.exe', 'notatki', 'dane.xyz'])('accepts any extension: %s', name => {
    expect(uploadSketchSchema.safeParse({ name, size: 100 }).success).toBe(true);
  });
  it('rejects traversal paths', () => {
    expect(sketchPathSchema.safeParse({ path: '../private/file' }).success).toBe(false);
    expect(uploadSketchSchema.safeParse({ name: '../file', size: 1 }).success).toBe(false);
  });
  it('enforces the storage size limit', () => {
    expect(uploadSketchSchema.safeParse({ name: 'large.any', size: 50 * 1024 * 1024 }).success).toBe(true);
    expect(uploadSketchSchema.safeParse({ name: 'large.any', size: 50 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});