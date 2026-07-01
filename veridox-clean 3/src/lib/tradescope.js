import { createClient } from '@supabase/supabase-js';

// Second Supabase client → the TradeScope project (separate DB from Veridox).
// Used to read/subscribe to live trading data (trader_accounts, trades) and,
// later, to apply trading adjustments. Veridox users do NOT authenticate here,
// so session persistence is disabled to avoid clashing with the Veridox auth client.
const tradescopeUrl = 'https://atqucerzdqzchdgylmfo.supabase.co';
const tradescopeAnonKey = 'sb_publishable_znSIOy8SHNmOb8pfeQtIRg_NY5wPGxK';

export const tradescope = createClient(tradescopeUrl, tradescopeAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
