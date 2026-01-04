Unicode true
RequestExecutionLevel user

!define APP_EXE_NAME "password-manager.exe"
!define PORTABLE_NAME "PasswordManager-Portable.exe"
!define TEMP_DIR_NAME "PasswordManagerPortable"

; Ensure output directory exists at compile time (makensis will fail if it doesn't).
!system 'cmd /c if not exist "..\..\dist-portable" mkdir "..\..\dist-portable"'

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

  ; Hard check: msedgewebview2.exe must exist in the runtime folder.
  IfFileExists "$INSTDIR\webview2-fixed\runtime\msedgewebview2.exe" runtime_ok runtime_missing
  runtime_missing:
    MessageBox MB_OK "WebView2 Fixed Runtime не найден. Ожидаю файл:`r`n$INSTDIR\webview2-fixed\runtime\msedgewebview2.exe`r`n`r`nПроверь, что ты распаковал CAB в src-tauri\webview2-fixed\runtime и что папка runtime попала в контейнер."
    Abort
  runtime_ok:

  ; Tell WebView2 where the fixed runtime lives (only for this process tree)
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", "$INSTDIR\webview2-fixed\runtime").r0'
  ; SetEnvironmentVariable returns nonzero on success, 0 on failure.
  StrCmp $0 0 setenv_failed setenv_ok
  setenv_failed:
    System::Call 'Kernel32::GetLastError()i.r1'
    MessageBox MB_OK "Не удалось установить WEBVIEW2_BROWSER_EXECUTABLE_FOLDER.`r`nGetLastError=$1"
    Abort
  setenv_ok:

  ; Run the app and wait until it exits
  ExecWait '"$INSTDIR\${APP_EXE_NAME}"'

  ; Cleanup extracted files (best-effort)
  RMDir /r "$INSTDIR"
SectionEnd
