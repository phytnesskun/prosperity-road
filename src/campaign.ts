import { DEFAULT_POLICY, INITIAL_RESOURCES, SEASONS, evaluate } from './economy.ts';
import type { Policy, Resources, Result } from './economy.ts';

export type Direction = '' | 'up' | 'same' | 'down';
export type Prediction = { price: Direction; purchases: Direction; reason: string };
export type TurnRecord = { result: Result; prediction: Prediction };
export type Report = { action: string; evidence: string; explanation: string; conditions: string };
export type GameState = {
  version: 1;
  phase: 'briefing' | 'decision' | 'result' | 'complete';
  seasonIndex: number;
  draft: Policy;
  prediction: Prediction;
  records: TurnRecord[];
  report: Report;
};

export const emptyPrediction = (): Prediction => ({ price: '', purchases: '', reason: '' });
export const predictionComplete = (prediction: Prediction): boolean =>
  Boolean(prediction.price && prediction.purchases && prediction.reason.trim());
export function newGame(): GameState {
  return {
    version: 1, phase: 'briefing', seasonIndex: 0,
    draft: { ...DEFAULT_POLICY }, prediction: emptyPrediction(), records: [],
    report: { action: '', evidence: '', explanation: '', conditions: '' },
  };
}
export const needsPrediction = (state: GameState): boolean =>
  state.phase === 'decision' && [1, 3].includes(state.seasonIndex);
export function currentResources(state: GameState): Resources {
  return { ...(state.records.at(-1)?.result.after ?? INITIAL_RESOURCES) };
}
export function choosePolicy(state: GameState, draft: Policy): GameState {
  if (state.phase !== 'decision') return state;
  if (state.draft.cap === draft.cap && state.draft.subsidy === draft.subsidy && state.draft.release === draft.release) return state;
  return { ...state, draft: { ...draft }, prediction: emptyPrediction() };
}
export function settleTurn(state: GameState): { ok: true; state: GameState } | { ok: false; message: string } {
  if (!['briefing', 'decision'].includes(state.phase)) {
    return { ok: false, message: '本季已经结算。请进入下一季，或在回放中比较其他政策。' };
  }
  if (needsPrediction(state) && !predictionComplete(state.prediction)) {
    return { ok: false, message: '请先点选价格与实际购粮的变化方向，再选择或填写一个理由。' };
  }
  const policy = state.seasonIndex === 0 ? DEFAULT_POLICY : state.draft;
  const evaluation = evaluate(SEASONS[state.seasonIndex], policy, currentResources(state));
  if (!evaluation.valid) return { ok: false, message: evaluation.message };
  return {
    ok: true,
    state: {
      ...state, phase: 'result',
      records: [...state.records, { result: evaluation.result, prediction: { ...state.prediction } }],
    },
  };
}
export function nextSeason(state: GameState): GameState {
  if (state.phase !== 'result') return state;
  if (state.seasonIndex === 5) return { ...state, phase: 'complete' };
  return {
    ...state, phase: 'decision', seasonIndex: state.seasonIndex + 1,
    draft: { ...DEFAULT_POLICY }, prediction: emptyPrediction(),
  };
}
export function goals(records: TurnRecord[]) {
  const metSeasons = records.filter(r => r.result.coverageLow >= 0.95 - 1e-9).length;
  const reserves = records.at(-1)?.result.after.reserves ?? INITIAL_RESOURCES.reserves;
  const solvent = records.every(r => r.result.after.cash >= 0);
  return { metSeasons, reserves, solvent, passed: records.length === 6 && metSeasons >= 5 && reserves >= 20 && solvent };
}

function isPolicy(value: unknown): value is Policy {
  if (!value || typeof value !== 'object') return false;
  const p = value as Policy;
  return [null, 4, 5, 6].includes(p.cap) && [0, 1, 2].includes(p.subsidy) && [0, 10, 20].includes(p.release);
}
function readPrediction(value: unknown): Prediction | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Prediction;
  if (!['', 'up', 'same', 'down'].includes(p.price) || !['', 'up', 'same', 'down'].includes(p.purchases) ||
      typeof p.reason !== 'string' || p.reason.length > 3000) return null;
  return { price: p.price, purchases: p.purchases, reason: p.reason };
}

// Recompute saved outcomes from policies, rather than trusting stored numerical results.
export function restoreGame(text: string): GameState | null {
  try {
    const saved = JSON.parse(text) as GameState;
    if (!saved || saved.version !== 1 || !['briefing', 'decision', 'result', 'complete'].includes(saved.phase) ||
        !Number.isInteger(saved.seasonIndex) || saved.seasonIndex < 0 || saved.seasonIndex > 5 ||
        !isPolicy(saved.draft) || !Array.isArray(saved.records) || saved.records.length > 6) return null;
    const count = saved.records.length;
    if ((saved.phase === 'briefing' && (count !== 0 || saved.seasonIndex !== 0)) ||
        (saved.phase === 'decision' && (count !== saved.seasonIndex || count < 1)) ||
        (saved.phase === 'result' && count !== saved.seasonIndex + 1) ||
        (saved.phase === 'complete' && (count !== 6 || saved.seasonIndex !== 5))) return null;
    const prediction = readPrediction(saved.prediction);
    if (!prediction || !saved.report) return null;
    const report = {} as Report;
    for (const key of ['action', 'evidence', 'explanation', 'conditions'] as const) {
      const value = saved.report[key];
      if (typeof value !== 'string' || value.length > 3000) return null;
      report[key] = value;
    }
    let resources = { ...INITIAL_RESOURCES };
    const records: TurnRecord[] = [];
    for (let index = 0; index < count; index++) {
      const row = saved.records[index];
      if (!row || !row.result || !isPolicy(row.result.policy)) return null;
      const p = row.result.policy;
      if (index === 0 && (p.cap !== null || p.subsidy !== 0 || p.release !== 0)) return null;
      const priorPrediction = readPrediction(row.prediction);
      if (!priorPrediction || ([1, 3].includes(index) && !predictionComplete(priorPrediction))) return null;
      const evaluation = evaluate(SEASONS[index], row.result.policy, resources);
      if (!evaluation.valid) return null;
      records.push({ result: evaluation.result, prediction: priorPrediction });
      resources = { ...evaluation.result.after };
    }
    return {
      version: 1, phase: saved.phase, seasonIndex: saved.seasonIndex,
      draft: { ...saved.draft }, prediction, records, report,
    };
  } catch {
    return null;
  }
}
