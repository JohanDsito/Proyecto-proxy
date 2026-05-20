const express   = require('express')
const helmet    = require('helmet')
const jwt       = require('jsonwebtoken')
const speakeasy = require('speakeasy')

const app    = express()
const SECRET = process.env.JWT_SECRET || 'miClaveSecretaSuperSegura2024'

app.use(helmet())
app.use(express.json())

// ── Usuario de prueba con 2FA pre-configurado ─────────────────
// En producción esto estaría en una base de datos
// ── Página de login (GET)
app.get('/auth/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - Proxy Inverso</title>
            <style>
                body { font-family: Arial; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
                       color: white; display: flex; justify-content: center; align-items: center; 
                       height: 100vh; margin: 0; }
                .login-box { background: rgba(30, 41, 59, 0.5); padding: 40px; border-radius: 12px; 
                            width: 300px; border: 1px solid #334155; }
                h1 { text-align: center; margin-top: 0; }
                input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #334155; 
                        border-radius: 6px; background: #1e293b; color: white; }
                button { width: 100%; padding: 12px; background: #3b82f6; color: white; 
                        border: none; border-radius: 6px; cursor: pointer; font-size: 1.1em; }
                button:hover { background: #60a5fa; }
                .info { color: #94a3b8; font-size: 0.9em; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h1>🔐 Login</h1>
                <form id="loginForm">
                    <input type="text" id="username" placeholder="Usuario" value="admin" required>
                    <input type="password" id="password" placeholder="Contraseña" value="1234" required>
                    <button type="submit">Continuar a 2FA</button>
                    <div class="info">
                        Usuario: <b>admin</b><br>
                        Contraseña: <b>1234</b>
                    </div>
                </form>
                <script>
                    document.getElementById('loginForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const username = document.getElementById('username').value;
                        const password = document.getElementById('password').value;
                        
                        const res = await fetch('/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password })
                        });
                        
                        if (res.ok) {
                            alert('Credenciales correctas. Ahora ingresa el código 2FA en el navegador de desarrollador.');
                            console.log(await res.json());
                        } else {
                            alert('Credenciales incorrectas');
                        }
                    });
                </script>
            </div>
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
