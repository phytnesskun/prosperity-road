import { DEFAULT_POLICY, SEASONS } from './economy.ts';
import type { Policy } from './economy.ts';
import type { Direction, GameState, Prediction } from './campaign.ts';

export const PILOT_VERSION = '2026.10.21';
export type PilotFeedback = {
  code: string;
  ease: string;
  fun: string;
  stuck: string;
  learned: string;
  suggestion: string;
};

export function emptyPilotFeedback(): PilotFeedback {
  return { code: '', ease: '', fun: '', stuck: '', learned: '', suggestion: '' };
}

const isRating = (value: string): boolean => ['1', '2', '3', '4', '5'].includes(value);

export function restorePilotFeedback(text: string | null): PilotFeedback {
  try {
    if (!text) return emptyPilotFeedback();
    const saved: unknown = JSON.parse(text);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return emptyPilotFeedback();
    const fields = saved as Record<string, unknown>;
    const restored = emptyPilotFeedback();
    for (const key of Object.keys(restored) as (keyof PilotFeedback)[]) {
      const value = fields[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') return emptyPilotFeedback();
      if (key === 'ease' || key === 'fun') {
        if (value !== '' && !isRating(value)) return emptyPilotFeedback();
        restored[key] = value;
      } else {
        restored[key] = value.slice(0, key === 'code' ? 40 : 1000);
      }
    }
    return restored;
  } catch {
    return emptyPilotFeedback();
  }
}

// A longer fence keeps even student-entered Markdown and HTML literal in the export.
function literal(value: string): string {
  const text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), match => match[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text.trim() ? text : '（未填写）'}\n${fence}`;
}

const number = (value: number): string => value.toFixed(2);
const policyText = (policy: Policy): string =>
  `最高限价：${policy.cap === null ? '不设限价' : policy.cap}；单位补贴：${policy.subsidy}；储备投放：${policy.release} 篮`;
const direction = (value: Direction): string => ({ '': '未预测', up: '上升', same: '不变', down: '下降' })[value];
function predictionText(prediction: Prediction): string {
  return `价格：${direction(prediction.price)}；低收入组实际购粮：${direction(prediction.purchases)}\n\n预测理由：\n\n${literal(prediction.reason)}`;
}

export function pilotFeedbackReport(state: GameState, feedback: PilotFeedback): string {
  const phase = { briefing: '开场观察', decision: '正在决策', result: '本季已结算', complete: '任期已完成' }[state.phase];
  const settled = state.phase === 'result' || state.phase === 'complete';
  const current = settled ? state.records.at(-1) : undefined;
  const policy = state.phase === 'briefing' ? DEFAULT_POLICY : current?.result.policy ?? state.draft;
  const rating = (value: string): string => isRating(value) ? `${value}/5` : '未评分';
  const lines = [
    '# 繁荣之路 · 学生试玩反馈',
    '',
    `试玩版本：${PILOT_VERSION}`,
    '',
    '本文件由玩家主动下载，不会自动上传。学生文字以原文代码块保存。',
    '',
    '## 试玩代号',
    '',
    literal(feedback.code),
    '',
    '## 体验反馈',
    '',
    `操作是否清楚：${rating(feedback.ease)}（1 很难上手，5 很容易）`,
    '',
    `是否愿意继续玩：${rating(feedback.fun)}（1 不太愿意，5 很愿意）`,
    '',
    '### 卡住或不符合预期的地方',
    '',
    literal(feedback.stuck),
    '',
    '### 发现的经济规律或仍有的疑问',
    '',
    literal(feedback.learned),
    '',
    '### 最希望改进的一件事',
    '',
    literal(feedback.suggestion),
    '',
    '## 当前进度',
    '',
    `阶段：${phase}；当前第 ${state.seasonIndex + 1}/6 季；已结算 ${state.records.length}/6 季。`,
    '',
    state.phase === 'complete' ? '以下为完整任期记录。' : '试玩尚未结束，以下仅记录当前进度，不作为最终评价。',
    '',
    `### ${settled ? '本季已执行政策' : state.phase === 'briefing' ? '基期固定政策（尚未执行）' : '当前政策草案（尚未执行）'}`,
    '',
    policyText(policy),
    '',
    '### 本季预测',
    '',
    predictionText(current?.prediction ?? state.prediction),
    '',
    '## 已结算季度记录',
    '',
    '仅列正式结算结果；未执行的草案和免费试算不会计入。价格与资金以游戏信用点计，购粮与储备以篮计。',
    '',
  ];
  if (state.records.length === 0) {
    lines.push('尚无已结算季度。');
  } else {
    lines.push(
      '| 季度 | 最高限价 | 单位补贴 | 储备投放 | 价格 | 低收入组实际购粮 | 保障率 | 超额需求 | 季末现金 | 季末储备 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...state.records.map(({ result: r }) =>
        `| ${r.season} | ${r.policy.cap === null ? '无' : r.policy.cap} | ${r.policy.subsidy} | ${r.policy.release} | ${number(r.price)} | ${number(r.purchasesLow)} | ${number(r.coverageLow * 100)}% | ${number(r.excessDemand)} | ${number(r.after.cash)} | ${number(r.after.reserves)} |`),
      '',
      '### 各季预测与理由',
      '',
    );
    for (const record of state.records) {
      lines.push(`#### 第 ${record.result.season} 季 · ${SEASONS[record.result.season - 1]?.title ?? '已结算'}`, '', predictionText(record.prediction), '');
    }
  }
  lines.push('', '## 已填写的学习复盘', '', '未填写的部分保持空白，不代替学生作答。', '');
  for (const [key, label] of [['action', '采取的行动'], ['evidence', '数字证据'], ['explanation', '经济解释'], ['conditions', '成立条件与局限']] as const) {
    lines.push(`### ${label}`, '', literal(state.report[key]), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
