#!/bin/bash

# Script para generar eventos de seguridad y ver dashboard actualizar
# Uso: ./generate_security_events.sh

BASE_URL="https://127.0.0.1"
CURL_OPTS="-k -s"

echo "════════════════════════════════════════════════════════════"
echo "   GENERADOR DE EVENTOS DE SEGURIDAD"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Este script genera eventos reales que el dashboard mostrará"
echo "Abre https://127.0.0.1/metrics/dashboard en otra terminal"
echo ""
echo "Presiona Enter para empezar..."
read

# ── EVENTO 1: SQLi Bloqueados ──────────────────────────────────
echo ""
echo "🚫 Generando intentos de SQL Injection..."
for i in {1..5}; do
    echo "  Intento $i de SQLi..."
    curl $CURL_OPTS "$BASE_URL/api/usuarios?id=1 UNION SELECT password" > /dev/null
    curl $CURL_OPTS "$BASE_URL/api/productos?name=test OR 1=1" > /dev/null
    curl $CURL_OPTS "$BASE_URL/api/datos?q='; DROP TABLE users; --" > /dev/null
    sleep 1
done

echo "✅ 5 intentos de SQLi generados (deberías ver el contador aumentar)"
echo ""
echo "Presiona Enter para continuar..."
read

# ── EVENTO 2: JWT Rechazados ──────────────────────────────────
echo ""
echo "🔐 Generando JWT inválidos..."
for i in {1..5}; do
    echo "  Intento $i de JWT inválido..."
    curl $CURL_OPTS -H "Authorization: Bearer invalid.token.$i" \
        "$BASE_URL/api/datos" > /dev/null
    sleep 1
done

echo "✅ 5 JWT inválidos generados (deberías ver el contador aumentar)"
echo ""
echo "Presiona Enter para continuar..."
read

# ── EVENTO 3: Autenticaciones Exitosas ─────────────────────────
echo ""
echo "✅ Generando autenticaciones exitosas con 2FA..."
echo ""
echo "Para esto necesitamos obtener un JWT válido."
echo "Pasos:"
echo "1. Abriremos Google Authenticator"
echo "2. Copiaremos el código 2FA"
echo "3. Haremos login y validación 2FA"
echo ""

# PASO 1: Login
echo "Haciendo login..."
LOGIN=$(curl $CURL_OPTS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}')

echo "Respuesta del login:"
echo "$LOGIN"
echo ""

# Pedir código 2FA
read -p "Ingresa el código 2FA (6 dígitos de Google Authenticator): " OTP_CODE

# PASO 2: Validar 2FA
echo "Validando 2FA..."
OTP_RESPONSE=$(curl $CURL_OPTS -X POST "$BASE_URL/auth/verificar-2fa" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"codigo\":\"$OTP_CODE\"}")

echo "Respuesta del 2FA:"
echo "$OTP_RESPONSE"

# Extraer token
TOKEN=$(echo "$OTP_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo ""
    echo "❌ Error: No se pudo obtener el JWT"
    exit 1
fi

echo ""
echo "✅ Token obtenido exitosamente"
echo ""

# PASO 3: Hacer múltiples solicitudes con JWT válido
echo "Haciendo solicitudes con JWT válido (registrando autenticaciones exitosas)..."
for i in {1..5}; do
    echo "  Solicitud $i..."
    curl $CURL_OPTS -H "Authorization: Bearer $TOKEN" \
        "$BASE_URL/api/datos" > /dev/null
    sleep 1
done

echo ""
echo "✅ 5 autenticaciones exitosas generadas"
echo ""

# ── RESUMEN FINAL ──────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "   RESUMEN DE EVENTOS GENERADOS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🚫 SQLi Bloqueados: 5 intentos"
echo "   - 1 x UNION SELECT"
echo "   - 1 x OR 1=1"
echo "   - 1 x DROP TABLE"
echo "   - 2 x variantes"
echo ""
echo "🔐 JWT Rechazados: 5 intentos"
echo "   - Todos con tokens inválidos"
echo ""
echo "✅ Autenticaciones Exitosas: 5 intentos"
echo "   - Login + 2FA + acceso a /api/datos"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Si abriste https://127.0.0.1/metrics/dashboard en otra terminal:"
echo "- Deberías ver los contadores actualizados"
echo "- Los eventos deberían aparecer en 'Eventos Recientes'"
echo ""
echo "Prueba de nuevo y mira cómo se actualizan en TIEMPO REAL ⚡"
echo ""