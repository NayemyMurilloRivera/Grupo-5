import type { SecurityRepository } from '../../ports/seguridad.repository.js'
import { accountIdentity } from '../../../domain/seguridad/entities.js'
import { SecurityError } from '../../../domain/seguridad/errors.js'
import { verifyPassword } from '../../../infrastructure/auth/credentials.js'
import { issueToken } from '../../../infrastructure/auth/tokens.js'

export async function login(repo: SecurityRepository, field: 'correo' | 'nombre_acceso', identifier: string, password: string) {
  const account = await repo.findByLogin(field, identifier)
  const valid = await verifyPassword(password, account?.credencial_acceso)
  const user = account && accountIdentity(account)
  if (!valid || !user || !account) throw new SecurityError(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos.')
  return { token: issueToken(user.idUsuario, account.credencial_acceso), user }
}
