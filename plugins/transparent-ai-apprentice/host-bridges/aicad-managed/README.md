# AutoCAD managed native selection bridge

This AutoCAD 2025 host extension adds an `AI 学徒` context-menu command. It reads the current native pickset and, when AutoCAD exposes a graphics-system marker, resolves a stable `FullSubentityPath` and `SubentityId` for a face, edge, or vertex. Entity-only selection remains explicit and is never mislabeled as a face.

The bridge is not an AI runtime. It writes `ai_apprentice_native_selection_v1` with `executionBoundary.mode=host_agent_plugin`, starts no model API, asks for no API key, and launches only the capture/handoff companion. Reasoning remains owned by the connected Agent through `manage_native_selection`.

After teacher review, `manage_native_selection.execute_autocad_live` can dispatch a guarded native request to the active AutoCAD document. The runtime rechecks document identity, handle, DXF type, layer, and captured line geometry before one transaction. Supported operations are LINE length changes, entity movement, allowlisted layer/color/linetype-scale changes, and native 3DSOLID face offsets when an exact face `SubentityId` was captured. Unsupported or stale targets are blocked. The bridge never saves or closes the drawing automatically, and every result remains pending teacher verification.

Build with the AutoCAD 2025 managed assemblies:

```powershell
dotnet build -c Release -p:AutoCADManagedDir="D:\软件安装\CAD\AutoCAD 2025"
```

Load `AI.Apprentice.AutoCAD.Selection.dll` with `NETLOAD`, select an entity or subentity, then use the AutoCAD right-click menu item `读取选中对象并交给当前 Agent`.
