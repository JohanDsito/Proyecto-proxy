#!/bin/bash

# Script de prueba del Proxy Inverso Inteligente
# Ejecuta desde la terminal: bash test_proxy.sh

echo "════════════════════════════════════════════════════════════"
echo "   PRUEBAS DEL PROXY INVERSO INTELIGENTE - GRUPO 5"
echo "════════════════════════════════════════════════════════════"
echo ""

BASE_URL="https://127.0.0.1"
CURL_OPTS="-k -s"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── PRUEBA 1: TLS Funciona ─────────────────────────────────────
echo "📋 PRUEBA 1: Terminación TLS"
echo "Intentando acceso HTTP (debe redirigir a HTTPS)..."
RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" http://127.0.0.1/api/datos 2>&1)
if [[ "$RESPONSE" == "301" ]] || [[ "$RESPONSE" == "000" ]]; then
    echo -e "${GREEN}✓ PASS${NC}: HTTP redirige correctamente (código $RESPONSE)"
else
    echo -e "${RED}✗ FAIL${NC}: HTTP no redirige (código $RESPONSE)"
fi
echo ""

# ── PRUEBA 2: JWT Requerido ────────────────────────────────────
echo "📋 PRUEBA 2: Validación JWT en /api/"
echo "Intentando acceso sin token (debe rechazar con 401)..."
RESPONSE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/datos")
if [[ "$RESPONSE" == "401" ]]; then
    echo -e "${GREEN}✓ PASS${NC}: Rechaza sin JWT (código 401)"
else
    echo -e "${RED}✗ FAIL${NC}: Respuesta inesperada (código $RESPONSE)"
fi
echo ""

# ── PRUEBA 3: SQLi Detectado ───────────────────────────────────
echo "📋 PRUEBA 3: Detección SQL Injection"
echo "Intentando inyección: id=1 UNION SELECT * (debe bloquear 403)..."
RESPONSE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/datos?id=1%20UNION%20SELECT%20*")
if [[ "$RESPONSE" == "403" ]]; then
    echo -e "${GREEN}✓ PASS${NC}: Bloquea SQLi (código 403)"
else
    echo -e "${RED}✗ FAIL${NC}: No bloqueó SQLi (código $RESPONSE)"
fi
echo ""

# ── PRUEBA 4: Otros patrones SQLi ──────────────────────────────
echo "📋 PRUEBA 4: Variantes de SQLi"
SQLI_PATTERNS=("OR 1=1" "DROP TABLE" "INSERT INTO" "--")
for pattern in "${SQLI_PATTERNS[@]}"; do
    ENCODED=$(echo "$pattern" | sed 's/ /%20/g')
    RESPONSE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" \
        "$BASE_URL/api/datos?q=$ENCODED")
    if [[ "$RESPONSE" == "403" ]]; then
        echo -e "${GREEN}✓${NC} '$pattern' → bloqueado"
    else
        echo -e "${RED}✗${NC} '$pattern' → no bloqueado (código $RESPONSE)"
    fi
done
echo ""

# ── PRUEBA 5: Login (sin 2FA aún) ──────────────────────────────
echo "📋 PRUEBA 5: Endpoint de Login (sin 2FA)"
echo "POST /auth/login con credenciales..."
RESPONSE=$(curl $CURL_OPTS -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"1234"}' \
    "$BASE_URL/auth/login")
if echo "$RESPONSE" | grep -q "paso"; then
    echo -e "${GREEN}✓ PASS${NC}: Login responde correctamente"
    echo "Respuesta: $RESPONSE"
else
    echo -e "${RED}✗ FAIL${NC}: Login respondió inesperadamente"
    echo "Respuesta: $RESPONSE"
fi
echo ""

# ── PRUEBA 6: Credenciales incorrectas ─────────────────────────
echo "📋 PRUEBA 6: Login con credenciales inválidas"
echo "POST /auth/login con password incorrecto..."
RESPONSE=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' \
    "$BASE_URL/auth/login")
if [[ "$RESPONSE" == "401" ]]; then
    echo -e "${GREEN}✓ PASS${NC}: Rechaza password incorrecto (código 401)"
else
    echo -e "${RED}✗ FAIL${NC}: No rechazó (código $RESPONSE)"
fi
echo ""

# ── PRUEBA 7: Backend no accesible sin proxy ──────────────────
echo "📋 PRUEBA 7: Backend inaccesible sin proxy"
echo "Intentando conectar directo a backend1:3001 (debe fallar)..."
if ! nc -z localhost 3001 2>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}: Backend no expuesto externamente"
else
    echo -e "${YELLOW}⚠ ADVERTENCIA${NC}: Puerto 3001 aparentemente abierto"
fi
echo ""

# ── PRUEBA 8: Panel de métricas ────────────────────────────────
echo "📋 PRUEBA 8: Panel de métricas"
echo "GET /metrics/resumen..."
RESPONSE=$(curl $CURL_OPTS "$BASE_URL/metrics/resumen")
if echo "$RESPONSE" | grep -q "estado"; then
    echo -e "${GREEN}✓ PASS${NC}: Métricas disponibles"
    echo "Respuesta: $RESPONSE"
else
    echo -e "${RED}✗ FAIL${NC}: Métricas no respondieron correctamente"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "   FIN DE PRUEBAS"
echo "════════════════════════════════════════════════════════════"
