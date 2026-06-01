import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { TEST_USER } from './fixtures'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

/**
 * Global setup: limpia la data del test user antes de cada corrida.
 * Usa supabase-js + login del test user para borrar via RLS.
 *
 * Asume que el SQL `setup_test_user.sql` se corrio al menos una vez.
 */
export default async function globalSetup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('⚠️  Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // 1. Login del test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  })

  if (authError || !authData.user) {
    console.error(
      `\n⚠️  No se pudo loguear como ${TEST_USER.email}.\n` +
      `   Corré primero el SQL: tests/sql/setup_test_user.sql\n` +
      `   Error: ${authError?.message ?? 'usuario no encontrado'}\n`
    )
    process.exit(1)
  }

  const userId = authData.user.id

  // 2. Limpiar data en orden por FKs
  const tablesInOrder = ['pagos', 'clientes', 'servicios', 'configuraciones']
  for (const table of tablesInOrder) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('usuario_id', userId)
    if (error) {
      console.error(`⚠️  Error limpiando ${table}: ${error.message}`)
    }
  }

  // 3. Logout
  await supabase.auth.signOut()

  console.log(`✓ Test user ${TEST_USER.email} reseteado a estado limpio`)
}
