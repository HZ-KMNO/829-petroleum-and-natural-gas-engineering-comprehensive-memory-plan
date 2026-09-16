<p align="center">
  <img src="assets/app-icon.png" alt="829 石油与天然气工程综合记忆计划图标" width="180">
</p>

# 829 记忆计划

「829 记忆计划」是面向《石油与天然气工程综合》备考的 Windows 桌面记忆工具。
它将 369 道题、3301 个人工设计的挖空和 36 个公式或示意图片组织为主动回忆、
间隔复习和错题再练流程。

> 当前版本为 **1.1.0**。项目只发布 Windows x64 安装版桌面应用，
> 不发布网页版或 Portable 版。

## 主要功能

- 人工挖空：题库的每个答案范围都来自人工 Excel 母版，不依赖 Markji 私用字符或特殊字体。
- 等长遮盖：遮盖条使用原答案的实际排版宽度，中文、英文、数字和公式都与原文等长。
- 口诀回忆：记忆口诀作为 `mnemonic` 语义空保留，不再被当作乱码或固定提示删除。
- 知识分类：按定义、分类、条件、机理、作用、结果、公式、数值、口诀、条目和例子筛选。
- 逐空显示：挖空模式下可单独点击某个遮盖条，不必一次显示整题答案。
- 图片回忆：带公式或图示的图片块同样先遮盖，点击后才显示。
- 双练习模式：可在「挖空」和「整题」之间切换，并可在答题前写下自己的答案骨架。
- 每日目标：当天首次学习前设置「今天想背多少题？」，支持直接输入或上下按钮调节。
- FSRS 间隔复习：根据「不会、不熟、熟练」三档自评动态估计记忆稳定性和下次复习日期。
- 科学每日队列：到期题按遗忘风险、逾期程度、历史失误和 A/B/C 优先级排序，再补充新题。
- 题库管理：按全部、未学习、学习中和已掌握筛选，搜索题号或正文，离开后保留当前筛选状态。
- 章节归属：复习页和题库列表都显示题目所在章节。
- 优先级与错题本：可为每道题设置 A、B、C 优先级，遗忘记录自动进入错题本。
- 学习统计：展示已开始、已掌握、累计复习、自评正确率和最近 30 天活动。
- 多玩家存档：首次启动时创建名称并选择头像，以后可通过头像直接进入或新增玩家。

## 学习流程

1. 在启动页选择已有玩家，或创建新玩家存档。
2. 输入当日想学习的题量，然后开始今日任务。
3. 根据题干和遮盖条主动回忆，需要时可逐空或逐图查看。
4. 点击「核对答案」，再按实际掌握程度选择「不会、不熟、熟练」。
5. 队列会先选入风险最高的到期题，再补充新题，并穿插章节与长短题以减少连续疲劳。

| 自评 | 排程规则 |
| --- | --- |
| 不会 | 降低记忆稳定性并记录一次遗忘；在本轮间隔 3 道题后再次出现 |
| 不熟 | 保守增长记忆稳定性，使用较短的下次复习间隔 |
| 熟练 | 按 FSRS Good 评分增长稳定性，达到稳定阈值后标记为已掌握 |

## 玩家存档

应用不使用用户名密码或云同步。每个玩家的学习进度、优先级、每日目标、
历史统计和设置都保存在本机 Electron 数据目录：

```text
%USERPROFILE%\829-memory-data
```

- 安装新版、修改安装位置或卸载应用时，安装程序不主动删除该目录。
- 首次启动新版时会扫描 `%APPDATA%\829-memory` 以及 Windows 应用容器中的旧存档，并迁移到上述固定目录。
- 启动时会扫描已有玩家数据，可恢复「进度存在但玩家索引缺失」的存档入口。
- 从旧 372 题题库升级时，会删除重复题对应的旧记录，并将后续题号顺延到连续的 1–369。
- 「计划设置」中可导出单个玩家的 JSON 备份，也可导入备份恢复进度。

更换电脑、重装 Windows 或手动清理 `%APPDATA%` 前，建议先在应用内导出 JSON 备份。

## 题库结构

运行时题库位于 `public/data/questions.json`，当前结构版本为 v6。

- `id`：应用中显示的连续题号，当前为 1–369。
- `sourceId`：人工 Excel 中的原始题号，用于后续教材校对，不与存档题号耦合。
- `chapter`：章号和章节名称。
- `category` / `knowledgeTypes`：题目的主知识类型及全部知识类型。
- `blocks`：按原题顺序保存正文、图片、分隔线和空行。
- `clozes`：正文块内的字符起止位置，并标记 `keyword`、`formula`、`value` 或 `mnemonic`。

题库不再把空白写成固定长度下划线，也不用私用区字符代表公式。
因此题目文字可正常复制，挖空、搜索、导出和存档迁移使用同一份结构化数据。

## 人工维护题库

题库编辑母版是仓库根目录的 `829题库.xlsx`。「手动挖空版」中使用半角方括号标记完整答案：

```text
孔隙与喉道直径的比值
改为
[孔隙]与[喉道][直径]的比值
```

修改后导入：

```powershell
py -3 -m pip install openpyxl
py -3 tools/import_manual_questions.py
py -3 tools/audit_question_bank.py
pnpm test
```

如需从当前 JSON 重新生成无预设挖空的审核模板：

```powershell
py -3 tools/export_question_bank_xlsx.py
```

导入器会逐题核对 Excel 与 JSON 的空数、图片占位、方括号配对、空答案、
知识类型和连续题号；删除重复题后保留 `sourceId`，再为应用生成连续 `id`。

## 安装

在 [GitHub Releases](https://github.com/HZ-KMNO/829-petroleum-and-natural-gas-engineering-comprehensive-memory-plan/releases/latest)
下载最新的 Windows x64 安装程序：

```text
829-memory-plan-<版本>-setup.exe
```

安装器支持选择安装位置，并创建桌面和开始菜单快捷方式。
运行安装版不需要另行安装 Node.js、pnpm 或本地服务器。

## 开发与测试

源码开发需要 Node.js 和 pnpm。

```powershell
pnpm install
pnpm dev
```

`pnpm dev` 仅用于本地开发和调试，不作为对外发布形式。

执行自动化测试和前端生产构建：

```powershell
pnpm test
pnpm build
```

构建 Windows NSIS 安装版：

```powershell
pnpm desktop:build
```

当前构建产物位于：

```text
desktop-app-v1.1.0/829-memory-plan-1.1.0-setup.exe
```

`desktop-app-v*/` 是本地生成目录，不提交到 Git。对外发布安装包时应使用 GitHub Releases。

## 项目结构

```text
.
├─ assets/app-icon.png            # README 项目标志
├─ electron/main.cjs              # Electron 主进程、资源协议和固定存档路径
├─ public/
│  ├─ data/questions.json       # v6 语义挖空题库
│  ├─ media/                    # 公式和示意图片
│  └─ app-icon.*                # 应用和 Windows 快捷方式图标
├─ src/
│  ├─ components/               # 通用界面、题目渲染和错误边界
│  ├─ pages/                    # 玩家、今日复习、题库、统计和设置
│  ├─ profiles.js               # 玩家资料校验与恢复
│  ├─ scheduler.js              # 队列与间隔复习规则
│  └─ storage.js                # 存档、备份和题号迁移
├─ tools/
│  ├─ export_question_bank_xlsx.py
│  ├─ import_manual_questions.py
│  ├─ prepare_question_bank_110.py
│  ├─ audit_question_bank.py
│  └─ repair_local_save.mjs
├─ 829题库.xlsx                  # 人工维护权威源
└─ package.json
```

## 发布检查

一次完整的桌面版更新至少应包含：

1. 确认 `package.json` 版本号和 `desktop-app-v<版本>` 输出目录一致。
2. 执行 `pnpm test` 和 `pnpm build`。
3. 生成 NSIS 安装包，从已有存档迁移到 `%USERPROFILE%\829-memory-data` 后启动验证。
4. 核对题库数量、连续题号、挖空数量和图片引用完整性。
5. 只向 GitHub Releases 上传安装版，不生成 Portable 或网页发布包。

## 数据与版权

应用不设置服务端，不上传玩家名、学习记录或题目作答。
本仓库中的题库和教材图片根据个人学习资料整理，仅供学习交流，请勿用于商业用途。
