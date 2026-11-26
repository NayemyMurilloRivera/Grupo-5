import { createHmac, timingSafeEqual } from 'node:crypto'
import { positiveId } from '../../domain/seguridad/entities.js'
import { SecurityError } from '../../domain/seguridad/errors.js'

const issuer = 'sis-god'
const audience = 'sis-god-api'
const lifetime = 3600
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
const encodedDigest = /^[A-Za-z0-9_-]{43}$/

interface Claims { iss: string; aud: string; sub: string; iat: number; exp: number; ver: string }

function secret(): Buffer {
  const key = process.env.AUTH_TOKEN_SECRET
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new SecurityError(503, 'AUTENTICACION_NO_CONFIGURADA', 'Configure la clave de firma del servidor.')
  }
  return Buffer.from(key, 'hex')
}

function sign(value: string, key: Buffer) {
  return createHmac('sha256', key).update(value).digest('base64url')
}

function credentialVersion(credential: string, key: Buffer) {
  return sign('sis-god:credencial:' + credential, key)
}

function matchDigest(expected: string, received: string) {
  return encodedDigest.test(received) && timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export function issueToken(userId: string, credential: string, now = Math.floor(Date.now() / 1000)) {
  const key = secret()
  const claims: Claims = { iss: issuer, aud: audience, sub: userId, iat: now, exp: now + lifetime, ver: credentialVersion(credential, key) }
  const input = header + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url')
  return input + '.' + sign(input, key)
}

export function verifyToken(token: string, now = Math.floor(Date.now() / 1000)): Claims | null {
  if (token.length > 1024) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== header || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !encodedDigest.test(parts[2])) return null
  const [encodedHeader, payload, signature] = parts
  if (!matchDigest(sign(encodedHeader + '.' + payload, secret()), signature)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims
    if (claims?.iss !== issuer || claims.aud !== audience || typeof claims.sub !== 'string' || !positiveId(claims.sub) ||
        !Number.isSafeInteger(claims.iat) || claims.iat > now || claims.exp !== claims.iat + lifetime || claims.exp <= now ||
        typeof claims.ver !== 'string' || !encodedDigest.test(claims.ver)) return null
    return claims
  } catch {
    return null
  }
}

export function matchesCredential(claims: Claims, credential: string): boolean {
  return matchDigest(credentialVersion(credential, secret()), claims.ver)
}
