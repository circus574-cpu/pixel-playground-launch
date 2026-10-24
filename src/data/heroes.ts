export type Direction = 
  | 'down' 
  | 'down-left' 
  | 'left' 
  | 'up-left' 
  | 'up' 
  | 'up-right' 
  | 'right' 
  | 'down-right';

export interface HeroRace {
  id: 'planetary' | 'sage' | 'android' | 'legend';
  name: string;
  polishName: string;
  tagline: string;
  homeworld: string;
  accentColor: string;
  lore: string;
  combatRole: string;
  baseStats: {
    hp: number;
    ki: number;
    atk: number;
    def: number;
    speed: number;
    kiRegen: number;
  };
  skills: {
    name: string;
    polishName: string;
    key: string;
    cost: number;
    cooldown: number;
    description: string;
    icon: string;
  }[];
  previewGif: string;
  masterSheet: string;
  views: Record<Direction, string>;
  hasMotionFrames: boolean;
  motionFrames?: {
    idle: string[];
    walk: string[];
    attack: string[];
    skill: string[];
    hit: string[];
    death: string[];
  };
}

export const HERO_RACES: HeroRace[] = [
  {
    id: 'planetary',
    name: 'Planetary',
    polishName: 'Planetarni',
    tagline: 'Defenders of the Verdant Forest & Masters of Natural Ki',
    homeworld: 'Verdant',
    accentColor: '#10b981',
    combatRole: 'Balanced Martial Striker',
    lore: 'Born under the towering anime canopies of the Verdant continent, the Planetary harmonise their internal Ki with the planet\'s lifeforce. They excel in fluid strikes, rapid dashes, and close-quarters aerial combinations.',
    baseStats: {
      hp: 120,
      ki: 100,
      atk: 18,
      def: 12,
      speed: 1.0,
      kiRegen: 8,
    },
    skills: [
      {
        name: 'Ki Blast',
        polishName: 'Pocisk Ki',
        key: 'Q',
        cost: 15,
        cooldown: 1.0,
        description: 'Condenses raw spiritual energy into a piercing projectile that detonates on impact.',
        icon: 'Zap'
      },
      {
        name: 'Verdant Flash Step',
        polishName: 'Mgnienie Lasu',
        key: 'E',
        cost: 25,
        cooldown: 3.5,
        description: 'Dashes forward instantaneously, leaving a gale that staggers nearby foes and grants invulnerability frames.',
        icon: 'Wind'
      },
      {
        name: 'Planetary Burst',
        polishName: 'Rozbłysk Planetarny',
        key: 'R',
        cost: 50,
        cooldown: 8.0,
        description: 'Unleashes an expanding shockwave of emerald Ki, dealing massive radial damage and blowing back adversaries.',
        icon: 'Sun'
      }
    ],
    previewGif: '/art/production/heroes/planetary/painted-v1/preview.gif',
    masterSheet: '/art/production/heroes/planetary/painted-v1/masters/masters-sheet.jpg',
    views: {
      'down': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-down.png',
      'down-left': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-down-left.png',
      'left': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-left.png',
      'up-left': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-up-left.png',
      'up': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-up.png',
      'up-right': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-up-right.png',
      'right': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-right.png',
      'down-right': '/art/production/heroes/planetary/painted-v1/masters/planetary-master-down-right.png'
    },
    hasMotionFrames: true,
    motionFrames: {
      idle: [0, 1, 2, 3, 4, 5, 6, 7].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/idle-down-0${i}.png`),
      walk: [0, 1, 2, 3, 4, 5, 6, 7].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/walk-down-0${i}.png`),
      attack: [0, 1, 2, 3, 4, 5, 6, 7].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/attack-down-0${i}.png`),
      skill: [0, 1, 2, 3, 4, 5, 6, 7].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/skill-down-0${i}.png`),
      hit: [0, 1, 2, 3].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/hit-down-0${i}.png`),
      death: [0, 1, 2, 3, 4, 5, 6, 7].map(i => `/art/production/heroes/planetary/v1/sources/motion-v2/death-down-0${i}.png`),
    }
  },
  {
    id: 'sage',
    name: 'Sage',
    polishName: 'Mędrcy',
    tagline: 'Keepers of the Celestial Seals & Ancient Aether Glyphs',
    homeworld: 'Aether',
    accentColor: '#f59e0b',
    combatRole: 'Ranged Ki Magus & Controller',
    lore: 'The Sages study the grand library sanctuaries suspended among Aether\'s cloud spires. By inscribing resonant golden runes onto reality itself, they bend time, weave protective barriers, and bombard enemies from afar.',
    baseStats: {
      hp: 95,
      ki: 160,
      atk: 22,
      def: 9,
      speed: 0.95,
      kiRegen: 14,
    },
    skills: [
      {
        name: 'Aether Seal',
        polishName: 'Pieczęć Eteru',
        key: 'Q',
        cost: 20,
        cooldown: 1.2,
        description: 'Projects a spinning golden seal that shoots rays of focused celestial Ki toward foes.',
        icon: 'Sparkles'
      },
      {
        name: 'Sanctuary Ward',
        polishName: 'Bariera Sanktuarium',
        key: 'E',
        cost: 35,
        cooldown: 6.0,
        description: 'Inscribes a protective glyph ring that absorbs up to 40% damage and reflects incoming spells.',
        icon: 'Shield'
      },
      {
        name: 'Judgment of Aether',
        polishName: 'Sąd Niebios',
        key: 'R',
        cost: 65,
        cooldown: 10.0,
        description: 'Summons three radiant pillars of divine Ki from the heavens that incinerate all marked targets.',
        icon: 'Flame'
      }
    ],
    previewGif: '/art/production/heroes/sage/painted-v1/preview.gif',
    masterSheet: '/art/production/heroes/sage/painted-v1/masters/masters-sheet.jpg',
    views: {
      'down': '/art/production/heroes/sage/painted-v1/masters/sage-master-down.png',
      'down-left': '/art/production/heroes/sage/painted-v1/masters/sage-master-down-left.png',
      'left': '/art/production/heroes/sage/painted-v1/masters/sage-master-left.png',
      'up-left': '/art/production/heroes/sage/painted-v1/masters/sage-master-up-left.png',
      'up': '/art/production/heroes/sage/painted-v1/masters/sage-master-up.png',
      'up-right': '/art/production/heroes/sage/painted-v1/masters/sage-master-up-right.png',
      'right': '/art/production/heroes/sage/painted-v1/masters/sage-master-right.png',
      'down-right': '/art/production/heroes/sage/painted-v1/masters/sage-master-down-right.png'
    },
    hasMotionFrames: false
  },
  {
    id: 'android',
    name: 'Android',
    polishName: 'Androidzi',
    tagline: 'Cybernetic Precision & Plasma Battery Overdrive',
    homeworld: 'Nexus',
    accentColor: '#06b6d4',
    combatRole: 'High-Tech Marksman & Vanguard',
    lore: 'Constructed in the graphite citadels of Nexus, Androids channel artificial Ki through superconductor channels and plasma vents. Their calculations yield devastating burst attacks and impenetrable hardlight energy shields.',
    baseStats: {
      hp: 135,
      ki: 90,
      atk: 20,
      def: 16,
      speed: 1.05,
      kiRegen: 7,
    },
    skills: [
      {
        name: 'Plasma Arc',
        polishName: 'Łuk Plazmowy',
        key: 'Q',
        cost: 18,
        cooldown: 0.8,
        description: 'Fires twin high-velocity plasma bolts that bounce between up to two nearby enemies.',
        icon: 'Radio'
      },
      {
        name: 'Hardlight Aegis',
        polishName: 'Tarcza Twardego Światła',
        key: 'E',
        cost: 30,
        cooldown: 5.0,
        description: 'Deploys a kinetic deflection matrix, absorbing 80 damage and granting 25% movement speed boost.',
        icon: 'ShieldCheck'
      },
      {
        name: 'Overcharge Core',
        polishName: 'Przeciążenie Rdzenia',
        key: 'R',
        cost: 60,
        cooldown: 9.0,
        description: 'Vents raw capacitor power in a 360-degree ion blast, instantly eliminating weak projectiles and electrocuting all foes.',
        icon: 'Cpu'
      }
    ],
    previewGif: '/art/production/heroes/android/painted-v1/preview.gif',
    masterSheet: '/art/production/heroes/android/painted-v1/masters/masters-sheet.jpg',
    views: {
      'down': '/art/production/heroes/android/painted-v1/masters/android-master-down.png',
      'down-left': '/art/production/heroes/android/painted-v1/masters/android-master-down-left.png',
      'left': '/art/production/heroes/android/painted-v1/masters/android-master-left.png',
      'up-left': '/art/production/heroes/android/painted-v1/masters/android-master-up-left.png',
      'up': '/art/production/heroes/android/painted-v1/masters/android-master-up.png',
      'up-right': '/art/production/heroes/android/painted-v1/masters/android-master-up-right.png',
      'right': '/art/production/heroes/android/painted-v1/masters/android-master-right.png',
      'down-right': '/art/production/heroes/android/painted-v1/masters/android-master-down-right.png'
    },
    hasMotionFrames: false
  },
  {
    id: 'legend',
    name: 'Legend',
    polishName: 'Legendy',
    tagline: 'Titans of Pyra & Unyielding Volcanic Berserkers',
    homeworld: 'Pyra',
    accentColor: '#ef4444',
    combatRole: 'Heavy Juggernaut & Berserker',
    lore: 'Forged amidst the molten rivers and basalt monoliths of Pyra, the Legends embody titanic physical power. Their wrath fuels their Ki, multiplying their damage as they engage multiple foes head-on.',
    baseStats: {
      hp: 170,
      ki: 75,
      atk: 25,
      def: 18,
      speed: 0.9,
      kiRegen: 6,
    },
    skills: [
      {
        name: 'Molten Slam',
        polishName: 'Magmowe Uderzenie',
        key: 'Q',
        cost: 15,
        cooldown: 1.5,
        description: 'Slams fists into the terra, erupting a geothermal rift that damages and launches enemies into the air.',
        icon: 'Hammer'
      },
      {
        name: 'Basalt Roar',
        polishName: 'Bazaltowy Ryk',
        key: 'E',
        cost: 25,
        cooldown: 6.0,
        description: 'Unleashes a fearsome bellow that taunts enemies, bolsters DEF by 30%, and reflects back physical damage.',
        icon: 'Flame'
      },
      {
        name: 'Cataclysmic Rage',
        polishName: 'Wulkaniczna Furia',
        key: 'R',
        cost: 55,
        cooldown: 12.0,
        description: 'Ignites pure volcanic fury for 8 seconds, increasing movement speed by 40% and making all attacks cause fiery explosions.',
        icon: 'Activity'
      }
    ],
    previewGif: '/art/production/heroes/legend/painted-v1/preview.gif',
    masterSheet: '/art/production/heroes/legend/painted-v1/masters/masters-sheet.jpg',
    views: {
      'down': '/art/production/heroes/legend/painted-v1/masters/legend-master-down.png',
      'down-left': '/art/production/heroes/legend/painted-v1/masters/legend-master-down-left.png',
      'left': '/art/production/heroes/legend/painted-v1/masters/legend-master-left.png',
      'up-left': '/art/production/heroes/legend/painted-v1/masters/legend-master-up-left.png',
      'up': '/art/production/heroes/legend/painted-v1/masters/legend-master-up.png',
      'up-right': '/art/production/heroes/legend/painted-v1/masters/legend-master-up-right.png',
      'right': '/art/production/heroes/legend/painted-v1/masters/legend-master-right.png',
      'down-right': '/art/production/heroes/legend/painted-v1/masters/legend-master-down-right.png'
    },
    hasMotionFrames: false
  }
];
