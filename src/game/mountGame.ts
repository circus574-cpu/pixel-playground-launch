import Phaser from 'phaser';
import { blockedAt, clearSight } from './movement';

export type GameViewState = { x: number; y: number; target: null | { name: string; hp: number; maxHp: number }; defeated: number; ready: boolean };

/** Client-only Phaser scene; no server-side DOM access. */
export function mountKileGends(parent: HTMLElement, onState?: (state: GameViewState) => void): () => void {
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
    private lastReport = 0;
    private defeated = 0;
    constructor() { super('Forest'); }

    preload() {
      this.load.image('world-atlas', '/game/assets/world-v1.webp');
      this.load.image('hero-sheet', '/game/assets/hero-walk-v2.webp');
      this.load.image('village', '/game/assets/village-v2.webp?v=2');
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
        const w = Math.floor(source.width / 4), h = Math.floor(source.height / 4);
        ['down', 'left', 'right', 'up'].forEach((direction, row) => {
          for (let col = 0; col < 4; col++) sheet.add(row * 4 + col, 0, col * w, row * h, w, h);
          this.anims.create({ key: 'walk-' + direction, frames: Array.from({ length: 4 }, (_, i) => ({ key: 'hero-sheet', frame: row * 4 + i })), frameRate: 8, repeat: -1 });
        });
      }
      const worldW = 1920, worldH = 1280;
      this.cameras.main.setBackgroundColor('#182d1b');
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      this.add.image(0, 0, 'village').setOrigin(0).setDisplaySize(worldW, worldH).setDepth(-100);
      // Colliders follow the approved village artwork (1536×1024 reference coordinates).
      const solids = [
        [82, 105, 260, 210], [75, 510, 335, 220], [820, 92, 340, 268],
        [555, 365, 178, 160], [403, 226, 122, 127],
        [5, 0, 650, 75], [0, 780, 560, 244], [850, 835, 686, 189],
        [0, 330, 80, 170], [900, 420, 100, 140], [1040, 435, 112, 128],
        [835, 672, 135, 175], [465, 628, 96, 145], [1130, 0, 406, 215],
        // River, with a walkable bridge at y=365..435.
        [1260, 215, 276, 150], [1260, 435, 276, 390],
      ];
      for (const [x, y, w, h] of solids) this.blocked.push(new Phaser.Geom.Rectangle(x * 1.25, y * 1.25, w * 1.25, h * 1.25));
      this.hero = this.makeCharacter(960, 700, 'Gracz');
      this.heroSprite = this.hero.getAt(1) as Phaser.GameObjects.Sprite;
      this.selection = this.add.ellipse(0, 0, 58, 24).setStrokeStyle(2, 0xffd565).setVisible(false);
      this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
      for (const [x, y] of [[1050, 730], [1430, 960], [1380, 780], [750, 930]]) {
        const body = this.makeCharacter(x, y, 'Dzik');
        const bar = this.add.rectangle(x, y - 43, 44, 5, 0xc94b38).setDepth(y + 1);
        this.enemies.push({ body, hp: 3, bar });
      }
      onState?.({ x: this.hero.x, y: this.hero.y, target: null, defeated: 0, ready: true });
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
      const collides = (px: number, py: number) => px < 14 || py < 14 || px > 1906 || py > 1266 || blockedAt(px, py, this.blocked);
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
      const focused = document.activeElement;
      const typing = focused instanceof HTMLElement && Boolean(focused.closest('input, textarea, [role=dialog]'));
      const k = typing ? undefined : this.keys;
      const dx = Number(Boolean(k?.D.isDown || k?.RIGHT.isDown)) - Number(Boolean(k?.A.isDown || k?.LEFT.isDown)) + this.joystick.x / 48;
      const dy = Number(Boolean(k?.S.isDown || k?.DOWN.isDown)) - Number(Boolean(k?.W.isDown || k?.UP.isDown)) + this.joystick.y / 48;
      if (Math.hypot(dx, dy) > 0.12) {
        this.destination = null; this.target = null;
        this.walkTowards(this.hero.x + dx * 100, this.hero.y + dy * 100, dt, 0);
      }
      this.selection.setVisible(Boolean(this.target && this.target.hp > 0));
      if (this.target) this.selection.setPosition(this.target.body.x, this.target.body.y + 11).setDepth(this.target.body.y - 1);

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
            this.target.body.destroy(); this.target.bar.destroy(); this.target = null; this.defeated++;
          }
        }
      } else if (this.destination && this.walkTowards(this.destination.x, this.destination.y, dt)) {
        this.destination = null;
      }
      if (time - this.lastReport > 100) {
        this.lastReport = time;
        onState?.({ x: this.hero.x, y: this.hero.y, target: this.target ? { name: 'Dzik leśny', hp: this.target.hp, maxHp: 3 } : null, defeated: this.defeated, ready: true });
      }
      if (this.walking) this.heroSprite.play('walk-' + this.facing, true);
      else { this.heroSprite.stop(); this.heroSprite.setFrame({ down: 0, left: 4, right: 8, up: 12 }[this.facing] ?? 0); }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, pixelArt: false, antialias: true, parent, width: parent.clientWidth || 960, height: parent.clientHeight || 540, backgroundColor: '#17251c',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ForestScene],
  });
  return () => game.destroy(true);
}

