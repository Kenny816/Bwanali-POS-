import React,{createContext,useContext,useState,useEffect,useCallback,useRef} from 'react';
import {supabase} from '../lib/supabase';
import {getUserFriendlyError} from '../lib/errorHandler';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [availableStores, setAvailableStores] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  
  const loadingRef = useRef(false);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const checkSubscription = useCallback(async (sid) => {
    if (!sid) return;
    const { data: store } = await supabase.from('stores')
      .select('subscription_status,trial_started_at,locked').eq('id',sid).single();
    if (store && mountedRef.current) {
      setIsLocked(store.locked || false);
      setSubscriptionStatus(store.subscription_status);
      if (store.subscription_status === 'trialing' && store.trial_started_at) {
        const end = new Date(store.trial_started_at);
        end.setDate(end.getDate() + 3);
        const left = Math.max(0, Math.ceil((end - new Date()) / 86400000));
        setTrialDaysLeft(left);
        if (left === 0) {
          await supabase.from('stores').update({subscription_status:'expired',locked:true}).eq('id',sid);
          if (mountedRef.current) {
            setIsLocked(true);
            setSubscriptionStatus('expired');
          }
        }
      }
    }
  }, []);

  const loadAvailableStores = useCallback(async (uid) => {
    try {
      const { data: adminStores } = await supabase
        .from('store_admins')
        .select('store:stores(id,name,subscription_status,locked)')
        .eq('user_id',uid);
      
      const { data: staffStores } = await supabase
        .from('staff')
        .select('store:stores(id,name,subscription_status,locked), role')
        .eq('user_id',uid)
        .eq('is_active',true);
      
      const stores = [];
      adminStores?.forEach(i => stores.push({...i.store, role: 'admin'}));
      staffStores?.forEach(i => stores.push({...i.store, role: i.role}));
      
      return Array.from(new Map(stores.map(s => [s.id, s])).values());
    } catch (err) {
      return [];
    }
  }, []);

  const loadStaffForStore = useCallback(async (uid, sid) => {
    const { data } = await supabase.from('staff')
      .select('*,store:stores(id,name,subscription_status,locked)')
      .eq('user_id',uid).eq('store_id',sid).maybeSingle();
    return data;
  }, []);

  const loadUserData = useCallback(async (uid, targetSid = null) => {
    if (!uid || loadingRef.current) return;
    loadingRef.current = true;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (loadingRef.current && mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
        toast.error('Network timeout. Check your connection.');
      }
    }, 10000);
    
    try {
      const stores = await loadAvailableStores(uid);
      if (!mountedRef.current) return;
      setAvailableStores(stores);
      
      if (!stores.length) {
        console.log('🟡 No stores found for user – pending confirmation');
        setStaff({ full_name: user?.user_metadata?.full_name || 'User', email: user?.email, role: 'pending', store: null, store_id: null, is_active: true });
        setActiveStoreId(null);
        setSubscriptionStatus('pending');
        return;
      }

      let sid = targetSid;
      if (!sid) {
        const saved = localStorage.getItem(`activeStore_${uid}`);
        sid = (saved && stores.find(s => s.id === saved)) ? saved : stores[0].id;
        if (!saved) localStorage.setItem(`activeStore_${uid}`, sid);
      }
      
      console.log('🟢 Active store ID:', sid);
      
      // FIRST: Check if user is a store_admin for this store
      const isStoreAdmin = stores.some(s => s.id === sid && s.role === 'admin');
      console.log('🔵 Is store admin?', isStoreAdmin);
      
      // Fetch staff record (may not exist)
      const staffRecord = await loadStaffForStore(uid, sid);
      console.log('🟣 Staff record from DB:', staffRecord);
      
      let finalStaff = null;
      
      if (isStoreAdmin) {
        // FORCE ADMIN ROLE for store admins, regardless of staff table
        finalStaff = {
          id: staffRecord?.id || null,
          full_name: staffRecord?.full_name || user?.user_metadata?.full_name || 'Owner',
          email: staffRecord?.email || user?.email,
          role: 'admin',  // <-- FORCED
          store: stores.find(s => s.id === sid),
          store_id: sid,
          is_active: staffRecord?.is_active ?? true,
          pin_code: staffRecord?.pin_code || null
        };
        console.log('🟠 Forcing admin role');
      } else if (staffRecord) {
        finalStaff = staffRecord;
        console.log('🟤 Using staff record role:', staffRecord.role);
      } else {
        console.log('🔴 No staff record and not store admin');
        toast.error('No profile found for this store');
        setStaff(null);
        setActiveStoreId(sid);
        return;
      }
      
      if (finalStaff) {
        if (!finalStaff.is_active) {
          toast.error('Account disabled');
          setStaff(null);
        } else {
          setStaff(finalStaff);
          await checkSubscription(sid);
          
          const pinDefault = !finalStaff.pin_code || finalStaff.pin_code === '1234';
          const shown = localStorage.getItem(`pin_prompt_shown_${uid}_${sid}`);
          setNeedsPinSetup(pinDefault && !shown);
          
          console.log('✅ Final staff role:', finalStaff.role);
        }
      }
      
      setActiveStoreId(sid);
    } catch (err) {
      console.error('Load user data error:', err);
      toast.error('Failed to load profile');
    } finally {
      clearTimeout(timeoutRef.current);
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [loadAvailableStores, loadStaffForStore, checkSubscription, user]);

  const switchStore = useCallback(async (sid) => {
    if (!user?.id) return;
    setLoading(true);
    localStorage.setItem(`activeStore_${user.id}`, sid);
    await loadUserData(user.id, sid);
    toast.success('Store switched');
  }, [user, loadUserData]);

  useEffect(() => {
    mountedRef.current = true;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setStaff(null);
        setActiveStoreId(null);
        setAvailableStores([]);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      listener?.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(getUserFriendlyError(error));
      return { error };
    }
    toast.success('Welcome!');
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStaff(null);
    setActiveStoreId(null);
    setAvailableStores([]);
  };

  const isAdmin = staff?.role === 'admin';
  const isManager = staff?.role === 'manager' || isAdmin;
  const hasActive = subscriptionStatus === 'active' || (subscriptionStatus === 'trialing' && !isLocked);

  const value = {
    user, staff, setStaff, storeId: activeStoreId, availableStores, switchStore,
    signIn, signOut, loading, needsPinSetup, reloadStaff: () => loadUserData(user?.id),
    isAdmin, isManager, canManageInventory: isManager, canDelete: isAdmin,
    markPinPromptAsShown: () => {
      if (user?.id && activeStoreId) {
        localStorage.setItem(`pin_prompt_shown_${user.id}_${activeStoreId}`, 'true');
      }
    },
    subscriptionStatus, trialDaysLeft, hasActiveSubscription: hasActive, isLocked, checkSubscription
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
