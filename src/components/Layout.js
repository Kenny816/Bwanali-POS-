import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Store, ChevronDown, Plus, UserCircle, LogOut, Lock } from 'lucide-react';

function StoreSwitcher() {
  const { availableStores, storeId, switchStore } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!availableStores || availableStores.length <= 1) return null;
  const current = availableStores.find(s => s.id === storeId) || availableStores[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
        <Store size={16} />
        <span className="text-sm truncate max-w-[120px]">{current?.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-50">
            <div className="p-2">
              {availableStores.map(s => (
                <button key={s.id} onClick={() => { switchStore(s.id); setOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex justify-between ${s.id === storeId ? 'bg-green-50 text-green-700' : ''}`}>
                  <span className="truncate">{s.name}</span>
                  {s.id === storeId && <span>✓</span>}
                </button>
              ))}
              <hr className="my-2" />
              <button onClick={() => { navigate('/app/settings'); setOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                <Plus size={14} /> Add New Store
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const { staff, signOut, storeId, isLocked, checkSubscription, availableStores, switchStore } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [locked, setLocked] = useState(isLocked);
  const lockInterval = useRef(null);

  // If the current store is no longer in the available list (it was deleted), switch to the first available
  useEffect(() => {
    if (storeId && availableStores && availableStores.length > 0) {
      const exists = availableStores.find(s => s.id === storeId);
      if (!exists) {
        const firstStore = availableStores[0];
        switchStore(firstStore.id);
        toast.success('Store has been removed. Switched to an available store.');
        navigate('/app');
      }
    } else if (availableStores && availableStores.length === 0 && storeId) {
      // No stores left at all
      navigate('/app/settings'); // or show a message
    }
  }, [availableStores, storeId, switchStore, navigate]);

  // Periodic lock check every 30 seconds
  useEffect(() => {
    if (!storeId) return;
    const check = async () => {
      try {
        const { data } = await supabase.from('stores').select('locked').eq('id', storeId).single();
        if (data && data.locked !== locked) {
          setLocked(data.locked);
          if (data.locked) {
            await checkSubscription(storeId);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    check();
    lockInterval.current = setInterval(check, 30000);
    return () => clearInterval(lockInterval.current);
  }, [storeId, locked, checkSubscription]);

  useEffect(() => {
    setLocked(isLocked);
  }, [isLocked]);

  const pageTitles = {
    '/app': 'Dashboard',
    '/app/pos': 'POS',
    '/app/inventory': 'Inventory',
    '/app/sales': 'Sales',
    '/app/reports': 'Reports',
    '/app/employees': 'Employees',
    '/app/returns': 'Returns',
    '/app/return-history': 'Return History',
    '/app/settings': 'Settings',
    '/app/discounts': 'Discounts',
    '/app/profile': 'Profile',
    '/app/layby': 'Lay‑by',
    '/app/invoices': 'Invoices',
  };
  const currentTitle = pageTitles[location.pathname] || 'Bwanali POS';

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="text-lg font-bold text-green-700 truncate hover:underline">
            {staff?.store?.name || 'Bwanali POS'}
          </button>
          <span className="hidden sm:inline text-gray-400">|</span>
          <span className="hidden sm:inline text-sm text-gray-600 truncate">{currentTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <StoreSwitcher />
          <button onClick={() => navigate('/app/profile')} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-sm">
            <UserCircle size={16} />
            <span className="hidden sm:inline truncate max-w-[100px]">{staff?.full_name}</span>
          </button>
          <button onClick={async () => { await signOut(); navigate('/login'); }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 text-sm">
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {locked && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
            <div className="bg-red-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4">
              <Lock className="text-red-600 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Locked</h1>
            <p className="text-gray-600 mb-6">Your account has been locked by the super admin. Please contact support for assistance.</p>
            <button
              onClick={async () => { await signOut(); navigate('/login'); }}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
