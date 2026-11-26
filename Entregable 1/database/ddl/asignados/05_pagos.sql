-- Pagos (Rodrigo). El esquema base ya trae PAGO, METODO_PAGO, BOLETA y FACTURA con sus PK, FK, CHECK y UNIQUE.
-- Único ajuste: índice candidato para sumar abonos por obligación (saldo, estado de cuenta y reporte).
-- Se aplica UNA sola vez, coordinado con el equipo, solo después de medir con database/benchmarks/asignados/pagos.sql.
CREATE INDEX IF NOT EXISTS idx_pago_obligacion ON sis_god."PAGO" (id_obligacion);
