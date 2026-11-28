export type ChapterContext = {
  load(): unknown;
  save(state: unknown): void;
  say(speaker: string, zh: string, en: string): void;
  finish(summary: string): void;
};

export const chapters = {
  harbor: ['序章', '雾港的最后一炉'],
  rice: ['第二章', '谁把西岸的粮买空了？'],
  mill: ['第三章', '风起磨坊'],
  convoy: ['第四章', '潮窗里的船队'],
  quay: ['第五章', '桥下游的灯'],
} as const;
export type Chapter = keyof typeof chapters;
export type LaterChapter = Exclude<Chapter, 'harbor' | 'rice'>;

export function isChapter(value: string | undefined): value is Chapter {
  return value !== undefined && Object.hasOwn(chapters, value);
}

export function chapterHref(id: Chapter): string {
  return document.body.hasAttribute('data-chapter') ? '#' + id : '?scenario=' + id;
}
