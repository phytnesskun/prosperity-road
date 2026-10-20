# 繁荣之路 · Prosperity Road

以 Pearson Edexcel International A Level Economics 为课程背景的课堂策略游戏。

当前《面包危机》可完成六个季度：观察正常市场、应对歉收、选择限价/补贴/公共投放、检查供需与账目、回放单季政策、完成学习报告。所有数值是透明的教学模型假设，不是现实预测。

## 本地运行

环境：Node.js 24.12 或更高版本、npm、现代浏览器。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。游戏在浏览器内运行，不需要后端数据库或 API 密钥。进度保存在当前浏览器的 localStorage；不同设备、浏览器和网址之间不会自动同步。报告可下载为 Markdown。

## 检查与构建

```bash
npm test
npm run build
```

- `npm test`：经济模型、季度状态、存档恢复、新剧本数值。
- `npm run check`：TypeScript 类型检查。
- `npm run build`：类型检查后生成 `dist/`。
- `npm run preview`：预览生产构建。

浏览器检查需要先在另一个终端运行 `npm run dev -- --port 5173 --strictPort`，然后执行：

```bash
npm run test:browser
```

macOS 优先使用已安装的 Google Chrome。其他环境可先运行 `npx playwright install chromium`，或通过 `BROWSER_EXECUTABLE` 指定浏览器可执行文件。检查使用独立临时浏览器上下文，不读取个人浏览器资料。截图及测试下载保存在被 Git 忽略的 `.qa/`。

## 文件结构

| 文件 | 用途 |
|---|---|
| `src/economy.ts` | 纯函数经济结算与供需函数 |
| `src/campaign.ts` | 六季流程、预测、存档验证、目标检查 |
| `src/main.ts` | 地图、政策、结果、回放与报告界面 |
| `src/charts.ts` | 使用同一经济模型绘制供需图 |
| `src/style.css`、`public/town.svg` | 界面样式和原创城镇地图 |
| `docs/scenarios/bread-crisis.md` | 面包危机的课程、剧本与规则依据 |
| `docs/scenarios/smokestacks-and-river.md` | 第二剧本《烟囱与河流》完整设计稿 |

《烟囱与河流》已完成规则与独立数值验证，尚未接入可玩界面。

## 游戏与教学约定

- 第1季固定无干预；第2–6季每季重新选择政策。
- 第2、4季先记录两项方向预测及一句理由；理由只要求填写，不进行自动内容评分。
- 资源不足时整组政策不执行，既有资源与历史保持不变。
- 决策前展示可执行性与库存承诺，执行后才揭示精确市场结果与现金账目。
- 超额需求和基本篮子缺口分别记录；低价或市场出清不自动代表保障改善。
- 单季回放复制该季期初资源与外生条件，不改变原局、不延续到以后季度。
- 所有视图读取同一结算记录；计算保持完整精度，展示四舍五入到两位小数。
- 教师可按 AO1–AO4 评价复盘，经营目标与学习评价分开；不自动生成 Pearson 考试等级。

## 发布与下一步

部署配置为 `.openai/hosting.json`，静态产物位于 `dist/`。Sites 发布版本保持私有，GitHub `origin` 保持为本仓库。发布时使用已验证并推送的同一源代码状态。

下一步建议进行3–5名学生的小范围试教，观察独立完成情况、因果解释和陌生情境迁移，再调整引导与难度。《烟囱与河流》可在规则审阅后接入相同的界面流程。

课程来源：[Pearson IAL Economics Specification](https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Economics/2018/Specification-and-Sample-Assessment/International-A-Level-Economics-spec.pdf)。
