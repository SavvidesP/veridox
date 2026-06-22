import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://daulxapmeckxsyhircbn.supabase.co'
const supabaseAnonKey = 'sb_publishable_ipNGBD8g_ncDIXze2vjCkA_S0EStRIJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
