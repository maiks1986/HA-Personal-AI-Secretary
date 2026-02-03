#include <File.au3>
#include <Array.au3>
#include <WinAPISys.au3>

; --- CONFIGURATION ---
Opt("WinTitleMatchMode", 2) 
Local $PROJECT_ROOT = "C:\Users\Maiks\OneDrive\Bureaublad\HA-Personal-AI-Secretary"
Local $GEMINI_PATH = "C:\Users\Maiks\AppData\Roaming\npm\gemini.cmd"
Local $CHECK_BAT = $PROJECT_ROOT & "\workflow\check_msg.bat"

Local $agents[4] = ["whatsapp_node", "calendar_node", "ai_gateway", "auth_node"]
Local $hwnds[4] 
Local $pids[4] 

ConsoleWrite(">>> GEMINI MISSION CONTROL (FIXED LAUNCH v2) <<<" & @CRLF)

; --- 1. LAUNCH AGENTS ---
For $i = 0 To 3
	Local $name = $agents[$i]
	Local $workDir = $PROJECT_ROOT & "\" & $name
	ConsoleWrite("Launching " & $name & " in " & $workDir & @CRLF)
	
	Local $app = '"' & $GEMINI_PATH & '"'
	Local $args = ' --yolo --model gemini-3-flash-preview --include-directories "..\.git,..\logs,..\plans,..\workflow"'
	Local $prompt = ' -i "System: Terminal ready."'
	
	; Glue it all together. Note: CMD /K ""Path" Args" is the secret for quoted paths.
	Local $cmd = 'cmd /k "' & $app & $args & $prompt & '"'
	
	ConsoleWrite("Running: " & $cmd & @CRLF)
	
	; Run(command, workingdir)
	$pids[$i] = Run($cmd, $workDir)
	
	If @error Then
		ConsoleWrite("!! ERROR: Could not start process for " & $name & @CRLF)
	Else
		ConsoleWrite("+ PID: " & $pids[$i] & @CRLF)
	EndIf
Next

ConsoleWrite("Waiting 8 seconds for windows to fully load..." & @CRLF)
Sleep(8000)

; --- 2. MATCH PIDs TO HANDLES ---
For $i = 0 To 3
	Local $targetPid = $pids[$i]
	Local $found = False
	For $attempts = 1 To 15
		Local $aList = WinList() ; Terminal
		If $aList[0][0] = 0 Then $aList = WinList("[CLASS:ConsoleWindowClass]") ; CMD
		
		For $j = 1 To $aList[0][0]
			If WinGetProcess($aList[$j][1]) = $targetPid Then
				$hwnds[$i] = $aList[$j][1]
				ConsoleWrite("++ Matched " & $agents[$i] & " to Handle: " & $hwnds[$i] & @CRLF)
				$found = True
				ExitLoop
			EndIf
		Next
		If $found Then ExitLoop
		Sleep(1000)
	Next
Next

; --- 3. INITIALIZE WORKFLOW ---
For $i = 0 To 3
	If $hwnds[$i] Then
		ConsoleWrite("Initializing Workflow for " & $agents[$i] & @CRLF)
		WinActivate($hwnds[$i])
		Sleep(500)
		ControlSend($hwnds[$i], "", "[CLASS:Windows.UI.Composition.DesktopWindowContentBridge; INSTANCE:1]", "..\read_workflow.bat{ENTER}", 1)
	EndIf
Next

ConsoleWrite(">>> Monitoring via check_msg.bat..." & @CRLF)

; --- 4. THE MONITORING LOOP ---
While 1
	For $i = 0 To 3
		Local $name = $agents[$i]
		Local $h = $hwnds[$i]
		
		If $h And WinExists($h) Then
			Local $iCheckPid = Run('cmd /c "' & $CHECK_BAT & '" ' & $name, $PROJECT_ROOT, @SW_HIDE, 0x2) ; $STDOUT_CHILD
			Local $sOutput = ""
			While 1
				Local $line = StdoutRead($iCheckPid)
				If @error Then ExitLoop
				$sOutput &= $line
			WEnd
			
			If StringInStr($sOutput, "New Message(s)") Then
				ConsoleWrite("! New message for " & $name & @CRLF)
				WinActivate($h)
				Sleep(300)
				ControlSend($h, "", "[CLASS:Windows.UI.Composition.DesktopWindowContentBridge; INSTANCE:1]", "[SYSTEM]: " & $sOutput & "{ENTER}", 1)
			EndIf
		EndIf
	Next
	Sleep(5000)
WEnd