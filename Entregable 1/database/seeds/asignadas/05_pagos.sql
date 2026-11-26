-- Semilla de ensayo: SOLO en una base de pruebas (sis_god_prueba), nunca en el Supabase compartido.
-- Requiere una obligación existente (la crea el módulo de planes). Deja dos abonos de 30 y 20.
BEGIN;
INSERT INTO sis_god."PAGO" (fecha_hora, importe, referencia, id_obligacion, id_metodopago)
SELECT LOCALTIMESTAMP, v.importe, 'semilla-pagos', o.id_obligacion, (SELECT MIN(id_metodopago) FROM sis_god."METODO_PAGO")
FROM (SELECT id_obligacion FROM sis_god."OBLIGACION" ORDER BY id_obligacion LIMIT 1) o
CROSS JOIN (VALUES (30.00::numeric), (20.00::numeric)) AS v(importe)
WHERE NOT EXISTS (SELECT 1 FROM sis_god."PAGO" WHERE referencia = 'semilla-pagos');
COMMIT;
