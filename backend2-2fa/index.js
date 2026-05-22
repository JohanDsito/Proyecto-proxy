const express   = require('express')
const helmet    = require('helmet')
const jwt       = require('jsonwebtoken')
const speakeasy = require('speakeasy')

const app    = express()
const SECRET = process.env.JWT_SECRET || 'miClaveSecretaSuperSegura2024'


app.use(helmet({
    contentSecurityPolicy: false
}))
app.use(express.json())

// ── Usuario de prueba con 2FA pre-configurado ─────────────────
// En producción esto estaría en una base de datos
// ── Página de login (GET)
// ── Página de login mejorada
app.get('/auth/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - Proxy Inverso</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
                       color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .login-box { background: rgba(30, 41, 59, 0.8); padding: 40px; border-radius: 12px; 
                            width: 350px; border: 1px solid #334155; backdrop-filter: blur(10px); }
                h1 { text-align: center; margin-bottom: 30px; font-size: 1.8em; }
                input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #334155; 
                        border-radius: 6px; background: #1e293b; color: white; font-size: 1em; }
                input:focus { outline: none; border-color: #3b82f6; }
                button { width: 100%; padding: 12px; margin-top: 15px; background: #3b82f6; color: white; 
                        border: none; border-radius: 6px; cursor: pointer; font-size: 1.1em; font-weight: bold; }
                button:hover { background: #60a5fa; }
                .info { color: #94a3b8; font-size: 0.9em; margin-top: 20px; padding-top: 20px; border-top: 1px solid #334155; }
                .info strong { color: #60a5fa; }
                .message { padding: 15px; margin-top: 15px; border-radius: 6px; text-align: center; display: none; }
                .message.success { background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e; display: block; }
                .message.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; display: block; }
                .step-indicator { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h1>🔐 Login</h1>
                <div id="step1">
                    <div class="step-indicator">PASO 1 de 2: Credenciales</div>
                    <input type="text" id="username" placeholder="Usuario" value="admin">
                    <input type="password" id="password" placeholder="Contraseña" value="1234">
                    <button onclick="login()">Continuar a 2FA</button>
                    <div class="info">
                        <strong>Demo:</strong> Usuario: <strong>admin</strong>, Contraseña: <strong>1234</strong>
                    </div>
                </div>
                <div id="step2" style="display:none;">
                    <div class="step-indicator">PASO 2 de 2: Código 2FA</div>
                    <input type="text" id="codigo" placeholder="Código 2FA (6 dígitos)" maxlength="6">
                    <button onclick="verificar2fa()">Verificar 2FA</button>
                    <div class="info">
                        Abre <strong>Google Authenticator</strong> en tu teléfono y copia el código
                    </div>
                </div>
                <div id="message" class="message"></div>
            </div>

            <script>
                async function login() {
                    const username = document.getElementById('username').value;
                    const password = document.getElementById('password').value;
                    
                    const res = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    
                    if (res.ok) {
                        document.getElementById('step1').style.display = 'none';
                        document.getElementById('step2').style.display = 'block';
                        showMessage('✅ Credenciales correctas. Ingresa el código 2FA.', 'success');
                    } else {
                        showMessage('❌ Credenciales incorrectas', 'error');
                    }
                }

                async function verificar2fa() {
                    const username = document.getElementById('username').value;
                    const codigo = document.getElementById('codigo').value;
                    
                    if (codigo.length !== 6) {
                        showMessage('❌ El código debe tener 6 dígitos', 'error');
                        return;
                    }
                    
                    const res = await fetch('/auth/verificar-2fa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, codigo })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        showMessage('✅ Autenticación exitosa. Token: ' + data.token.substring(0, 30) + '...', 'success');
                        console.log('JWT Token:', data.token);
                        setTimeout(() => {
                            alert('Autenticación completada. Tu JWT está en la consola (F12)');
                        }, 500);
                    } else {
                        showMessage('❌ Código 2FA inválido', 'error');
                        document.getElementById('codigo').value = '';
                    }
                }

                function showMessage(msg, type) {
                    const el = document.getElementById('message');
                    el.textContent = msg;
                    el.className = 'message ' + type;
                }

                // Permitir Enter en inputs
                document.getElementById('password').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') login();
                });
                document.getElementById('codigo').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') verificar2fa();
                });
            </script>
        </body>
        </html>
    `)
})
// Secret 2FA fijo (predeterminado para pruebas)
const SECRET_2FA = {
    base32: 'JBSWY3DPEBLW64TMMQ======',
    otpauth_url: 'otpauth://totp/ProxyProyecto?secret=JBSWY3DPEBLW64TMMQ======'
}

const usuarios = {
    'admin': {
        password: '1234',
        secret2fa: SECRET_2FA.base32
    }
}

console.log('=== ESCANEA ESTE CÓDIGO EN GOOGLE AUTHENTICATOR ===')
console.log('Secret 2FA (base32):', SECRET_2FA.base32)
console.log('URL OTP:', SECRET_2FA.otpauth_url)
console.log('====================================================')

// ── Paso 1 del login: usuario + contraseña ────────────────────
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body

    const user = usuarios[username]
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    // Si es válido, pedimos el código 2FA
    res.json({
        mensaje: 'Credenciales correctas. Ingresa el código 2FA.',
        paso: 2
    })
})

// ── Paso 2 del login: validar código 2FA y emitir JWT ─────────
app.post('/auth/verificar-2fa', (req, res) => {
    const { username, codigo } = req.body

    const user = usuarios[username]
    if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    const valido = speakeasy.totp.verify({
        secret:   user.secret2fa,
        encoding: 'base32',
        token:    codigo,
        window:   2          // permite 30s de tolerancia
    })

    if (!valido) {
        return res.status(401).json({ error: 'Código 2FA inválido' })
    }

    // Emitir JWT con expiración de 1 hora
    const token = jwt.sign(
        { username, rol: 'usuario' },
        SECRET,
        { expiresIn: '1h' }
    )

	// Registrar la autenticación exitosa en backend1
    fetch('http://backend1:3001/metrics/record-auth', {
    	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ username })
    }).catch(err => console.log('Nota: No se pudo registrar en backend1', err.message))
    res.json({
        mensaje: 'Autenticación completa',
        token,
        expira_en: '1 hora'
    })
})

app.listen(3002, () => console.log('Backend 2FA corriendo en puerto 3002'))
