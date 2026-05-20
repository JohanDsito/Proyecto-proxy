#!/bin/bash

echo "=== PASO 1: LOGIN ==="
curl -k -s -X POST https://127.0.0.1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}'
echo ""
echo ""

echo "=== PASO 2: INGRESA CODIGO 2FA ==="
read -p "Codigo 2FA (6 digitos): " CODE

echo "Validando..."
RESPONSE=$(curl -k -s -X POST https://127.0.0.1/auth/verificar-2fa \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"codigo\":\"$CODE\"}")

echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "token"; then
    echo "✅ EXITO - Token JWT obtenido"
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "Token: ${TOKEN:0:50}..."
    echo ""
    echo "=== PASO 3: ACCESO A RUTA PROTEGIDA ==="
    curl -k -s -H "Authorization: Bearer $TOKEN" https://127.0.0.1/api/datos
else
    echo "❌ Error - Codigo 2FA invalido"
fi
