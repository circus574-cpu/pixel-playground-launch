import Phaser from 'phaser';

/** Client-only Phaser scene; no server-side DOM access. */
export function mountKileGends(parent: HTMLElement): () => void {
  class ForestScene extends Phaser.Scene {
    private hero!: Phaser.GameObjects.Container;
    private destination: Phaser.Math.Vector2 | null = null;
    private blocked: Phaser.Geom.Rectangle[] = [];
    private enemies: { body: Phaser.GameObjects.Container; hp: number; bar: Phaser.GameObjects.Rectangle }[] = [];
    private target: (typeof this.enemies)[number] | null = null;
    private attackCooldown = 0;
    private readonly speed = 175;
    constructor() { super('Forest'); }

    create() {
      const worldW = 1920, worldH = 1440, tile = 48;
      this.cameras.main.setBackgroundColor('#182d1b');
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      const terrain = this.add.graphics();
      for (let y = 0; y < worldH; y += tile) for (let x = 0; x < worldW; x += tile) {
        const seed = ((x * 37 + y * 73) / tile) | 0;
        const path = (Math.abs(x - 960) < 125 || Math.abs(y - 700) < 95);
        terrain.fillStyle(path ? (seed % 3 ? 0x87795b : 0x968669) : (seed % 4 ? 0x3d6937 : 0x477741));
        terrain.fillRect(x, y, tile, tile);
        if (seed % 7 === 0) {
          terrain.fillStyle(path ? 0xb2a180 : 0x6d8b47, 0.5);
          terrain.fillCircle(x + 16, y + 29, 3);
        }
      }
      // Solid trees and boulders. Their trunks/rocks are collision geometry.
      for (let i = 0; i < 105; i++) {
        const x = 65 + ((i * 233 + 117) % 1790), y = 70 + ((i * 397 + 51) % 1290);
        if (Math.abs(x - 960) < 180 || Math.abs(y - 700) < 140) continue;
        if (i % 5 === 0) {
          this.add.ellipse(x, y + 10, 55, 23, 0x142515, 0.5);
          this.add.ellipse(x, y, 55, 38, 0x747b6e).setStrokeStyle(3, 0x343e36);
          this.blocked.push(new Phaser.Geom.Rectangle(x - 29, y - 19, 58, 38));
        } else {
          this.add.ellipse(x, y + 17, 56, 23, 0x10200f, 0.5);
          this.add.rectangle(x, y + 5, 16, 32, 0x62452b);
          this.add.circle(x, y - 17, 35, i % 3 ? 0x24532b : 0x376c32).setStrokeStyle(4, 0x173b22);
          this.add.circle(x - 12, y - 27, 17, 0x477c3a, 0.75);
          this.blocked.push(new Phaser.Geom.Rectangle(x - 16, y - 2, 32, 34));
        }
      }
      // Starting village houses.
      for (const [x, y] of [[690, 430], [1120, 420], [670, 925], [1170, 950]]) {
        this.add.rectangle(x, y + 13, 150, 110, 0x8a6b48).setStrokeStyle(5, 0x463b2e);
        this.add.triangle(x, y - 58, -86, 35, 0, -50, 86, 35, 0x793e2e).setStrokeStyle(4, 0x422b25);
        this.add.rectangle(x, y + 50, 28, 35, 0x362a20);
        this.blocked.push(new Phaser.Geom.Rectangle(x - 80, y - 76, 160, 139));
      }
      this.hero = this.makeCharacter(960, 700, 0x3159aa, 0xf2c9a0, 'Gracz');
      this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
      for (const [x, y] of [[1190, 690], [1360, 820], [1510, 540], [790, 1130]]) {
        const body = this.makeCharacter(x, y, 0x78432e, 0x80664b, 'Dzik');
        const bar = this.add.rectangle(x, y - 43, 44, 5, 0xc94b38);
        this.enemies.push({ body, hp: 3, bar });
      }
      const hud = this.add.text(14, 12, 'KI LEGENDS  •  Las Początkowy\\nKliknij ziemię: ruch  |  Kliknij dzika: atak', {
        fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#f5e5bb',
        backgroundColor: '#101b13', padding: { x: 12, y: 10 }
      }).setScrollFactor(0).setDepth(100);
      hud.setInteractive();
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const pos = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const clicked = this.enemies.find(e => e.hp > 0 && Phaser.Math.Distance.Between(pos.x, pos.y, e.body.x, e.body.y) < 32);
        this.target = clicked ?? null;
        this.destination = clicked ? null : new Phaser.Math.Vector2(pos.x, pos.y);
      });
      this.input.keyboard?.on('keydown-ESC', () => { this.target = null; this.destination = null; });
    }

    private makeCharacter(x: number, y: number, clothes: number, skin: number, label: string) {
      const shadow = this.add.ellipse(0, 13, 31, 11, 0x000000, 0.35);
      const legs = this.add.rectangle(0, 10, 17, 19, 0x292b31);
      const torso = this.add.rectangle(0, -7, 25, 29, clothes).setStrokeStyle(2, 0x1b1e1a);
      const head = this.add.circle(0, -27, 12, skin).setStrokeStyle(2, 0x24241e);
      const name = this.add.text(0, -57, label, { fontSize: '13px', fontFamily: 'Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      return this.add.container(x, y, [shadow, legs, torso, head, name]).setDepth(y);
    }

    private walkTowards(x: number, y: number, dt: number, stopDistance = 5) {
      const dx = x - this.hero.x, dy = y - this.hero.y, distance = Math.hypot(dx, dy);
      if (distance <= stopDistance) return true;
      const step = Math.min(distance - stopDistance, this.speed * dt / 1000);
      const nx = this.hero.x + dx / distance * step, ny = this.hero.y + dy / distance * step;
      const collides = (px: number, py: number) => this.blocked.some(b => b.contains(px, py) || b.contains(px - 10, py + 8) || b.contains(px + 10, py + 8));
      if (!collides(nx, ny)) this.hero.setPosition(nx, ny);
      else if (!collides(nx, this.hero.y)) this.hero.x = nx;
      else if (!collides(this.hero.x, ny)) this.hero.y = ny;
      else return true; // Stop when a solid obstacle blocks the path.
      this.hero.setDepth(this.hero.y);
      return false;
    }

    update(time: number, dt: number) {
      if (this.target && this.target.hp > 0) {
        if (this.walkTowards(this.target.body.x, this.target.body.y, dt, 55) && time >= this.attackCooldown) {
          this.attackCooldown = time + 700;
          this.target.hp--;
          const hit = this.add.text(this.target.body.x, this.target.body.y - 76, '-1', { fontSize: '24px', color: '#ffdd66', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
          this.tweens.add({ targets: hit, y: hit.y - 30, alpha: 0, duration: 500, onComplete: () => hit.destroy() });
          this.target.bar.width = Math.max(0, 44 * this.target.hp / 3);
          if (this.target.hp === 0) {
            this.target.body.destroy(); this.target.bar.destroy(); this.target = null;
          }
        }
      } else if (this.destination && this.walkTowards(this.destination.x, this.destination.y, dt)) {
        this.destination = null;
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 960, height: 540, backgroundColor: '#17251c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ForestScene],
  });
  return () => game.destroy(true);
}
