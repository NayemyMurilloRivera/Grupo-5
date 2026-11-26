import type { AuthContext } from '../../../domain/seguridad/entities.js'

export function getMe(context: AuthContext) {
  const { permisos, ...user } = context
  return { user, permisos }
}
