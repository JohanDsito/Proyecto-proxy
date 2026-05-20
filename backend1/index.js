const express = require('express')
const helmet  = require('helmet')
const jwt     = require('jsonwebtoken')

const app    = express()
const SECRET = process.env.JWT_SECRET || 'miClaveSecretaSuperSegura2024'

app.use(helmet({
    contentSecurityPolicy: false
}))
// ── Ruta raíz - redirige al dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Proxy Inverso - Grupo 5</title>
            <style>
                body { font-family: Arial; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
                       color: white; display: flex; justify-content: center; align-items: center; 
                       height: 100vh; margin: 0; }
                .container { text-align: center; }
                h1 { font-size: 2.5em; margin: 0; }
                p { font-size: 1.2em; color: #94a3b8; }
                .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; 
                       background: #3b82f6; color: white; text-decoration: none; 
                       border-radius: 6px; font-size: 1.1em; }
                .btn:hover { background: #60a5fa; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🛡️ Proxy Inverso Inteligente</h1>
                <p>Grupo 5 - Ingeniería de Software</p>
                <a href="/metrics/dashboard" class="btn">Ir al Dashboard</a>
            </div>
        </body>
        </html>
    `)
})
app.use(express.json())

// ── Métricas en memoria ────────────────────────────────────────
let metrics = {
    sqli_blocked: 0,
    jwt_rejected: 0,
    successful_auth: 0,
    failed_auth: 0,
    total_requests: 0,
    last_events: []
}

// Función para registrar eventos
function logEvent(type, details) {
    metrics.total_requests++
    metrics.last_events.unshift({
        timestamp: new Date().toISOString(),
        type,
        details
    })
    if (metrics.last_events.length > 50) {
        metrics.last_events.pop()
    }
    
    // También imprimir en logs de Docker
    console.log(`[${type}] ${JSON.stringify(details)}`)
}

// ── Middleware para detectar eventos de Nginx ───────────────────
app.use((req, res, next) => {
    // Nginx puede pasar información en headers personalizados
    const sqliDetected = req.headers['x-sqli-detected']
    const jwtRejected = req.headers['x-jwt-rejected']
    
    if (sqliDetected === '1') {
        metrics.sqli_blocked++
        logEvent('SQLI_BLOCKED', { 
            ip: req.ip,
            uri: req.originalUrl 
        })
    }
    
    if (jwtRejected === '1') {
        metrics.jwt_rejected++
        logEvent('JWT_REJECTED', { 
            ip: req.ip 
        })
    }
    
    next()
})

// ── Middleware: verificar JWT en cada ruta protegida ──────────
function verificarJWT(req, res, next) {
    const auth = req.headers['authorization']
    if (!auth || !auth.startsWith('Bearer ')) {
        metrics.jwt_rejected++
        logEvent('JWT_REJECTED', { ip: req.ip })
        return res.status(401).json({ error: 'Token requerido' })
    }
    try {
        const token = auth.split(' ')[1]
        req.usuario = jwt.verify(token, SECRET)
        next()
    } catch (err) {
        metrics.jwt_rejected++
        logEvent('JWT_INVALID', { ip: req.ip, error: err.message })
        return res.status(401).json({ error: 'Token inválido o expirado' })
    }
}

// ── Ruta de prueba protegida ──────────────────────────────────
app.get('/api/datos', verificarJWT, (req, res) => {
    metrics.successful_auth++
    logEvent('AUTH_SUCCESS', { usuario: req.usuario.username })
    res.json({
        mensaje: 'Acceso concedido al backend1',
        usuario: req.usuario,
        cabeceras_seguridad: 'Helmet activo'
    })
})


// ── Endpoint para registrar SQLi detectado por Nginx
app.get('/metrics/record-sqli', express.json(), (req, res) => {
    const { ip, uri } = req.query
    metrics.sqli_blocked++
    logEvent('SQLI_BLOCKED', { 
        ip: ip || req.ip,
        uri: decodeURIComponent(uri || req.originalUrl)
    })
    res.json({ success: true, message: 'SQLi registrado' })
})

// ── Endpoint para registrar manualmente autenticaciones exitosas
app.post('/metrics/record-auth', express.json(), (req, res) => {
    const { username } = req.body
    metrics.successful_auth++
    logEvent('AUTH_SUCCESS_2FA', { usuario: username })
    res.json({ success: true, message: 'Autenticación registrada' })
})

// ── Panel de métricas en tiempo real ────────────────────────────
app.get('/metrics/resumen', (req, res) => {
    res.json({
        estado: 'proxy activo',
        tls: 'activo',
        sqli_bloqueados: metrics.sqli_blocked,
        jwt_rechazados: metrics.jwt_rejected,
        autenticaciones_exitosas: metrics.successful_auth,
        autenticaciones_fallidas: metrics.failed_auth,
        total_requests: metrics.total_requests,
        timestamp: new Date().toISOString()
    })
})

// ── Endpoint para obtener eventos recientes ────────────────────
app.get('/metrics/eventos', (req, res) => {
    res.json({
        eventos_recientes: metrics.last_events,
        total: metrics.last_events.length
    })
})

// ── HTML del Dashboard ──────────────────────────────────────────
app.get('/metrics/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Métricas - Proxy Inverso</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 40px;
            animation: slideDown 0.6s ease-out;
        }

        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #60a5fa, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: #94a3b8;
            font-size: 1.1em;
        }

        .status-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid #334155;
            border-radius: 6px;
            animation: fadeIn 0.8s ease-out;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #34d399;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5));
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 24px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            animation: slideUp 0.6s ease-out;
            animation-fill-mode: both;
        }

        .metric-card:nth-child(1) { animation-delay: 0.1s; }
        .metric-card:nth-child(2) { animation-delay: 0.2s; }
        .metric-card:nth-child(3) { animation-delay: 0.3s; }
        .metric-card:nth-child(4) { animation-delay: 0.4s; }

        .metric-card:hover {
            border-color: #60a5fa;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8));
            transform: translateY(-5px);
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .metric-label {
            color: #94a3b8;
            font-size: 0.9em;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            background: linear-gradient(135deg, #60a5fa, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .metric-icon {
            font-size: 2em;
            margin-bottom: 12px;
            opacity: 0.7;
        }

        .events-section {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5));
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 24px;
            backdrop-filter: blur(10px);
            animation: slideUp 0.8s ease-out 0.5s both;
        }

        .events-title {
            font-size: 1.3em;
            margin-bottom: 20px;
            color: #60a5fa;
        }

        .event-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(15, 23, 42, 0.3);
            border-left: 3px solid #60a5fa;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 0.95em;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .event-time {
            color: #94a3b8;
            font-size: 0.85em;
        }

        .event-type {
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .event-type.sqli {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            border: 1px solid #ef4444;
        }

        .event-type.jwt {
            background: rgba(245, 158, 11, 0.2);
            color: #fcd34d;
            border: 1px solid #f59e0b;
        }

        .event-type.auth {
            background: rgba(34, 197, 94, 0.2);
            color: #86efac;
            border: 1px solid #22c55e;
        }

        .event-type.api {
            background: rgba(59, 130, 246, 0.2);
            color: #93c5fd;
            border: 1px solid #3b82f6;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: #64748b;
        }

        .refresh-indicator {
            display: inline-block;
            margin-left: 10px;
            font-size: 0.9em;
            color: #34d399;
        }

        .loading {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #34d399;
            border-radius: 50%;
            animation: loading 1.5s infinite;
        }

        @keyframes loading {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🛡️ Panel de Seguridad</h1>
            <p class="subtitle">Proxy Inverso Inteligente - Monitoreo en Tiempo Real</p>
        </header>

        <div class="status-bar">
            <div class="status-item">
                <div class="status-dot"></div>
                <span>Nginx: Activo</span>
            </div>
            <div class="status-item">
                <div class="status-dot"></div>
                <span>TLS: Habilitado</span>
            </div>
            <div class="status-item">
                <div class="status-dot"></div>
                <span>Detección SQLi: Activa</span>
            </div>
            <div class="status-item">
                <div class="status-dot"></div>
                <span>Validación JWT: Activa</span>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-icon">🚫</div>
                <div class="metric-label">SQLi Bloqueados</div>
                <div class="metric-value" id="sqli-count">0</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">🔐</div>
                <div class="metric-label">JWT Rechazados</div>
                <div class="metric-value" id="jwt-count">0</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">✅</div>
                <div class="metric-label">Autenticaciones Exitosas</div>
                <div class="metric-value" id="auth-count">0</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">📊</div>
                <div class="metric-label">Solicitudes Totales</div>
                <div class="metric-value" id="total-count">0</div>
            </div>
        </div>

        <div class="events-section">
            <h2 class="events-title">
                📋 Eventos Recientes
                <span class="refresh-indicator">
                    Actualizando<span class="loading"></span>
                </span>
            </h2>
            <div id="events-container">
                <div class="empty-state">Esperando eventos...</div>
            </div>
        </div>
    </div>

    <script>
        async function updateMetrics() {
            try {
                // Obtener métricas
                const metricsRes = await fetch('/metrics/resumen');
                const metrics = await metricsRes.json();

                document.getElementById('sqli-count').textContent = metrics.sqli_bloqueados;
                document.getElementById('jwt-count').textContent = metrics.jwt_rechazados;
                document.getElementById('auth-count').textContent = metrics.autenticaciones_exitosas;
                document.getElementById('total-count').textContent = metrics.total_requests;

                // Obtener eventos
                const eventsRes = await fetch('/metrics/eventos');
                const eventsData = await eventsRes.json();
                const container = document.getElementById('events-container');

                if (eventsData.eventos_recientes.length === 0) {
                    container.innerHTML = '<div class="empty-state">Sin eventos aún</div>';
                } else {
                    container.innerHTML = eventsData.eventos_recientes
                        .slice(0, 20)
                        .map(event => {
                            const time = new Date(event.timestamp).toLocaleTimeString('es-ES');
                            let typeClass = 'api';
                            let typeLabel = event.type;

                            if (event.type.includes('JWT')) typeClass = 'jwt';
                            if (event.type.includes('SQLI')) typeClass = 'sqli';
                            if (event.type.includes('AUTH')) typeClass = 'auth';

                            return \`
                                <div class="event-item">
                                    <div>
                                        <span class="event-type \${typeClass}">\${typeLabel}</span>
                                        <span style="margin-left: 12px; color: #94a3b8;">\${JSON.stringify(event.details || {})}</span>
                                    </div>
                                    <div class="event-time">\${time}</div>
                                </div>
                            \`;
                        })
                        .join('');
                }
            } catch (error) {
                console.error('Error actualizando métricas:', error);
            }
        }

        // Actualizar cada 2 segundos
        updateMetrics();
        setInterval(updateMetrics, 2000);
    </script>
</body>
</html>
    `)
})

app.listen(3001, () => console.log('Backend1 corriendo en puerto 3001'))
