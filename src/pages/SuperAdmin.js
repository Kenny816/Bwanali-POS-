import React,{useState,useEffect} from 'react';import {supabase} from '../lib/supabase';import toast from 'react-hot-toast';import {Shield,Users,CreditCard,RefreshCw,Trash2,Eye,Lock,Unlock,Search,Download,Calendar,CheckCircle,X,AlertOctagon,Settings,Activity,BarChart3,Smartphone,DollarSign,TrendingUp,TrendingDown} from 'lucide-react';
const SUPER_SECRET=process.env.REACT_APP_SUPER_ADMIN_SECRET||'kk-super-secret-2024';
export default function SuperAdmin(){
  const [authenticated,setAuthenticated]=useState(false);const [secretInput,setSecretInput]=useState('');const [tab,setTab]=useState('dashboard');
  const [stats,setStats]=useState({stores:0,users:0,sales:0,revenue:0,activeShifts:0,pendingPayments:0,trialExpiring:0});
  const [stores,setStores]=useState([]);const [storeSearch,setStoreSearch]=useState('');const [selectedStore,setSelectedStore]=useState(null);
  const [showSubModal,setShowSubModal]=useState(false);const [subStoreId,setSubStoreId]=useState(null);const [subForm,setSubForm]=useState({endDate:'',status:'active'});
  const [pendingPayments,setPendingPayments]=useState([]);const [paymentSearch,setPaymentSearch]=useState('');
  const [users,setUsers]=useState([]);const [userSearch,setUserSearch]=useState('');
  const [auditLogs,setAuditLogs]=useState([]);const [auditSearch,setAuditSearch]=useState('');
  const [globalSettings,setGlobalSettings]=useState({default_trial_days:3,max_stores_per_account:3,default_currency:'ZMW'});
  const [settingsLoading,setSettingsLoading]=useState(false);
  const [messagesSearch,setMessagesSearch]=useState('');

  useEffect(()=>{const auth=sessionStorage.getItem('super_admin_auth');if(auth===SUPER_SECRET){setAuthenticated(true);loadAll();}},[]);
  const handleAuth=e=>{e.preventDefault();if(secretInput===SUPER_SECRET){sessionStorage.setItem('super_admin_auth',SUPER_SECRET);setAuthenticated(true);loadAll();}else{toast.error('Invalid secret key');}};
  const loadAll=()=>{loadDashboardStats();loadStores();loadPendingPayments();loadUsers();loadAuditLogs();loadGlobalSettings();};

  const loadDashboardStats=async()=>{try{const [storesRes,usersRes,salesRes,shiftsRes,paymentsRes,expiringRes]=await Promise.all([supabase.from('stores').select('id',{count:'exact',head:true}),supabase.from('staff').select('id',{count:'exact',head:true}),supabase.from('sales').select('total_amount'),supabase.from('cash_shifts').select('id',{count:'exact',head:true}).is('end_time',null),supabase.from('pending_subscription_payments').select('id',{count:'exact',head:true}).eq('status','pending'),supabase.from('stores').select('id',{count:'exact',head:true}).eq('subscription_status','trialing').lte('trial_started_at',new Date(Date.now()-2*24*60*60*1000).toISOString())]);const totalRevenue=salesRes.data?.reduce((s,i)=>s+(i.total_amount||0),0)||0;setStats({stores:storesRes.count||0,users:usersRes.count||0,sales:salesRes.data?.length||0,revenue:totalRevenue,activeShifts:shiftsRes.count||0,pendingPayments:paymentsRes.count||0,trialExpiring:expiringRes.count||0});}catch(e){console.error(e);}};

  const loadStores=async()=>{const {data}=await supabase.from('stores').select('*,staff(count),company_settings(company_name)');setStores(data||[]);};
  const viewStoreDetails=async(storeId)=>{const {data}=await supabase.from('stores').select('*,company_settings(*),staff(*),products(count),sales(count)').eq('id',storeId).single();setSelectedStore(data);};
  const toggleLock=async(storeId,currentLock)=>{await supabase.from('stores').update({locked:!currentLock}).eq('id',storeId);toast.success(`Store ${currentLock?'unlocked':'locked'}`);loadStores();logAction('store_lock_toggle',`Store ${storeId} locked=${!currentLock}`);};
  const deleteStore=async(storeId)=>{if(!window.confirm('PERMANENTLY DELETE this store and all its data?'))return;await supabase.from('stores').delete().eq('id',storeId);toast.success('Store deleted');loadStores();loadDashboardStats();logAction('store_delete',`Store ${storeId} deleted`);};
  const openSubModal=(storeId)=>{setSubStoreId(storeId);const store=stores.find(s=>s.id===storeId);setSubForm({endDate:store?.subscription_end_date?.split('T')[0]||'',status:store?.subscription_status||'active'});setShowSubModal(true);};
  const handleSubUpdate=async(e)=>{e.preventDefault();try{const payload={subscription_status:subForm.status,subscription_end_date:subForm.endDate?new Date(subForm.endDate).toISOString():null,trial_started_at:null};await supabase.from('stores').update(payload).eq('id',subStoreId);toast.success('Subscription updated');setShowSubModal(false);loadStores();logAction('subscription_update',`Store ${subStoreId} status=${subForm.status}`);}catch(err){toast.error(err.message);}};
  const suspendStore=async(storeId)=>{await supabase.from('stores').update({subscription_status:'suspended'}).eq('id',storeId);toast.success('Store suspended');loadStores();logAction('store_suspend',`Store ${storeId} suspended`);};
  const unsuspendStore=async(storeId)=>{await supabase.from('stores').update({subscription_status:'active',subscription_end_date:new Date(Date.now()+365*24*60*60*1000).toISOString()}).eq('id',storeId);toast.success('Store reactivated');loadStores();logAction('store_unsuspend',`Store ${storeId} unsuspended`);};

  // Upgrade / Downgrade plan
  const changePlan = async (storeId, newPlan) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return;
    const endDate = new Date();
    if (newPlan === 'annual') {
      endDate.setMonth(endDate.getMonth() + 12);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    await supabase.from('stores').update({
      subscription_plan: newPlan,
      subscription_end_date: endDate.toISOString(),
      subscription_status: 'active',
      locked: false
    }).eq('id', storeId);
    toast.success(`Plan changed to ${newPlan === 'annual' ? 'Annual' : 'Monthly'}`);
    loadStores();
    logAction('plan_change', `Store ${storeId} plan changed to ${newPlan}`);
  };

  const exportCSV=()=>{const rows=stores.map(s=>[s.name,new Date(s.created_at).toLocaleDateString(),s.staff?.count||0,s.subscription_status||'trialing',s.locked?'Locked':'Active']);const csv=[['Store','Created','Staff','Subscription','Status'].join(',')].concat(rows.map(r=>r.map(v=>`"${v}"`).join(','))).join('\n');const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='stores.csv';a.click();};

  const loadPendingPayments=async()=>{const {data}=await supabase.from('pending_subscription_payments').select('*,store:stores(name)').order('created_at',{ascending:false});setPendingPayments(data||[]);};
  const matchPayment=async(id,transactionId)=>{await supabase.from('pending_subscription_payments').update({status:'matched',matched_transaction_id:transactionId,matched_at:new Date().toISOString()}).eq('id',id);toast.success('Payment marked as matched');loadPendingPayments();logAction('payment_matched',`Payment ${id} matched to ${transactionId}`);};
  const rejectPayment=async(id)=>{await supabase.from('pending_subscription_payments').update({status:'rejected'}).eq('id',id);toast.success('Payment rejected');loadPendingPayments();logAction('payment_rejected',`Payment ${id} rejected`);};
  const deletePendingPayment=async(id)=>{await supabase.from('pending_subscription_payments').delete().eq('id',id);toast.success('Payment entry deleted');loadPendingPayments();};

  const loadUsers=async()=>{const {data}=await supabase.from('staff').select('*,store:stores(name)');setUsers(data||[]);};
  const forceResetPassword=async(email)=>{const {error}=await supabase.auth.resetPasswordForEmail(email);if(error)toast.error(error.message);else toast.success(`Password reset email sent to ${email}`);logAction('password_reset_request',`Password reset requested for ${email}`);};
  const deleteUser=async(staffId)=>{if(!window.confirm('Delete this user?'))return;await supabase.from('staff').delete().eq('id',staffId);toast.success('User deleted');loadUsers();logAction('user_delete',`Staff ${staffId} deleted`);};

  const loadAuditLogs=async()=>{const {data}=await supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200);setAuditLogs(data||[]);};
  const logAction=async(action,details)=>{await supabase.from('audit_logs').insert({action,details,performed_by:'super_admin'});loadAuditLogs();};

  const loadGlobalSettings=async()=>{const {data}=await supabase.from('global_settings').select('*').single();if(data)setGlobalSettings({default_trial_days:data.default_trial_days||3,max_stores_per_account:data.max_stores_per_account||3,default_currency:data.default_currency||'ZMW'});};
  const saveGlobalSettings=async(e)=>{e.preventDefault();setSettingsLoading(true);try{await supabase.from('global_settings').upsert({id:1,...globalSettings,updated_at:new Date().toISOString()});toast.success('Global settings saved');logAction('global_settings_update','Global settings updated');loadGlobalSettings();}catch(err){toast.error(err.message);}finally{setSettingsLoading(false);}};

  const activateFromMessage=async(payment)=>{
    if(!payment.store_id) return toast.error('No store linked to this payment');
    const endDate = new Date();
    const isAnnual = payment.notes?.includes('annual') || payment.notes?.includes('Annual');
    endDate.setMonth(endDate.getMonth() + (isAnnual ? 12 : 1));
    try{
      await supabase.from('stores').update({
        subscription_status:'active',
        locked:false,
        subscription_end_date:endDate.toISOString(),
        subscription_plan: isAnnual?'annual':'monthly',
        trial_started_at:null
      }).eq('id',payment.store_id);
      await supabase.from('pending_subscription_payments').update({status:'matched',matched_at:new Date().toISOString()}).eq('id',payment.id);
      toast.success(`Store ${payment.store?.name} activated for ${isAnnual?'12':'1'} month(s)`);
      logAction('manual_activation',`Store ${payment.store_id} activated via message ID ${payment.id}`);
      loadPendingPayments();
    }catch(err){toast.error(err.message);}
  };

  if(!authenticated){return(<div className="min-h-screen flex items-center justify-center bg-gray-900 p-4"><form onSubmit={handleAuth} className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-sm"><Shield className="w-12 h-12 text-green-500 mx-auto mb-6"/><h1 className="text-2xl font-bold text-white text-center mb-6">Super Admin</h1><input type="password" placeholder="Enter secret key" value={secretInput} onChange={e=>setSecretInput(e.target.value)} className="w-full p-3 bg-gray-700 text-white border border-gray-600 rounded mb-4" autoFocus/><button className="w-full bg-green-600 text-white p-3 rounded font-bold">Authenticate</button></form></div>);}

  const tabs=[
    {id:'dashboard',label:'Dashboard',icon:BarChart3},
    {id:'stores',label:'Stores',icon:Shield},
    {id:'pending',label:'Payments',icon:DollarSign},
    {id:'messages',label:'Messages',icon:Smartphone},
    {id:'users',label:'Users',icon:Users},
    {id:'audit',label:'Audit',icon:Activity},
    {id:'settings',label:'Settings',icon:Settings},
  ];

  return(<div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6"><div className="max-w-7xl mx-auto">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold"><Shield className="inline mr-2 text-green-500"/>Super Admin</h1>
      <button onClick={()=>{sessionStorage.removeItem('super_admin_auth');setAuthenticated(false);}} className="px-4 py-2 bg-red-600 rounded text-sm w-full sm:w-auto">Logout</button>
    </div>

    <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-2">
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab===t.id?'bg-green-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          <t.icon size={16}/> {t.label}
        </button>
      ))}
    </div>

    {/* ---- DASHBOARD ---- */}
    {tab==='dashboard'&&(<div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Total Stores</p><p className="text-2xl font-bold">{stats.stores}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Total Users</p><p className="text-2xl font-bold">{stats.users}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Total Sales</p><p className="text-2xl font-bold">{stats.sales}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Revenue</p><p className="text-2xl font-bold">K{stats.revenue.toFixed(2)}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Active Shifts</p><p className="text-2xl font-bold">{stats.activeShifts}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Pending Payments</p><p className="text-2xl font-bold">{stats.pendingPayments}</p></div><div className="bg-gray-800 p-4 rounded-xl"><p className="text-gray-400 text-sm">Trials Expiring</p><p className="text-2xl font-bold text-yellow-400">{stats.trialExpiring}</p></div></div></div>)}

    {/* ---- STORES ---- */}
    {tab==='stores'&&(<div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input placeholder="Search stores..." value={storeSearch} onChange={e=>setStoreSearch(e.target.value)} className="w-full pl-10 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"/></div><button onClick={exportCSV} className="px-4 py-2 bg-blue-600 rounded flex items-center justify-center gap-2 text-sm w-full sm:w-auto"><Download size={16}/>Export CSV</button></div>
      <div className="hidden md:block bg-gray-800 rounded-xl overflow-hidden"><div className="p-4 border-b border-gray-700 flex justify-between"><h2 className="text-xl font-semibold">All Stores</h2><button onClick={loadStores} className="p-2 hover:bg-gray-700 rounded"><RefreshCw size={16}/></button></div><table className="w-full text-sm"><thead className="bg-gray-700"><tr><th className="p-3 text-left">Store</th><th className="p-3 text-left">Created</th><th className="p-3 text-left">Staff</th><th className="p-3 text-left">Subscription</th><th className="p-3 text-left">Plan</th><th className="p-3 text-center">Actions</th></tr></thead><tbody>{stores.filter(s=>s.name?.toLowerCase().includes(storeSearch.toLowerCase())).map(s=>(<tr key={s.id} className="border-b border-gray-700"><td className="p-3">{s.name}</td><td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td><td className="p-3">{s.staff?.count||0}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${s.subscription_status==='active'?'bg-green-900 text-green-300':s.subscription_status==='trialing'?'bg-blue-900 text-blue-300':s.subscription_status==='suspended'?'bg-yellow-900 text-yellow-300':'bg-red-900 text-red-300'}`}>{s.subscription_status||'trialing'}</span></td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${s.subscription_plan==='annual'?'bg-purple-900 text-purple-300':'bg-gray-700 text-gray-300'}`}>{s.subscription_plan||'monthly'}</span></td><td className="p-3"><div className="flex gap-1 justify-center flex-wrap"><button onClick={()=>viewStoreDetails(s.id)} className="p-1 text-blue-400"><Eye size={16}/></button><button onClick={()=>toggleLock(s.id,s.locked)} className="p-1 text-yellow-400">{s.locked?<Unlock size={16}/>:<Lock size={16}/>}</button><button onClick={()=>openSubModal(s.id)} className="p-1 text-green-400"><Calendar size={16}/></button>{s.subscription_status!=='suspended'?<button onClick={()=>suspendStore(s.id)} className="p-1 text-orange-400"><AlertOctagon size={16}/></button>:<button onClick={()=>unsuspendStore(s.id)} className="p-1 text-blue-400"><CheckCircle size={16}/></button>}{s.subscription_plan==='monthly'?<button onClick={()=>changePlan(s.id,'annual')} className="p-1 text-purple-400" title="Upgrade to Annual"><TrendingUp size={16}/></button>:<button onClick={()=>changePlan(s.id,'monthly')} className="p-1 text-gray-400" title="Downgrade to Monthly"><TrendingDown size={16}/></button>}<button onClick={()=>deleteStore(s.id)} className="p-1 text-red-400"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div>
      <div className="md:hidden space-y-3">{stores.filter(s=>s.name?.toLowerCase().includes(storeSearch.toLowerCase())).map(s=>(<div key={s.id} className="bg-gray-800 rounded-xl p-4"><div className="flex justify-between"><h3 className="font-bold">{s.name}</h3><span className={`px-2 py-1 rounded-full text-xs ${s.subscription_status==='active'?'bg-green-900 text-green-300':s.subscription_status==='trialing'?'bg-blue-900 text-blue-300':s.subscription_status==='suspended'?'bg-yellow-900 text-yellow-300':'bg-red-900 text-red-300'}`}>{s.subscription_status||'trialing'}</span></div><div className="mt-2 grid grid-cols-2 text-sm"><div>Staff: {s.staff?.count||0}</div><div>Plan: {s.subscription_plan||'monthly'}</div><div>Status: {s.locked?'🔒 Locked':'Active'}</div></div><div className="mt-3 flex gap-2 justify-end flex-wrap"><button onClick={()=>viewStoreDetails(s.id)} className="p-2 bg-gray-700 rounded"><Eye size={16}/></button><button onClick={()=>toggleLock(s.id,s.locked)} className="p-2 bg-gray-700 rounded">{s.locked?<Unlock size={16}/>:<Lock size={16}/>}</button><button onClick={()=>openSubModal(s.id)} className="p-2 bg-gray-700 rounded"><Calendar size={16}/></button>{s.subscription_status!=='suspended'?<button onClick={()=>suspendStore(s.id)} className="p-2 bg-gray-700 rounded text-orange-400"><AlertOctagon size={16}/></button>:<button onClick={()=>unsuspendStore(s.id)} className="p-2 bg-gray-700 rounded text-blue-400"><CheckCircle size={16}/></button>}{s.subscription_plan==='monthly'?<button onClick={()=>changePlan(s.id,'annual')} className="p-2 bg-gray-700 rounded text-purple-400"><TrendingUp size={16}/></button>:<button onClick={()=>changePlan(s.id,'monthly')} className="p-2 bg-gray-700 rounded text-gray-400"><TrendingDown size={16}/></button>}<button onClick={()=>deleteStore(s.id)} className="p-2 bg-gray-700 rounded text-red-400"><Trash2 size={16}/></button></div></div>))}</div>
    </div>)}

    {/* ---- PENDING PAYMENTS ---- */}
    {tab==='pending'&&(<div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Pending Subscription Payments</h2><button onClick={loadPendingPayments} className="p-2 hover:bg-gray-700 rounded"><RefreshCw size={16}/></button></div>
      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input placeholder="Search by phone..." value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)} className="w-full pl-10 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"/></div>
      <div className="hidden md:block bg-gray-800 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-700"><tr><th className="p-3">Phone</th><th className="p-3">Amount</th><th className="p-3">Store Count</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{pendingPayments.filter(p=>p.phone_number?.includes(paymentSearch)||p.notes?.includes(paymentSearch)).map(p=>(<tr key={p.id} className="border-b border-gray-700"><td className="p-3">{p.phone_number||'-'}</td><td className="p-3">K{p.expected_amount?.toFixed(2)}</td><td className="p-3">{p.expected_store_count||1}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${p.status==='pending'?'bg-yellow-900 text-yellow-300':p.status==='matched'?'bg-green-900 text-green-300':'bg-red-900 text-red-300'}`}>{p.status}</span></td><td className="p-3"><div className="flex gap-2 justify-center">{p.status==='pending'&&<><button onClick={()=>{const txn=prompt('Transaction ID:');if(txn)matchPayment(p.id,txn);}} className="px-2 py-1 bg-green-600 rounded text-xs">Match</button><button onClick={()=>rejectPayment(p.id)} className="px-2 py-1 bg-red-600 rounded text-xs">Reject</button></>}<button onClick={()=>deletePendingPayment(p.id)} className="p-1 text-red-400"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div>
      <div className="md:hidden space-y-3">{pendingPayments.filter(p=>p.phone_number?.includes(paymentSearch)||p.notes?.includes(paymentSearch)).map(p=>(<div key={p.id} className="bg-gray-800 rounded-xl p-4"><div className="flex justify-between"><span className="font-bold">{p.phone_number||'No phone'}</span><span className={`px-2 py-1 rounded-full text-xs ${p.status==='pending'?'bg-yellow-900 text-yellow-300':p.status==='matched'?'bg-green-900 text-green-300':'bg-red-900 text-red-300'}`}>{p.status}</span></div><div className="mt-2 text-sm">Amount: K{p.expected_amount?.toFixed(2)} · Stores: {p.expected_store_count||1}</div><div className="mt-3 flex gap-2 justify-end">{p.status==='pending'&&<><button onClick={()=>{const txn=prompt('Transaction ID:');if(txn)matchPayment(p.id,txn);}} className="px-3 py-1 bg-green-600 rounded text-xs">Match</button><button onClick={()=>rejectPayment(p.id)} className="px-3 py-1 bg-red-600 rounded text-xs">Reject</button></>}<button onClick={()=>deletePendingPayment(p.id)} className="p-2 bg-gray-700 rounded text-red-400"><Trash2 size={16}/></button></div></div>))}</div>
    </div>)}

    {/* ---- MESSAGES ---- */}
    {tab==='messages'&&(<div>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Smartphone className="text-green-500"/> Subscription Verification Requests</h2>
      <p className="text-gray-400 mb-4">Admins have sent these SMS messages for verification. Review each one and manually activate the store subscription.</p>
      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input placeholder="Search by store or phone..." value={messagesSearch} onChange={e=>setMessagesSearch(e.target.value)} className="w-full pl-10 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"/></div>
      <div className="space-y-4">
        {pendingPayments.filter(p=>p.raw_sms).filter(p=>(p.store?.name||'').toLowerCase().includes(messagesSearch.toLowerCase())||(p.phone_number||'').includes(messagesSearch)||(p.raw_sms||'').includes(messagesSearch)).length===0 ? (
          <div className="bg-gray-800 p-8 rounded-xl text-center text-gray-400">No verification requests yet.</div>
        ) : (
          pendingPayments.filter(p=>p.raw_sms).filter(p=>(p.store?.name||'').toLowerCase().includes(messagesSearch.toLowerCase())||(p.phone_number||'').includes(messagesSearch)||(p.raw_sms||'').includes(messagesSearch)).map(p=>(
            <div key={p.id} className="bg-gray-800 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-lg">{p.store?.name || 'No store'}</p>
                  <p className="text-sm text-gray-400">Amount: K{p.expected_amount?.toFixed(2)} · {p.expected_store_count||1} store(s) · {p.notes}</p>
                  {p.phone_number && <p className="text-xs text-gray-500">Phone: {p.phone_number}</p>}
                  <p className="text-xs text-gray-500 mt-2">Status: <span className={`px-2 py-0.5 rounded-full text-xs ${p.status==='pending'?'bg-yellow-800 text-yellow-300':p.status==='matched'?'bg-green-800 text-green-300':'bg-red-800 text-red-300'}`}>{p.status}</span></p>
                  <div className="mt-3 bg-gray-700 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                    <p className="text-gray-400 mb-1">Raw SMS:</p>
                    {p.raw_sms}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:w-40">
                  {p.status==='pending'&&p.store_id&&(
                    <button onClick={()=>activateFromMessage(p)} className="px-3 py-2 bg-green-600 rounded text-sm flex items-center justify-center gap-1"><CheckCircle size={14}/> Activate</button>
                  )}
                  {p.status==='pending'&&p.store_id&&(
                    <button onClick={()=>rejectPayment(p.id)} className="px-3 py-2 bg-red-600 rounded text-sm flex items-center justify-center gap-1"><X size={14}/> Reject</button>
                  )}
                  <button onClick={()=>deletePendingPayment(p.id)} className="px-3 py-2 bg-gray-600 rounded text-sm flex items-center justify-center gap-1"><Trash2 size={14}/> Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>)}

    {/* ---- USERS ---- */}
    {tab==='users'&&(<div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">All Users</h2><button onClick={loadUsers} className="p-2 hover:bg-gray-700 rounded"><RefreshCw size={16}/></button></div>
      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input placeholder="Search by name or email..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className="w-full pl-10 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"/></div>
      <div className="hidden md:block bg-gray-800 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-700"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Store</th><th className="p-3">Actions</th></tr></thead><tbody>{users.filter(u=>`${u.full_name} ${u.email} ${u.store?.name}`.toLowerCase().includes(userSearch.toLowerCase())).map(user=>(<tr key={user.id} className="border-b border-gray-700"><td className="p-3">{user.full_name}</td><td className="p-3">{user.email}</td><td className="p-3 capitalize">{user.role}</td><td className="p-3">{user.store?.name||'-'}</td><td className="p-3"><div className="flex gap-2 justify-center"><button onClick={()=>forceResetPassword(user.email)} className="px-2 py-1 bg-blue-600 rounded text-xs">Reset PW</button><button onClick={()=>deleteUser(user.id)} className="p-1 text-red-400"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div>
      <div className="md:hidden space-y-3">{users.filter(u=>`${u.full_name} ${u.email} ${u.store?.name}`.toLowerCase().includes(userSearch.toLowerCase())).map(user=>(<div key={user.id} className="bg-gray-800 rounded-xl p-4"><div><p className="font-bold">{user.full_name}</p><p className="text-sm text-gray-400">{user.email}</p><p className="text-xs capitalize">{user.role} · {user.store?.name||'No store'}</p></div><div className="mt-3 flex gap-2 justify-end"><button onClick={()=>forceResetPassword(user.email)} className="px-3 py-1 bg-blue-600 rounded text-xs">Reset PW</button><button onClick={()=>deleteUser(user.id)} className="p-2 bg-gray-700 rounded text-red-400"><Trash2 size={16}/></button></div></div>))}</div>
    </div>)}

    {/* ---- AUDIT ---- */}
    {tab==='audit'&&(<div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Audit Log</h2><button onClick={loadAuditLogs} className="p-2 hover:bg-gray-700 rounded"><RefreshCw size={16}/></button></div>
      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input placeholder="Search actions..." value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} className="w-full pl-10 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"/></div>
      <div className="bg-gray-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto"><table className="w-full text-sm"><thead className="bg-gray-700"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead><tbody>{auditLogs.filter(log=>log.action.toLowerCase().includes(auditSearch.toLowerCase())||log.details?.toLowerCase().includes(auditSearch.toLowerCase())).map(log=>(<tr key={log.id} className="border-b border-gray-700"><td className="p-3 text-xs">{new Date(log.created_at).toLocaleString()}</td><td className="p-3">{log.action}</td><td className="p-3 text-xs text-gray-400">{log.details||''}</td></tr>))}</tbody></table></div>
    </div>)}

    {/* ---- SETTINGS ---- */}
    {tab==='settings'&&(<div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20}/> Global Settings</h2>
      <form onSubmit={saveGlobalSettings} className="bg-gray-800 p-6 rounded-xl space-y-4">
        <div><label className="block text-sm mb-1">Default Trial Days</label><input type="number" value={globalSettings.default_trial_days} onChange={e=>setGlobalSettings({...globalSettings,default_trial_days:parseInt(e.target.value)||3})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"/></div>
        <div><label className="block text-sm mb-1">Max Stores Per Account</label><input type="number" value={globalSettings.max_stores_per_account} onChange={e=>setGlobalSettings({...globalSettings,max_stores_per_account:parseInt(e.target.value)||3})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"/></div>
        <div><label className="block text-sm mb-1">Default Currency</label><input type="text" value={globalSettings.default_currency} onChange={e=>setGlobalSettings({...globalSettings,default_currency:e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"/></div>
        <button type="submit" disabled={settingsLoading} className="w-full bg-green-600 py-2 rounded flex items-center justify-center gap-2">{settingsLoading?'Saving...':'Save Settings'}</button>
      </form>
    </div>)}

    {/* Modals */}
    {selectedStore&&(<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto"><div className="p-4 border-b border-gray-700 flex justify-between"><h3 className="text-xl font-bold">{selectedStore.name}</h3><button onClick={()=>setSelectedStore(null)} className="text-gray-400"><X/></button></div><div className="p-4 space-y-4"><div className="grid grid-cols-2 gap-4"><div><p className="text-gray-400">Company</p><p>{selectedStore.company_settings?.company_name||'-'}</p></div><div><p className="text-gray-400">Email</p><p>{selectedStore.company_settings?.email||'-'}</p></div><div><p className="text-gray-400">Phone</p><p>{selectedStore.company_settings?.phone||'-'}</p></div><div><p className="text-gray-400">Products</p><p>{selectedStore.products?.count||0}</p></div><div><p className="text-gray-400">Sales</p><p>{selectedStore.sales?.count||0}</p></div><div><p className="text-gray-400">Locked</p><p>{selectedStore.locked?'Yes':'No'}</p></div></div><div><p className="text-gray-400 mb-2">Staff</p><div className="bg-gray-900 rounded p-2 max-h-40 overflow-auto">{selectedStore.staff?.map(s=>(<div key={s.id} className="text-sm py-1 border-b border-gray-800">{s.full_name} ({s.role}) - {s.email}</div>))}</div></div></div></div></div>)}
    {showSubModal&&(<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-xl w-full max-w-md"><div className="p-4 border-b border-gray-700 flex justify-between"><h3 className="text-xl font-bold">Update Subscription</h3><button onClick={()=>setShowSubModal(false)} className="text-gray-400"><X/></button></div><form onSubmit={handleSubUpdate} className="p-4 space-y-4"><div><label className="block text-sm mb-1">Status</label><select value={subForm.status} onChange={e=>setSubForm({...subForm,status:e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"><option value="active">Active</option><option value="trialing">Trialing</option><option value="expired">Expired</option><option value="suspended">Suspended</option></select></div><div><label className="block text-sm mb-1">End Date</label><input type="date" value={subForm.endDate} onChange={e=>setSubForm({...subForm,endDate:e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded"/></div><div className="flex gap-2 pt-2"><button type="button" onClick={()=>setShowSubModal(false)} className="flex-1 py-2 border border-gray-600 rounded">Cancel</button><button type="submit" className="flex-1 py-2 bg-green-600 rounded flex items-center justify-center gap-2"><CheckCircle size={18}/> Save</button></div></form></div></div>)}
  </div></div>);
}
