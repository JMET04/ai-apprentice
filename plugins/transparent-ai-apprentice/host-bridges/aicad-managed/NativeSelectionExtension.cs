using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using AcApplication = Autodesk.AutoCAD.ApplicationServices.Core.Application;

[assembly: ExtensionApplication(typeof(AI.Apprentice.AutoCAD.Selection.NativeSelectionExtension))]

namespace AI.Apprentice.AutoCAD.Selection;

public sealed class NativeSelectionExtension : IExtensionApplication
{
    public void Initialize() { }

    public void Terminate() { }

    [CommandMethod("AIAPPRENTICE_CAPTURE_SELECTION", CommandFlags.Modal | CommandFlags.UsePickSet)]
    public static void CaptureSelection()
    {
        CaptureSelectionCore("right_click");
    }

    [CommandMethod("AIAPPRENTICE_CAPTURE_SELECTION_COMMAND", CommandFlags.Modal | CommandFlags.UsePickSet)]
    public static void CaptureSelectionFromCommand()
    {
        CaptureSelectionCore("command");
    }

    private static void CaptureSelectionCore(string trigger)
    {
        var document = AcApplication.DocumentManager.MdiActiveDocument;
        if (document is null) return;
        var editor = document.Editor;
        var implied = editor.SelectImplied();
        if (implied.Status != PromptStatus.OK || implied.Value.Count == 0)
        {
            editor.WriteMessage("\n请先选择线段、面、尺寸或特征，再从右键菜单交给 AI 学徒。\n");
            return;
        }

        var selected = implied.Value[0];
        if (selected is null || selected.ObjectId.IsNull) return;
        using var transaction = document.TransactionManager.StartOpenCloseTransaction();
        var entity = transaction.GetObject(selected.ObjectId, OpenMode.ForRead, false) as Entity;
        if (entity is null) return;

        var headlessHost = Process.GetCurrentProcess().ProcessName.Equals("accoreconsole", StringComparison.OrdinalIgnoreCase);
        var subentity = headlessHost ? null : ResolveSubentity(entity, selected);
        var packet = BuildPacket(document, entity, selected, subentity, headlessHost, trigger);
        var inbox = ResolveInbox(document);
        Directory.CreateDirectory(inbox);
        var path = Path.Combine(inbox, $"selection-autocad-managed-{DateTime.UtcNow:yyyyMMddTHHmmssfffZ}-{entity.Handle}.json");
        File.WriteAllText(path, JsonSerializer.Serialize(packet, new JsonSerializerOptions { WriteIndented = true }));
        LaunchCompanion();
        editor.WriteMessage($"\nAI 学徒插件已读取 {packet.selection.nativeKind} {packet.selection.nativeLocator}，等待当前 Agent 处理。\n");
    }

    private static SubentitySnapshot? ResolveSubentity(Entity entity, SelectedObject selected)
    {
        foreach (var selectedSubObject in selected.GetSubentities())
        {
            var path = selectedSubObject.FullSubentityPath;
            if (path.IsNull) continue;
            return new SubentitySnapshot(
                path.SubentId.Type.ToString().ToLowerInvariant(),
                path.SubentId.IndexPtr.ToInt32(),
                path.GetObjectIds().Select(id => id.Handle.ToString()).ToArray());
        }
        return null;
    }

    private static NativeSelectionPacket BuildPacket(Document document, Entity entity, SelectedObject selected, SubentitySnapshot? subentity, bool headlessHost, string trigger)
    {
        var objectId = ReadAicadObjectId(entity) ?? $"HANDLE:{entity.Handle}";
        var nativeKind = subentity is null ? "autocad_entity" : $"autocad_{subentity.kind}";
        var locator = subentity is null
            ? $"handle:{entity.Handle}"
            : $"handle:{entity.Handle}/subentity:{subentity.kind}:{subentity.index}";
        var properties = new Dictionary<string, object?>
        {
            ["handle"] = entity.Handle.ToString(),
            ["layer"] = entity.Layer,
            ["dxfName"] = entity.GetRXClass().DxfName,
            ["graphicsSystemMarker"] = headlessHost ? 0 : selected.GraphicsSystemMarkerPtr.ToInt64(),
            ["headlessHost"] = headlessHost,
            ["subentityType"] = subentity?.kind,
            ["subentityIndex"] = subentity?.index,
            ["fullObjectPath"] = subentity?.objectPath
        };
        if (entity is Line line)
        {
            properties["startPoint"] = Point(line.StartPoint);
            properties["endPoint"] = Point(line.EndPoint);
            properties["length"] = line.Length;
        }
        try
        {
            var extents = entity.GeometricExtents;
            properties["extentsMin"] = Point(extents.MinPoint);
            properties["extentsMax"] = Point(extents.MaxPoint);
        }
        catch { }
        return new NativeSelectionPacket(
            "ai_apprentice_native_selection_v1",
            "engineering_native_object",
            new HostSnapshot("AICAD / AutoCAD", AcApplication.Version.ToString(), document.Name, document.Database.Filename, $"autocad-{document.GetHashCode()}"),
            new SelectionSnapshot(nativeKind, locator, objectId, entity.GetRXClass().DxfName, properties, new[] { $"layer:{entity.Layer}" }, Array.Empty<string>()),
            new CaptureSnapshot(trigger, "autocad_managed_full_subentity_bridge_v1", DateTime.UtcNow),
            new InteractionPreference(true, false, true),
            new ExecutionBoundary("host_agent_plugin", "host_agent", false, false, "capture_and_handoff_only"),
            true, false, false, true);
    }

    private static string? ReadAicadObjectId(Entity entity)
    {
        using var data = entity.XData;
        if (data is null) return null;
        var inAicadPayload = false;
        foreach (var value in data.AsArray())
        {
            if (value.TypeCode == 1001)
            {
                inAicadPayload = string.Equals(value.Value as string, "AICAD", StringComparison.OrdinalIgnoreCase);
                continue;
            }
            if (inAicadPayload && value.TypeCode == 1000 && value.Value is string objectId && !string.IsNullOrWhiteSpace(objectId))
            {
                return objectId;
            }
        }
        return null;
    }

    [CommandMethod("AIAPPRENTICE_APPLY_REQUEST", CommandFlags.Modal)]
    public static void ApplyRequest()
    {
        var document = AcApplication.DocumentManager.MdiActiveDocument;
        if (document is null) return;
        var options = new PromptStringOptions("\nAI Apprentice request JSON path: ") { AllowSpaces = true };
        var prompted = document.Editor.GetString(options);
        if (prompted.Status != PromptStatus.OK || string.IsNullOrWhiteSpace(prompted.StringResult)) return;
        ApplyRequestCore(document, prompted.StringResult.Trim().Trim('"'));
    }

    private static void ApplyRequestCore(Document document, string requestPath)
    {
        string receiptPath = "";
        try
        {
            using var json = JsonDocument.Parse(File.ReadAllText(requestPath));
            var request = json.RootElement;
            if (RequiredString(request, "format") != "ai_apprentice_autocad_native_selection_request_v1")
                throw new InvalidOperationException("Unsupported AutoCAD native selection request format.");
            receiptPath = RequiredString(request, "receiptPath");
            var action = RequiredString(request, "action");
            if (action is not ("verify" or "apply")) throw new InvalidOperationException("Request action must be verify or apply.");

            var selectionRecord = request.GetProperty("selection");
            var snapshot = selectionRecord.GetProperty("snapshot");
            var correction = request.GetProperty("correction");
            var packet = correction.GetProperty("packet");
            if (RequiredString(snapshot, "surfaceKind") != "engineering_native_object" ||
                RequiredString(packet, "surfaceKind") != "engineering_native_object")
                throw new InvalidOperationException("Request is not an engineering native-object correction.");

            ValidateDocument(document, snapshot.GetProperty("host"));
            var selected = snapshot.GetProperty("selection");
            var properties = selected.GetProperty("properties");
            var handleText = RequiredString(properties, "handle");
            var objectId = document.Database.GetObjectId(false, new Handle(long.Parse(handleText, NumberStyles.HexNumber, CultureInfo.InvariantCulture)), 0);
            if (objectId.IsNull || objectId.IsErased) throw new InvalidOperationException($"AutoCAD entity handle {handleText} is no longer available.");

            using var transaction = document.TransactionManager.StartTransaction();
            var entity = transaction.GetObject(objectId, action == "apply" ? OpenMode.ForWrite : OpenMode.ForRead, false) as Entity
                ?? throw new InvalidOperationException("Captured AutoCAD object is not an entity.");
            var expectedType = RequiredString(selected, "objectType");
            if (!string.Equals(entity.GetRXClass().DxfName, expectedType, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Entity type changed after capture: expected {expectedType}, found {entity.GetRXClass().DxfName}.");
            var expectedLayer = RequiredString(properties, "layer");
            if (!string.Equals(entity.Layer, expectedLayer, StringComparison.Ordinal))
                throw new InvalidOperationException($"Entity layer changed after capture: expected {expectedLayer}, found {entity.Layer}.");
            ValidateGeometrySnapshot(entity, properties);

            var before = DescribeEntity(entity);
            var target = packet.GetProperty("target");
            var operation = RequiredString(target, "action");
            if (action == "apply") ApplyOperation(document.Database, entity, selected, target, operation);
            var after = DescribeEntity(entity);
            if (action == "apply") transaction.Commit();

            WriteReceipt(receiptPath, new Dictionary<string, object?>
            {
                ["format"] = "ai_apprentice_autocad_native_selection_result_v1",
                ["status"] = action == "apply" ? "applied_pending_teacher_verification" : "verified_ready_for_apply",
                ["action"] = action,
                ["documentName"] = document.Name,
                ["documentPath"] = document.Database.Filename,
                ["nativeLocator"] = RequiredString(selected, "nativeLocator"),
                ["operation"] = operation,
                ["before"] = before,
                ["after"] = after,
                ["exactCapturedEntityMatched"] = true,
                ["documentLeftOpen"] = true,
                ["documentSavedAutomatically"] = false,
                ["screenControlUsed"] = false,
                ["teacherVerificationRequired"] = true,
                ["accepted"] = false,
                ["ruleEnabled"] = false,
                ["packagingGated"] = true
            });
            document.Editor.WriteMessage($"\nAI Apprentice {operation} {action} completed; teacher verification is still required.\n");
        }
        catch (System.Exception error)
        {
            if (!string.IsNullOrWhiteSpace(receiptPath))
            {
                WriteReceipt(receiptPath, new Dictionary<string, object?>
                {
                    ["format"] = "ai_apprentice_autocad_native_selection_result_v1",
                    ["status"] = "blocked",
                    ["error"] = error.Message,
                    ["accepted"] = false,
                    ["ruleEnabled"] = false,
                    ["packagingGated"] = true
                });
            }
            document.Editor.WriteMessage($"\nAI Apprentice blocked the native edit: {error.Message}\n");
        }
    }

    private static void ApplyOperation(Database database, Entity entity, JsonElement selected, JsonElement target, string operation)
    {
        if (operation == "set_dimension")
        {
            if (entity is not Line line) throw new InvalidOperationException("set_dimension currently supports native LINE entities only.");
            var targetLength = RequiredFiniteNumber(target, "targetValue");
            if (targetLength <= Tolerance.Global.EqualPoint) throw new InvalidOperationException("Target line length must be positive.");
            var direction = line.EndPoint - line.StartPoint;
            if (direction.Length <= Tolerance.Global.EqualPoint) throw new InvalidOperationException("A zero-length line cannot be resized.");
            line.EndPoint = line.StartPoint + direction.GetNormal() * targetLength;
            return;
        }
        if (operation == "offset_face")
        {
            if (entity is not Solid3d solid) throw new InvalidOperationException("offset_face requires a native 3DSOLID entity.");
            if (!RequiredString(selected, "nativeKind").Equals("autocad_face", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("offset_face requires an explicitly captured face, not only its parent solid.");
            var index = selected.GetProperty("properties").GetProperty("subentityIndex").GetInt32();
            var subentityId = new SubentityId(SubentityType.Face, new IntPtr(index));
            solid.OffsetFaces(new[] { subentityId }, RequiredFiniteNumber(target, "targetValue"));
            return;
        }
        if (operation == "move_object")
        {
            var delta = target.GetProperty("delta");
            entity.TransformBy(Matrix3d.Displacement(new Vector3d(
                RequiredFiniteNumber(delta, "x"), RequiredFiniteNumber(delta, "y"), RequiredFiniteNumber(delta, "z"))));
            return;
        }
        if (operation == "change_property")
        {
            var name = RequiredString(target, "propertyName");
            var value = target.GetProperty("propertyValue");
            if (name == "layer")
            {
                var layer = value.GetString() ?? "";
                var table = (LayerTable)database.TransactionManager.TopTransaction.GetObject(database.LayerTableId, OpenMode.ForRead);
                if (!table.Has(layer)) throw new InvalidOperationException($"Layer does not exist: {layer}.");
                entity.Layer = layer;
                return;
            }
            if (name == "colorIndex")
            {
                var colorIndex = value.ValueKind == JsonValueKind.Number ? value.GetInt16() : short.Parse(value.GetString() ?? "", CultureInfo.InvariantCulture);
                if (colorIndex < 0 || colorIndex > 256) throw new InvalidOperationException("colorIndex must be between 0 and 256.");
                entity.ColorIndex = colorIndex;
                return;
            }
            if (name == "linetypeScale")
            {
                var scale = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : double.Parse(value.GetString() ?? "", CultureInfo.InvariantCulture);
                if (!double.IsFinite(scale) || scale <= 0) throw new InvalidOperationException("linetypeScale must be positive.");
                entity.LinetypeScale = scale;
                return;
            }
            throw new InvalidOperationException($"Property is not in the live-edit allowlist: {name}.");
        }
        throw new InvalidOperationException($"Unsupported AutoCAD native operation: {operation}.");
    }

    private static void ValidateDocument(Document document, JsonElement host)
    {
        var expectedName = RequiredString(host, "documentName");
        if (!string.Equals(document.Name, expectedName, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Active AutoCAD document changed: expected {expectedName}, found {document.Name}.");
        var expectedPath = host.TryGetProperty("documentPath", out var pathElement) ? pathElement.GetString() ?? "" : "";
        if (!string.IsNullOrWhiteSpace(expectedPath) && !string.IsNullOrWhiteSpace(document.Database.Filename) &&
            !string.Equals(Path.GetFullPath(expectedPath), Path.GetFullPath(document.Database.Filename), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Active AutoCAD document path no longer matches the captured selection.");
    }

    private static void ValidateGeometrySnapshot(Entity entity, JsonElement properties)
    {
        if (entity is not Line line || !properties.TryGetProperty("length", out var expectedLength)) return;
        var expected = expectedLength.GetDouble();
        if (Math.Abs(line.Length - expected) > Math.Max(1e-7, Math.Abs(expected) * 1e-9))
            throw new InvalidOperationException($"Line geometry changed after capture: expected length {expected}, found {line.Length}.");
    }

    private static Dictionary<string, object?> DescribeEntity(Entity entity)
    {
        var value = new Dictionary<string, object?>
        {
            ["handle"] = entity.Handle.ToString(), ["dxfName"] = entity.GetRXClass().DxfName,
            ["layer"] = entity.Layer, ["colorIndex"] = entity.ColorIndex, ["linetypeScale"] = entity.LinetypeScale
        };
        if (entity is Line line)
        {
            value["startPoint"] = Point(line.StartPoint);
            value["endPoint"] = Point(line.EndPoint);
            value["length"] = line.Length;
        }
        if (entity is Solid3d solid)
        {
            try { value["volume"] = solid.MassProperties.Volume; } catch { }
        }
        return value;
    }

    private static double[] Point(Point3d point) => new[] { point.X, point.Y, point.Z };

    private static string RequiredString(JsonElement value, string name)
    {
        if (!value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(property.GetString()))
            throw new InvalidOperationException($"Request field is required: {name}.");
        return property.GetString()!;
    }

    private static double RequiredFiniteNumber(JsonElement value, string name)
    {
        if (!value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Number || !property.TryGetDouble(out var number) || !double.IsFinite(number))
            throw new InvalidOperationException($"Request field must be a finite number: {name}.");
        return number;
    }

    private static void WriteReceipt(string path, object value)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporary, path, true);
    }

    private static string ResolveInbox(Document document)
    {
        var configured = Environment.GetEnvironmentVariable("AI_APPRENTICE_NATIVE_SELECTION_INBOX");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;
        var directory = Path.GetDirectoryName(document.Database.Filename);
        return Path.Combine(string.IsNullOrWhiteSpace(directory) ? Environment.CurrentDirectory : directory, ".transparent-apprentice", "native-selections", "inbox");
    }

    private static void LaunchCompanion()
    {
        var root = Environment.GetEnvironmentVariable("AI_APPRENTICE_PLUGIN_ROOT");
        if (string.IsNullOrWhiteSpace(root)) return;
        var script = Path.Combine(root, "assets", "desktop-companion", "AI-Apprentice-Companion.ps1");
        if (!File.Exists(script)) return;
        Process.Start(new ProcessStartInfo("powershell.exe", $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{script}\"") { UseShellExecute = false, CreateNoWindow = true });
    }

    private sealed record SubentitySnapshot(string kind, int index, string[] objectPath);
    private sealed record NativeSelectionPacket(string format, string surfaceKind, HostSnapshot host, SelectionSnapshot selection, CaptureSnapshot capture, InteractionPreference interactionPreference, ExecutionBoundary executionBoundary, bool reviewOnly, bool accepted, bool ruleEnabled, bool packagingGated);
    private sealed record HostSnapshot(string application, string version, string documentName, string documentPath, string sessionId);
    private sealed record SelectionSnapshot(string nativeKind, string nativeLocator, string objectId, string objectType, Dictionary<string, object?> properties, string[] relationships, string[] protectedObjectIds);
    private sealed record CaptureSnapshot(string trigger, string adapter, DateTime capturedAt);
    private sealed record InteractionPreference(bool backgroundPreparation, bool allowScreenControl, bool keepHostDocumentOpen);
    private sealed record ExecutionBoundary(string mode, string reasoningOwner, bool modelApiRequired, bool apiKeyRequired, string companionRole);
}
