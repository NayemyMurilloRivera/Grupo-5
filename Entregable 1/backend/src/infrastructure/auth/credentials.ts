import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
const version = 'scrypt-v1'
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

async function key(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await key(password, salt)
  return [version, salt.toString('hex'), hash.toString('hex')].join('$')
}

export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const format = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored ?? '')
  const salt = format ? Buffer.from(format[1], 'hex') : Buffer.alloc(16)
  const expected = format ? Buffer.from(format[2], 'hex') : Buffer.alloc(32)
  const matches = timingSafeEqual(await key(password, salt), expected)
  return Boolean(format) && matches
}
