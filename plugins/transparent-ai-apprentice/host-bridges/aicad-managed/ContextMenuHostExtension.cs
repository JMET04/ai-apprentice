using System.Windows.Forms;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.Windows;
using AcApplication = Autodesk.AutoCAD.ApplicationServices.Core.Application;
using AcUiApplication = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: ExtensionApplication(typeof(AI.Apprentice.AutoCAD.ContextMenu.ContextMenuHostExtension))]

namespace AI.Apprentice.AutoCAD.ContextMenu;

public sealed class ContextMenuHostExtension : IExtensionApplication
{
    private ContextMenuExtension? contextMenu;

    public void Initialize()
    {
        contextMenu = new ContextMenuExtension { Title = "AI 学徒" };
        var item = new MenuItem("读取选中对象并交给当前 Agent");
        item.Click += (_, _) => AcApplication.DocumentManager.MdiActiveDocument?
            .SendStringToExecute("AIAPPRENTICE_CAPTURE_SELECTION ", true, false, false);
        contextMenu.MenuItems.Add(item);
        AcUiApplication.AddDefaultContextMenuExtension(contextMenu);
    }

    public void Terminate()
    {
        if (contextMenu is null) return;
        AcUiApplication.RemoveDefaultContextMenuExtension(contextMenu);
        contextMenu.Dispose();
        contextMenu = null;
    }
}
