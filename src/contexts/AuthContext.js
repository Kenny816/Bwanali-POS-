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
      const allStores = JSON.parse(localStorage.getItem('bwanali_stores') || '[]');
      const allStaff = JSON.parse(localStorage.getItem('bwanali_staff') || '[]');

      // Find all staff records for this user's email
      const myStaffRecords = allStaff.filter(s => s.email === parsed.email);
      const managedStoreIds = myStaffRecords.map(s => s.store_id);
      // Also include stores where the user is admin in store_admins
      const storeAdmins = JSON.parse(localStorage.getItem('bwanali_store_admins') || '[]');
      const adminStoreIds = storeAdmins.filter(a => a.user_id === parsed.id).map(a => a.store_id);
      const allManagedIds = [...new Set([...managedStoreIds, ...adminStoreIds])];

      // If parsed.store_id is set, ensure it's included
      if (parsed.store_id && !allManagedIds.includes(parsed.store_id)) {
        allManagedIds.push(parsed.store_id);
      }

      const managedStores = allStores.filter(s => allManagedIds.includes(s.id));
      
      if (managedStores.length === 0) {
        // Fallback: if no managed stores found, but parsed has a store_id, just use that
        const fallbackStore = allStores.find(s => s.id === parsed.store_id);
        if (fallbackStore) {
          managedStores.push(fallbackStore);
        } else {
          // No stores at all – sign out
          localStorage.removeItem('local_user');
          setUser(null); setStaff(null); setActiveStoreId(null);
          setAvailableStores([]); setLoading(false);
          return;
        }
      }

      setAvailableStores(managedStores);

      // Active store: prefer saved one, else first managed
      const savedActiveId = localStorage.getItem(`activeStore_${parsed.id}`);
      const activeId = (savedActiveId && managedStores.find(s => s.id === savedActiveId)) 
                        ? savedActiveId 
                        : managedStores[0].id;
      setActiveStoreId(activeId);
      localStorage.setItem(`activeStore_${parsed.id}`, activeId);

      // Current staff record for the active store
      const currentStaffRecord = myStaffRecords.find(s => s.store_id === activeId);
      const userStore = managedStores.find(s => s.id === activeId);
      const staffMember = {
        ...parsed,
        id: currentStaffRecord?.id,
        full_name: currentStaffRecord?.full_name || parsed.full_name || 'User',
        role: currentStaffRecord?.role || parsed.role || 'admin',
        is_active: currentStaffRecord?.is_active !== false,
        store: userStore,
        store_id: activeId,
        pin_code: currentStaffRecord?.pin_code || null,
      };
      setStaff(staffMember);

      // Subscription status from active store
      const store = userStore || managedStores[0];
      if (store) {
        if (store.subscription_status === 'trialing' && store.trial_started_at) {
          const trialEnd = new Date(store.trial_started_at);
          trialEnd.setDate(trialEnd.getDate() + 3);
          const now = new Date();
          const left = Math.max(0, Math.ceil((trialEnd - now) / 86400000));
          setTrialDaysLeft(left);
          if (left === 0) {
            store.subscription_status = 'expired';
            store.locked = true;
            const updatedStores = allStores.map(s => s.id === store.id ? store : s);
            localStorage.setItem('bwanali_stores', JSON.stringify(updatedStores));
            setSubscriptionStatus('expired');
            setIsLocked(true);
            setLoading(false);
            return;
          }
        }
        setSubscriptionStatus(store.subscription_status || 'trialing');
        setIsLocked(store.locked || false);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

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

  const switchStore = (id) => {
    if (!user) return;
    localStorage.setItem(`activeStore_${user.id}`, id);
    loadUser();
  };

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
  const hasActive = subscriptionStatus === 'active' || (subscriptionStatus === 'trialing' && !isLocked);

  return (
    <AuthContext.Provider
      value={{
        user, staff, setStaff, storeId: activeStoreId, availableStores,
        switchStore,
        signIn, signOut, loading,
        isAdmin, isManager,
        canManageInventory: isAdmin || role === 'manager',
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
