@echo off
cd /d "%~dp0"
for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\MathWorks\MATLAB\26.1" /v MATLABROOT 2^>nul ^| find "MATLABROOT"') do set "MATLAB_EXE=%%Bbin\matlab.exe"
set "RETINA_BRIDGE_HOST=0.0.0.0"
python server.py
pause
