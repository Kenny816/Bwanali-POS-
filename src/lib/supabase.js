import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://mnzvafeobjgzqiugbawu.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_Sw3y9HZgfU-7ZazsbTGq1w_tQIuc7i3';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
