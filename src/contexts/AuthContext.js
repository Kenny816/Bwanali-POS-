import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [availableStores, setAvailableStores] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const loadUser = useCallback(async () => {
    const saved = localStorage.getItem('local_user');
    if (!saved) {
      setUser(null); setStaff(null); setActiveStoreId(null);
      setAvailableStores([]); setLoading(false);
      return;
    }
    const parsed = JSON.parse(saved);
    setUser(parsed);

    try {
      // Load all stores owned by this admin via store_admins
      const allAdmins = JSON.parse(localStorage.getItem('bwanali_store_admins') || '[]');
      const adminEntries = allAdmins.filter(a => a.user_id === parsed.id || a.user_id === parsed.email);
      const allStores = JSON.parse(localStorage.getItem('bwanali_stores') || '[]');
      
      // Get the store IDs the admin is linked to
      const adminStoreIds = new Set(adminEntries.map(a => a.store_id));
      
      // Also include the store from the user's own staff record (in case store_admin entry is missing)
      if (parsed.store_id) adminStoreIds.add(parsed.store_id);
      
      const userStores = allStores.filter(s => adminStoreIds.has(s.id));
      
      // If no stores found, fallback to the user's own store from staff record
      if (userStores.length === 0 && parsed.store_id) {
        const userStore = allStores.find(s => s.id === parsed.store_id);
        if (userStore) userStores.push(userStore);
      }
      
      // If still zero, create a default store (should not happen normally)
      if (userStores.length === 0) {
        const newStoreId = 'store-' + Date.now().toString(36);
        const defaultStore = {
          id: newStoreId,
          name: parsed.full_name ? `${parsed.full_name}'s Store` : 'My Store',
          subscription_status: 'trialing',
          trial_started_at: new Date().toISOString(),
          subscription_plan: 'monthly',
          locked: false,
        };
        saveStores([...allStores, defaultStore]);
        userStores.push(defaultStore);
        // also create store_admin entry
        const newAdmins = [...allAdmins, { user_id: parsed.id, store_id: newStoreId }];
        localStorage.setItem('bwanali_store_admins', JSON.stringify(newAdmins));
      }
      
      setAvailableStores(userStores);

      // Determine active store (saved preference or first)
      const savedStoreId = localStorage.getItem(`activeStore_${parsed.id}`);
      const activeId = savedStoreId && userStores.find(s => s.id === savedStoreId)
        ? savedStoreId
        : userStores[0].id;
      setActiveStoreId(activeId);

      const staffMember = {
        ...parsed,
        full_name: parsed.full_name || 'User',
        role: parsed.role || 'admin',
        is_active: parsed.is_active !== false,
        store: userStores.find(s => s.id === activeId) || userStores[0],
        is_inventory_manager: parsed.is_inventory_manager ?? true,
      };
      setStaff(staffMember);

      const currentStore = userStores.find(s => s.id === activeId) || userStores[0];
      if (currentStore) {
        // Trial expiry check
        if (currentStore.subscription_status === 'trialing' && currentStore.trial_started_at) {
          const trialEnd = new Date(currentStore.trial_started_at);
          trialEnd.setDate(trialEnd.getDate() + 3);
          const now = new Date();
          const left = Math.max(0, Math.ceil((trialEnd - now) / 86400000));
          setTrialDaysLeft(left);
          if (left === 0) {
            currentStore.subscription_status = 'expired';
            currentStore.locked = true;
            const updatedStores = allStores.map(s => s.id === currentStore.id ? currentStore : s);
            localStorage.setItem('bwanali_stores', JSON.stringify(updatedStores));
            setSubscriptionStatus('expired');
            setIsLocked(true);
            setLoading(false);
            return;
          }
        }
        setSubscriptionStatus(currentStore.subscription_status || 'trialing');
        setIsLocked(currentStore.locked || false);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // Helper to save stores and dispatch event
  const saveStores = (stores) => {
    localStorage.setItem('bwanali_stores', JSON.stringify(stores));
    window.dispatchEvent(new CustomEvent('db-change'));
  };

  useEffect(() => {
    loadUser();
    const interval = setInterval(loadUser, 10 * 60 * 1000);
    window.addEventListener('auth-change', loadUser);
    window.addEventListener('focus', loadUser);
    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-change', loadUser);
      window.removeEventListener('focus', loadUser);
    };
  }, [loadUser]);

  const switchStore = useCallback((storeId) => {
    if (!user?.id) return;
    setActiveStoreId(storeId);
    localStorage.setItem(`activeStore_${user.id}`, storeId);
    loadUser(); // re-fetch
  }, [user, loadUser]);

  const checkSubscription = useCallback(async (storeId) => {
    const allStores = JSON.parse(localStorage.getItem('bwanali_stores') || '[]');
    const store = allStores.find(s => s.id === storeId);
    if (store) {
      setSubscriptionStatus(store.subscription_status);
      setIsLocked(store.locked || false);
    }
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setStaff(null); setActiveStoreId(null); setAvailableStores([]);
  };

  const role = staff?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || isAdmin;
  const canManageInventory = isAdmin || isManager || (staff?.is_inventory_manager === true);
  const hasActive = subscriptionStatus === 'active' || (subscriptionStatus === 'trialing' && !isLocked);

  return (
    <AuthContext.Provider
      value={{
        user, staff, setStaff, storeId: activeStoreId, availableStores,
        switchStore, signIn, signOut, loading,
        isAdmin, isManager,
        canManageInventory,
        canDelete: isAdmin,
        subscriptionStatus, trialDaysLeft,
        hasActiveSubscription: hasActive,
        isLocked, checkSubscription,
        reloadStaff: () => loadUser(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
