-- SQL para crear un usuario de prueba E2E.
-- Email: test-e2e@cobrogest.test
-- Pass:  TestE2E2026!
--
-- Para correr: Supabase Dashboard -> SQL Editor -> Run.
-- IDEMPOTENTE: si el user ya existe, lo deja como está.

DO $$
DECLARE
  v_email      text := 'test-e2e@cobrogest.test';
  v_password   text := 'TestE2E2026!';
  v_user_id    uuid;
  v_already    bool;
BEGIN
  -- 1. Verificar si ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  v_already := v_user_id IS NOT NULL;

  IF v_already THEN
    RAISE NOTICE 'Usuario de prueba ya existe (id=%)', v_user_id;
  ELSE
    -- 2. Insertar en auth.users directamente con password bcrypt
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),                                                  -- email confirmado (sin step de mail)
      '{"provider":"email","providers":["email"]}'::jsonb,
      NOW(), NOW(),
      '', '', '', ''
    ) RETURNING id INTO v_user_id;
    RAISE NOTICE '✓ Usuario de prueba creado (id=%)', v_user_id;
  END IF;

  -- 3. Asegurar que está en usuarios_aprobados
  INSERT INTO usuarios_aprobados (email)
  VALUES (v_email)
  ON CONFLICT (email) DO NOTHING;

  -- 4. Asegurar que tiene suscripción trial activa
  INSERT INTO suscripciones (usuario_id, tipo, vence_el)
  VALUES (v_user_id, 'trial', (CURRENT_DATE + INTERVAL '90 days')::date)
  ON CONFLICT (usuario_id) DO UPDATE
    SET tipo = 'trial', vence_el = (CURRENT_DATE + INTERVAL '90 days')::date;

  -- 5. Resetear data del test user (para que arranque limpio en cada test run)
  DELETE FROM pagos          WHERE usuario_id = v_user_id;
  DELETE FROM clientes       WHERE usuario_id = v_user_id;
  DELETE FROM servicios      WHERE usuario_id = v_user_id;
  DELETE FROM configuraciones WHERE usuario_id = v_user_id;

  RAISE NOTICE 'OK. Email=% Password=%', v_email, v_password;
END $$;
