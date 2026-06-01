-- Personalización del recibo PDF: logo, nombre del negocio y mensaje al pie.
-- Para aplicar: pegar este SQL en Supabase Dashboard -> SQL Editor -> Run.

-- 1. Columnas nuevas en `configuraciones` (idempotente)
ALTER TABLE configuraciones
  ADD COLUMN IF NOT EXISTS nombre_negocio  text,
  ADD COLUMN IF NOT EXISTS logo_url        text,
  ADD COLUMN IF NOT EXISTS contacto        text,
  ADD COLUMN IF NOT EXISTS mensaje_recibo  text;

-- 2. Bucket `logos` (publico para que el PDF pueda leer la imagen sin auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies del bucket
--    - Cualquiera puede VER logos (bucket publico, requerido para el PDF)
--    - Cada usuario solo puede INSERT/UPDATE/DELETE en su propia carpeta {auth.uid()}/
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_owner_insert" ON storage.objects;
CREATE POLICY "logos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "logos_owner_update" ON storage.objects;
CREATE POLICY "logos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "logos_owner_delete" ON storage.objects;
CREATE POLICY "logos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
