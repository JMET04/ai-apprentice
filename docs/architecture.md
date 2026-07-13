# AI 学徒架构与边界

## 分层

AI 学徒保持以下责任边界：UI、API、AI 服务、工作流执行、记忆、轨迹、纠错与规则提取、知识来源与检索证据、工具注册、技能注册、策略与安全门。

用户界面只采集意图和展示证据；包装状态机负责阶段顺序；Image2 负责视觉候选与局部修改；AICAD 只接收已确认工程参数；规则模块只能创建默认停用的候选；最终验收属于老师或工程师。

蒙版任务链保持独立分层：浏览器客户端只负责提交与离线重试；本地服务负责 HTTP 边界；任务存储负责幂等、状态和原子写入；老师审核负责决定是否允许后续执行；工程适配器只消费已审核任务；结果返回后仍必须等待老师验收。任何一层都不能自行启用规则、保存验收或解锁投产。

MCP 工具注册分为三级：默认模式只公开 7 个老师面对的入口；`advanced` 模式公开 30 个任务型入口；`full` 模式保留完整兼容维护面。普通使用不枚举深层 TLCL 路由，这些路由由内部目录和验证器维护。

## 包装状态机

`packaging-design-workflow.mjs` 实现八个不可跳过的阶段：

1. `requirements_clarification`
2. `solution_planning`
3. `image2_sample_generation`
4. `sample_self_check`
5. `teacher_mask_correction`
6. `image2_local_edit`
7. `cad_handoff`
8. `final_teacher_review`

每个阶段保存输入、输出、验证和锁定状态。下一阶段只能在前置证据完整时执行。

## 三套独立精准纠错入口

原工程图片蒙版保持原来的 `mask-workbench` 页面和 `create_transparent_sketch_overlay_kit` 入口，不加入文字或工程软件模式。Word / Excel 文字使用独立的 `text-mask-workbench` 和 `create_office_text_mask_workbench`；工程软件对象使用独立的 `engineering-software-mask-workbench` 和 `create_engineering_software_mask_workbench`。三个页面没有内容类型切换，共享的只有底层审校锁和可验证局部修改协议。

`transparent_ai_apprentice_surgical_edit_contract_v1` 默认只允许改变选中目标；图片检查蒙版外差异，Word / Excel 检查未选中 OOXML 部件，工程图检查未选中实体、参数、约束与拓扑。Word 使用段落定位器，Excel 使用工作表和单元格地址。涉及尺寸、角度、容差、材料和工艺的细节必须绑定数据、公式、约束或明确规则；缺少来源会阻止执行。整体重生成只能是单独保留的候选，不能覆盖当前可行版本。

## AICAD 严格边界

`transparent_ai_apprentice_aicad_request_v1` 包含产品参数、材料、几何意图、局部修改、证据文件、真值来源、QA 需求、宿主策略和安全锁。交接前会将证据复制到会话目录并计算 SHA-256。

`transparent_ai_apprentice_aicad_result_v1` 必须绑定请求哈希、生产者 `aicad-agent`、版本 `1.2.0`、宿主执行状态和产物哈希。结果路径必须留在允许目录中，错误需要根因与修复建议。

## 规则与记忆

一次纠错不能直接改变长期行为。系统只生成 `draft_disabled` 规则候选。规则看似冲突时先比较上下文、具体性、老师例外、证据、优先级、置信度和风险；决策必须记录选中与压制规则并显示问题标记，不得静默删除规则。低置信度或高风险歧义进入复核。RAG 只能补充带来源的证据，不得启用规则、执行软件、写入权威记忆或解锁包装投产。

## 公开轨迹

系统不公开私有思维链。对用户显示的是目标、步骤、采用规则、证据来源、置信度、验证结果、阻塞原因、回滚点和人工复核点。

## 默认锁

所有首版流程默认保持：

```json
{
  "reviewOnly": true,
  "accepted": false,
  "technologyAccepted": false,
  "ruleEnabled": false,
  "packagingGated": true
}
```

## 宿主 Agent 插件边界与原生选区

本项目是依附 Codex 等宿主 Agent 使用的插件，不是独立 AI 产品。Word、AutoCAD/AICAD 桥接层和桌面助手只负责读取原生选区、保存修改意见、打开当前 Agent 任务和显示状态；推理、工具选择与任务上下文均由宿主 Agent 持有。插件不启动模型服务，不要求独立模型 API，也不要求 API Key。

Word 使用 COM Range 定位选中文字；AutoCAD 使用实体句柄以及托管 API 的 FullSubentityPath 定位实体、边、面或顶点。右键捕获生成 ai_apprentice_native_selection_v1，Agent 再生成局部预览和待审核动作。桌面助手允许连续提交意见，每次递增 teacherInstructionRevision 并保留 teacherInstructionHistory。后台准备默认开启；屏幕控制默认关闭，只有本次记录为 screenControlPolicy=explicit_opt_in 时才可作为宿主 Agent 的兜底工具。
