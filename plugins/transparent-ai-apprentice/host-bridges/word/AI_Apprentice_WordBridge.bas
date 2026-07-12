Attribute VB_Name = "AI_Apprentice_WordBridge"
Option Explicit

Public AIAPPRENTICE_EVENTS As CAIApprenticeEvents

Public Sub AutoExec()
    AIAPPRENTICE_INITIALIZE
End Sub

Public Sub AIAPPRENTICE_INITIALIZE()
    Set AIAPPRENTICE_EVENTS = New CAIApprenticeEvents
    Set AIAPPRENTICE_EVENTS.App = Word.Application
End Sub

Public Sub AIAPPRENTICE_CAPTURE_SELECTION(Optional ByVal Trigger As String = "command")
    Dim PluginRoot As String
    Dim ScriptPath As String
    Dim CommandLine As String

    PluginRoot = Environ$("AI_APPRENTICE_PLUGIN_ROOT")
    If Len(PluginRoot) = 0 Then
        MsgBox "AI_APPRENTICE_PLUGIN_ROOT is not configured. Run install-word-bridge.ps1 first.", vbExclamation, "AI 学徒"
        Exit Sub
    End If

    ScriptPath = PluginRoot & "\host-bridges\word\capture-word-selection.ps1"
    CommandLine = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & _
                  ScriptPath & """ -Trigger " & Trigger & " -OpenCompanion"
    Shell CommandLine, vbHide
End Sub

Public Sub AIAPPRENTICE_RECONNECT()
    AIAPPRENTICE_INITIALIZE
    MsgBox "AI 学徒已重新连接 Word 右键选区事件。", vbInformation, "AI 学徒"
End Sub
