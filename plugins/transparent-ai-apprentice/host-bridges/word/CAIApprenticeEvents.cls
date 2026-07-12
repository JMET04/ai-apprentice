VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "CAIApprenticeEvents"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Option Explicit

Public WithEvents App As Word.Application
Attribute App.VB_VarHelpID = -1

Private Sub App_WindowBeforeRightClick(ByVal Sel As Selection, Cancel As Boolean)
    On Error Resume Next
    If Not Sel Is Nothing Then
        If Sel.Start <> Sel.End Then
            AIAPPRENTICE_CAPTURE_SELECTION "right_click"
        End If
    End If
    Cancel = False
End Sub
