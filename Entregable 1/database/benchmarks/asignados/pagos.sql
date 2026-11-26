-- Benchmark del índice idx_pago_obligacion. SOLO en la base de pruebas (nunca en Supabase compartido).
-- Requisito: tener cargadas las obligaciones de ensayo (generar_datos.sql / planes). Usa SIEMPRE los mismos datos y consulta.
-- 1) Carga ~200 000 abonos repartidos entre las obligaciones existentes.
INSERT INTO sis_god."PAGO"(fecha_hora, importe, referencia, id_obligacion, id_metodopago)
SELECT LOCALTIMESTAMP, 0.01, 'bench-pagos',
       (SELECT id_obligacion FROM sis_god."OBLIGACION" ORDER BY id_obligacion OFFSET (g % (SELECT COUNT(*) FROM sis_god."OBLIGACION")) LIMIT 1),
       (SELECT MIN(id_metodopago) FROM sis_god."METODO_PAGO")
FROM generate_series(1, 200000) g;
DROP INDEX IF EXISTS sis_god.idx_pago_obligacion;
ANALYZE sis_god."PAGO";

-- 2) ANTES (sin índice). Parámetro: una obligación existente.
EXPLAIN (ANALYZE, BUFFERS)
SELECT COALESCE(SUM(importe), 0) FROM sis_god."PAGO" WHERE id_obligacion = (SELECT MIN(id_obligacion) FROM sis_god."OBLIGACION");

-- 3) Se crea el índice candidato y se repite exactamente la misma consulta.
CREATE INDEX idx_pago_obligacion ON sis_god."PAGO" (id_obligacion);
ANALYZE sis_god."PAGO";

-- 4) DESPUÉS.
EXPLAIN (ANALYZE, BUFFERS)
SELECT COALESCE(SUM(importe), 0) FROM sis_god."PAGO" WHERE id_obligacion = (SELECT MIN(id_obligacion) FROM sis_god."OBLIGACION");
-- Registrar en el informe: plan (Seq Scan vs Index/Bitmap Scan), "Execution Time" y "Buffers" de ambos. No afirmar mejora sin estos números.

-- 5) Limpieza.
DELETE FROM sis_god."PAGO" WHERE referencia = 'bench-pagos';
