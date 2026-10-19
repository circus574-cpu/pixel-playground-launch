import { describe, expect, it } from 'vitest';
import { sketchPreviewFormat } from '@/lib/sketches.preview';

describe('Private sketch previews', () => {
  it('supports images, PDF, text and recordings', () => {
    expect(sketchPreviewFormat('mapa.PNG')).toEqual({ kind: 'image', mime: 'image/png' });
    expect(sketchPreviewFormat('projekt.pdf')?.kind).toBe('pdf');
    expect(sketchPreviewFormat('notatki.md')?.kind).toBe('text');
    expect(sketchPreviewFormat('film.mp4')?.kind).toBe('video');
    expect(sketchPreviewFormat('dzwiek.mp3')?.kind).toBe('audio');
  });
  it('never renders uploaded HTML or scripts as executable documents', () => {
    expect(sketchPreviewFormat('szkic.html')).toEqual({ kind: 'text', mime: 'text/plain' });
    expect(sketchPreviewFormat('kod.js')).toEqual({ kind: 'text', mime: 'text/plain' });
  });
  it('keeps unsupported formats out of embedded viewers', () => {
    expect(sketchPreviewFormat('projekt.blend')).toBeNull();
    expect(sketchPreviewFormat('program.exe')).toBeNull();
  });
});