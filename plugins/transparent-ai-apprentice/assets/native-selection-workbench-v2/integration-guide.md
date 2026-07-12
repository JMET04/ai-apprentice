# 集成指南

## 1. 生成自包含工作台

统一使用生成器，不直接拼接页面：

```powershell
node plugins/transparent-ai-apprentice/scripts/create-native-selection-workbench-v2.mjs `
  --surface office `
  --selection-id <selection-id> `
  --selection-store <native-selection-store.json> `
  --submit-endpoint http://127.0.0.1:4317/api/mask-corrections `
  --output-dir <output-directory>
```

`--surface` 允许 `packaging`、`office`、`engineering`。Office 和工程原生选区必须提供匹配的 `selection-id`；生成器会拒绝跨 surface 使用。

## 2. 运行时配置

生成器在应用脚本之前注入：

```js
window.__MINGTU_OVERLAY_CONFIG__ = {
  format: 'ai_apprentice_native_selection_workbench_config_v1',
  selectionId: 'selection-...',
  nativeSelection: {
    format: 'ai_apprentice_native_selection_v1',
    surfaceKind: 'office_native_text | engineering_native_object'
  },
  submitEndpoint: 'http://127.0.0.1:4317/api/mask-corrections',
  executionBoundary: {
    mode: 'host_agent_plugin',
    reasoningOwner: 'host_agent',
    modelApiRequired: false,
    apiKeyRequired: false,
    companionRole: 'capture_and_handoff_only'
  }
};
```

页面没有 API Key、模型选择器或独立模型调用。推理和工具调用始终由当前宿主 Agent 负责。

## 3. 统一导出与校验

三页都提供：

```js
globalThis.MingTuOverlay.validate();
globalThis.MingTuOverlay.packet();
```

`validate()` 在空蒙版、空意见、无效尺寸、预览过期或尚未进入审核步骤时返回失败。顶层 packet 使用 `mingtu_multimodal_surgical_mask_correction_v1`，并保持：

- `reviewOnly: true`
- `accepted: false`
- `ruleEnabled: false`
- `packagingGated: true`

正式 surfaceKind 为 `packaging_image_mask`、`office_native_text`、`engineering_native_object`。

## 4. 原生选区与上下文动作

宿主桥写入 `ai_apprentice_native_selection_v1`，Agent 通过 `native-selection-store.mjs` 摄取并创建 `ai_apprentice_context_action_v1`。必须保留 `selectionId`、原生 locator、宿主文档路径、保护对象和 `selectionVersion`；过期选择不得执行。

Word 使用 COM Range/paragraph locator；AutoCAD 使用 handle 或 FullSubentityPath。浏览器 Canvas 只表达修改、保护和参考范围，不是 Office 写回或 CAD 几何求解结果。

## 5. 提交、离线与执行边界

`mask-submission-client.js` 将审核包提交给 `mask-correction-service.mjs`。网络失败时，最多 20 条任务保存在浏览器本地待重试队列，并显示“重试待提交任务”；成功后移除对应队列项。

提交成功只表示保存为待老师审核任务。老师审核完成后，Word/AutoCAD 适配器仍需通过独立执行入口运行，并返回 `result_succeeded_pending_teacher_verification`。UI 不得显示验收、投产或规则启用。

## 6. 集成文件

- `shared/tokens.css`：共享色彩、排版、状态和移动尺寸。
- `shared/assistant.css` / `assistant-v2.js`：宿主 Agent 状态信标与 `aria-live` 公告。
- 三个 surface 的 `index.html/styles.css/app.js`：领域工作面。
- `create-native-selection-workbench-v2.mjs`：唯一正式内联生成入口。
- `smoke-native-selection-workbench-v2.mjs`：桌面/移动、协议、提交、离线与预览门禁验收。
