import { z } from "zod";
import { FOREST, forestObstacles, WORLD_HEIGHT, WORLD_WIDTH } from "./world/forest";
import { Navigation, distance, type Point } from "./navigation";

export const ITEMS = {
  potion: {
    name: "Mikstura życia",
    type: "consumable",
    icon: 4,
    attack: 0,
    defense: 0,
    price: 8,
    sell: 3,
  },
  tusk: { name: "Kieł dzika", type: "material", icon: 8, attack: 0, defense: 0, price: 0, sell: 5 },
  sword: {
    name: "Ostrze strażnika",
    type: "weapon",
    icon: 2,
    attack: 8,
    defense: 0,
    price: 40,
    sell: 18,
  },
  vest: {
    name: "Kamizelka podróżnika",
    type: "armor",
    icon: 3,
    attack: 0,
    defense: 3,
    price: 25,
    sell: 10,
  },
} as const;
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const BAG_CAPACITY = 12;
export type Ability = "flame" | "pulse" | "shield" | "attack" | "potion";
export const ABILITIES: Record<
  Ability,
  { name: string; cost: number; cooldown: number; range: number; icon: number; key: string }
> = {
  flame: { name: "Cięcie płomienia", cost: 12, cooldown: 3500, range: 110, icon: 2, key: "1" },
  pulse: { name: "Impuls KI", cost: 18, cooldown: 5000, range: 300, icon: 1, key: "2" },
  shield: { name: "Tarcza ducha", cost: 15, cooldown: 10000, range: 0, icon: 3, key: "3" },
  attack: { name: "Atak podstawowy", cost: 0, cooldown: 650, range: 78, icon: 8, key: "4" },
  potion: { name: "Mikstura życia", cost: 0, cooldown: 6000, range: 0, icon: 4, key: "Q" },
};
export type QuestId = "steps" | "boars" | "gear";
export const QUEST_NAMES: Record<QuestId, string> = {
  steps: "Pierwsze kroki",
  boars: "Zagrożenie w lesie",
  gear: "Pierwsze wyposażenie",
};
const status = z.enum(["locked", "active", "ready", "done"]);
const finite = (max: number) => z.number().finite().min(0).max(max);
const itemSchema = z.enum(["potion", "tusk", "sword", "vest"]);
const PlayerSchema = z.object({
  level: z.number().int().min(1).max(100),
  xp: finite(1000000).int(),
  hp: finite(10000),
  ki: finite(10000),
  gold: finite(1000000).int(),
  x: finite(WORLD_WIDTH),
  y: finite(WORLD_HEIGHT),
  items: z.object({
    potion: finite(99).int(),
    tusk: finite(99).int(),
    sword: finite(99).int(),
    vest: finite(99).int(),
  }),
  weapon: z.literal("sword").nullable(),
  armor: z.literal("vest").nullable(),
  upgrade: z.number().int().min(0).max(1),
  quests: z.object({ steps: status, boars: status, gear: status }),
  visited: z.boolean(),
  kills: z.number().int().min(0).max(3),
  cooldowns: z.object({
    flame: finite(3500),
    pulse: finite(5000),
    shield: finite(10000),
    attack: finite(650),
    potion: finite(6000),
  }),
  shield: finite(5000),
  dead: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;
export type NpcId = "guide" | "hunter" | "merchant" | "smith";
export const NPCS: { id: NpcId; name: string; role: string; x: number; y: number; tint: number }[] =
  [
    { id: "guide", name: "Aira", role: "Przewodniczka", x: 1570, y: 1250, tint: 0xa8f0cf },
    { id: "hunter", name: "Ren", role: "Strażnik lasu", x: 1850, y: 1070, tint: 0xffc7a4 },
    { id: "merchant", name: "Mio", role: "Kupczyni", x: 1260, y: 1100, tint: 0xd6b3ff },
    { id: "smith", name: "Taro", role: "Kowal", x: 1260, y: 1560, tint: 0xa4d5ff },
  ];
export type Enemy = Point & {
  id: string;
  home: Point;
  hp: number;
  maxHp: number;
  mode: "patrol" | "chase" | "return" | "dead";
  timer: number;
  attackIn: number;
  patrol: Point;
};
export type Loot = Point & { id: string; item: ItemId; quantity: number; gold: number };
export type GameEvent = Point & {
  type: "hit" | "attack" | "death" | "respawn" | "level" | "loot" | "shield" | "heal";
  text?: string;
  target?: string;
  ability?: Ability;
  to?: Point;
};
export type Command =
  | { type: "move"; x: number; y: number }
  | { type: "target"; id: string }
  | { type: "ability"; ability: Ability }
  | { type: "interact"; npc: NpcId }
  | { type: "dialogue"; action: "close" | "accept" | "claim" | "upgrade" }
  | { type: "equip"; item: ItemId }
  | { type: "unequip"; slot: "weapon" | "armor" }
  | { type: "trade"; item: ItemId; buy: boolean }
  | { type: "loot"; id: string }
  | { type: "pause"; value: boolean }
  | { type: "cancel" };
export const xpNeeded = (level: number) => 100 + (level - 1) * 60;
export const stats = (p: Player) => ({
  maxHp: 120 + (p.level - 1) * 20,
  maxKi: 50 + (p.level - 1) * 5,
  attack: 18 + (p.level - 1) * 3 + (p.weapon ? ITEMS[p.weapon].attack + p.upgrade * 4 : 0),
  defense: p.level - 1 + (p.armor ? ITEMS[p.armor].defense : 0),
});
export function newPlayer(): Player {
  return {
    level: 1,
    xp: 0,
    hp: 120,
    ki: 50,
    gold: 20,
    ...FOREST.spawn,
    items: { potion: 3, tusk: 0, sword: 0, vest: 0 },
    weapon: null,
    armor: null,
    upgrade: 0,
    quests: { steps: "locked", boars: "locked", gear: "locked" },
    visited: false,
    kills: 0,
    cooldowns: { flame: 0, pulse: 0, shield: 0, attack: 0, potion: 0 },
    shield: 0,
    dead: false,
  };
}
export const SAVE_KEY = "ki-legends:adventure:v1";
const SaveSchema = z.object({ version: z.literal(1), revision: z.string(), player: PlayerSchema });
export type StoragePort = Pick<Storage, "getItem" | "setItem">;

/** Dedicated local demo save. Invalid/newer saves and other tabs are never overwritten. */
export class SaveStore {
  private expected: string | null = null;
  private writable = true;
  warning = "";
  constructor(private storage: StoragePort | null) {}
  load(): Player | undefined {
    try {
      if (!this.storage) throw new Error("storage unavailable");
      const raw = this.storage.getItem(SAVE_KEY);
      this.expected = raw;
      if (!raw) return undefined;
      const data = SaveSchema.safeParse(JSON.parse(raw));
      if (!data.success) {
        this.writable = false;
        this.warning =
          "Nieprawidłowy lub nowszy zapis. Zachowano oryginał; zapis tej sesji wyłączony.";
        return undefined;
      }
      const p = data.data.player,
        s = stats(p);
      if (
        p.xp >= xpNeeded(p.level) ||
        (p.weapon && !p.items.sword) ||
        (p.armor && !p.items.vest) ||
        (p.quests.boars !== "locked" && p.quests.steps !== "done") ||
        (p.quests.gear !== "locked" && p.quests.boars !== "done")
      ) {
        this.writable = false;
        this.warning = "Niespójny zapis. Oryginał zachowany; zapis tej sesji wyłączony.";
        return undefined;
      }
      p.hp = Math.min(p.hp, s.maxHp);
      p.ki = Math.min(p.ki, s.maxKi);
      return p;
    } catch {
      this.writable = false;
      this.warning = "Zapis lokalny niedostępny. Postęp tej sesji nie będzie zachowany.";
      return undefined;
    }
  }
  save(p: Player): boolean {
    if (!this.storage || !this.writable) return false;
    try {
      if (this.storage.getItem(SAVE_KEY) !== this.expected) {
        this.writable = false;
        this.warning =
          "Zapis zmienił się w innej karcie. Odśwież grę; ta karta nie nadpisze postępu.";
        return false;
      }
      const next = JSON.stringify({
        version: 1,
        revision: Date.now().toString(36) + Math.random().toString(36).slice(2),
        player: p,
      });
      this.storage.setItem(SAVE_KEY, next);
      this.expected = next;
      return true;
    } catch {
      this.warning = "Nie udało się zapisać postępu. Sprawdź dostęp do pamięci przeglądarki.";
      return false;
    }
  }
}

export class GameSession {
  player: Player;
  readonly nav = new Navigation(WORLD_WIDTH, WORLD_HEIGHT, forestObstacles());
  readonly npcs: typeof NPCS;
  enemies: Enemy[];
  loot: Loot[] = [];
  targetId: string | null = null;
  dialogue: NpcId | null = null;
  paused = false;
  autoAttack = false;
  notice = "Porozmawiaj z Airą. Klikaj postacie lub użyj przycisku Rozmowa.";
  log: string[] = [];
  events: GameEvent[] = [];
  moving = false;
  facing: Point = { x: 0, y: 1 };
  private route: Point[] = [];
  private pendingNpc: NpcId | null = null;
  private pendingLoot: string | null = null;
  private pathIn = 0;
  private enemyPaths = new Map<string, { goal: Point; points: Point[]; remaining: number }>();
  private saveIn = 0;
  private combatIn = 0;
  private respawnIn = 0;
  private counter = 0;
  constructor(readonly saves?: SaveStore) {
    this.player = saves?.load() ?? newPlayer();
    const safe = this.nav.safe(this.player.dead ? FOREST.spawn : this.player);
    Object.assign(this.player, safe);
    if (this.player.dead || this.player.hp <= 0) {
      this.player.dead = false;
      this.player.hp = stats(this.player).maxHp;
      this.player.ki = stats(this.player).maxKi;
    }
    this.npcs = NPCS.map((n) => ({ ...n, ...this.nav.safe(n) }));
    this.enemies = FOREST.enemies.map((p, i) => {
      const home = this.nav.safe(p);
      return {
        id: "boar-" + i,
        ...home,
        home,
        patrol: { ...home },
        hp: 66,
        maxHp: 66,
        mode: "patrol",
        timer: 0,
        attackIn: 900,
      };
    });
    if (saves?.warning) this.say(saves.warning);
  }
  get target() {
    return this.enemies.find((e) => e.id === this.targetId && e.hp > 0);
  }
  say(text: string) {
    this.notice = text;
    this.log = [...this.log.slice(-19), text];
  }
  flush() {
    this.saves?.save(this.player);
  }
  private emit(event: GameEvent) {
    this.events.push(event);
  }
  private award(xp: number) {
    this.player.xp += xp;
    this.say("+" + xp + " XP");
    while (this.player.level < 100 && this.player.xp >= xpNeeded(this.player.level)) {
      this.player.xp -= xpNeeded(this.player.level);
      this.player.level++;
      const s = stats(this.player);
      this.player.hp = s.maxHp;
      this.player.ki = s.maxKi;
      this.emit({ type: "level", ...this.player, text: "Poziom " + this.player.level });
      this.say("Awans! Poziom " + this.player.level);
    }
    if (this.player.level === 100) this.player.xp = Math.min(this.player.xp, xpNeeded(100) - 1);
  }
  private add(item: ItemId, n = 1) {
    if (
      this.player.items[item] + n > 99 ||
      (!this.player.items[item] &&
        ITEM_IDS.filter((id) => this.player.items[id] > 0).length >= BAG_CAPACITY)
    ) {
      this.say("Brak miejsca w plecaku lub pełny stos (99).");
      return false;
    }
    this.player.items[item] += n;
    return true;
  }
  private nearbyNpc() {
    return this.npcs.find((n) => n.id === this.dialogue && distance(n, this.player) <= 115);
  }
  private go(to: Point, silent = false) {
    this.route = this.nav.path(this.player, to);
    if (!this.route.length && !silent) this.say("Brak przejścia. Wybierz inne miejsce.");
  }
  command(c: Command) {
    const p = this.player;
    if (c.type === "pause") {
      this.paused = c.value;
      if (c.value) {
        this.route = [];
        this.autoAttack = false;
      }
      return;
    }
    if (c.type === "cancel") {
      this.dialogue = null;
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.route = [];
      this.targetId = null;
      this.autoAttack = false;
      return;
    }
    if (c.type === "dialogue" && c.action === "close") {
      this.dialogue = null;
      return;
    }
    if (p.dead) {
      this.say("Odradzasz się w wiosce…");
      return;
    }
    if (c.type === "dialogue") {
      const npc = this.nearbyNpc();
      if (!npc) return this.say("Podejdź do rozmówcy.");
      if (c.action === "accept") {
        if (npc.id === "guide" && p.quests.steps === "locked") {
          p.quests.steps = "active";
          this.say(
            "Pierwsze kroki: odwiedź latarnię na północ od fontanny (rynek), potem wróć do Airy.",
          );
        } else if (
          npc.id === "hunter" &&
          p.quests.steps === "done" &&
          p.quests.boars === "locked"
        ) {
          p.quests.boars = "active";
          this.say("Zagrożenie w lesie: pokonaj 3 dziki i wróć do Rena.");
        } else if (npc.id === "smith" && p.quests.boars === "done" && p.quests.gear === "locked") {
          p.quests.gear = p.weapon === "sword" ? "ready" : "active";
          this.say("Załóż Ostrze strażnika w ekwipunku, potem wróć do Taro.");
        } else this.say("To zadanie jest już przyjęte albo wymaga poprzedniego zadania.");
      }
      if (c.action === "claim") {
        if (npc.id === "guide" && p.quests.steps === "ready") {
          p.quests.steps = "done";
          this.award(40);
          this.say(
            "Pierwsze kroki ukończone. +40 XP. Ren przy wschodniej drodze potrzebuje pomocy.",
          );
        } else if (npc.id === "hunter" && p.quests.boars === "ready") {
          if (!this.add("sword")) return;
          p.quests.boars = "done";
          p.gold += 30;
          this.award(80);
          this.say("Zagrożenie ukończone: +80 XP, +30 monet, Ostrze strażnika. Odwiedź kowala.");
        } else if (npc.id === "smith" && p.quests.gear === "ready") {
          p.quests.gear = "done";
          this.award(40);
          this.say("Pierwsze wyposażenie ukończone. +40 XP. Możesz dalej trenować i handlować.");
        } else this.say("Najpierw wykonaj cele. Odebranej nagrody nie można odebrać ponownie.");
      }
      if (c.action === "upgrade") {
        if (npc.id !== "smith" || !p.weapon) return this.say("Najpierw załóż ostrze.");
        if (p.upgrade) return this.say("Ostrze zostało już ulepszone.");
        if (p.gold < 15) return this.say("Ulepszenie kosztuje 15 monet.");
        p.gold -= 15;
        p.upgrade = 1;
        this.say("Ostrze ulepszone: +4 ataku.");
      }
      this.flush();
      return;
    }
    if (c.type === "trade") {
      if (this.nearbyNpc()?.id !== "merchant") return this.say("Porozmawiaj z Mio, aby handlować.");
      const item = ITEMS[c.item];
      if (c.buy) {
        if (!item.price) return;
        if (p.gold < item.price) return this.say("Za mało monet.");
        if (!this.add(c.item)) return;
        p.gold -= item.price;
        this.say("Kupiono: " + item.name);
      } else {
        const reserved = p.weapon === c.item || p.armor === c.item ? 1 : 0;
        if (p.items[c.item] <= reserved)
          return this.say("Brak przedmiotu do sprzedaży. Najpierw zdejmij wyposażenie.");
        p.items[c.item]--;
        p.gold += item.sell;
        this.say("Sprzedano: " + item.name);
      }
      this.flush();
      return;
    }
    if (c.type === "equip") {
      if (!p.items[c.item]) return this.say("Nie masz tego przedmiotu.");
      if (c.item === "potion") return this.use("potion");
      if (c.item === "sword") p.weapon = "sword";
      else if (c.item === "vest") p.armor = "vest";
      else return this.say("Ten materiał możesz sprzedać kupcowi.");
      if (p.quests.gear === "active" && p.weapon) p.quests.gear = "ready";
      this.say("Założono: " + ITEMS[c.item].name);
      this.flush();
      return;
    }
    if (c.type === "unequip") {
      p[c.slot] = null;
      this.say("Zdjęto wyposażenie.");
      this.flush();
      return;
    }
    if (this.dialogue || this.paused) return this.say("Zamknij okno, aby kontynuować.");
    if (c.type === "ability") return this.use(c.ability);
    if (c.type === "move") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      this.targetId = null;
      this.autoAttack = false;
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.go(c);
      return;
    }
    if (c.type === "target") {
      const enemy = this.enemies.find((e) => e.id === c.id && e.hp > 0);
      if (!enemy) return this.say("Brak żywego przeciwnika.");
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.targetId = c.id;
      this.autoAttack = true;
      this.pathIn = 0;
      this.say("Cel: Dzik leśny. Autoatak aktywny.");
      return;
    }
    if (c.type === "interact") {
      const npc = this.npcs.find((n) => n.id === c.npc);
      if (!npc) return;
      this.targetId = null;
      this.autoAttack = false;
      this.pendingNpc = npc.id;
      this.pendingLoot = null;
      this.go(npc);
      return;
    }
    if (c.type === "loot") {
      const loot = this.loot.find((l) => l.id === c.id);
      if (!loot) return this.say("Ten łup został już podniesiony.");
      if (distance(p, loot) > 90) {
        this.pendingLoot = loot.id;
        this.targetId = null;
        this.autoAttack = false;
        this.go(loot);
        return;
      }
      if (!this.add(loot.item, loot.quantity)) return;
      p.gold += loot.gold;
      this.loot = this.loot.filter((l) => l.id !== loot.id);
      this.pendingLoot = null;
      this.emit({ type: "loot", ...loot, text: "+" + loot.quantity + " " + ITEMS[loot.item].name });
      this.say("Łup: " + ITEMS[loot.item].name + ", +" + loot.gold + " monet.");
      this.flush();
    }
  }
  private use(ability: Ability) {
    const p = this.player,
      spec = ABILITIES[ability],
      s = stats(p);
    if (p.cooldowns[ability] > 0)
      return this.say("Odnowienie: " + Math.ceil(p.cooldowns[ability] / 1000) + " s.");
    if (p.ki < spec.cost) return this.say("Za mało KI (" + spec.cost + ").");
    if (ability === "potion") {
      if (!p.items.potion) return this.say("Brak mikstury. Kup ją u Mio.");
      if (p.hp >= s.maxHp) return this.say("Masz pełne HP.");
      p.items.potion--;
      p.hp = Math.min(s.maxHp, p.hp + 65);
      this.emit({ type: "heal", ...p, text: "+65 HP" });
    } else if (ability === "shield") {
      p.shield = 5000;
      this.emit({ type: "shield", ...p, text: "Ochrona 60% · 5 s" });
    } else {
      if (!this.target) {
        const enemy = this.enemies
          .filter((e) => e.hp > 0 && distance(e, p) <= 340)
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (enemy) this.targetId = enemy.id;
      }
      const e = this.target;
      if (!e) return this.say("Wybierz dzika kliknięciem lub podejdź bliżej.");
      if (e.mode === "return") return this.say("Dzik wraca na swoje terytorium.");
      if (distance(p, e) > spec.range) {
        if (ability === "attack") {
          this.autoAttack = true;
          this.pathIn = 0;
          this.say("Podchodzisz do celu.");
        } else this.say("Cel poza zasięgiem (" + spec.range + "). Podejdź bliżej.");
        return;
      }
      if (!this.nav.visible(p, e)) return this.say("Przeszkoda zasłania cel.");
      const d = distance(p, e);
      if (d > 0) this.facing = { x: (e.x - p.x) / d, y: (e.y - p.y) / d };
      this.emit({ type: "attack", ...p, ability, target: e.id, to: { x: e.x, y: e.y } });
      const damage = Math.round(
        s.attack * (ability === "flame" ? 1.8 : ability === "pulse" ? 1.6 : 1),
      );
      this.hurtEnemy(e, damage);
      this.combatIn = 4500;
    }
    p.ki -= spec.cost;
    p.cooldowns[ability] = spec.cooldown;
    this.flush();
  }
  private hurtEnemy(e: Enemy, amount: number) {
    if (e.hp <= 0 || e.mode === "return") return;
    e.hp = Math.max(0, e.hp - amount);
    e.mode = "chase";
    this.emit({ type: "hit", ...e, target: e.id, text: "-" + amount });
    if (!e.hp) {
      e.mode = "dead";
      e.timer = 18000;
      this.emit({ type: "death", ...e, target: e.id });
      this.loot.push({
        id: "loot-" + ++this.counter,
        x: e.x,
        y: e.y,
        item: "tusk",
        quantity: 1,
        gold: 4,
      });
      this.targetId = null;
      this.autoAttack = false;
      this.route = [];
      if (this.player.quests.boars === "active") {
        this.player.kills = Math.min(3, this.player.kills + 1);
        if (this.player.kills === 3) {
          this.player.quests.boars = "ready";
          this.say("3/3 dzików. Wróć do Rena po nagrodę.");
        }
      }
      this.award(20);
    }
  }
  manual(dx: number, dy: number, dt: number) {
    if (this.paused || this.dialogue || this.player.dead) return;
    this.route = [];
    this.pendingNpc = null;
    this.pendingLoot = null;
    this.autoAttack = false;
    this.movePlayer({ x: this.player.x + dx * 100, y: this.player.y + dy * 100 }, dt);
  }
  private moveEnemy(enemy: Enemy, goal: Point, amount: number, dt: number) {
    let route = this.enemyPaths.get(enemy.id);
    if (!route || distance(route.goal, goal) > 36 || route.remaining <= 0) {
      route = {
        goal: { x: goal.x, y: goal.y },
        points: this.nav.path(enemy, goal),
        remaining: 700,
      };
      this.enemyPaths.set(enemy.id, route);
    }
    route.remaining -= dt;
    if (!route.points.length) return;
    const next = route.points[0]!;
    Object.assign(enemy, this.nav.step(enemy, next, amount));
    if (distance(enemy, next) < 5) route.points.shift();
  }
  private movePlayer(to: Point, dt: number) {
    const before = { x: this.player.x, y: this.player.y };
    const next = this.nav.step(before, to, (205 * dt) / 1000);
    Object.assign(this.player, next);
    this.moving = distance(before, next) > 0.01;
    if (this.moving) {
      const d = distance(before, next);
      this.facing = { x: (next.x - before.x) / d, y: (next.y - before.y) / d };
    }
  }
  tick(milliseconds: number) {
    const dt = Math.max(0, Math.min(100, milliseconds));
    this.moving = false;
    if (this.dialogue || this.paused) return;
    const p = this.player,
      s = stats(p);
    for (const key of Object.keys(p.cooldowns) as Ability[])
      p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
    p.shield = Math.max(0, p.shield - dt);
    this.combatIn = Math.max(0, this.combatIn - dt);
    if (p.dead) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) {
        Object.assign(p, this.nav.safe(FOREST.spawn));
        p.dead = false;
        p.hp = s.maxHp;
        p.ki = s.maxKi;
        this.combatIn = 0;
        this.emit({ type: "respawn", ...p });
        this.say("Odrodzono w bezpiecznej wiosce. Zachowano przedmioty i zadania.");
        this.flush();
      }
      return;
    }
    p.ki = Math.min(s.maxKi, p.ki + dt * 0.004);
    if (!this.combatIn) p.hp = Math.min(s.maxHp, p.hp + dt * 0.003);
    this.pathIn -= dt;
    const target = this.target;
    if (this.autoAttack && target) {
      if (target.mode === "return") {
        this.autoAttack = false;
        this.targetId = null;
        this.route = [];
        this.say("Dzik wraca na swoje terytorium.");
      } else if (distance(p, target) <= ABILITIES.attack.range && this.nav.visible(p, target)) {
        this.route = [];
        if (!p.cooldowns.attack) this.use("attack");
      } else if (this.pathIn <= 0) {
        this.go(target, true);
        this.pathIn = 600;
      }
    }
    if (this.route.length) {
      this.movePlayer(this.route[0]!, dt);
      if (distance(p, this.route[0]!) < 5) this.route.shift();
    }
    if (this.pendingNpc) {
      const npc = this.npcs.find((n) => n.id === this.pendingNpc)!;
      if (distance(p, npc) <= 100) {
        this.dialogue = npc.id;
        this.pendingNpc = null;
        this.route = [];
        this.say(npc.name + ": " + npc.role);
        this.flush();
        return;
      }
    }
    if (this.pendingLoot) {
      const loot = this.loot.find((l) => l.id === this.pendingLoot);
      if (!loot) this.pendingLoot = null;
      else if (distance(p, loot) <= 90) this.command({ type: "loot", id: loot.id });
    }
    if (p.quests.steps === "active" && distance(p, { x: 1480, y: 800 }) < 85) {
      p.visited = true;
      p.quests.steps = "ready";
      this.say("Rynek odwiedzony. Wróć do Airy po nagrodę.");
      this.flush();
    }
    for (const e of this.enemies) {
      e.attackIn = Math.max(0, e.attackIn - dt);
      e.timer -= dt;
      if (e.mode === "dead") {
        if (e.timer <= 0 && distance(p, e.home) > 160) {
          Object.assign(e, e.home);
          e.hp = e.maxHp;
          e.mode = "patrol";
          e.attackIn = 1000;
          e.timer = 1000;
          this.emit({ type: "respawn", ...e, target: e.id });
        }
        continue;
      }
      if (e.mode === "chase" && (distance(e, e.home) > 330 || distance(e, p) > 420 || p.dead))
        e.mode = "return";
      if (e.mode === "patrol" && distance(e, p) < 155 && this.nav.visible(e, p)) e.mode = "chase";
      if (e.mode === "return") {
        this.moveEnemy(e, e.home, dt * 0.14, dt);
        if (distance(e, e.home) < 8) {
          e.mode = "patrol";
          e.hp = e.maxHp;
          e.timer = 1000;
        }
      } else if (e.mode === "chase") {
        const range = distance(e, p);
        if (range > 57) this.moveEnemy(e, p, dt * 0.12, dt);
        if (range <= 68 && !e.attackIn && this.nav.visible(e, p)) {
          e.attackIn = 1400;
          const damage = Math.max(1, Math.round((9 - s.defense) * (p.shield > 0 ? 0.4 : 1)));
          p.hp = Math.max(0, p.hp - damage);
          this.combatIn = 4500;
          this.emit({ type: "hit", ...p, target: "player", text: "-" + damage });
          if (p.hp <= 0) {
            p.dead = true;
            this.respawnIn = 3000;
            this.targetId = null;
            this.autoAttack = false;
            this.route = [];
            this.emit({ type: "death", ...p, target: "player" });
            this.say("Zostałeś pokonany. Odrodzenie za 3 sekundy.");
            this.flush();
            break;
          }
        }
      } else {
        if (e.timer <= 0) {
          e.timer = 2800;
          const phase = (this.counter++ + Number(e.id.slice(-1))) * 2.4;
          e.patrol = this.nav.safe({
            x: e.home.x + Math.cos(phase) * 65,
            y: e.home.y + Math.sin(phase) * 65,
          });
        }
        this.moveEnemy(e, e.patrol, dt * 0.035, dt);
      }
    }
    this.saveIn += dt;
    if (this.saveIn >= 2000) {
      this.saveIn = 0;
      this.flush();
    }
  }
  questText(id: QuestId): string {
    const q = this.player.quests[id];
    if (q === "done") return "Ukończone · nagroda odebrana";
    if (q === "ready")
      return "Wróć do " + { steps: "Airy", boars: "Rena", gear: "Taro" }[id] + " po nagrodę";
    if (id === "steps")
      return q === "locked"
        ? "Porozmawiaj z Airą przy miejscu startowym"
        : "Odwiedź rynek na północ od fontanny";
    if (id === "boars")
      return q === "locked"
        ? "Po Pierwszych krokach porozmawiaj z Renem"
        : "Pokonaj dziki: " + this.player.kills + "/3";
    return q === "locked"
      ? "Po Zagrożeniu porozmawiaj z kowalem Taro"
      : "Załóż Ostrze strażnika w ekwipunku";
  }
  snapshot() {
    return {
      x: this.player.x,
      y: this.player.y,
      player: structuredClone(this.player),
      stats: stats(this.player),
      target: this.target
        ? { name: "Dzik leśny", hp: this.target.hp, maxHp: this.target.maxHp }
        : null,
      defeated: this.player.kills,
      ready: true,
      dialogue: this.dialogue,
      notice: this.notice,
      log: [...this.log],
      saveWarning: this.saves?.warning ?? "",
      quests: (Object.keys(QUEST_NAMES) as QuestId[]).map((id) => ({
        id,
        name: QUEST_NAMES[id],
        status: this.player.quests[id],
        text: this.questText(id),
      })),
      nearbyLoot: this.loot.filter((l) => distance(l, this.player) < 140).map((l) => ({ ...l })),
      nearestNpc:
        [...this.npcs].sort((a, b) => distance(a, this.player) - distance(b, this.player))[0]?.id ??
        ("guide" as NpcId),
      autoAttack: this.autoAttack,
    };
  }
}
export type GameViewState = ReturnType<GameSession["snapshot"]>;
export function initialView(): GameViewState {
  const p = newPlayer();
  return {
    ...p,
    player: p,
    stats: stats(p),
    target: null,
    defeated: 0,
    ready: false,
    dialogue: null,
    notice: "",
    log: [],
    saveWarning: "",
    quests: [],
    nearbyLoot: [],
    nearestNpc: "guide",
    autoAttack: false,
  };
}
export function decodeItem(value: unknown) {
  return itemSchema.safeParse(value);
}
