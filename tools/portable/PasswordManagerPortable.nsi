Unicode true
RequestExecutionLevel user

!define APP_EXE_NAME "password-manager.exe"
!define PORTABLE_NAME "PasswordManager-Portable.exe"
!define TEMP_DIR_NAME "PasswordManagerPortable"

OutFile "..\..\dist-portable\${PORTABLE_NAME}"
SetCompressor /SOLID lzma

ShowInstDetails nevershow
ShowUninstDetails nevershow
AutoCloseWindow true

Section
  ; Extract everything to a temp directory on the current machine
  StrCpy $INSTDIR "$TEMP\${TEMP_DIR_NAME}"
  RMDir /r "$INSTDIR"
  CreateDirectory "$INSTDIR"

  ; App exe (built by tauri)
  SetOutPath "$INSTDIR"
  File /oname=${APP_EXE_NAME} "..\..\src-tauri\target\release\${APP_EXE_NAME}"

  ; Optional resources dir (if present)
  IfFileExists "..\..\src-tauri\target\release\resources\*.*" 0 +3
    CreateDirectory "$INSTDIR\resources"
    SetOutPath "$INSTDIR\resources"
    File /r "..\..\src-tauri\target\release\resources\*.*"

  ; Fixed WebView2 runtime (must contain msedgewebview2.exe at its root)
  CreateDirectory "$INSTDIR\webview2-fixed\runtime"
  SetOutPath "$INSTDIR\webview2-fixed\runtime"
  File /r "..\..\src-tauri\webview2-fixed\runtime\*.*"

  ; Tell WebView2 where the fixed runtime lives (only for this process tree)
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", "$INSTDIR\webview2-fixed\runtime").r0'
  StrCmp $0 0 +2
    MessageBox MB_OK "Failed to set WEBVIEW2_BROWSER_EXECUTABLE_FOLDER."

  ; Run the app and wait until it exits
  ExecWait '"$INSTDIR\${APP_EXE_NAME}"'

  ; Cleanup extracted files (best-effort)
  RMDir /r "$INSTDIR"
SectionEnd
