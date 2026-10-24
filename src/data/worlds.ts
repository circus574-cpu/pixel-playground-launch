export interface BiomeAsset {
  id: string;
  name: string;
  category: 'texture' | 'object' | 'candidate';
  path: string;
  world: 'verdant' | 'aether' | 'nexus' | 'pyra' | 'all';
  description: string;
}

export const BIOME_ASSETS: BiomeAsset[] = [
  // Textures
  {
    id: 'forest-floor',
    name: 'Forest Floor',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/forest-floor-s5741102.webp',
    world: 'verdant',
    description: 'Lush moss, fallen leaves, and fertile humus for the deep woods of Verdant.'
  },
  {
    id: 'cliff-rock',
    name: 'Cliff Rock Face',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/cliff-rock-s5741102.webp',
    world: 'verdant',
    description: 'Steep granite crags and elevation dividers separating forest plateaus.'
  },
  {
    id: 'energy-liquid',
    name: 'Liquid Ki Energy',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/energy-liquid-s5741102.webp',
    world: 'aether',
    description: 'Pure crystalline spiritual resonance flowing through celestial conduits.'
  },
  {
    id: 'ice-glacier',
    name: 'Glacier Sheet',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/ice-glacier-s5741104.webp',
    world: 'aether',
    description: 'Deep glacial permafrost found on high Aether cloud-mountain summits.'
  },
  {
    id: 'basalt-columns',
    name: 'Hexagonal Basalt',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/basalt-columns-s5741102.webp',
    world: 'pyra',
    description: 'Geometric volcanic columns cooled from prehistoric magma pools.'
  },
  {
    id: 'ash-ground',
    name: 'Volcanic Ash Soil',
    category: 'texture',
    path: '/art/production/nature/v1/sources/textures/ash-ground-s5741102.webp',
    world: 'pyra',
    description: 'Powdery dark ash earth surrounding active caldera zones.'
  },

  // Sprites & Objects
  {
    id: 'broadleaf-tree',
    name: 'Ancient Broadleaf Tree',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/broadleaf-tree-s5741104.webp',
    world: 'verdant',
    description: 'Iconic anime style canopy tree with rich shaded foliage.'
  },
  {
    id: 'pine-tree',
    name: 'Alpine Pine',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/pine-tree-s5741104.webp',
    world: 'verdant',
    description: 'High elevation conifer lining valley edges and hill slopes.'
  },
  {
    id: 'flower-bush',
    name: 'Medicinal Flower Bush',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/flower-bush-s5741104.webp',
    world: 'verdant',
    description: 'Vibrant blossoms harvested for healing potions and Ki salves.'
  },
  {
    id: 'boulder-group',
    name: 'Mossy Boulders',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/boulder-group-s5741104.webp',
    world: 'verdant',
    description: 'Collision terrain providing tactical cover against ranged beasts.'
  },
  {
    id: 'waterfall',
    name: 'Cascading Waterfall',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/waterfall-s5741104.webp',
    world: 'verdant',
    description: 'High waterfall replenishing sacred forest springs.'
  },
  {
    id: 'crystal-tree',
    name: 'Resonating Crystal Tree',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/crystal-tree-s5741104.webp',
    world: 'aether',
    description: 'Gleaming crystal tree absorbing celestial Ki.'
  },
  {
    id: 'ice-spires',
    name: 'Ice Spires',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/ice-spires-s5741104.webp',
    world: 'aether',
    description: 'Sharpened frost monoliths erected by ancient ice spirits.'
  },
  {
    id: 'volcano-active',
    name: 'Active Magma Caldera',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/volcano-active-s5741104.webp',
    world: 'pyra',
    description: 'Erupting volcanic mountain that fuels Pyra’s endless heat.'
  },
  {
    id: 'volcano-dormant',
    name: 'Dormant Obsidian Peak',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/volcano-dormant-s5741103.webp',
    world: 'pyra',
    description: 'Solidified lava summit housing the subterranean coliseums.'
  },
  {
    id: 'lava-rocks',
    name: 'Incandescent Lava Rocks',
    category: 'object',
    path: '/art/production/nature/v1/sources/objects/lava-rocks-s5741104.webp',
    world: 'pyra',
    description: 'Red-hot basalt rubble that deals environmental burn damage.'
  },

  // Anime candidates & Concept
  {
    id: 'anime-cottage',
    name: 'Safe Haven Cottage',
    category: 'candidate',
    path: '/art/candidates/anime-v1/cottage.webp',
    world: 'verdant',
    description: 'Timber and stone sanctuary cottage nestled in the anime grove.'
  },
  {
    id: 'anime-oak-topdown',
    name: 'Great Oak (Topdown)',
    category: 'candidate',
    path: '/art/candidates/anime-v1/oak-topdown.webp',
    world: 'verdant',
    description: 'Top-down painted canopy render with sunlight filtering through leaves.'
  },
  {
    id: 'scene-reference',
    name: 'Forest Meadow Scene',
    category: 'candidate',
    path: '/art/candidates/anime-v1/scene-reference.webp',
    world: 'verdant',
    description: 'Atmospheric scene concept showing lighting and scale balance.'
  },
  {
    id: 'hero-design',
    name: 'Hero Design Specimen',
    category: 'candidate',
    path: '/art/candidates/anime-v1/hero-design.webp',
    world: 'verdant',
    description: 'Martial artist hero character in anime cel-shaded aesthetic.'
  }
];
