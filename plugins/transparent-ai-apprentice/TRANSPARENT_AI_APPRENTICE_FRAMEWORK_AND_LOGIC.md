# Transparent AI Apprentice 插件整体框架与逻辑

本文用于和外部同伴讨论 Transparent AI Apprentice 的产品框架、技术逻辑、当前能力边界和下一步验证方向。

## 0. 当前收束方向：TLCL

根据最新市场方向报告，Transparent AI Apprentice 的主线应收束为：

```text
Teachable Logic Contract Layer for AI Workflows
可教学逻辑契约层驱动的 AI 工作系统
```

这意味着项目第一阶段不再主打“通用 Agent”“控制所有软件”“无人值守自动化”或“万能 AI 学徒”，而是主打强模型进入专业生产系统所需的可信交付层：

```text
人类教学
-> 高级模型提取规则和边界
-> 人类审核
-> Artifact Envelope / Rule Card / Rule DSL
-> Rule Package / Validator Registry / Validation Report
-> Delivery Gate / Execution Gate
-> Audit Chain
-> 低成本模型在契约约束下执行
```

一句话：Skill 让 AI 会做，Transparent AI Apprentice 让 AI 做出来的东西可验证、可复用、可交付、可追责。

当前 MVP 应优先证明：

- 人类纠错可以变成可执行规则契约。
- 输入可以被统一为 Artifact Envelope。
- Validator 可以输出 pass/fail/unknown/error。
- active + blocking + fail/unknown/error 必须阻断交付。
- 透明蒙版、编号确认、细节逻辑学习、Rule DSL、Validator、Validation Report 和审计链可以在一个窄场景中跑通。

推荐第一场景：包装盒展开图或简单工程图验证。原因是它能清楚证明“看起来像”不等于“能生产/可交付”，也能把线条、角度、比例、胶舌宽度、连接关系、材料约束等细节转成可检查逻辑。

这些原始功能仍然必须保留，但要重新挂到 TLCL 主线上，作为证据、交互、观察、执行或验证支撑能力：

- 全软件自动学习。
- 无人值守控制电脑。
- 语音控制所有工程软件。
- 持续观察屏幕。
- 通用 Agent 定位。
- 完整 3D 空间理解。
- 全自动 CAD 操作。

这些方向不是删除，而是必须回答同一组问题：它产生什么 evidence，能否进入 Artifact Envelope，能否生成或引用 Rule Card，是否经过 Rule DSL / Validator，是否有老师 receipt，是否有 rollback point，是否能进入 audit chain。回答不了的部分先补契约层，再谈执行。

完整目标方向和任务列表见：

`FULL_TARGET_DIRECTION_AND_TASK_LIST.md`

## 1. 一句话定位

Transparent AI Apprentice 不是普通聊天机器人，也不是冷冰冰的流程自动化工具，而是一个“可被人类教学、纠正、复盘、逐步信任”的 AI 学徒系统。

核心闭环：

```text
人类演示/说明 -> AI 尝试执行/复述 -> 人类纠正 -> 系统提取规则草案 -> 人类审核 -> 规则进入可复用记忆 -> 下次执行更稳
```

系统永远不应该只生成“看起来像”的结果，而是要把人类教学转成可检查的结构：

- 我看到了什么证据。
- 我理解了哪些步骤。
- 我认为哪些规则可能成立。
- 这些规则适用边界是什么。
- 哪些地方需要老师确认。
- 哪些动作被禁止自动执行。
- 下次遇到类似任务如何复用。

## 2. 产品目标

插件要解决的不是“让 AI 一次性帮人做完一个任务”，而是让 AI 可以像学徒一样被训练：

- 老师可以用自然语言、语音、截图、录屏、CAD 图纸、草图、表格、软件操作痕迹等方式教学。
- AI 把教学过程整理成公开结构化轨迹，而不是暴露私有链式思考。
- 老师可以纠正 AI 的理解，系统将纠正转成禁用状态的规则草案。
- 只有经过老师确认的规则才能进入可复用记忆。
- 对软件执行、截图、读日志、定时任务、写记忆、包装发布等高风险动作，都必须有明确门控。

## 3. 总体架构

系统可以分成九层。

```text
用户/老师
  |
  v
教学入口层：teach_apprentice、命令中心、工作台、HTML receipt builder
  |
  v
证据输入层：文字、语音、截图、绘图文件、录屏事件、日志元数据、软件清单、CAD/工程文件
  |
  v
理解与追踪层：结构化 public trace、步骤、观察、候选规则、置信度、待确认点
  |
  v
教学闭环层：演示、尝试、纠正、回放、反例、边界、老师确认
  |
  v
规则与记忆层：禁用规则草案、审核后记忆、冲突检测、可撤销/可修正 profile
  |
  v
工具与软件适配层：现有绘图工具、浏览器自动化、CLI/API、软件日志、文件导入导出、受监督 UI 操作
  |
  v
执行与安全门控层：receipt、validation、rollback、dry-run、teacher-reviewed、approval gate
  |
  v
审计与交付层：smoke、verify、coverage、current-status refresh、handoff、未完成边界
```

对应到代码和插件形态：

- `skills/teachable-apprentice/SKILL.md` 是默认教学技能入口。
- `.mcp.json` 和 `scripts/mcp-server.mjs` 暴露 MCP 工具。
- `scripts/*.mjs` 是实际能力模块。
- `.transparent-apprentice/` 保存运行证据、收据、状态刷新、回滚点、smoke 输出。
- `verify-plugin.mjs`、`smoke-goal-coverage.mjs`、各类 smoke 脚本证明能力没有只停留在口头设计。

## 4. 默认教学闭环

默认入口是 `teach_apprentice`，它应该根据老师输入自动选择下一步：

- 如果老师给目标：创建教学会话或命令中心。
- 如果老师给步骤：转成动作序列和 public trace。
- 如果老师给截图/绘图/录屏：导入为演示证据。
- 如果老师说“不对”：定位最近规则草案或执行结果，生成纠正。
- 如果老师说“记住”：只在审核通过后写入 profile memory。
- 如果老师让复用：从已审核记忆运行，而不是重新问一遍。
- 如果风险动作缺确认：停止并生成 receipt/approval gate。

重要原则：

- AI 的私有推理不展示。
- 对外只展示结构化理由：证据、步骤、规则、置信度、验证、人工确认点。
- 默认规则草案都是 disabled/review-only。
- 只有老师审核通过后才可以进入长期记忆。

## 5. 低 token 全软件学习逻辑

用户希望插件适配“电脑上所有软件”，不能只围绕 CAD 或 SolidWorks。因此当前框架采用“先发现、再低成本观察、再触发视觉/执行”的顺序。

### 5.1 软件发现

系统先做只读发现：

- 本机软件清单。
- 进程和窗口元数据。
- 可能的日志路径。
- Windows Event 线索。
- 文件变动线索。
- 软件是否有 CLI/API/宏/脚本/导入导出能力。
- 是否只能走受监督 UI 操作。

相关能力：

- `create-software-capability-profile.mjs`
- `create-software-observer-inventory.mjs`
- `create-software-observer-queue.mjs`
- `create-all-software-log-source-discovery-ledger.mjs`
- `create-all-software-observer-bootstrap.mjs`
- `create-all-software-control-channel-coverage-audit.mjs`

Current source-discovery rule: every bounded software inventory row must have a source route before any broad low-token coverage claim. The log-source discovery ledger classifies each row as direct log candidates behind a metadata gate, non-log low-token fallback, Windows Event fallback, candidate roots needing bounded scan, missing teacher source, or teacher-excluded/private. This keeps the all-software goal honest: apps without ordinary logs are not ignored, and they are not upgraded to screenshots until event/file/process/window metadata or teacher markers are reviewed.

### 5.2 低 token 观察

默认不连续录屏，也不反复截屏。优先读取低 token 信号：

- 文件是否存在。
- 文件大小、mtime、hash 或元数据是否变化。
- 进程/窗口状态是否变化。
- Windows 事件计数或摘要是否变化。
- 老师是否留下 marker。
- 只有变化后才进入更贵的证据收集。

相关能力：

- `watch-log-source-metadata-deltas.mjs`
- `monitor-software-observation-deltas.mjs`
- `run-software-observer-watch-cycle.mjs`
- `run-all-software-low-token-learning-cycle.mjs`
- `run-automatic-low-token-learning-runner.mjs`

### 5.3 触发式视觉检查

截图不是默认持续行为，而是触发式：

- 日志/事件/文件元数据出现有意义变化。
- 老师明确要求看当前状态。
- 错误、导出、重建、状态跳变等需要视觉确认。
- 执行动作前后需要对比。

相关能力：

- `create-automatic-triggered-visual-check-queue.mjs`
- `create-triggered-visual-check-request.mjs`
- `capture-triggered-visual-check.mjs`
- `create-triggered-visual-evidence-learning-handoff.mjs`

这解决了“让 AI 一直录屏可能很强，但 token 太浪费”的问题：先用低 token 元数据发现变化，再在必要时截图。

## 6. 透明绘画蒙版与空间理解

插件包含透明草图/绘画蒙版方向，用于让老师在软件画面上表达空间意图：

- 老师可以在透明蒙版上画线、圈选、箭头、标号、角度、关系。
- 系统不把草图当成最终图像，而是提取空间意图。
- 意图可以包括位置关系、透视关系、2D 平面关系、3D 深度关系、目标对象编号。
- AI 在可能的位置标号，让老师确认后再进入执行计划。

相关能力：

- `create-transparent-sketch-overlay-kit.mjs`
- `interpret-transparent-sketch-spatial-intent.mjs`
- `create-spatial-target-confirmation-kit.mjs`
- `confirm-engineering-command-target.mjs`
- `create-spatial-software-execution-route-bridge.mjs`
- `create-transparent-sketch-depth-demonstration-rehearsal.mjs`
- `create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs`
- `validate-transparent-sketch-depth-rehearsal-review-receipt.mjs`

当前设计重点不是“AI 直接看懂后自动点”，而是：

```text
老师画蒙版 -> AI 提取候选空间意图 -> AI 标号 -> 老师确认编号 -> 生成 dry-run 执行计划 -> 进入审批门控
```

## 7. 语音/文字操控工程软件

插件目标之一是让不会工程软件的人也能用自然语言或语音下达操作意图。

流程：

```text
老师说/输入指令
  -> AI 复述理解
  -> AI 找到可能目标位置并标号
  -> 老师选择编号
  -> AI 生成 dry-run-first 操作计划
  -> 老师显式确认执行
  -> 通过软件适配器或受监督 UI 执行
  -> 执行后证据校验
```

相关能力：

- `create-voice-teaching-kit.mjs`
- `create-engineering-command-confirmation-kit.mjs`
- `create-engineering-voice-control-workbench.mjs`
- `run-engineering-voice-command-control-loop.mjs`
- `create-engineering-voice-execution-approval-gate.mjs`
- `create-visual-engineering-target-confirmation-kit.mjs`
- `create-existing-software-execution-adapter.mjs`
- `create-supervised-software-action-kit.mjs`
- `verify-supervised-action-outcome.mjs`

安全边界：

- 没有目标编号确认，不生成最终动作。
- 没有老师执行确认，不发送软件命令。
- 没有回滚点，不进入高风险执行门。
- 优先使用软件 API、脚本、CLI、导入导出；最后才考虑 UI 自动化。

## 8. 细节严谨的“逻辑化学习”

用户提出的关键问题是：AI 不能只是生成“看起来像”的东西，而要理解细节和数据之间的关系。

因此插件中有一条“通用细节逻辑学习”方向：

- 线条只是例子，角度、比例、孔位、间距、层级、约束、材料、颜色、编号、命名、装配关系都可以逻辑化。
- 老师可以告诉 AI：某个几何/视觉/工程细节和哪个数据字段、约束、公式或业务规则有关。
- 系统把这些映射转成可审查的逻辑合同。
- 新数据进入时，AI 先应用逻辑，而不是只模仿外观。
- 输出前要生成 dry-run、反例、边界和老师确认点。

相关能力：

- `create-parametric-drawing-logic-learning-kit.mjs`
- `validate-parametric-drawing-logic-receipt.mjs`
- `compile-parametric-drawing-logic-rule-package.mjs`
- `apply-universal-detail-logic-rule-package-dry-run.mjs`
- `create-universal-detail-logic-existing-tool-preview-package.mjs`

目标形式：

```text
已有样例/图纸/界面
  -> 老师解释细节与数据的关系
  -> 系统生成逻辑关系表
  -> 老师补充反例和边界
  -> 验证通过后编译为禁用规则包
  -> 新数据 dry-run 应用
  -> 老师确认后再进入可复用规则
```

这一层是整个项目从“像”走向“严谨”的关键。

## 9. 使用现有工具优先

开发早期主要验证可行性，不应该先造完整绘图软件或完整语音引擎。

现有工具优先级：

- 绘图：draw.io、Excalidraw、Mermaid、SVG、CAD 导出图、已有工程软件。
- 语音：浏览器 Web Speech API、系统语音、手动 transcript fallback。
- 观察：日志元数据、Windows Event、文件 delta、进程/窗口元数据。
- 软件执行：官方 API、宏、脚本、CLI、文件导入导出、浏览器自动化。
- UI 操作：只作为受监督兜底路线。

相关能力：

- `create-visual-teaching-kit.mjs`
- `create-visual-teaching-template.mjs`
- `import-demonstration-artifact.mjs`
- `create-existing-software-execution-adapter.mjs`
- `create-workalong-teaching-kit.mjs`

## 10. 门控、收据与回滚点

项目最重要的工程纪律之一是：所有关键转换都必须有门。

常见门控：

- receipt builder：生成老师填写的收据模板。
- receipt validation：验证老师是否真的确认。
- approval gate：高风险动作前的最终审批。
- dry-run：默认只生成计划，不执行。
- rollback point：执行前必须保留回滚点。
- smoke：证明脚本行为和锁没有被破坏。
- verify：插件整体能力面检查。

禁止默认发生的动作：

- 自动执行目标软件。
- 持续录屏。
- 随意截图。
- 读取完整日志。
- 注册/启动定时任务。
- 写入长期记忆。
- 声称全软件覆盖完成。
- 声称通用原生执行完成。
- 解锁包装发布。

近期新增的方向是：低 token metadata gate preflight 后面必须再经过老师收据和回滚点验证，不能只因为生成了 batch 命令就继续跑。老师确认后的 validated command 也不能让下一位执行者手动复制长命令到 shell；它必须进入 `run-original-goal-low-token-metadata-gate-validation-command.mjs`，由这个无 shell、白名单、需要老师确认和保留回滚点的 runner 只调用 `run-all-software-coverage-enrollment-follow-up-batch.mjs`，并继续禁止 bounded tail、截图、目标软件执行、记忆写入、封装和完成声明。batch 跑完后，runner 只写出 review-only 的 `reconcile_all_software_coverage_enrollment_follow_up_batch` handoff 命令，不自动回写覆盖结论；下一位老师或代理必须先审查 batch receipt，再把证据回流到 coverage audit 和 enrollment ledger。

## 11. 当前能力总览

目前插件已经形成这些能力簇：

### 11.1 基础教学

- 创建教学会话。
- 导入演示证据。
- 记录老师对话。
- 生成 public trace。
- 生成禁用规则草案。
- 回放学习过程。
- 审核后保存 profile memory。
- 纠正已保存记忆。

### 11.2 视觉/绘图教学

- draw.io、Excalidraw、Mermaid 模板。
- 截图/绘图/录屏事件导入。
- 透明草图蒙版。
- 2D、透视、3D 深度演示 rehearsal。
- 空间意图解释。
- 编号目标确认。

### 11.3 语音/自然语言控制

- 语音教学 kit。
- 工程命令确认 kit。
- 语音/文字工程控制 workbench。
- 编号候选目标。
- 执行审批门。

### 11.4 全软件低 token 学习

- 本机软件清单。
- 软件能力 profile。
- 日志/事件/文件/窗口元数据观察。
- 低 token learning cycle。
- 自动学习 runner 包。
- 定时任务包和审批门。
- run-output 审计。
- teacher review packet。
- unattended learning audit。

### 11.5 执行能力矩阵

- 控制通道 profile。
- 控制通道覆盖审计。
- 执行 pilot queue。
- 执行 capability matrix。
- dry-run adapter package。
- supervised execution gate。

### 11.6 严谨细节逻辑

- 参数化绘图逻辑学习 kit。
- 通用细节逻辑 receipt。
- 规则包编译。
- 新数据 dry-run 应用。
- 现有工具预览包。

## 12. 当前边界与不能夸大的点

当前系统仍处于可行性验证和门控搭建阶段，不应该宣称以下事情已经完成：

- 已经能无人值守控制任意软件。
- 已经全电脑所有软件都完成低 token 学习覆盖。
- 已经可以不经老师确认自动执行工程软件。
- 已经把 CAD/三维/绘图细节完全严谨参数化。
- 已经可以放心包装成最终产品交付。
- 已经可以删除回滚点。

当前更准确的表述是：

- 插件已经有一套覆盖“教学、观察、绘图、语音、低 token、执行门控、回滚、审计”的框架。
- 多个模块已经有 smoke/verify 脚本证明其可运行。
- 真实执行和自动化能力仍被 receipt、approval gate、rollback point 和 teacher review 锁住。
- 下一步应该在老师确认方向后，逐步打开最小安全执行切片。

## 13. 推荐讨论重点

和别人讨论时，可以围绕这些问题：

1. 这个系统是否应该定位为“AI 学徒训练框架”，而不是单一自动化工具？
2. public trace 的字段是否足够让老师理解 AI 为什么这样做？
3. 低 token 观察是否应该作为所有软件学习的默认策略？
4. 透明绘画蒙版和编号确认，是否能降低非专业用户操控工程软件的门槛？
5. “所有细节逻辑化”的数据结构应该如何设计，才能覆盖线条、角度、约束、比例、装配、工艺等不同对象？
6. 哪些场景可以先用现有工具验证，哪些场景必须开发自定义 UI？
7. 回滚点、receipt、approval gate 的门控会不会太重，哪些可以合并，哪些必须保留？
8. 第一个真正可交付 MVP 应该选择哪条闭环：
   - 低 token 软件观察闭环。
   - 透明蒙版空间意图闭环。
   - 语音工程软件控制闭环。
   - 参数化细节逻辑学习闭环。

## 14. 建议 MVP 切片

最适合作为第一阶段可演示 MVP 的闭环：

```text
老师给一个已有工程图/界面截图
  -> 老师在透明蒙版上画出修改意图
  -> AI 标出候选目标编号
  -> 老师确认编号
  -> AI 生成结构化操作计划和逻辑关系说明
  -> 老师纠正其中一个细节关系
  -> 系统生成禁用规则草案
  -> 新数据 dry-run 应用这条规则
  -> 老师确认后保存为可复用记忆
```

这个 MVP 同时验证：

- 教学闭环。
- 透明蒙版。
- 编号确认。
- 细节逻辑化。
- 低风险 dry-run。
- 人类纠错到规则。
- 规则复用。
- 门控和回滚。

## 15. 最终判断

Transparent AI Apprentice 的核心价值不在于“AI 直接代替人操作软件”，而在于建立一套可训练、可纠正、可审计、可回滚、可逐步信任的 AI 学徒系统。

如果这个框架成立，未来它可以扩展到 CAD、SolidWorks、普通办公软件、网页系统、设计工具、工程仿真软件等不同场景。但每次扩展都必须遵守同一原则：

```text
先观察 -> 再理解 -> 再让老师确认 -> 再 dry-run -> 再受监督执行 -> 再校验 -> 再学习
```

这也是它区别于普通自动化脚本和普通生成式 AI 的地方。

## 16. 知识增强与 RAG 研究分支

根据用户提供的大佬建议截图，项目目标新增一条正式研究方向：知识增强、RAG、知识增强大模型。

这条方向已经加入项目目标，但当前状态是 research/prototype lane，不是技术验收、规则启用、软件执行或封装解锁结论。所有产物仍然必须经过 source registry、retrieval evidence packet、disabled Rule Card、Rule DSL/validator、teacher review、rollback point 和 approval gate。

提取到的建议：

- 重点调研“知识增强、RAG”。
- 这块已有研究很多，应该优先学习已有论文、方法和工程实现，不要从零硬造。
- “知识增强大模型”是更准确的定位：不是普通聊天提示词，而是带外接知识库检索、知识注入、证据 grounding 的智能体。
- “浙大团队做得挺多也还不错”应作为研究线索去核实，不能未经验证就当作权威结论。
- RAG 可以理解为给大模型增加一个外接知识库检索器，让模型回答、规划或生成规则时能检索外部知识库。
- 这条方向服务于一个更大的产品目标：让普通人低成本培养自己专业相关的智能体。

加入目标后的定位：

```text
老师资料/案例/纠错/软件日志/操作演示
  -> 知识源登记与低成本摄取
  -> RAG 检索外部证据
  -> 生成带来源的证据包
  -> 生成禁用规则草案或候选解释
  -> Rule DSL / validator / teacher review 审核
  -> 合格后才成为可复用记忆
```

边界：

- RAG 是证据层，不是执行权。
- RAG 可以检索手册、标准、论文、软件文档、老师笔记、旧纠错、示例和日志格式说明。
- 检索片段必须变成带来源、hash、位置和置信度的 evidence packet。
- evidence packet 可以辅助生成 disabled Rule Card，但 Rule DSL、验证器、老师审核、回滚点和 approval gate 才决定可信度和执行权。
- RAG 不得启用规则、执行软件、绕过编号确认、写入长期记忆、声明技术验收或解锁封装。

这条分支和“低 token 全软件学习”的关系：

- 低 token 观察负责发现“什么时候值得查知识”。
- RAG 负责在必要时检索有限、相关、可追溯的知识片段。
- 学徒不再只根据日志片段或截图猜，而是能把软件手册、错误码、标准、老师旧纠错一起作为证据。
- 这样能降低 token 浪费，也能减少“看起来像但细节不严谨”的输出。

这条分支和“细节逻辑化”的关系：

- 线条、角度、比例、孔位、装配、命名、工艺等细节可以从老师教学和外部知识中共同抽取逻辑关系。
- RAG 找证据，老师确认关系，验证器检查约束，新数据 dry-run 应用。
- 目标不是让 AI 背资料，而是让每条可复用规则都有来源、有边界、有反例、有审查记录。

当前已有原型：

- `schemas/knowledge-source-card.schema.json`
- `schemas/retrieval-evidence-packet.schema.json`
- `scripts/knowledge/ingest-local-corpus.mjs`
- `scripts/knowledge/retrieve-local-knowledge.mjs`
- `scripts/knowledge/draft-rule-card-from-retrieval.mjs`
- `scripts/knowledge/augment-low-token-learning-with-retrieval.mjs`
- `npm run smoke:plugin-knowledge-rag-rule-draft`
- `npm run smoke:plugin-knowledge-augmented-low-token-learning`

持久化研究 brief：

`KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md`

## 17. Original Goal Capability Matrix Audit

The project now keeps a machine-checkable capability matrix for the core user-requested directions:

- knowledge-augmented RAG as an evidence-only research lane;
- low-token metadata/log observation before bounded visual escalation;
- voice/text engineering control through numbered target confirmation;
- transparent sketch and spatial target confirmation before execution planning;
- universal detail logic for strict data-to-output relationships;
- existing-tool-first feasibility through draw.io, Excalidraw, Mermaid, browser, CLI/API, import/export, and supervised UI routes;
- rollback points and approval gates before reviewed execution or registration.

It also records the market-response direction explicitly: distilled skill packages and stronger Claude/GPT/Gemini-class models should be treated as replaceable compiler/runtime/tool providers. They become useful when TLCL wraps them with contracts, validators, teacher receipts, rollback points, and audit trails; they do not replace the logic contract layer itself.

The audit command is:

```bash
npm run smoke:plugin-original-goal-capability-matrix-coverage-audit
```

This audit does not claim completion. It only proves that the main capability lanes still have visible documentation, MCP or script-backed entrypoints, npm smoke coverage, and closed safety locks.
