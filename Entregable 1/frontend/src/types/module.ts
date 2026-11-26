import type { Role } from './session'
export type Row = Record<string, unknown>
export interface Field { key: string; label: string; type?: string; required?: boolean }
export interface LoadContext { token: string; role: Role; resourceId: string }
export interface Module {
 id: string; title: string; caption: string; path: string; createPath?: string; idLabel?: string; action?: string
 columns: [string, string][]; fields?: Field[]
 load: (context: LoadContext) => Promise<Row[]>
 create?: (values: Record<string, unknown>, token: string) => Promise<unknown>
 download?: (token: string) => Promise<void>
}
