export interface Soundtrack {
  id: string;
  title: string;
  game: string;
  scene: string;
}

export const SOUNDTRACKS: readonly Soundtrack[] = [
  { id: 'warband-town-rhodok', title: 'Town Rhodok', game: '骑马与砍杀：战团', scene: '城镇经营' },
  { id: 'warband-town-swadian', title: 'Town Swadian', game: '骑马与砍杀：战团', scene: '市集与交易' },
  { id: 'warband-town-neutral', title: 'Town Neutral', game: '骑马与砍杀：战团', scene: '菜单与休息' },
  { id: 'warband-town-vaegir', title: 'Town Vaegir', game: '骑马与砍杀：战团', scene: '冬季村落' },
  { id: 'warband-town-khergit', title: 'Town Khergit', game: '骑马与砍杀：战团', scene: '商队往来' },
  { id: 'warband-outdoor-beautiful-land', title: 'Outdoor Beautiful Land', game: '骑马与砍杀：战团', scene: '郊外与农场' },
  { id: 'warband-uncertain-homestead', title: 'Uncertain Homestead', game: '骑马与砍杀：战团', scene: '村庄与生产' },
  { id: 'warband-travel-swadian', title: 'Travel Swadian', game: '骑马与砍杀：战团', scene: '旅行与地图' },
  { id: 'warband-tavern-1', title: 'Tavern 1', game: '骑马与砍杀：战团', scene: '酒馆与闲聊' },
  { id: 'warband-tavern-2', title: 'Tavern 2', game: '骑马与砍杀：战团', scene: '酒馆与闲聊' },
  { id: 'warband-lords-hall-swadian', title: "Lord's Hall Swadian", game: '骑马与砍杀：战团', scene: '开场与休息' },
  { id: 'eu4-commerce-in-the-peninsula', title: 'Commerce in the Peninsula', game: '欧陆风云 IV', scene: '贸易与产业' },
  { id: 'eu4-in-the-streets', title: 'In the Streets', game: '欧陆风云 IV', scene: '街巷与店铺' },
  { id: 'eu4-among-the-poor', title: 'Among the Poor', game: '欧陆风云 IV', scene: '生产与等待' },
  { id: 'eu4-eire', title: 'Éire', game: '欧陆风云 IV', scene: '地图与规划' },
  { id: 'eu4-peace-for-generations', title: 'Peace for Generations', game: '欧陆风云 IV', scene: 'Kairi Soundtrack II · 长期经营与结局' },
];

function normalizedTitle(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function findSoundtrack(filename: string): Soundtrack | undefined {
  const title = normalizedTitle(filename.replace(/\.(mp3|ogg|oga|wav|flac|m4a|aac|opus|webm)$/i, ''));
  return SOUNDTRACKS.find(track => normalizedTitle(track.title) === title);
}
