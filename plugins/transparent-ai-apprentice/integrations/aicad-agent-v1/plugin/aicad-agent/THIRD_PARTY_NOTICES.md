# Third-party notices

The AICAD source is MIT licensed; see `LICENSE`.

Optional Python QA dependencies are not bundled: `jsonschema`, `ezdxf`, `Pillow`, and `Shapely`. Their licenses must be reviewed by the integrating project and are installed from their publishers.

AutoCAD and SolidWorks are optional commercial hosts and are not included. `SolidWorks.Interop.sldworks.dll` and `SolidWorks.Interop.swconst.dll` are Dassault Systèmes vendor components and are intentionally excluded because redistribution rights were not established. Build the host with `SolidWorksApiPath` pointing to a licensed local installation. The included host executable is project code only and still requires a licensed compatible SolidWorks installation and its interop runtime.
