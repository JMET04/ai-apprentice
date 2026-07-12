# Security, licensing and limits

- Review-only safety locks are schema constants and runtime assertions.
- Paths in contracts and release metadata are relative; traversal and absolute paths are rejected.
- Image pixels cannot become dimensional parameters. Conflicts fail closed.
- No secrets, user configuration, marketplace state, cache, jobs or temporary native CAD files are included.
- OpenAI/network providers require separate explicit authorization; offline is default.
- AutoCAD and SolidWorks are optional commercial hosts. No host license is included.
- SolidWorks interop DLLs are not redistributed. The compiled project host requires a compatible licensed installation.
- 2D native plan primitives are LINE/CIRCLE/ARC; layer/text/dimension orchestration remains in packaging/host adapters.
- 3D supports base/boss/cut extrusions with rectangle/circle/circle-pattern profiles; no assembly, shell, sweep, loft, surface, fillet or chamfer.
- Historical host evidence predates the newest packaged LISP/host executable and is provenance only, not proof of this binary.
