-- Pruebas de restricciones del módulo pagos. Ejecutar SOLO en una base de pruebas con el esquema y las semillas.
-- Cada bloque debe terminar en NOTICE 'OK ...'; cualquier excepción inesperada indica un fallo. Todo se revierte.
BEGIN;
DO $$
DECLARE v_obl BIGINT; v_met BIGINT; v_pago BIGINT;
BEGIN
  SELECT id_obligacion INTO v_obl FROM sis_god."OBLIGACION" ORDER BY 1 LIMIT 1;
  SELECT id_metodopago INTO v_met FROM sis_god."METODO_PAGO" ORDER BY 1 LIMIT 1;
  IF v_obl IS NULL THEN RAISE EXCEPTION 'Se necesita al menos una obligación de ensayo'; END IF;

  BEGIN INSERT INTO sis_god."PAGO"(fecha_hora, importe, id_obligacion, id_metodopago) VALUES (now(), 0, v_obl, v_met);
    RAISE EXCEPTION 'FALLO: aceptó importe 0'; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK importe > 0'; END;

  INSERT INTO sis_god."PAGO"(fecha_hora, importe, id_obligacion, id_metodopago) VALUES (LOCALTIMESTAMP, 1, v_obl, v_met) RETURNING id_pago INTO v_pago;

  INSERT INTO sis_god."BOLETA"(serie, numero, fecha_emision, id_pago) VALUES ('T001', 1, CURRENT_DATE, v_pago);
  BEGIN INSERT INTO sis_god."BOLETA"(serie, numero, fecha_emision, id_pago) VALUES ('T001', 1, CURRENT_DATE, v_pago);
    RAISE EXCEPTION 'FALLO: aceptó boleta duplicada'; EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK numeración única de boleta'; END;

  BEGIN INSERT INTO sis_god."FACTURA"(serie, numero, fecha_emision, razon_social_receptor, ruc_receptor, id_pago) VALUES ('F001', 1, CURRENT_DATE, 'Prueba SAC', '20123456789', v_pago);
    RAISE EXCEPTION 'FALLO: el pago tiene boleta y factura'; EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF; RAISE NOTICE 'OK boleta y factura excluyentes (%)', SQLSTATE; END;

  BEGIN INSERT INTO sis_god."FACTURA"(serie, numero, fecha_emision, razon_social_receptor, ruc_receptor, id_pago) VALUES ('F001', 2, CURRENT_DATE, 'Prueba SAC', '123', v_pago);
    RAISE EXCEPTION 'FALLO: aceptó RUC inválido'; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK RUC de 11 dígitos'; END;
END $$;
ROLLBACK;
