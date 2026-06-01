-- RPC atomica para registrar un pago: inserta en `pagos` + actualiza el cliente
-- en una sola transaccion. Si cualquier paso falla, ambos se revierten.
--
-- Antes: el frontend hacia 2 calls separadas, y si la 2da fallaba el pago
-- quedaba registrado pero el cliente seguia marcado como deudor.
--
-- Para aplicar: pegar en Supabase Dashboard -> SQL Editor -> Run.

CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_cliente_id uuid,
  p_monto      numeric,
  p_metodo     text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- corre como el usuario que llama => respeta RLS
SET search_path = public
AS $$
DECLARE
  v_pago_id      uuid;
  v_fecha_pago   timestamptz;
  v_venc_actual  date;
  v_venc_nuevo   date;
BEGIN
  -- 1. Validar entrada
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0' USING ERRCODE = '22023';
  END IF;
  IF p_metodo IS NULL OR length(trim(p_metodo)) = 0 THEN
    RAISE EXCEPTION 'El metodo de pago es requerido' USING ERRCODE = '22023';
  END IF;

  -- 2. Lockear el cliente + validar ownership.
  --    RLS ya filtra por usuario_id, pero igualmente devolvemos
  --    "no encontrado" si alguien intenta pagar de otro tenant.
  SELECT fecha_vencimiento INTO v_venc_actual
  FROM clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin permisos' USING ERRCODE = '42501';
  END IF;

  -- 3. Insertar el pago
  INSERT INTO pagos (cliente_id, usuario_id, monto_pagado, metodo_pago)
  VALUES (p_cliente_id, auth.uid(), p_monto, p_metodo)
  RETURNING id, fecha_pago INTO v_pago_id, v_fecha_pago;

  -- 4. Calcular nuevo vencimiento (+1 mes calendario sobre el vencimiento previo)
  v_venc_nuevo := v_venc_actual + INTERVAL '1 month';

  -- 5. Actualizar el cliente
  UPDATE clientes
  SET estado = 'al_dia',
      fecha_vencimiento = v_venc_nuevo
  WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'fecha_pago', v_fecha_pago,
    'nueva_fecha_vencimiento', v_venc_nuevo
  );
END;
$$;

-- Permitir que usuarios autenticados puedan ejecutarla
REVOKE EXECUTE ON FUNCTION public.registrar_pago(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_pago(uuid, numeric, text) TO authenticated;
