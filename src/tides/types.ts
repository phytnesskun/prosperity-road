export type Prop = 'cart'|'rice'|'crate'|'egg'|'lamp'|'key'|'ticket'|'boat'|'reed'|'chalk'|'oil'|'bell'|'paper'|'coins'|'bread'|'rope';
export type StoryLine = readonly [speaker: string, chinese: string, english: string];
export type Past = Readonly<Record<string, string>>;
export type StoryContext = { past: Past; picks: readonly string[] };
export type Choice = {
  id: string; label: string; prop: Prop; result: string; cue: string;
  hint?: string;
};
export type Beat = {
  title: string; detail: string; item: Prop; itemLabel: string; choices: Choice[];
};
export type Outcome = { title: string; detail: string; facts: Record<string,string> };
export type StoryChapter = {
  num: number; title: string; lines: Record<string,StoryLine>; opening: string;
  steps: ((context: StoryContext) => Beat)[];
  end(context: StoryContext): Outcome;
};
