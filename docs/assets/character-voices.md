# 角色双语配音

第一剧本的林岚、农民陈禾、工人阿诚、售货员阿芸、居民周婶分别使用独立的标准合成声。角色切换和语音语言切换只改变播放内容，不改变游戏规则、存档或界面语言。

## 台词与声音

`src/voice-lines.ts` 是台词来源：中文与英文各一份，按当前季度、草案、实际结算、原料限制和居民购粮情况选择短句。短句承担人物反应和核心意思，旁边的账本保留完整实时数值；配音字幕显示实际播放的句子，不声称逐字朗读整页。

- 林岚：中文 `zh-CN-XiaoxiaoNeural`，英文 `en-GB-SoniaNeural`；语速 −4%，温和、留停顿。
- 陈禾：中文 `zh-CN-YunyangNeural`，英文 `en-GB-RyanNeural`；语速 −8%，音高 −5 Hz，节奏稳一些。
- 阿诚：中文 `zh-CN-YunxiNeural`，英文 `en-GB-ThomasNeural`；正常语速，简短直接。
- 阿芸：中文 `zh-CN-XiaoyiNeural`，英文 `en-GB-LibbyNeural`；语速 +2%，明快但不夸张。
- 周婶：中文 `zh-TW-HsiaoChenNeural`，英文 `en-US-JennyNeural`；语速 −5%，音高 −3 Hz，亲切平缓。中文带台湾普通话口音。

声线是角色演绎方向，不代表服务提供真人年龄或情感参数。未克隆真人，未使用个人密钥或付费接口。没有将 EU4 或其他商业游戏音乐打包进角色音频。

## 生成与复现

生成工具沿用演示视频使用的第三方开源 [edge-tts 7.3.1](https://github.com/rany2/edge-tts)。2026-10-26 实际查询服务声线列表并完成中文、英文样音生成后，制作双语音频。服务端合成结果可能随服务更新略有变化。

```sh
PYTHONPATH=.qa/demo/tools python3 scripts/generate-character-voices.py
```

制作需要网络及演示视频已安装的 `edge-tts`。必要时可在该命令进程设置 `CHARACTER_TTS_PROXY`；脚本不改动系统代理。仅发送仓库中的固定公开台词。运行中的游戏直接播放静态 MP3，不调用在线语音服务，也不收集麦克风声音。

`public/audio/characters/manifest.json` 记录每段台词、声线、语速、音高、字节数及 SHA-256；生成器根据台词和声线签名复用已有文件，修改台词后只重生成受影响片段。`tests/voice-lines.test.ts` 核对真实文件与台词、角色和哈希一致，检查草案与结算、保障目标与基本口粮等分支。

## 本次资源核验

65 组中英台词，共 130 个 MP3，6,080,544 字节。每段约 5.14–10.37 秒，合计约 16.9 分钟。全部通过 macOS `afinfo` 有效时长识别与 FFmpeg 全段解码；5 组台词选择及音频清单测试通过。该验证覆盖文件完整性和情境分支，不等于逐段主观听音评价。
