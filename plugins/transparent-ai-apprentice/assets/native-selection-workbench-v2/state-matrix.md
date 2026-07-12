# 状态矩阵

| 状态 | 页面状态 | 主动作 | 约束 |
|---|---|---|---|
| selection-ready | 已读取原生选区/对象 | 输入意见 | 选择快照和 locator 已固定 |
| request-editing | 正在编辑意见 | 生成预览 | 输入变化会立即作废旧预览 |
| validation-error | 缺少蒙版/意见或尺寸无效 | 修正输入 | 禁止提交 |
| previewing | 正在生成局部预览 | 禁用 | 不暗示写回或执行 |
| preview-ready | 预览已生成，原文件未变 | 进入审核 | 此时仍不能提交 |
| waiting-review | 预览已锁定，等待老师送审 | 提交老师审核 | `accepted=false` 不变 |
| submitting | 正在保存纠错任务 | 禁用 | 按钮使用 `aria-busy`，防止重复提交 |
| queued-offline | 提交失败，已进入本地队列 | 重试待提交任务 | 最多保留 20 条，绝不报告假成功 |
| submitted | 纠错任务已保存 | 等待老师审核 | 未自动写回、未自动执行 |
| back-to-edit | 返回修改 | 重新生成预览 | 只丢弃当前预览，不宣称宿主已回滚 |
| execution-ready | 老师已批准独立执行 | 由宿主适配器执行 | 浏览器 UI 不能直接进入 |
| executing | 宿主适配器正在执行 | 禁用 | 保持原文件/对象回滚证据 |
| result-pending-verification | 宿主结果已返回 | 老师验收结果 | 仍不自动启用规则 |
| rollback-ready | 已有真实宿主执行结果和回滚点 | 独立回滚 | 只有执行后才允许出现 |
| error | 预览、提交或执行失败 | 修正/重试 | 错误原因保留，草稿不丢失 |
| stale-selection | 原生选择版本已变化 | 重新读取 | 禁止旧意见写入新选择 |
| read-only | 只读回放 | 无写动作 | 可查看 packet、事件和回滚证据 |

颜色不是唯一信号：每个状态同时使用文字、点/边框形态、按钮状态、`data-state` 和屏幕阅读器公告。
