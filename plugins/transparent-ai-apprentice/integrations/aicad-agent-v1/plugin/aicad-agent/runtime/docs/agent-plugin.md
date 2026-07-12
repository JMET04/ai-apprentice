# aicad-agent 插件说明

`aicad-agent` 用同一个 stdio MCP/JSON CLI 入口提供 2D 逐实体约束绘图和 3D SolidWorks 逐特征交易建模。

## 结构

```text
aicad-agent/
├─ .codex-plugin/plugin.json
├─ .mcp.json
├─ skills/aicad-draw/
├─ skills/aicad-model-3d/
├─ scripts/aicad_agent.py
└─ runtime/
   ├─ src/aicad/
   ├─ schema/
   ├─ examples/
   └─ solidworks-host/
```

## MCP 工具

| 工具 | 作用 |
|---|---|
| `aicad_capabilities` | 读取能力、产物和强制不变量 |
| `aicad_get_plan_schema` | 读取 2D Schema |
| `aicad_generate` | 离线/可选 provider 生成常见 2D 几何 |
| `aicad_validate_plan` | 无写入验证 2D 计划 |
| `aicad_compile_plan` | 生成 DXF、AutoCAD 执行文件与审计 |
| `aicad_solidworks_doctor` | 检查 SolidWorks、零件模板和类型化宿主 |
| `aicad_get_3d_plan_schema` | 读取 3D 特征计划 Schema |
| `aicad_validate_3d_plan` | 无写入验证特征图、支撑和数学约束 |
| `aicad_build_solidworks_part` | 真实构建、回读、保存、重开验证 SLDPRT/STEP |

MCP 实现 `initialize`、`ping`、`tools/list`、`tools/call`、`resources/list` 和 `resources/read`。工具结果同时返回文本和 `structuredContent`。

## 3D 成功结果

`aicad_build_solidworks_part` 成功后返回：

- `sldprt`、`step`、`audit`、`manifest`、`solidworks_report`、`reopen_report`；
- 每个特征的 `sketch_constraint_status`、`feature_error_code`、持久引用状态和完整 `checks`；
- 最终实体数、故障数、体积、表面积与边界框；
- 保存后重开状态和重开后 AICAD 特征数。

任一特征失败时，MCP 返回 `isError: true` 和稳定错误结构；宿主关闭未保存的部分零件，不继续执行后续特征。

## CLI

```powershell
python scripts/aicad_agent.py capabilities
python scripts/aicad_agent.py schema3d
python scripts/aicad_agent.py solidworks-doctor
python scripts/aicad_agent.py validate3d --plan part.plan.json
python scripts/aicad_agent.py build3d --plan part.plan.json --out build/job
```

`build3d --no-execute` 只生成 SolidWorks 执行计划和审计文件，不打开 SolidWorks。

## 信任边界

- UTF-8 负责人类可读内容；CAD 执行字段使用 ASCII 标识符。
- 输入必须先通过本地编译器，SolidWorks 宿主只接收编译后的受限特征协议。
- 禁止计划依赖 `Face1`/`Edge3` 等漂移名称。
- 不把非空 COM 返回值或文件存在当成几何成功证明。

