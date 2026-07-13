# AI 学徒 1.0 人工测试手册

## 测试原则

人工测试的目标不是证明系统已经量产，而是发现自动测试无法判断的语义、版式、工程和交互问题。任何一项关键输入来源不明、工程图无法复核、界面无法稳定提交或安全锁被打开，都应停止后续阶段。

## 测试前检查

- 运行 `npm ci`、`npm run typecheck`、`npm test` 和 `npm run verify:plugin`。npm 单命令默认通过 `run-with-workspace-temp.mjs` 使用项目盘临时目录。
- 运行 `npm run smoke:image2-prompt-optimizer`、`npm run smoke:packaging-workflow` 和 `npm run smoke:mask-workbench`。
- 运行 AICAD 清单、集成与交接烟测。
- 准备一个真实产品的类型、长宽高、重量、材料偏好和运输条件。
- 明确本轮只做老师审校，不作技术验收或生产放行。

## 场景一：需求澄清

输入一个故意不完整的需求，例如“给 200 × 120 × 60 mm 的电子产品设计插舌盒”，但不提供重量、材料厚度和运输条件。

通过标准：系统继续追问关键字段；会话停留在 `requirements_clarification`；不能生成严格 AICAD 请求。

停止条件：系统臆测材料厚度、把图片比例当尺寸，或直接进入 CAD。

## 场景二：方案与 Image2 样图

补齐关键需求、记录深度方案，先检查自动生成的 `image2-initial-prompt-guidance.json`，再生成中文样图。

检查：

- `route.domain=packaging`，`readyForGeneration=true`，且 `blockingUnknowns` 为空；
- 提示词明确区分确认事实、保留项、修改项、禁止事项和人工复核边界；
- 提示词中的尺寸与老师确认数据逐字一致，且声明像素不是尺寸真值；
- 会话保存提示词指导包 SHA-256；篡改文件后，`record-sample` 必须因哈希不匹配而拒绝；
- 中文标题、尺寸表和说明能正确阅读；
- 版式接近统一工程说明页，而不是随中文长度任意重排；
- 产品类型、结构方向和面板关系与方案一致；
- 图片中不声称“已验收”或“可直接量产”。

通过标准：提示词指导包通过阻塞项、来源和哈希校验后，样图才可进入自查，并且仍被标记为视觉候选。

## 场景三：尺寸与形状自查

检查系统是否覆盖：尺寸完整性、单位一致性、面板拓扑、刀线与压线冲突、闭合/间隙、制造可行性和文字可读性。

通过标准：八类检查都有证据；任何失败都会阻止进入蒙版提交或 CAD。

## 场景四：原工程图片蒙版

分别使用自由画笔、圈选、框选、箭头和文字。继续验证：

- 调整颜色和粗细；
- 撤销、重做和清空确认；
- 放大、缩小和适配；
- 隐藏/显示蒙版；
- 刷新后恢复本地草稿；
- 无底图状态可以上传图片；
- 只读回放逐条显示标注；
- 手机触控能打开检查器并绘制；
- 提交中、成功和失败状态都有清楚反馈。
- 确认页面与原版一致，不出现文字、图片、工程三种内容切换；
- 确认仍能导出原有 Image2 局部纠错证据。

通过标准：`npm run smoke:mask-workbench` 通过 7 项，旧工程图片蒙版界面和导出行为没有被新增工作台改写。

## 场景四 A：两个独立新增工作台

运行 `npm run smoke:independent-masks`。文字工作台应只出现 Word / Excel 类型、原生定位器、原文和替换文字；工程软件工作台应只出现对象编号、动作、目标值、单位和约束。两个页面都不能出现内容类型切换，也不能出现对方的字段。

通过标准：两个页面路径、配置格式和导出格式不同；文字示例只修改 `paragraph:2`，工程软件示例只修改 `D04`，其他内容分别进入保护证明。

## 场景四 A-1：真实提交、审核与结果回放

运行 `npm run serve:mask-corrections`，再打开两个新增工作台并绘制至少一个修改区。提交后检查 `.transparent-apprentice/mask-corrections/store.json`：任务必须是 `pending_teacher_review`，包含 packet 哈希、事件和关闭的安全锁。停止服务后再次提交，页面必须显示“提交失败”和“待重试队列”，不能显示已保存。

自动门禁：`npm run smoke:mask-correction-service` 与 `npm run smoke:mask-submission-browser`。

## 场景四 B：Word / Excel 原生点改

Word 使用 `paragraph:2` 将唯一出现的“周五”替换为“周一”；Excel 使用 `进度表!B2` 将“待处理”替换为“已完成”。运行 `npm run smoke:office-surgical-edit`。

通过标准：源 DOCX/XLSX 哈希不变；输出为新文件；Word 只有 `word/document.xml` 变化，Excel 只有目标工作表 XML 变化；原文不匹配时必须阻止修改而不是猜测。报告应把检查范围缩小到目标段落或单元格。

继续测试 Word `table:1/row:1/cell:1/paragraph:1` 跨两个富文本 run 的替换，以及 Excel 合并区域锚点和共享富文本。非锚点合并单元格、公式单元格、原文不匹配和覆盖源文件必须失败关闭。

## 场景四 B-1：AICAD 对象定点执行

将工程对象蒙版任务审核为 `approved_for_separate_execution`，运行统一 MCP 工具 `manage_mask_correction` 的 `execute_aicad` 动作，或运行 `aicad-object-mask-adapter.mjs`。检查 D04 从 420 改为 450 mm、D08/D10 对象哈希不变、源计划未改、回滚副本哈希一致，并确认 `.aicad/.scr/.dxf/.audit.md/.manifest.json` 均存在。

自动门禁：`npm run smoke:aicad-object-mask-adapter`。

## 场景四 B-2：失败矩阵与性能

- `npm run smoke:product-failure-matrix` 必须让 29 个危险场景全部按预期阻止。
- `npm run benchmark:product` 必须记录 MCP 冷启动、30 工具高级面、蒙版页面、5000 段 Word、大并发、长序列、内存和 AICAD 编译指标。
- 性能报告写入 `.ta-smoke/product-performance/performance-report.json`，失败矩阵写入 `.ta-smoke/product-failure-matrix/failure-matrix-report.json`。

## 场景四 C：规则差异决策

运行 `npm run smoke:rule-conflicts`。测试同动作规则、一般规则与老师例外、普通低置信度差异和高风险差异。

通过标准：兼容规则合并；更具体的老师例外在对应上下文生效；不同动作会显示选中规则、被压制规则、依据、置信度和 `apparent_rule_conflict` 标记；高风险歧义阻止执行但仍给出推荐，不修改底层规则。

## 场景五：Image2 局部修改

提交“只修改上盖搭接方向，底部缓冲和其他尺寸保持不变”。

通过标准：修改区域与蒙版一致；未标注区域没有无关重绘；修改后再次进入人工复核。

## 场景六：AICAD 交接

确认材料与厚度后生成 `mingtu_aicad_request_v1`。

检查：

- 所有输入使用相对路径并位于会话证据目录；
- 每个证据有 SHA-256、媒体类型和角色；
- 工程尺寸来自老师、已批准工程资料、可信目录或计算结果；
- `imagePixelsUsedAsDimensions=false`；
- 输出路径不能越过允许目录；
- 结果绑定本次会话、交接 ID 和请求哈希。

篡改一个输入或输出哈希，确认结果回收被拒绝。

## 场景七：真实 CAD 复核

在目标 AutoCAD 或 SolidWorks 宿主中打开候选文件。

检查结构闭合、尺寸、刀线/压线、材料、保存重开、版本兼容和制造约束。记录宿主版本、执行时间、产物哈希和复核人。

通过标准：结果只进入“可继续人工审核”，不能由自动测试直接变成技术验收。

## 结果记录

每个问题至少记录：场景、复现步骤、预期、实际结果、截图/文件、严重级别、是否阻塞下一阶段和老师建议。涉及客户图纸时不要上传公开 Issue。

## 场景八：宿主原生右键选区与连续纠错

1. 在 Word 中选中一段文字并右键，确认原菜单没有被吞掉，桌面助手显示同一文档、原文和 COM Range。输入第一版意见并交给当前 Agent，确认只生成局部预览，未直接修改文件。
2. 不关闭 Word，再补充第二版意见。检查选区 JSON 中 teacherInstructionRevision 递增，teacherInstructionHistory 同时保留两版意见，宿主文档保持打开。
3. 默认勾选后台准备且不勾选屏幕控制。检查动作记录为 preparationMode=background、screenControlPolicy=disabled。只有老师主动勾选后，下一版才能记录 explicit_opt_in。
4. 在 AutoCAD 2025 中先选实体，再按 Ctrl 选择边或面并右键。实体回退必须标识为 autocad_entity；真实子对象必须带 FullSubentityPath、SubentityType 和索引，不得把普通拾取点伪称为面。
5. 用 manage_native_selection.create_workbench 打开包装/Office/工程工作台，在桌面和手机宽度检查菜单、信标、差异预览与安全锁。三类提交都必须真实进入老师审核队列，不能只显示成功文案。
6. 老师选择 approved_for_separate_execution 后，分别调用 execute_word_live 或 execute_autocad_live。修改前必须重新匹配文档和原生目标；执行后文件保持打开且不自动保存，结果状态必须等待老师验收。

自动门禁：npm run smoke:native-selection-agent-plugin、npm run smoke:word-native-selection-live、npm run smoke:aicad-managed-selection-bridge、npm run smoke:native-selection-workbench-v2。

通过标准：所有推理仍由宿主 Agent 完成；没有独立模型 API、API Key 或桌面模型进程；精确选区、修订历史、后台模式、屏幕控制授权、预览、审核和撤销都有证据。

真实 AutoCAD 2025 数据层烟测：npm run smoke:aicad-managed-runtime。该命令验证 Core Console 中的 LINE 实体、句柄定位、命令触发来源、几何快照、从 100 到 450 的真实线长事务，以及 3DSOLID 指定面的原生偏移事务；桌面 COM 调度、右键菜单与 Ctrl 子对象捕获仍按人工测试手册复核。

真实 AutoCAD 桌面 COM 调度烟测：先运行 `npm run smoke:aicad-managed-runtime`，再运行 `npm run smoke:aicad-managed-desktop-live`。后者隐藏启动测试图纸、通过已安装插件执行原生 LINE 修改、不保存关闭，并验证未使用屏幕控制；运行前不得已有 AutoCAD 进程。
