import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://mnzvafeobjgzqiugbawu.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_Sw3y9HZgfU-7ZazsbTGq1w_tQIuc7i3';
const realClient = createClient(supabaseUrl, supabaseAnonKey);

const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function load(t) {
  try { return JSON.parse(localStorage.getItem('bwanali_' + t) || '[]'); } catch { return []; }
}
function save(t, rows) {
  localStorage.setItem('bwanali_' + t, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent('db-change', { detail: { table: t } }));
  trySync(t);
}

// --- Default admin seed ---
if (!load('staff').length) {
  const storeId = id();
  save('stores', [{
    id: storeId, name: 'My Store', subscription_status: 'trialing',
    trial_started_at: new Date().toISOString(), subscription_plan: 'monthly', locked: false,
  }]);
  save('staff', [{
    id: id(), email: 'admin@bwanali.com', password: 'admin123', pin_code: '1234',
    full_name: 'Store Owner', role: 'admin', is_active: true, store_id: storeId,
    is_inventory_manager: true,
  }]);
  save('company_settings', [{
    id: id(), store_id: storeId, company_name: 'My Store', local_currency: 'ZMW',
    receipt_footer: 'Thank you for your business!', currency_symbol: 'K',
    receipt_header: '', logo_url: '',
  }]);
  save('customers', []); save('sales', []); save('sale_items', []);
  save('cash_shifts', []); save('discount_rules', []); save('returns', []);
  save('laybys', []); save('store_admins', []);
  save('stock_transfers', []);
}

// ---------- Query builder ----------
function queryBuilder(table) {
  const filters = [];
  let orderCol = null, orderAsc = true, limitVal = null, singleMode = false, countMode = false, headOnly = false;

  const apply = () => {
    let rows = load(table);
    rows = rows.filter(r => filters.every(f => {
      try {
        if (f.type === 'eq') return r[f.col] === f.val;
        if (f.type === 'gte') return new Date(r[f.col]) >= new Date(f.val);
        if (f.type === 'lte') return new Date(r[f.col]) <= new Date(f.val);
        if (f.type === 'not') return r[f.col] !== f.val;
        if (f.type === 'is') return r[f.col] === null || r[f.col] === undefined;
        if (f.type === 'in') return f.vals.includes(r[f.col]);
        return true;
      } catch { return false; }
    }));
    if (orderCol) rows.sort((a, b) => (a[orderCol] > b[orderCol] ? 1 : -1) * (orderAsc ? 1 : -1));
    if (limitVal !== null) rows = rows.slice(0, limitVal);
    if (singleMode) return { data: rows[0] || null, error: null };
    const result = { data: headOnly ? [] : rows, error: null };
    if (countMode) result.count = rows.length;
    return result;
  };

  const builder = {
    select: (cols, opts) => { if (opts?.count === 'exact') { countMode = true; if (opts.head) headOnly = true; } return builder; },
    eq: (col, val) => { filters.push({ type: 'eq', col, val }); return builder; },
    gte: (col, val) => { filters.push({ type: 'gte', col, val }); return builder; },
    lte: (col, val) => { filters.push({ type: 'lte', col, val }); return builder; },
    not: (col, val) => { filters.push({ type: 'not', col, val }); return builder; },
    is: (col, val) => { filters.push({ type: 'is', col, val }); return builder; },
    in: (col, vals) => { filters.push({ type: 'in', col, vals }); return builder; },
    order: (col, opts) => { orderCol = col; orderAsc = opts?.ascending !== false; return builder; },
    limit: (n) => { limitVal = n; return builder; },
    single: () => { singleMode = true; return builder; },
    maybeSingle: () => { singleMode = true; return builder; },
    then: (resolve) => Promise.resolve().then(() => apply()).then(resolve),
    catch: () => builder,
  };
  return builder;
}

// ---------- Mutations ----------
function dbInsert(table, payload) {
  const rows = load(table);
  const arr = Array.isArray(payload) ? payload : [payload];
  const newRows = arr.map(d => {
    const base = { id: id(), created_at: new Date().toISOString(), ...d };
    if (table === 'sales' && !base.invoice_number) base.invoice_number = '' + (rows.length + 1);
    return base;
  });
  save(table, [...rows, ...newRows]);
  return {
    data: newRows, error: null,
    select: () => ({ single: () => ({ data: newRows[0] || null, error: null }) }),
    single: () => ({ data: newRows[0] || null, error: null }),
    then: (r) => r({ data: newRows, error: null }),
    catch: () => {},
  };
}

function dbUpdate(table, data, filters) {
  const rows = load(table);
  const updated = rows.map(r => filters.every(f => r[f.col] === f.val) ? { ...r, ...data } : r);
  save(table, updated);
  return { error: null, then: (r) => r({ error: null }), catch: () => {} };
}

function dbDelete(table, filters) {
  const rows = load(table);
  save(table, rows.filter(r => !filters.every(f => r[f.col] === f.val)));
  return { error: null, then: (r) => r({ error: null }), catch: () => {} };
}

function dbUpsert(table, payload) {
  const rows = load(table);
  (Array.isArray(payload) ? payload : [payload]).forEach(d => {
    const idx = rows.findIndex(r => r.id === d.id);
    if (idx >= 0) rows[idx] = d;
    else rows.push({ id: id(), created_at: new Date().toISOString(), ...d });
  });
  save(table, rows);
  return { error: null, then: (r) => r({ error: null }), catch: () => {} };
}

// ---------- Auth ----------
function findUser(email, password) {
  return load('staff').find(u => u.email === email && (u.password === password || u.pin_code === password));
}

// Sync helpers
const tables = ['stores','staff','products','sales','sale_items','cash_shifts','discount_rules','returns','company_settings','customers','laybys','store_admins','stock_transfers'];

async function trySync(t) {
  if (!navigator.onLine) return;
  const rows = load(t);
  if (!rows.length) return;
  const rowsToUpsert = rows.map(({ id, ...rest }) => rest);
  try { await realClient.from(t).upsert(rowsToUpsert, { onConflict: 'id' }); } catch {}
}

async function pullAll() {
  if (!navigator.onLine) return;
  for (const t of tables) {
    try {
      const { data } = await realClient.from(t).select('*');
      const remote = data || [];
      const local = load(t);
      const merged = {};
      [...local, ...remote].forEach(r => {
        if (!r.id) r.id = id();
        if (!merged[r.id]) merged[r.id] = r;
        else if (!merged[r.id].created_at || new Date(r.created_at) > new Date(merged[r.id].created_at)) merged[r.id] = r;
      });
      if (t === 'staff') {
        Object.values(merged).forEach(record => { if (record.pin_code && !record.password) record.password = record.pin_code; });
      }
      save(t, Object.values(merged));
    } catch {}
  }
  window.dispatchEvent(new CustomEvent('db-change'));
}

async function syncStoreFromCloud(storeId) {
  if (!navigator.onLine || !storeId) return;
  try {
    const { data } = await realClient.from('stores').select('*').eq('id', storeId).single();
    if (!data) return;
    const stores = load('stores');
    const idx = stores.findIndex(s => s.id === storeId);
    if (idx >= 0) stores[idx] = { ...stores[idx], ...data };
    else stores.push(data);
    save('stores', stores);
  } catch {}
}

let storeSyncInterval = null;
function startStoreSync() {
  if (storeSyncInterval) clearInterval(storeSyncInterval);
  storeSyncInterval = setInterval(() => {
    const user = JSON.parse(localStorage.getItem('local_user') || 'null');
    if (user?.store_id) syncStoreFromCloud(user.store_id);
  }, 60000);
}

window.addEventListener('online', () => { pullAll(); startStoreSync(); });
window.addEventListener('offline', () => { if (storeSyncInterval) clearInterval(storeSyncInterval); });

if (navigator.onLine) { setTimeout(() => { pullAll(); startStoreSync(); }, 2000); }

// ---------- The exported supabase ----------
export const supabase = {
  from: (table) => ({
    select: (cols, opts) => queryBuilder(table).select(cols, opts),
    insert: (data) => dbInsert(table, data),
    update: (data) => ({
      eq: (col, val) => dbUpdate(table, data, [{ type: 'eq', col, val }]),
      in: (col, vals) => dbUpdate(table, data, [{ type: 'in', col, vals }]),
    }),
    delete: () => ({ eq: (col, val) => dbDelete(table, [{ type: 'eq', col, val }]) }),
    upsert: (data) => dbUpsert(table, data),
  }),
  auth: {
    signInWithPassword: async ({ email, password }) => {
      const user = findUser(email, password);
      if (user) {
        localStorage.setItem('local_user', JSON.stringify(user));
        window.dispatchEvent(new Event('auth-change'));
        if (navigator.onLine) await syncStoreFromCloud(user.store_id);
        return { data: { user }, error: null };
      }
      if (navigator.onLine) {
        try {
          const { data, error } = await realClient.auth.signInWithPassword({ email, password });
          if (!error && data?.user) {
            const onlineUser = data.user;
            const metadata = onlineUser.user_metadata || {};
            const storeId = metadata.store_id;
            const staffList = load('staff');
            const existingStaff = staffList.find(s => s.email === email);
            if (!existingStaff) {
              const newStaff = {
                id: id(), email, password, pin_code: password,
                full_name: metadata.full_name || 'Store Owner',
                role: 'admin', is_active: true, store_id: storeId,
              };
              save('staff', [...staffList, newStaff]);
            } else {
              const updated = staffList.map(s => s.email === email ? { ...s, password, pin_code: password } : s);
              save('staff', updated);
            }
            localStorage.setItem('local_user', JSON.stringify({ ...onlineUser, store_id: storeId }));
            window.dispatchEvent(new Event('auth-change'));
            if (storeId) await syncStoreFromCloud(storeId);
            return { data: { user: onlineUser }, error: null };
          }
        } catch {}
      }
      return { error: { message: 'Invalid credentials' } };
    },
    signOut: async () => { localStorage.removeItem('local_user'); return { error: null }; },
    getSession: async () => {
      const user = JSON.parse(localStorage.getItem('local_user') || 'null');
      return { data: { session: user ? { user, access_token:'offline', refresh_token:'offline' } : null } };
    },
    onAuthStateChange: (cb) => {
      const handler = () => {
        const user = JSON.parse(localStorage.getItem('local_user') || 'null');
        cb('SIGNED_IN', { user });
      };
      window.addEventListener('auth-change', handler); handler();
      return { data: { subscription: { unsubscribe: () => window.removeEventListener('auth-change', handler) } } };
    },
    setSession: async () => ({ error: null }),
    signUp: async ({ email, password, options }) => {
      const staff = load('staff');
      if (staff.find(u => u.email === email)) return { error: { message: 'Email already registered' } };

      const currentUser = JSON.parse(localStorage.getItem('local_user') || 'null');
      const isFirstUser = staff.length === 0;
      /* ----- FIXED LINE: EVERY SIGN-UP BECOMES ADMIN ----- */
      const role = options?.data?.role || 'admin';
      /* ------------------------------------------------ */
      let storeId = currentUser?.store_id;
      if (!storeId || isFirstUser) {
        storeId = id();
        const storeName = options?.data?.full_name ? `${options.data.full_name}'s Store` : 'My Store';
        save('stores', [...load('stores'), {
          id: storeId, name: storeName, subscription_status: 'trialing',
          trial_started_at: new Date().toISOString(), subscription_plan: options?.data?.plan || 'monthly', locked: false,
        }]);
        save('company_settings', [...load('company_settings'), {
          id: id(), store_id: storeId, company_name: storeName, local_currency: 'ZMW',
          receipt_footer: 'Thank you!', currency_symbol: 'K', receipt_header: '', logo_url: '',
        }]);
      }
      const newUser = {
        id: id(), email, password, pin_code: password,
        full_name: options?.data?.full_name || 'Store Owner',
        role, is_active: true, store_id: storeId,
        is_inventory_manager: true,   // admin has inventory access
      };
      save('staff', [...staff, newUser]);
      if (isFirstUser) {
        localStorage.setItem('local_user', JSON.stringify(newUser));
        window.dispatchEvent(new Event('auth-change'));
      }
      return { data: { user: newUser }, error: null };
    },
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  rpc: () => ({ error: null, then: (r) => r({ error: null }), catch: () => {} }),
};
