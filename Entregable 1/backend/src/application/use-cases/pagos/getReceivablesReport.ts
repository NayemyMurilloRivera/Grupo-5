import { sumTotals, type ReceivablesFilters } from '../../../domain/pagos/entities.js'
import type { PaymentsRepository } from '../../ports/pagos.repository.js'
/** JSON y CSV salen de este mismo resultado: mismos filtros y mismos totales. */
export async function getReceivablesReport(repo: PaymentsRepository, filters: ReceivablesFilters) {
  const items = await repo.receivables({ desde: filters.desde, hasta: filters.hasta, saldoMinimo: filters.saldoMinimo })
  return { filtros: filters, items, totales: sumTotals(items) }
}
const CSV_HEAD = ['id_paciente', 'paciente', 'obligaciones', 'obligado', 'pagado', 'saldo']
// Evita que Excel interprete una celda de texto como fórmula.
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? "'" + value : value
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}
export function toCsv(report: Awaited<ReturnType<typeof getReceivablesReport>>): string {
  const lines = [CSV_HEAD.join(',')]
  for (const row of report.items) lines.push(CSV_HEAD.map(k => cell(String(row[k as keyof typeof row]))).join(','))
  const t = report.totales
  lines.push(['TOTAL', '', t.obligaciones, t.obligado, t.pagado, t.saldo].map(cell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
