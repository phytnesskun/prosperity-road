# 《繁荣之路》学生试玩演示视频

本片使用真实网页操作录制，配中文系统旁白、烧录中文字幕与点击提示。它跟随一位玩家做出前两季的决定，观察城镇回应，再尝试另一种方案；不展示全通关攻略。画面中的政策结果来自游戏模型。

界面流程为选方案后直接执行，随后看街头反应、生产流转和经营变化。微调、林岚对话、免费试算、城镇走访和试玩反馈都由玩家自选；六季结束自动生成任期战报。

## 可编辑素材与成品

- `narration.json`：分段标题、完整中文旁白、字幕，修改这份文件即可重新制作。
- `script.md`：便于教师阅读的分镜讲稿与时间轴。
- `prosperity-road-demo.zh.srt`：字幕源文件。
- `../../scripts/record-demo.mjs`：浏览器操作脚本，使用独立无存档环境。
- `../../scripts/render-demo.py`：系统旁白生成、字幕与音视频合成脚本。
- `../../public/prosperity-road-demo.mp4`：H.264 / AAC 成品，可直接播放或下载。
- `../../public/prosperity-road-demo-poster.jpg`：从成片提取的海报帧。
- `.qa/demo/`：原始网页录屏、分段音频、时间轴、验收截图。临时目录不提交。

录制向浏览器临时注入黄色指针及点击圆环，不改变游戏实现；所有政策、对话、试算均通过实际按钮操作。只有演示视频有标题栏及字幕条，网页本身不受影响。旁白采用 macOS 系统 Tingting 合成语音，没有调用外部语音服务。

## 复现步骤

在项目根目录执行，保持第一个终端的开发服务器运行：

```sh
npm run dev -- --host 127.0.0.1
```

第二个终端准备视频工具。项目本身没有新增依赖，FFmpeg 放在被忽略的临时目录中：

```sh
python3 -m pip install --target .qa/demo/tools imageio-ffmpeg
node node_modules/playwright/cli.js install ffmpeg
python3 scripts/render-demo.py prepare
node scripts/record-demo.mjs
python3 scripts/render-demo.py render
```

默认使用安装在 `/Applications/Google Chrome.app` 的 Chrome，否则使用 Playwright Chromium。可用 `BROWSER_EXECUTABLE` 指定浏览器路径、`BASE_URL` 指定预览地址；`FFMPEG` 可指定已有 FFmpeg 可执行文件。旁白生成需要 macOS `/usr/bin/say`，可用 `DEMO_VOICE` 选择已安装的中文声音。上述环境中 Python 实际路径为 `/Users/bingkunqi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`。

如果修改了按钮文案、流程或场景，需同步操作脚本和讲稿并重新录制。发布前运行项目测试，再检查视频，避免新界面配旧讲解。

## 游戏规则与演示边界

- 视频展示的是自由决策与世界反馈，不要求玩家预测、答题或填写学习报告。
- 示例的第二季：限价 5 后低收入组实际购粮 24；同季无干预为 25。价格较低并不自动增加实际获得量。
- 免费试算复制同季天气、成本和期初资源，不改写本局记录，也不延续至后续季度。
- 林岚是结合当前数据的选项式虚拟顾问；本片不暗示自由语音聊天。
- 视频中的动画只说明流向；具体数量以结算数值为准。
- 后续政策由玩家自己选择，图表、账本与试玩反馈都是可选内容，不作为继续游戏的门槛。
