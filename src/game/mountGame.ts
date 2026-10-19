import Phaser from 'phaser';
import { blockedAt, clearSight } from './movement';

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
    private keys?: Record<string, Phaser.Input.Keyboard.Key>;
    private joystickId: number | null = null;
    private joystickStart = new Phaser.Math.Vector2();
    private joystick = new Phaser.Math.Vector2();
    private stickBase!: Phaser.GameObjects.Arc;
    private stickKnob!: Phaser.GameObjects.Arc;
    private selection!: Phaser.GameObjects.Ellipse;
    private heroSprite!: Phaser.GameObjects.Sprite;
    private facing: 'down' | 'left' | 'right' | 'up' = 'down';
    private walking = false;
    private targetLabel!: Phaser.GameObjects.Text;
    constructor() { super('Forest'); }

    preload() {
      this.load.image('world-atlas', '/game/assets/world-v1.webp');
      this.load.image('hero-sheet', '/game/assets/hero-walk-v1.webp');
      this.load.image('terrain-sheet', '/game/assets/terrain-v1.webp');
    }

    create() {
      const atlas = this.textures.get('world-atlas');
      if (atlas.key !== '__MISSING') {
        const source = atlas.getSourceImage() as HTMLImageElement;
        // Bounds fitted to the generated atlas so the tree trunk is not clipped.
        const w = source.width, h = source.height;
        atlas.add('tree', 0, 0, 0, w * 0.515625, h * 0.546875);
        atlas.add('house', 0, w * 0.515625, 0, w * 0.484375, h * 0.546875);
        atlas.add('rock', 0, 0, h * 0.546875, w * 0.515625, h * 0.453125);
        atlas.add('boar', 0, w * 0.515625, h * 0.546875, w * 0.484375, h * 0.453125);
      }
      const sheet = this.textures.get('hero-sheet');
      if (sheet.key !== '__MISSING') {
        const source = sheet.getSourceImage() as HTMLImageElement;
        const w = source.width / 4, h = source.height / 4;
        ['down', 'left', 'right', 'up'].forEach((direction, row) => {
          for (let col = 0; col < 4; col++) sheet.add(row * 4 + col, 0, col * w, row * h, w, h);
          this.anims.create({ key: 'walk-' + direction, frames: Array.from({ length: 4 }, (_, i) => ({ key: 'hero-sheet', frame: row * 4 + i })), frameRate: 8, repeat: -1 });
        });
      }
      const ground = this.textures.get('terrain-sheet');
      if (ground.key !== '__MISSING') {
        const source = ground.getSourceImage() as HTMLImageElement;
        ground.add('grass', 0, 0, 0, source.width / 2, source.height);
        ground.add('dirt', 0, source.width / 2, 0, source.width / 2, source.height);
      }
      const worldW = 1920, worldH = 1440, tile = 48;
      this.cameras.main.setBackgroundColor('#182d1b');
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      for (let y = 0; y < worldH; y += tile) for (let x = 0; x < worldW; x += tile) {
        const path = Math.abs(x - 960) < 125 || Math.abs(y - 700) < 95;
        this.add.image(x, y, 'terrain-sheet', path ? 'dirt' : 'grass').setOrigin(0).setDisplaySize(tile, tile);
      }
      // Solid trees and boulders. Their trunks/rocks are collision geometry.
      for (let i = 0; i < 105; i++) {
        const x = 65 + ((i * 233 + 117) % 1790), y = 70 + ((i * 397 + 51) % 1290);
        if (Math.abs(x - 960) < 180 || Math.abs(y - 700) < 140) continue;
        if (i % 5 === 0) {
          this.add.image(x, y, 'world-atlas', 'rock').setDisplaySize(88, 88).setOrigin(0.5, 0.8).setDepth(y);
          this.blocked.push(new Phaser.Geom.Rectangle(x - 27, y - 17, 54, 34));
        } else {
          this.add.image(x, y, 'world-atlas', 'tree').setDisplaySize(154, 178).setOrigin(0.5, 0.95).setDepth(y);
          this.blocked.push(new Phaser.Geom.Rectangle(x - 14, y - 7, 28, 22));
        }
      }
      for (const [x, y] of [[690, 430], [1120, 420], [670, 925], [1170, 950]]) {
        this.add.image(x, y, 'world-atlas', 'house').setDisplaySize(210, 210).setOrigin(0.5, 0.90).setDepth(y);
        this.blocked.push(new Phaser.Geom.Rectangle(x - 70, y - 110, 140, 115));
      }
      this.hero = this.makeCharacter(960, 700, 'Gracz');
      this.heroSprite = this.hero.getAt(1) as Phaser.GameObjects.Sprite;
      this.selection = this.add.ellipse(0, 0, 58, 24).setStrokeStyle(2, 0xffd565).setVisible(false);
      this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
      for (const [x, y] of [[1190, 690], [1360, 820], [1510, 540], [790, 1130]]) {
        const body = this.makeCharacter(x, y, 'Dzik');
        const bar = this.add.rectangle(x, y - 43, 44, 5, 0xc94b38).setDepth(y + 1);
        this.enemies.push({ body, hp: 3, bar });
      }
      const hud = this.add.text(14, 12, 'KI LEGENDS • Las Początkowy\nWASD / strzałki / dotyk: ruch • Kliknij dzika: cel • Esc: anuluj', {
        fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#f5e5bb',
        backgroundColor: '#101b13', padding: { x: 12, y: 10 }
      }).setScrollFactor(0).setDepth(10000);
      this.targetLabel = this.add.text(26, 78, '', { fontSize: '15px', color: '#ffd565', stroke: '#10200f', strokeThickness: 4 }).setScrollFactor(0).setDepth(10000);
      this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
      this.input.addPointer(2);
      this.stickBase = this.add.circle(90, 440, 48, 0x101b13, 0.5).setStrokeStyle(2, 0xcee6b6, 0.5).setScrollFactor(0).setDepth(10001).setVisible(false);
      this.stickKnob = this.add.circle(90, 440, 20, 0xcee6b6, 0.7).setScrollFactor(0).setDepth(10002).setVisible(false);
      const resetStick = () => {
        this.joystickId = null; this.joystick.set(0, 0);
        this.stickBase.setVisible(false); this.stickKnob.setVisible(false);
      };
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.id !== this.joystickId) return;
        this.joystick.set(pointer.x - this.joystickStart.x, pointer.y - this.joystickStart.y).limit(48);
        this.stickKnob.setPosition(this.joystickStart.x + this.joystick.x, this.joystickStart.y + this.joystick.y);
      });
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => { if (pointer.id === this.joystickId) resetStick(); });
      this.input.on('gameout', resetStick);
      this.game.events.on('blur', resetStick);
      this.events.once('shutdown', () => this.game.events.off('blur', resetStick));
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch && pointer.x < 240 && pointer.y > 270 && this.joystickId === null) {
          this.joystickId = pointer.id; this.joystickStart.set(pointer.x, pointer.y);
          this.stickBase.setPosition(pointer.x, pointer.y).setVisible(true);
          this.stickKnob.setPosition(pointer.x, pointer.y).setVisible(true);
          this.destination = null; this.target = null; return;
        }
        if (pointer.y < 100) return;
        const pos = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const clicked = this.enemies.find(e => e.hp > 0 && Phaser.Math.Distance.Between(pos.x, pos.y, e.body.x, e.body.y) < 32);
        this.target = clicked ?? null;
        this.destination = clicked ? null : new Phaser.Math.Vector2(pos.x, pos.y);
      });
      this.input.keyboard?.on('keydown-ESC', () => { this.target = null; this.destination = null; });
    }

    private makeCharacter(x: number, y: number, label: string) {
      const shadow = this.add.ellipse(0, 3, 31, 11, 0x000000, 0.35);
      const sprite = label === 'Gracz'
        ? this.add.sprite(0, 0, 'hero-sheet', 0).setDisplaySize(62, 62).setOrigin(0.5, 0.95)
        : this.add.sprite(0, 0, 'world-atlas', 'boar').setDisplaySize(70, 70).setOrigin(0.5, 0.8);
      const name = this.add.text(0, -53, label, { fontSize: '13px', fontFamily: 'Arial', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      return this.add.container(x, y, [shadow, sprite, name]).setDepth(y);
    }

    private walkTowards(x: number, y: number, dt: number, stopDistance = 5) {
      const dx = x - this.hero.x, dy = y - this.hero.y, distance = Math.hypot(dx, dy);
      if (distance <= stopDistance) return true;
      const step = Math.min(distance - stopDistance, this.speed * Math.min(dt, 50) / 1000);
      const nx = this.hero.x + dx / distance * step, ny = this.hero.y + dy / distance * step;
      const collides = (px: number, py: number) => px < 14 || py < 14 || px > 1906 || py > 1426 || blockedAt(px, py, this.blocked);
      const beforeX = this.hero.x, beforeY = this.hero.y;
      if (!collides(nx, ny)) this.hero.setPosition(nx, ny);
      else if (!collides(nx, this.hero.y)) this.hero.x = nx;
      else if (!collides(this.hero.x, ny)) this.hero.y = ny;
      else return true;
      this.walking = Math.hypot(this.hero.x - beforeX, this.hero.y - beforeY) > 0.01;
      if (this.walking) this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      this.hero.setDepth(this.hero.y);
      return false;
    }

    update(time: number, dt: number) {
      this.walking = false;
      const k = this.keys;
      const dx = Number(Boolean(k?.D.isDown || k?.RIGHT.isDown)) - Number(Boolean(k?.A.isDown || k?.LEFT.isDown)) + this.joystick.x / 48;
      const dy = Number(Boolean(k?.S.isDown || k?.DOWN.isDown)) - Number(Boolean(k?.W.isDown || k?.UP.isDown)) + this.joystick.y / 48;
      if (Math.hypot(dx, dy) > 0.12) {
        this.destination = null; this.target = null;
        this.walkTowards(this.hero.x + dx * 100, this.hero.y + dy * 100, dt, 0);
      }
      this.selection.setVisible(Boolean(this.target && this.target.hp > 0));
      if (this.target) this.selection.setPosition(this.target.body.x, this.target.body.y + 11).setDepth(this.target.body.y - 1);
      this.targetLabel.setText(this.target ? 'Cel: Dzik • HP ' + this.target.hp + '/3' : '');
      if (this.target && this.target.hp > 0) {
        this.walkTowards(this.target.body.x, this.target.body.y, dt, 55);
        if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.target.body.x, this.target.body.y) <= 56
          && clearSight(this.hero.x, this.hero.y, this.target.body.x, this.target.body.y, this.blocked)
          && time >= this.attackCooldown) {
          this.attackCooldown = time + 700;
          this.target.hp--;
          const hit = this.add.text(this.target.body.x, this.target.body.y - 76, '-1', { fontSize: '24px', color: '#ffdd66', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(10003);
          this.tweens.add({ targets: hit, y: hit.y - 30, alpha: 0, duration: 500, onComplete: () => hit.destroy() });
          this.target.bar.width = Math.max(0, 44 * this.target.hp / 3);
          if (this.target.hp === 0) {
            this.target.body.destroy(); this.target.bar.destroy(); this.target = null;
          }
        }
      } else if (this.destination && this.walkTowards(this.destination.x, this.destination.y, dt)) {
        this.destination = null;
      }
      if (this.walking) this.heroSprite.play('walk-' + this.facing, true);
      else { this.heroSprite.stop(); this.heroSprite.setFrame({ down: 0, left: 4, right: 8, up: 12 }[this.facing] ?? 0); }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, pixelArt: true, parent, width: 960, height: 540, backgroundColor: '#17251c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ForestScene],
  });
  return () => game.destroy(true);
}

