<p align="center">
  <img src="assets/app-icon.png" alt="829 石油与天然气工程综合记忆计划图标" width="180">
</p>

# 829 记忆计划

面向《石油与天然气综合（829）》完整版题库的本地记忆训练软件。项目把 372 道题、
2827 个挖空答案片段和 36 个图片块整理为适合一个月冲刺的主动回忆与间隔复习流程。

> 本仓库包含根据个人学习资料整理的题库和教材图片，仅供学习交流。使用者应自行遵守
> 相关资料的版权规定，请勿用于商业用途。

## 功能

- 主动回忆模式：先看保留原下划线长度的挖空，再显示答案并自评。
- 全题浏览模式：按原题结构查看文字、下划线和图片，支持关键词搜索。
- 四级反馈：使用“忘记、困难、记得、熟练”安排下一次复习。
- 优先级管理：A、B、C 三档标记重点，队列内优先安排高优先级题目。
- 错题本与统计：汇总遗忘题、掌握进度、连续学习和未来复习量。
- 30 天计划：根据考试日期和未学习题数自动计算每日新题目标。
- 本地数据：学习记录仅存于本机应用，可随时导出或导入 JSON 备份。
- 独立桌面窗口：不启动本地服务器，不打开 Edge，也不要求运行时安装 Node.js。

## Windows 快速启动

直接双击桌面的 `829 记忆计划` 快捷方式。它会启动独立 Windows 应用，不会打开浏览器。

其他电脑可以从 [GitHub Releases](https://github.com/HZ-KMNO/829-petroleum-and-natural-gas-engineering-comprehensive-memory-plan/releases/latest)
下载 `829-memory-plan-1.0.0-portable.exe`，无需安装即可运行。

本机生成的可移植程序位于：

`desktop-app/829-memory-plan-1.0.0-portable.exe`

该 EXE 已包含 Electron 运行时、题库和图片，可以直接运行，不依赖 pnpm。关闭应用窗口即可
停止软件。

## 命令行使用

```powershell
pnpm install
pnpm desktop:build
```

构建完成后运行 `desktop-app/829-memory-plan-1.0.0-portable.exe`。开发时也可以先构建网页资源，
再用 Electron 直接打开：

```powershell
pnpm build
pnpm desktop
```

`pnpm dev` 仍保留为可选的网页开发模式，但日常学习不需要使用。

## 复习规则

每日队列先加入已到期题目，再按当日目标补充新题；同一组中按 A、B、C 优先级排序。

| 反馈 | 规则 |
| --- | --- |
| 忘记 | 重置学习阶段，1 天后复习，并在本轮队尾再次出现 |
| 困难 | 保持当前阶段，间隔约为原来的 1.25 倍，最少 1 天 |
| 记得 | 推进一个阶段，按 1、3、7、14、30 天逐步拉长间隔 |
| 熟练 | 推进阶段，间隔至少 3 天，并按原间隔约 1.8 倍延长 |

首次使用时，考试日期默认为 30 天后。可以在“计划设置”中调整考试日期或手动指定每日
新题数。

## 数据位置

- `source/石油与天然气综合_完整版题库.docx`：完整 Word 题库源文件。
- `public/data/questions.json`：应用读取的结构化题库。
- `public/media/`：从 Word 提取的题目图片。
- `public/app-icon.png`、`public/app-icon.ico`：网页应用图标。
- `public/app-shortcut-icon-v2.ico`：Windows 快捷方式图标（独立文件名避免系统缓存旧图标）。
- `public/markji.otf`：还原题目中专用字符的字体。
- Electron 应用本地存储：学习进度、优先级、设置和历史记录。

在“计划设置”中使用“导出”生成 JSON 备份，重装系统或清理应用数据前应先导出。

## 重新提取题库

需要 Python 3.10 或更高版本。脚本优先读取仓库内的 Word 文件，并直接使用 Python 标准库：

```powershell
python tools/extract_questions.py
```

它会更新 `public/data/questions.json` 和 `public/media/`。原始 Word 文件不会被修改。

## 项目结构

```text
study-app/
├─ electron/               # Windows 桌面窗口与应用资源协议
├─ public/                 # 题库 JSON、图片和字体
├─ source/                 # Word 题库源文件
├─ src/
│  ├─ components/         # 通用界面组件
│  ├─ pages/              # 复习、题库、统计和设置页面
│  ├─ scheduler.js        # 间隔复习与每日队列逻辑
│  └─ storage.js          # 应用本地存储与备份
├─ tools/                 # Word 题库提取脚本
└─ 启动829记忆计划.cmd    # 已构建桌面应用的一键启动器
```

## 测试

```powershell
pnpm test
pnpm build
pnpm desktop:build
```

当前自动化测试覆盖复习间隔、遗忘重排和每日队列等核心调度逻辑。

## 技术栈

Electron、React、Vite、Vitest、Lucide React。桌面应用通过内部安全协议加载资源，不需要后端
服务，学习数据不会上传到网络。
