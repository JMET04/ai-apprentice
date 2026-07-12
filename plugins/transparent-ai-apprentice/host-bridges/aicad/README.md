# AICAD / AutoCAD native selection bridge

This bridge uses AutoLISP `vlr-mouse-reactor` for `:vlr-beginRightClick`, `ssget` for an implied selection, `nentselp` for the clicked entity/subentity path, and `entget` for DXF and AICAD XData. It writes one `ai_apprentice_native_selection_v1` file and opens the desktop companion. It does not start an AI model or API.

The bridge captures entity handle, type, layer, layout, pick point, common geometric properties, and the first AICAD XData string as the stable object id. A 3D solid face is represented as the parent native entity plus the exact pick point in this AutoLISP bridge. A managed AutoCAD host can later enrich this with a stable `SubentityId`; the plugin must not pretend that a parent handle alone uniquely proves a BREP face.

Install with `powershell -ExecutionPolicy Bypass -File install-aicad-selection-bridge.ps1`. Commands: `AIAPPRENTICE_EDIT`, `AIAPPRENTICE_RIGHTCLICK_ON`, and `AIAPPRENTICE_RIGHTCLICK_OFF`.
