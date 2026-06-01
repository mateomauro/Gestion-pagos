-- Cron diario que actualiza estados de clientes según fecha_vencimiento.
--
-- Reglas:
--   1. estado='al_dia' con fecha_vencimiento <= hoy  -> pasa a 'pendiente'
--      (el cuota del nuevo periodo es debida)
--   2. estado='pendiente' con fecha_vencimiento < hoy -> pasa a 'vencido'
--      (no pagó a tiempo)
--
-- Sin grace period: si vence hoy y no pagó, mañana ya esta vencido.
-- El cron corre 1 vez por dia.
--
-- Para aplicar:
--   1. Habilitar extension `pg_cron` en Supabase Dashboard -> Database -> Extensions
--   2. Pegar este SQL en SQL Editor -> Run

-- =====================================================================
-- 1. La función que hace el trabajo
-- =====================================================================

CREATE OR REPLACE FUNCTION public.actualizar_estados_vencidos()
RETURNS TABLE(pendientes_creados int, vencidos_creados int)
LANGUAGE plpgsql
SECURITY DEFINER  -- corre como service: ignora RLS para iterar todos los clientes
SET search_path = public
AS $$
DECLARE
  v_pend int := 0;
  v_venc int := 0;
BEGIN
  -- al_dia con vencimiento llegado -> pendiente
  WITH actualizados AS (
    UPDATE clientes
    SET estado = 'pendiente'
    WHERE estado = 'al_dia'
      AND fecha_vencimiento <= CURRENT_DATE
    RETURNING id
  )
  SELECT count(*) INTO v_pend FROM actualizados;

  -- pendiente con vencimiento pasado -> vencido
  WITH actualizados AS (
    UPDATE clientes
    SET estado = 'vencido'
    WHERE estado = 'pendiente'
      AND fecha_vencimiento < CURRENT_DATE
    RETURNING id
  )
  SELECT count(*) INTO v_venc FROM actualizados;

  RETURN QUERY SELECT v_pend, v_venc;
END;
$$;

-- =====================================================================
-- 2. Programar via pg_cron: todos los días a las 03:00 UTC (00:00 ARG)
-- =====================================================================

-- Limpia jobs previos con el mismo nombre (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('actualizar-estados-clientes');
EXCEPTION
  WHEN OTHERS THEN NULL;  -- si no existe, ignorar
END $$;

SELECT cron.schedule(
  'actualizar-estados-clientes',
  '0 3 * * *',  -- 03:00 UTC todos los días = 00:00 hora ARG
  $$ SELECT public.actualizar_estados_vencidos(); $$
);

-- =====================================================================
-- 3. Correr ya una vez para arrancar con estados al dia
-- =====================================================================
SELECT * FROM public.actualizar_estados_vencidos();
