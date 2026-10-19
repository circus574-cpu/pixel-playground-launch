import Phaser from 'phaser';

/** Mount the game only in the browser. Never import this module during SSR. */
export function mountKileGends(parent: HTMLElement): () => void {
  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      this.cameras.main.setBackgroundColor('#17251c');
      this.add.text(32, 32, 'KileGends', { fontFamily: 'sans-serif', fontSize: '32px', color: '#e8d9ae' });
      this.add.text(32, 78, 'Phaser 4 — inicjalizacja silnika', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' });
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#17251c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene],
  });
  return () => { game.destroy(true); };
}
