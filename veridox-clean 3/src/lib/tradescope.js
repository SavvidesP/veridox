import { createClient } from '@supabase/supabase-js';

// Second Supabase client → the TradeScope project (separate DB from Veridox).
// Used to read/subscribe to live trading data (trader_accounts, trades) and,
// later, to apply trading adjustments. Veridox users do NOT authenticate here,
// so session persistence is disabled to avoid clashing with the Veridox auth client.
const tradescopeUrl = 'https://atqucerzdqzchdgylmfo.supabase.co';
const tradescopeAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cXVjZXJ6ZHF6Y2hkZ3lsbWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTMzMjYsImV4cCI6MjA5Nzk2OTMyNn0.rI3v-lVdsSX2VQUyVxYE4A4EsDsYlexTz5llVsqbx7I';

export const tradescope = createClient(tradescopeUrl, tradescopeAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
