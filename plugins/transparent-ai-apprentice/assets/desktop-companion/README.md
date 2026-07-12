# AI Apprentice desktop companion

The companion is an original blue mechanical helper drawn from WPF primitives. It intentionally does not use Doraemon artwork, names, silhouette, pocket, bell, or other protected character features.

It is not an AI and starts no model API. It watches the plugin's native-selection inbox, lets the teacher attach an opinion and interaction preference, and copies an Agent handoff prompt. By default it does not open a new Codex task; the teacher returns to the current task and sends the copied prompt. A specific Codex deep link may be passed explicitly when a host integration knows the intended task. The connected Agent remains the only reasoning and tool-execution owner; no separate model account or API key is used. `backgroundPreparation` defaults to true; `allowScreenControl` defaults to false.

Run with `powershell -ExecutionPolicy Bypass -File AI-Apprentice-Companion.ps1`.
