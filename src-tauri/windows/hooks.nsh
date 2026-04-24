!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\.msep" "" "MotorSoundEditor.Project"
  WriteRegStr HKCU "Software\Classes\MotorSoundEditor.Project" "" "Motor Sound Editor Project"
  WriteRegStr HKCU "Software\Classes\MotorSoundEditor.Project\DefaultIcon" "" "$INSTDIR\resources\icons\file-ico.ico,0"
  WriteRegStr HKCU "Software\Classes\MotorSoundEditor.Project\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\MotorSoundEditor.Project"
!macroend
