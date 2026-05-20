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
