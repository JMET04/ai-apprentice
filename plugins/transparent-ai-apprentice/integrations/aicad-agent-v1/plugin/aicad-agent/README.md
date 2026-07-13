# aicad-agent 1.2.0

Deterministic, origin-anchored CAD plugin for review-only AI Apprentice integration. It compiles 2D AICAD plans to AICAD/SCR/DXF/audit artifacts, runs packaging dieline QA, and supports transactional SolidWorks 3D plans through an optional Windows host.

## Runtime

- Core: Python 3.10+, standard library only.
- Packaging QA: install `requirements-qa.txt`.
- AutoCAD: optional AutoCAD 2025+ bundle under `runtime/autocad`.
- SolidWorks: optional Windows x64, .NET Framework 4.8, licensed SolidWorks 2026 installation. Vendor interop DLLs are intentionally not redistributed.

Quick smoke:

```powershell
python scripts/aicad_agent.py capabilities
python scripts/aicad_agent.py compile --plan runtime/examples/rectangle.plan.json --out smoke --name rectangle
python scripts/aicad_agent.py build3d --plan runtime/examples/mounting_plate_3d.plan.json --out smoke3d --name plate --no-execute
```

This is an engineering candidate for teacher review. It does not represent production or technical acceptance.
