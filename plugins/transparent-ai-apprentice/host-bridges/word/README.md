# Word native selection bridge

This bridge is not an AI service. Word captures the current COM `Selection`, writes one `ai_apprentice_native_selection_v1` JSON file, and opens the capture companion. It does not create a new Codex task. The teacher returns to the current task, where the connected Agent uses the AI Apprentice MCP plugin to read the file and ask for the intended change.

`WindowBeforeRightClick` keeps the normal Word context menu available (`Cancel = False`). A non-empty text selection triggers the capture script. The document stays open, screen control is disabled by default, and no document content changes during capture. Only the explicit selection is captured by default; neighboring context is opt-in through `-ContextCharacters`.

Install with `powershell -ExecutionPolicy Bypass -File install-word-bridge.ps1`. Word may require the teacher to allow trusted access to the VBA project object model or import the `.cls` and `.bas` files manually. The installer never changes that security setting automatically.
