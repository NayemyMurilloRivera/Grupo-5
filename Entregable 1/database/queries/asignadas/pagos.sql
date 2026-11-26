-- Consultas reales del módulo pagos. Parámetros: $1.. según se indica.

-- Q1. Bloqueo de la obligación antes de calcular saldo (createPayment). $1 = id_obligacion
SELECT id_obligacion, importe FROM sis_god."OBLIGACION" WHERE id_obligacion = $1 FOR UPDATE;

-- Q2. Pagos por obligación (saldo). $1 = id_obligacion
SELECT COALESCE(SUM(importe), 0) AS total FROM sis_god."PAGO" WHERE id_obligacion = $1;

-- Q3. Estado de cuenta: pagos preagrupados por obligación ANTES del JOIN (no multiplica importes). $1 = id_paciente
WITH pagado AS (SELECT id_obligacion, SUM(importe) AS total FROM sis_god."PAGO" GROUP BY id_obligacion)
SELECT o.id_obligacion, o.importe AS obligado, COALESCE(g.total, 0) AS pagado, o.importe - COALESCE(g.total, 0) AS saldo
FROM sis_god."OBLIGACION" o
JOIN sis_god."PRESUPUESTO" pr ON pr.id_presupuesto = o.id_presupuesto
JOIN sis_god."PLAN_TRATAMIENTO" pl ON pl.id_plan = pr.id_plan
JOIN sis_god."HISTORIA_CLINICA" h ON h.id_historia = pl.id_historia
LEFT JOIN pagado g ON g.id_obligacion = o.id_obligacion
WHERE h.id_paciente = $1 ORDER BY o.id_obligacion;

-- Q4. Reporte de cuentas por cobrar (GROUP BY + HAVING). $1 = desde (o NULL), $2 = hasta (o NULL), $3 = saldoMinimo
WITH pagado AS (SELECT id_obligacion, SUM(importe) AS total FROM sis_god."PAGO" GROUP BY id_obligacion)
SELECT pa.id_paciente, pa.nombres || ' ' || pa.apellidos AS paciente, COUNT(*) AS obligaciones,
       SUM(o.importe) AS obligado, SUM(COALESCE(g.total, 0)) AS pagado, SUM(o.importe - COALESCE(g.total, 0)) AS saldo
FROM sis_god."OBLIGACION" o
JOIN sis_god."PRESUPUESTO" pr ON pr.id_presupuesto = o.id_presupuesto
JOIN sis_god."PLAN_TRATAMIENTO" pl ON pl.id_plan = pr.id_plan
JOIN sis_god."HISTORIA_CLINICA" h ON h.id_historia = pl.id_historia
JOIN sis_god."PACIENTE" pa ON pa.id_paciente = h.id_paciente
LEFT JOIN pagado g ON g.id_obligacion = o.id_obligacion
WHERE ($1::date IS NULL OR o.fecha_emision >= $1::date) AND ($2::date IS NULL OR o.fecha_emision <= $2::date)
GROUP BY pa.id_paciente, pa.nombres, pa.apellidos
HAVING SUM(o.importe - COALESCE(g.total, 0)) >= $3::numeric
ORDER BY SUM(o.importe - COALESCE(g.total, 0)) DESC, pa.id_paciente;

-- Q5. Siguiente número de documento, serializado por serie (el bloqueo dura hasta el COMMIT). $1 = 'pagos:boleta:B001'
SELECT pg_advisory_xact_lock(hashtextextended($1, 0));
SELECT COALESCE(MAX(numero), 0) + 1 FROM sis_god."BOLETA" WHERE serie = 'B001';
