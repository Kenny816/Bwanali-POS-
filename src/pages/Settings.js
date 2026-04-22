import React,{useState,useEffect} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {Save,Building2,Smartphone,AlertCircle,CheckCircle,CreditCard,ClipboardPaste,Plus} from 'lucide-react';

export default function Settings() {
  const {staff,storeId,subscriptionStatus,trialDaysLeft,checkSubscription,user,availableStores,reloadStaff} = useAuth();
  const [loading,setLoading] = useState(false);
  const [initLoading,setInitLoading] = useState(true);
  const [form,setForm] = useState({
    company_name:'', tpin:'', address:'', phone:'', email:'',
    business_mobile_money_number:'', subscription_amount_local:'3500', local_currency:'ZMW'
  });
  const [showPaymentModal,setShowPaymentModal] = useState(false);
  const [smsText,setSmsText] = useState('');
  const [verifying,setVerifying] = useState(false);
  const [companySettings,setCompanySettings] = useState(null);
  const [showNewStoreModal,setShowNewStoreModal] = useState(false);
  const [newStore,setNewStore] = useState({name:''});
  const isAdmin = staff?.role === 'admin';

  useEffect(() => {
    if (!storeId || !isAdmin) return;
    loadSettings();
    loadCompanySettings();
  }, [storeId, isAdmin]);

  const loadSettings = async () => {
    try {
      const {data} = await supabase
        .from('company_settings')
        .select('company_name,tpin,address,phone,email,business_mobile_money_number,subscription_amount_local,local_currency')
        .eq('store_id',storeId)
        .single();
      if (data) setForm(data);
    } catch (err) {
      console.error(err);
    } finally {
      setInitLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    const {data} = await supabase.from('company_settings').select('*').eq('store_id',storeId).single();
    if (data) setCompanySettings(data);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {...form, store_id: storeId};
      const {data: existing} = await supabase.from('company_settings').select('id').eq('store_id',storeId).single();
      let error;
      if (existing) ({error} = await supabase.from('company_settings').update(payload).eq('id',existing.id));
      else ({error} = await supabase.from('company_settings').insert(payload));
      if (error) throw error;
      toast.success('Settings saved');
      loadCompanySettings();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = async e => {
    e.preventDefault();
    if (!newStore.name.trim()) return toast.error('Store name required');
    try {
      const {data: store, error: storeError} = await supabase
        .from('stores')
        .insert({name: newStore.name, subscription_status:'trialing', trial_started_at: new Date().toISOString()})
        .select('id')
        .single();
      if (storeError) throw storeError;

      await supabase.from('store_admins').insert({user_id: user.id, store_id: store.id});
      await supabase.from('company_settings').insert({store_id: store.id, company_name: newStore.name, receipt_footer:'Thank you for your business!'});
      await supabase.from('staff').insert({user_id: user.id, store_id: store.id, full_name: user.user_metadata?.full_name || 'Owner', email: user.email, role: 'admin', is_active: true});

      toast.success('New store created!');
      setShowNewStoreModal(false);
      setNewStore({name:''});
      await reloadStaff();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePaste = async () => {
    try {
      setSmsText(await navigator.clipboard.readText());
      toast.success('Pasted');
    } catch {
      toast.error('Cannot access clipboard');
    }
  };

  const extractSmsDetails = (text) => {
    const patterns = {
      transactionId: [
        /Txn\.?\s*ID\s*[:\-]?\s*([A-Z0-9.]+)/i,
        /Transaction\s*ID\s*[:\-]?\s*([A-Z0-9.]+)/i,
        /Trans\s*ID\s*[:\-]?\s*([A-Z0-9.]+)/i,
        /Ref\s*[:\-]?\s*([A-Z0-9.]+)/i
      ],
      amount: [
        /Amount\s*[:\-]?\s*([\d,]+\.?\d*)/i,
        /ZMW\s*([\d,]+\.?\d*)/i,
        /K\s*([\d,]+\.?\d*)/i
      ],
      senderName: [
        /from\s+([A-Za-z\s]+?)(?:\s+on|\s+at|\s+\.|\s+Ref|\s*$)/i
      ],
      senderPhone: [
        /from\s+(\d{10,})/i,
        /(\d{10,})/
      ]
    };
    let transactionId = null, amount = null, senderName = null, senderPhone = null;
    for (const regex of patterns.transactionId) {
      const m = text.match(regex);
      if (m) { transactionId = m[1].trim(); break; }
    }
    for (const regex of patterns.amount) {
      const m = text.match(regex);
      if (m) { amount = parseFloat(m[1].replace(/,/g, '')); break; }
    }
    for (const regex of patterns.senderName) {
      const m = text.match(regex);
      if (m) { senderName = m[1].trim(); break; }
    }
    for (const regex of patterns.senderPhone) {
      const m = text.match(regex);
      if (m) { senderPhone = m[1].trim(); break; }
    }
    return { transactionId, amount, senderName, senderPhone };
  };

  const handleVerifyPayment = async e => {
    e.preventDefault();
    if (!smsText.trim()) return toast.error('Paste SMS');
    setVerifying(true);
    try {
      const { transactionId, amount, senderName } = extractSmsDetails(smsText);
      if (!transactionId) throw new Error('Transaction ID not found');
      if (!amount) throw new Error('Amount not found');
      
      const expectedAmount = parseFloat(form.subscription_amount_local || 3500);
      if (amount < expectedAmount) throw new Error(`Amount too low (need ${expectedAmount})`);

      // Query the mobile_money_transactions table
      let query = supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('status', 'pending');
      
      const { data, error } = await query.single();
      
      if (error || !data) throw new Error('Transaction not found or already used');
      if (Math.abs(data.amount - amount) > 0.01) throw new Error('Amount mismatch');
      if (senderName && data.sender_name && !data.sender_name.toLowerCase().includes(senderName.toLowerCase())) {
        throw new Error('Sender name mismatch');
      }

      // Mark transaction as used
      await supabase.from('mobile_money_transactions').update({ status: 'used' }).eq('id', data.id);
      
      // Activate subscription for 12 months
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 12);
      await supabase.from('stores').update({
        subscription_status: 'active',
        subscription_end_date: endDate.toISOString(),
        subscription_plan: 'annual',
        trial_started_at: null  // clear trial
      }).eq('id', storeId);

      await checkSubscription(storeId);
      toast.success('Subscription activated for 12 months!');
      setShowPaymentModal(false);
      setSmsText('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (!isAdmin) return <div className="p-8 text-red-600">Access Denied</div>;
  if (initLoading) return <div className="p-8">Loading...</div>;

  const businessNumber = form.business_mobile_money_number || '097XXXXXXX';
  const localAmount = form.subscription_amount_local || '3500';
  const localCurrency = form.local_currency || 'ZMW';

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold"><Building2 className="inline mr-2"/>Store Settings</h1>
        <button onClick={()=>setShowNewStoreModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18}/> New Store
        </button>
      </div>

      {availableStores.length > 1 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Your Stores:</p>
          <div className="flex flex-wrap gap-2">
            {availableStores.map(s => (
              <span key={s.id} className={`px-3 py-1 rounded-full text-sm ${s.id === storeId ? 'bg-green-100 text-green-800' : 'bg-gray-200'}`}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Payment Banner */}
      {subscriptionStatus !== 'active' && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-3">
            <CreditCard className="text-green-600" size={24}/>
            <div className="flex-1">
              <p className="font-medium">
                {subscriptionStatus === 'trialing' ? 'Your 3-day trial is active' : 'Your trial has ended'}
              </p>
              <p className="text-sm">
                Subscribe now for {localCurrency} {localAmount}/year.
              </p>
            </div>
            <button onClick={()=>setShowPaymentModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              Pay Now
            </button>
          </div>
        </div>
      )}

      {subscriptionStatus === 'active' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
          <CheckCircle className="text-green-600"/>
          <span className="font-medium text-green-800">Subscription Active (Annual Plan)</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded-xl shadow p-6 space-y-4">
        <input placeholder="Company Name" disabled={false} disabled={false} value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} className="w-full p-2 border rounded"/>
        <input placeholder="TPIN" value={form.tpin} onChange={e=>setForm({...form,tpin:e.target.value})} className="w-full p-2 border rounded"/>
        <input placeholder="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="w-full p-2 border rounded"/>
        <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full p-2 border rounded"/>
        <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full p-2 border rounded"/>
        
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2"><Smartphone size={16} className="inline mr-1"/>Mobile Money Settings</h3>
          <input placeholder="Business Number" value={form.business_mobile_money_number} onChange={e=>setForm({...form,business_mobile_money_number:e.target.value})} className="w-full p-2 border rounded"/>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="number" placeholder="Amount" value={form.subscription_amount_local} onChange={e=>setForm({...form,subscription_amount_local:e.target.value})} className="w-full p-2 border rounded"/>
            <input placeholder="Currency" value={form.local_currency} onChange={e=>setForm({...form,local_currency:e.target.value})} className="w-full p-2 border rounded"/>
          </div>
        </div>
        
        <div className="pt-4">
          <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-lg">
            <Save size={18} className="inline mr-1"/>{loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b"><h2 className="text-xl font-bold">Complete Payment</h2></div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium">Send {localCurrency} {localAmount} to:</p>
                <p className="text-2xl font-bold">{businessNumber}</p>
              </div>
              <textarea
                value={smsText}
                onChange={e=>setSmsText(e.target.value)}
                rows={3}
                className="w-full p-2 border rounded font-mono text-sm"
                placeholder="Paste confirmation SMS here"
              />
              <div className="flex gap-2">
                <button onClick={handlePaste} className="px-3 py-1.5 bg-gray-200 rounded flex items-center gap-1">
                  <ClipboardPaste size={14}/>Paste
                </button>
                <button onClick={handleVerifyPayment} disabled={verifying} className="flex-1 bg-green-600 text-white py-1.5 rounded">
                  {verifying ? 'Verifying...' : 'Verify & Activate'}
                </button>
              </div>
            </div>
            <div className="p-3 border-t flex justify-end">
              <button onClick={()=>setShowPaymentModal(false)} className="px-4 py-1.5 border rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Store Modal */}
      {showNewStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b"><h2 className="text-xl font-bold">Create New Store</h2></div>
            <form onSubmit={handleCreateStore} className="p-4 space-y-4">
              <input placeholder="Store Name" value={newStore.name} onChange={e=>setNewStore({name:e.target.value})} className="w-full p-2 border rounded" required/>
              <div className="flex gap-2">
                <button type="button" onClick={()=>setShowNewStoreModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">Create Store</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
