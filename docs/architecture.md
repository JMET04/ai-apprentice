# 明徒 AI 架构与边界

## 分层

明徒 AI 保持以下责任边界：UI、API、AI 服务、工作流执行、记忆、轨迹、纠错与规则提取、知识来源与检索证据、工具注册、技能注册、策略与安全门。

用户界面只采集意图和展示证据；包装状态机负责阶段顺序；Image2 负责视觉候选与局部修改；AICAD 只接收已确认工程参数；规则模块只能创建默认停用的候选；最终验收属于老师或工程师。

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

## 多模态精准纠错协议

蒙版工作台在浏览器内保存归一化坐标，不记录连续桌面视频。它支持文字、图片和工程对象，并把标注区分为修改、保护和参考。输出同时兼容 `mingtu_multimodal_surgical_mask_correction_v1`、`mingtu_teacher_mask_correction_v1` 和 `transparent_ai_sketch_overlay_packet_v1`。

`mingtu_surgical_edit_contract_v1` 默认只允许改变选中目标；图片检查蒙版外差异，Word / Excel 检查未选中 OOXML 部件，工程图检查未选中实体、参数、约束与拓扑。Word 使用段落定位器，Excel 使用工作表和单元格地址。涉及尺寸、角度、容差、材料和工艺的细节必须绑定数据、公式、约束或明确规则；缺少来源会阻止执行。整体重生成只能是单独保留的候选，不能覆盖当前可行版本。

## AICAD 严格边界

`mingtu_aicad_request_v1` 包含产品参数、材料、几何意图、局部修改、证据文件、真值来源、QA 需求、宿主策略和安全锁。交接前会将证据复制到会话目录并计算 SHA-256。

`mingtu_aicad_result_v1` 必须绑定请求哈希、生产者 `aicad-agent`、版本 `1.2.0`、宿主执行状态和产物哈希。结果路径必须留在允许目录中，错误需要根因与修复建议。

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
