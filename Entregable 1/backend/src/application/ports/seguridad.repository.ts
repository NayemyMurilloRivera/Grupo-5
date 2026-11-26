import type { Account, AccountFilters, AccountInput, AccountPatch, AuthenticatedAccount, Permission, Role } from '../../domain/seguridad/entities.js'

export type StoredAccountInput = Omit<AccountInput, 'password'> & { credencial_acceso: string }
export type StoredAccountPatch = Omit<AccountPatch, 'password'> & { credencial_acceso?: string }

export interface SecurityRepository {
  findByLogin(field: 'correo' | 'nombre_acceso', value: string): Promise<AuthenticatedAccount | null>
  findById(id: string): Promise<AuthenticatedAccount | null>
  listRoles(): Promise<(Role & { permisos: Permission[] })[]>
  listPermissions(): Promise<Permission[]>
  listUsers(filters: AccountFilters): Promise<Account[]>
  withAdministration<T>(actorId: string, work: (repo: SecurityWrites, adminRoleId: string) => Promise<T>): Promise<T>
}

export interface SecurityWrites {
  findRole(id: string): Promise<Role | null>
  createUser(input: StoredAccountInput): Promise<Account>
  updateUser(id: string, input: StoredAccountPatch): Promise<Account>
  getUserForUpdate(id: string): Promise<Account | null>
  hasOtherAdministrator(roleId: string, userId: string): Promise<boolean>
  replaceRolePermissions(roleId: string, permissionIds: string[]): Promise<void>
}
