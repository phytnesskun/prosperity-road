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
  morning: ['第六章', '雾港第一班早船'],
  ch7: ['第七章', '桥开那天'],
  ch8: ['第八章', '红帆也会看价牌'],
  ch9: ['第九章', '仓门上的两道粉笔线'],
  ch10: ['第十章', '给夜船做一盏灯'],
  ch11: ['第十一章', '借我半天舵'],
  ch12: ['第十二章', '雾港赶大集'],
  ch13: ['第十三章', '芦湾只收半船货'],
  ch14: ['第十四章', '别让回程空着'],
  ch15: ['第十五章', '两把仓房钥匙'],
  ch16: ['第十六章', '迟到一班的价牌'],
  ch17: ['第十七章', '包船一个冬天'],
  ch18: ['第十八章', '旧船票背面的名字'],
  ch19: ['第十九章', '两岸换班'],
  ch20: ['第二十章', '今天谁来挂船牌'],
} as const;
export type Chapter = keyof typeof chapters;
export type LaterChapter = Exclude<Chapter, 'harbor' | 'rice'>;

export function isChapter(value: string | undefined): value is Chapter {
  return value !== undefined && Object.hasOwn(chapters, value);
}

export function chapterHref(id: Chapter): string {
  return document.body.hasAttribute('data-chapter') ? '#' + id : '?scenario=' + id;
}
