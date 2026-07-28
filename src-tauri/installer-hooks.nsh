; jdnotes → Lapis 更名迁移。
; 模板的 CreateOrUpdateDesktopShortcut / StartMenuShortcut 只认「当前产品名」的
; 快捷方式：更新模式下 Lapis.lnk 不存在就直接跳过，老用户桌面上的 jdnotes.lnk
; 永远不会被迁移，且其指向的旧主程序更新后已被移除（快捷方式变死链）。
; 这里在装完后把旧名快捷方式就地替换为新名；用户自己删过快捷方式则两处都不存在，
; 不会凭空新建，不打扰。
!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$DESKTOP\jdnotes.lnk"
    Delete "$DESKTOP\jdnotes.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
  ${If} ${FileExists} "$SMPROGRAMS\jdnotes.lnk"
    Delete "$SMPROGRAMS\jdnotes.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}

  ; 清理 jdnotes 旧安装。更名后模板按「当前产品名」的卸载键找旧安装，jdnotes 的键
  ; 对不上 → 新版会另装到默认目录，旧目录残留旧主程序 + 控制面板双卸载项，误开旧版
  ; 还会踩 attachment 图片空白（旧版不识别附件引用）。这里只删旧安装自带的二进制与
  ; 注册表项；数据库/配置等一切其它文件不碰（用户 DB 可能就放在旧安装目录里）。
  ; 旧程序正在运行时 Delete 失败即保留，下次更新再清，不阻塞本次安装。
  !insertmacro CLEAN_OLD_JDNOTES HKCU
  !insertmacro CLEAN_OLD_JDNOTES HKLM
!macroend

!macro CLEAN_OLD_JDNOTES ROOT
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\jdnotes" "InstallLocation"
  ${If} $0 != ""
    ; InstallLocation 值带包裹引号，剥掉再用
    StrCpy $1 $0 1
    ${If} $1 == "$\""
      StrLen $2 $0
      IntOp $2 $2 - 2
      StrCpy $0 $0 $2 1
    ${EndIf}
    ${If} $0 != ""
    ${AndIf} $0 != $INSTDIR
      Delete "$0\app.exe"
      Delete "$0\uninstall.exe"
    ${EndIf}
    DeleteRegKey ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\jdnotes"
  ${EndIf}
!macroend
