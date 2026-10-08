@echo off
chcp 65001 >nul
title CRM y Gestion de Leads - JRG Agency
color 0a
echo ====================================================
echo         CRM Y GESTION DE LEADS - JRG AGENCY
echo ====================================================
echo.
echo Abriendo panel interactivo de clientes y prospeccion...
echo.
for /d %%D in ("%~dp0*App_CRM*") do start "" "%%D\index.html"
timeout /t 2 >nul
exit