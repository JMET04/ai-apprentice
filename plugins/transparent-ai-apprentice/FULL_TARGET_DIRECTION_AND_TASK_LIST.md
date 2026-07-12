# Transparent AI Apprentice 完整目标方向与任务列表

本文合并两类要求：

- 用户最开始提出的完整能力目标：低 token 全软件学习、透明蒙版、语音/文字操控工程软件、编号确认、细节逻辑化学习、RAG 知识增强、回滚点、老师确认、现有工具优先。
- 最新市场方向报告提出的新收束：Transparent AI Apprentice 应成为 AI 学徒的 Teachable Logic Contract Layer (`TLCL`, 可教学逻辑契约层)，让 AI 工作从“会生成”升级到“可验证、可复用、可交付、可追责”。

## 1. 总方向

最终定位：

```text
Transparent AI Apprentice
= TLCL + 教学入口 + 证据层 + Rule DSL + Validator + Model Router + Audit Chain
```

中文定位：

```text
Transparent AI Apprentice 是一个基于可教学逻辑契约层的 AI 岗位训练、质检、准入和责任体系。
```

核心不是做普通 Agent，也不是一开始就宣称控制所有软件，而是建立一层能把人类教学、工作数据、纠错、资料和验收标准编译成可执行规则、流程、验证器和审计链的系统。

最重要的判断：

```text
模型负责提出、学习、编译和执行候选动作；
验证器负责裁判；
人类负责审核和责任确认；
审计链负责留下可追责证据。
```

## 2. 完整产品闭环

完整闭环应保持为：

```text
老师教学 / 演示 / 纠错 / 提供资料
-> 证据结构化：截图、草图、日志元数据、文档、RAG 片段、软件状态
-> AI 生成 public trace：步骤、证据、候选规则、置信度、未知点
-> 老师确认目标编号、逻辑关系、反例和边界
-> 高级模型把经验编译为 Rule Card / Rule DSL / Workflow / Test Cases
-> 人类审核
-> Rule Package / Validator Registry / Validation Report
-> 低成本模型或工具适配器在契约约束下执行 dry-run 或受监督动作
-> Validator 输出 pass/fail/unknown/error
-> Delivery Gate / Execution Gate 决定是否允许继续
-> Audit Chain 记录规则来源、版本、验证器版本、回滚点和老师确认
-> 通过后才进入可复用记忆或下一次执行
```

## 3. 必须保留的原始功能

这些功能仍然是目标的一部分，不删除，只重新排序和加门控。

### 3.1 低 token 全软件学习

目标：让系统能面向电脑上的不同软件建立低成本观察能力，而不是只围绕 CAD 或某个软件。

任务：

- 建立软件清单、进程、窗口、日志路径、Windows Event、文件 delta 的只读发现。
- 每个软件行必须有 direct log、metadata gate、Windows Event、文件 fallback、老师排除或老师补充信号。
- 默认不持续录屏，不反复截图。
- 先看文件大小、mtime、hash、事件计数、窗口状态等低 token 信号。
- 只有出现有意义变化或老师要求时，才进入截图或更重证据采集。
- 全软件覆盖不得提前宣称完成，必须经过 coverage audit、enrollment ledger、teacher receipt、completion gate。

### 3.2 透明蒙版与编号确认

目标：让老师能在现有软件、截图、工程图或设计稿上画意图，AI 只做候选理解，最终由老师确认编号。

任务：

- 支持老师在透明蒙版上画线、圈选、箭头、标号、角度、关系。
- AI 提取候选空间意图，不把草图当最终图。
- AI 在可能目标上标号。
- 没有老师确认编号，不进入执行计划。
- 编号确认后生成 dry-run-first 操作计划。
- 透明蒙版可以先复用现有绘图软件和浏览器技术，不急着自研完整绘图软件。

### 3.3 语音/文字操控工程软件

目标：让不会工程软件的人可以用语音或文字描述需求，但系统必须先复述理解、标号确认、dry-run，再执行。

任务：

- 语音优先复用浏览器 Web Speech API 或系统能力。
- 文本和语音统一进入 command interpretation。
- AI 输出“我理解你想做什么”。
- AI 标出候选目标编号。
- 老师选择编号。
- 系统生成 dry-run 计划和风险说明。
- 执行前必须有 approval gate、rollback point 和老师显式确认。
- 优先使用软件 API、CLI、脚本、宏、导入导出；UI 自动化只作为受监督兜底。

### 3.4 细节逻辑化学习

目标：解决“AI 生成得像但细节不严谨”的问题。

任务：

- 线条、角度、比例、孔位、间距、层级、材料、颜色、编号、装配、工艺、命名都可以成为逻辑化对象。
- 老师可以说明某个细节与哪个数据字段、公式、约束、来源标准或业务规则有关。
- 系统将说明转成 data-to-output logic evidence。
- AI 生成 disabled Rule Card，不直接启用。
- 新数据进入时先 dry-run 应用逻辑，不只模仿外观。
- Validator 检查逻辑输出，unknown 也要阻断高风险交付。

### 3.5 知识增强与 RAG

目标：让普通人可以低成本培养专业相关智能体，把手册、标准、论文、软件文档、老师笔记、旧纠错、示例和日志格式说明作为证据来源。

任务：

- 建立 knowledge source card。
- 本地资料优先摄取，外部资料先登记为研究线索，不自动 fetch。
- 检索结果必须形成 retrieval evidence packet，包含 source id、hash、locator、trust note、missing evidence。
- RAG 只提供证据和 disabled Rule Card 草案，不拥有执行权。
- RAG 输出必须经过 teacher review、Rule DSL validation、Validation Report、Delivery Gate、Audit Trail。
- 浙江大学等外部研究线索必须通过 primary source 核实后才能引用。

### 3.6 回滚点、收据与审批门

目标：任何可能改变系统状态、规则状态、记忆状态、目标软件状态或交付状态的行为，都必须有可回滚和可审计边界。

任务：

- 每次重要编辑或执行前建立 rollback point。
- rollback point 在老师确认前不得删除。
- receipt builder 生成老师可填写模板。
- receipt validation 验证老师是否真的确认。
- approval gate 阻断高风险动作。
- dry-run 是默认执行形态。
- 所有完成声明必须经过 final completion gate。

## 4. 报告新增的功能与概念

### 4.1 TLCL 可教学逻辑契约层

新增目标：

- 把人类教学、纠错、反例、边界、验收标准编译为可执行契约。
- 契约包括 Rule DSL、Workflow、Validator、Test Cases、Failure Policy、Escalation Policy、Audit Fields。
- TLCL 是系统主线，其他能力都要服务于它。

任务：

- 明确 TLCL schema 边界。
- 为每条规则保存 teacher、evidence、review status、lifecycle、version、validator refs。
- 建立从自然语言纠错到 Rule Card 的标准编译流程。
- 建立从 Rule Card 到 Rule Package 的编译流程。
- 建立从 Rule Package 到 Validation Report 的评估流程。

### 4.2 Artifact Envelope

新增目标：

- 所有输入都变成统一 artifact，方便验证器检查。

任务：

- 扩展 `artifact-envelope.schema.json`。
- 支持 packaging、engineering drawing、UI screenshot、CAD export、document、workflow trace 等 artifact types。
- 每个 artifact 必须包含 objects、relations、context、source refs、confidence、unknowns。
- 老师纠正必须能绑定到 artifact object 或 relation。

### 4.3 Validator Registry

新增目标：

- 模型不是裁判，验证器才是裁判。

任务：

- 保留 pass/fail/unknown/error 四态。
- active + blocking + fail 阻断交付。
- active + blocking + unknown 阻断交付。
- validator error 阻断交付。
- 建立 expression、json_schema、topology、geometry、policy_gate 等 validator registry。
- 每份 Validation Report 记录 validator id、version、input evidence、rule version。

### 4.4 Test Cases 与错误案例库

新增目标：

- 规则不是只靠一句自然语言，而要有正例、反例、边界样例和回归测试。

任务：

- 每条 Rule Card 支持 examples、counterexamples、edge cases。
- 老师纠错可以转成 regression case。
- 验证器失败样例进入 error-case library。
- 每次规则修改必须能跑最小回归测试。

### 4.5 Senior Model Compiler / Medium Runtime

新增目标：

- 用高推理模型做一次性学习、规范逻辑建立和规则编译，用中等推理模型执行已经确认的完整工作流，用低推理/工具层做固定转换和低成本机械任务；用户纠错、unknown、失败或证据冲突时回到高推理模型修正规范逻辑。

任务：

- 设计 Senior Model Rule Compiler 接口。
- 设计 Medium Reasoning Runtime 执行接口。
- 设计 Low Reasoning Tool Layer 接口。
- 建立 reasoning budget router。
- 明确哪些任务必须用高级模型：读规范、理解纠错、生成规则草案、修复异常。
- 明确哪些任务交给中等推理模型：按已确认规则执行完整工作流、整理上下文、解释执行步骤、发现不满足契约时请求升级。
- 明确哪些任务交给低推理/工具层：字段提取、格式转换、固定流程执行、初稿生成、元数据变化检测。
- 让验证器而不是模型决定结果是否可交付。
- 用户纠错必须触发回到 Senior Model Rule Compiler，生成修正规则草案和回归测试，不允许中等推理执行层私自改规则。

### 4.6 Escalation Policy

新增目标：

- 当执行失败、unknown、高风险、规则冲突或证据不足时，系统应升级给高级模型或人类。

任务：

- 定义升级触发条件：unknown、validator error、conflicting rules、missing evidence、high risk action、teacher disagreement。
- 每次升级要生成 public trace，不暴露私有推理。
- 升级结果不能自动启用规则，仍需老师审核。

### 4.7 AI Job License / AI 工作执照

新增目标：

- 把“AI 会不会做”升级为“AI 是否通过岗位准入和质检”。

任务：

- 为某个工作流定义 job license requirements。
- 规则包、验证器、测试集、老师审核、回滚策略共同组成岗位准入。
- 未通过 license 的 AI 只能 dry-run 或请求老师确认。
- 通过后仍保留审计和撤销能力。

### 4.8 商业与论文叙事

新增目标：

- 不与基础模型竞争，而是成为强模型进入专业生产环境的可信交付层。
- 应对蒸馏 skill、开源模型和 Claude/GPT/Gemini 等强模型升级：把它们视为可替换的 senior compiler、medium runtime 或 low reasoning tool 候选，而不是产品本体；项目护城河在 Rule DSL、验证器、回滚点、老师验收、证据链和工作执照。

任务：

- 商业一句话：我们不是让 AI 更会说，而是让 AI 的工作结果能被验收。
- 论文命题：从统计生成到可信交付，可教学逻辑契约层在专业生产系统中的必要性与实现路径。
- 论文贡献：区分生成相似性和交付可用性；提出 TLCL；设计 Rule DSL + Artifact Envelope + Validator Registry；用窄场景证明能拦截看起来像但不能用的结果。
- 输出模型竞争应对策略：强模型直接做、蒸馏 skill 直接做、中等推理按无契约工作流做、TLCL 契约化流程做四组对比；重点证明“可验收、可回滚、可审计、可纠错复用”而不只是生成效果。

## 5. 包装盒 / 工程图验证的定位

包装盒展开图或简单工程图不是唯一目标，也不急着现在验证。

它的定位是：

```text
TLCL 雏形完成后的第一个强验证场景。
```

为什么保留它：

- 它能证明“看起来像”不等于“能生产”。
- 胶舌宽度、刀线/折线、连通性、材料厚度、连接关系都适合验证器。
- 它能展示 Rule DSL、Artifact Envelope、Validator、Validation Report、Audit Chain 的完整价值。

当前任务不是马上做包装盒产品，而是先完成 TLCL 雏形。等雏形完成后，再由老师带着真实样例验证。

## 6. 阶段任务列表

### Phase 0：方向锁定与任务重排

- [done] 提取市场报告方向。
- [done] 将项目定位收束为 TLCL。
- [done] 保留原始功能并重新放入完整目标。
- [todo] 把 README、框架文档、MCP 工具描述中的“全软件/语音/自动执行”叙事调整为支撑 TLCL，而不是压过 TLCL。
- [todo] 建立 `TLCL status refresh`，展示当前 TLCL 链条缺口。

### Phase 1：TLCL 最小骨架

- [in_progress] Rule Card schema。
- [in_progress] Artifact Envelope schema。
- [in_progress] Rule Package compiler。
- [in_progress] Validator Registry。
- [in_progress] Validation Report。
- [in_progress] Delivery Gate / Execution Gate。
- [in_progress] Audit Trail。
- [todo] 将这些能力串成一个最短端到端命令：teacher correction -> disabled Rule Card -> Rule DSL -> Validation Report -> closed gate -> audit.
- [todo] 给每一步生成老师可读 receipt 和 next action。

### Phase 2：细节逻辑化学习

- [in_progress] 参数化绘图逻辑学习。
- [todo] 把 data-to-output logic evidence 标准化到 Artifact Envelope。
- [todo] 为角度、比例、孔位、间距、连接关系建立通用 relation schema。
- [todo] 让老师纠错可以明确绑定对象、字段、公式、阈值和反例。
- [todo] 生成 test cases、counterexamples、edge cases。

### Phase 3：透明蒙版与编号确认

- [in_progress] 透明蒙版工具链。
- [in_progress] 编号目标确认。
- [todo] 将透明蒙版输出统一转成 Artifact Envelope object/relation。
- [todo] 将编号确认结果绑定到 Rule Card evidence。
- [todo] 生成可审查的 spatial intent receipt。

### Phase 4：语音/文字工程控制

- [in_progress] 语音/文字输入到命令理解。
- [in_progress] 编号确认和 dry-run-first。
- [todo] 将语音命令解释结果转成 TLCL operation contract。
- [todo] 将执行前 approval gate 与 rollback point 强制绑定。
- [todo] 将执行后 evidence 和 validator 结果回流到 Audit Chain。

### Phase 5：低 token 全软件学习

- [in_progress] 软件发现、日志源发现、metadata delta。
- [in_progress] all-software coverage audit 和 enrollment ledger。
- [todo] 将低 token 事件统一转成 Artifact Envelope 或 Evidence Packet。
- [todo] 当低 token 事件指向知识缺口时触发 RAG 检索，而不是直接扩大截图。
- [todo] 将 all-software lane 的完成声明全部挂到 TLCL final gate 下。

### Phase 6：RAG 知识增强

- [in_progress] local corpus ingest。
- [in_progress] retrieval evidence packet。
- [in_progress] disabled Rule Card drafting。
- [in_progress] RAG -> Rule DSL -> Validation Report -> Delivery Gate -> Audit Trail。
- [todo] primary-source research lane，核实外部论文和团队线索。
- [todo] 知识源 trust model：官方标准、老师笔记、论文、软件文档、旧纠错的权重不同。
- [todo] RAG 结果与老师纠错合并为同一 logic evidence。

### Phase 7：Model Router

- [todo] 定义 senior compiler model 入口。
- [todo] 定义 medium reasoning runtime 入口。
- [todo] 定义 low reasoning tool layer 入口。
- [todo] 定义 deterministic validator 与 model 输出的边界。
- [todo] 定义成本/可靠性对比实验。
- [todo] 输出四组对比：强模型直接做、蒸馏 skill/低成本模型直接做、中等推理模型按无契约工作流执行、TLCL pipeline。
- [done] 建立 `reasoning-tier-contract.schema.json` 与 `TLCL status refresh`，持续检查高推理编译、中推理执行、低推理工具层、纠错升级和验证器裁判边界。
- [in_progress] 建立 `TLCL Runtime Gate`，用 Validation Report 和老师纠错决定 `medium_runtime_allowed` 或 `escalate_to_senior_compile`，保证中等推理只做已审查 dry-run，不能私自执行、启用规则或写记忆。

### Phase 8：包装盒 / 工程图验证

- [not_now] 等 TLCL 雏形完成后，由老师带真实样例验证。
- [todo] 选定首个 artifact type：packaging_dieline 或 simple_engineering_drawing。
- [todo] 建立 face/edge/tab/line object schema。
- [todo] 建立 topology validator。
- [todo] 建立 geometry validator。
- [todo] 建立胶舌宽度、连接关系、刀线/折线冲突 demo。
- [todo] 输出本场景的 validation report 和 audit report。

### Phase 9：产品化与封装

- [todo] 只在老师确认 TLCL 雏形可用后考虑封装。
- [todo] 包装前必须通过 final completion gate。
- [todo] 保留回滚点，不能因为封装删除审计证据。
- [todo] 明确产品文案：AI 员工训练、质检、准入、责任系统。

## 7. 当前优先级

最高优先级：

```text
把 TLCL 最小骨架跑通，并让原始功能都能挂到这条链上。
```

当前最短执行链：

```text
teacher correction
-> Artifact Envelope / Evidence Packet
-> disabled Rule Card
-> Rule DSL / Rule Package
-> Validator Registry
-> Validation Report
-> closed Delivery Gate
-> Audit Trail
-> teacher review receipt
```

下一步开发不应该继续横向堆功能，而应该检查每个已有功能能否回答：

- 它产生什么 evidence？
- 它能否进入 Artifact Envelope？
- 它是否生成 Rule Card？
- 它是否经过 Rule DSL / Validator？
- 它是否有老师 receipt？
- 它是否有 rollback point？
- 它是否能被 audit chain 追责？

回答不了的功能，先补契约层，再谈执行。
