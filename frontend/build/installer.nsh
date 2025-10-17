!macro customInstall
  ; Create shared directory at C:\ProgramData\CocoKDS
  CreateDirectory "$COMMONFILES\CocoKDS"
  
  ; Give full permissions to Users group
  AccessControl::GrantOnFile "$COMMONFILES\CocoKDS" "(BU)" "FullAccess"
!macroend