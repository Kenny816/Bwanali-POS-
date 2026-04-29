import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  Clock, Store, Shield, AlertTriangle, CheckCircle,
  CreditCard, ClipboardPaste, Plus, Save, Building2, Smartphone, Camera, Upload
} from 'lucide-react';

export default function Settings() {
  const {
    staff, storeId, availableStores, subscriptionStatus, trialDaysLeft,
    isLocked, checkSubscription, user, reloadStaff
  } = useAuth();

  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [now, setNow] = useState(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');

  const [selectedStoreId, setSelectedStoreId] = useState(storeId);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    company_name: '',
    tpin: '',
    address: '',
    phone: '',
    email: '',
    business_mobile_money_number: '',
    local_currency: 'ZMW',
    receipt_footer: 'Thank you for your business!',
    vat_registered: false,
    vat_rate: '16',
    hardware_scanner: 'camera',
    low_stock_threshold: '5',
    logo_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showNewStoreModal, setShowNewStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');

  const isAdmin = staff?.role === 'admin';
  const storeCount = availableStores?.length || 0;

  // Pricing: 150/month per store, 1500/year per store
  const monthlyPrice = 150 * storeCount;
  const annualPrice = 1500 * storeCount;
  const paymentAmount = billingCycle === 'monthly' ? monthlyPrice : annualPrice;
  const currency = form.local_currency || 'ZMW';
  const businessNumber = form.business_mobile_money_number || '097XXXXXXX';

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!selectedStoreId || !isAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('company_settings').select('*').eq('store_id', selectedStoreId).single();
        if (data) setForm(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    load();
  }, [selectedStoreId, isAdmin]);

  useEffect(() => {
    if (availableStores?.length > 0) {
      const end = availableStores[0]?.subscription_end_date;
      setSubscriptionEnd(end ? new Date(end) : null);
    }
  }, [availableStores]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedStoreId}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      setForm(prev => ({ ...prev, logo_url: publicUrlData.publicUrl }));
      toast.success('Logo uploaded');
    } catch (err) { toast.error('Upload failed: ' + err.message); } finally { setUploading(false); }
  };

  const formatTimeLeft = (endDate) => {
    const diff = endDate - now;
    if (diff <= 0) return { expired: true, text: 'Expired' };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { expired: false, text: `${days}d ${hours}h remaining` };
  };
  const timeLeftInfo = subscriptionEnd ? formatTimeLeft(subscriptionEnd) : null;

  const handlePaste = async () => {
    try { setSmsText(await navigator.clipboard.readText()); toast.success('Pasted'); } catch { toast.error('Cannot access clipboard'); }
  };

  // Submit SMS for verification (monthly or annual)
  const handleSubmitForVerification = async (e) => {
    e.preventDefault();
    if (!smsText.trim()) return toast.error('Paste SMS');
    setSending(true);
    try {
      const { error } = await supabase.from('pending_subscription_payments').insert({
        phone_number: form.phone || '0',
        expected_amount: paymentAmount,
        expected_store_count: storeCount,
        store_id: selectedStoreId,
        raw_sms: smsText.trim(),
        status: 'pending',
        notes: `Billing cycle: ${billingCycle}`
      });
      if (error) throw error;
      toast.success('Verification request sent to super admin.');
      setShowPaymentModal(false);
      setSmsText('');
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, store_id: selectedStoreId, vat_rate: parseFloat(form.vat_rate) || 16, low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5 };
      const { data: existing } = await supabase.from('company_settings').select('id').eq('store_id', selectedStoreId).single();
      let error;
      if (existing) ({ error } = await supabase.from('company_settings').update(payload).eq('id', existing.id));
      else ({ error } = await supabase.from('company_settings').insert(payload));
      if (error) throw error;
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreName.trim()) return toast.error('Store name required');
    try {
      const { data: store } = await supabase.from('stores').insert({
        name: newStoreName.trim(),
        subscription_status: 'trialing',
        trial_started_at: new Date().toISOString()
      }).select('id').single();
      await supabase.from('store_admins').insert({ user_id: user.id, store_id: store.id });
      await supabase.from('company_settings').insert({
        store_id: store.id, company_name: newStoreName.trim(), receipt_footer: 'Thank you for your business!'
      });
      await supabase.from('staff').insert({
        user_id: user.id, store_id: store.id,
        full_name: user.user_metadata?.full_name || 'Owner', email: user.email, role: 'admin', is_active: true
      });
      toast.success('New store created!');
      setShowNewStoreModal(false);
      setNewStoreName('');
      await reloadStaff();
      setSelectedStoreId(store.id);
    } catch (err) { toast.error(err.message); }
  };

  if (!isAdmin) return <div className="p-8 text-red-600">Access Denied</div>;
  if (loading && !selectedStoreId) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto max-w-2xl mx-auto space-y-8">
      {/* Subscription Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-green-600" /> Current Subscription</h2>
          <span className="text-sm text-gray-500">{storeCount} store{storeCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="mb-4">
          <p className="text-3xl font-bold">{storeCount} Store{storeCount !== 1 ? 's' : ''}</p>
          <p className="text-lg text-green-700">ZMW {monthlyPrice}<span className="text-gray-500 text-sm">/month</span> or ZMW {annualPrice}<span className="text-gray-500 text-sm">/year</span></p>
        </div>
        <div className="flex items-center gap-2 mb-4">
          {subscriptionStatus === 'active' && <CheckCircle className="text-green-600" size={20} />}
          {subscriptionStatus === 'trialing' && <Clock className="text-blue-600" size={20} />}
          {subscriptionStatus === 'expired' && <AlertTriangle className="text-red-600" size={20} />}
          <span className={`font-semibold ${subscriptionStatus === 'active' ? 'text-green-700' : subscriptionStatus === 'trialing' ? 'text-blue-700' : 'text-red-700'}`}>
            {subscriptionStatus === 'active' ? 'Active' : subscriptionStatus === 'trialing' ? `Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : subscriptionStatus === 'expired' ? 'Expired' : 'Pending'}
          </span>
        </div>
        {subscriptionStatus === 'active' && timeLeftInfo && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg text-sm"><Clock className="inline mr-1 text-green-600" size={16} /> {timeLeftInfo.text}{subscriptionEnd && <span className="ml-2 text-gray-500">Expires {subscriptionEnd.toLocaleDateString()}</span>}</div>
        )}
        {isLocked && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> Access restricted — subscription required.
          </div>
        )}
        <button onClick={() => setShowPaymentModal(true)} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700">
          <CreditCard size={20} /> {subscriptionStatus === 'active' ? 'Upgrade Subscription' : 'Subscribe Now'}
        </button>
      </div>

      {/* Store Switcher */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Store size={20} /> Your Stores</h2>
          <button onClick={() => setShowNewStoreModal(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 text-white">
            <Plus size={18} /> Add Store
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableStores.map(s => (
            <button key={s.id} onClick={() => setSelectedStoreId(s.id)} className={`px-4 py-2 rounded-full text-sm font-medium transition ${s.id === selectedStoreId ? 'bg-green-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>{s.name}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">Pricing: ZMW 150/month per store, or ZMW 1,500/year per store. Add a store to scale your business.</p>
      </div>

      {/* Company Settings Form */}
      {selectedStoreId && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Building2 size={20} /> Company Settings</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Company Logo</label>
              <div className="flex items-center gap-4">
                {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain border rounded" />}
                <label className="flex-1 cursor-pointer bg-gray-100 hover:bg-gray-200 rounded-lg p-3 text-center text-sm">
                  <Upload size={16} className="inline mr-1" />
                  {uploading ? 'Uploading...' : 'Choose Logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
            </div>
            <input placeholder="Company Name" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full p-2 border rounded" />
            <input placeholder="TPIN" value={form.tpin} onChange={e => setForm({...form, tpin: e.target.value})} className="w-full p-2 border rounded" />
            <input placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full p-2 border rounded" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded" />
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full p-2 border rounded" />
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Receipt & Tax</h3>
              <input placeholder="Receipt Footer" value={form.receipt_footer} onChange={e => setForm({...form, receipt_footer: e.target.value})} className="w-full p-2 border rounded mb-2" />
              <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={form.vat_registered} onChange={e => setForm({...form, vat_registered: e.target.checked})} /> VAT Registered</label>
              {form.vat_registered && <input type="number" step="0.1" placeholder="VAT Rate (%)" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} className="w-full p-2 border rounded" />}
            </div>
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2 flex items-center gap-1"><Camera size={16} /> Barcode Scanner</h3>
              <select value={form.hardware_scanner} onChange={e => setForm({...form, hardware_scanner: e.target.value})} className="w-full p-2 border rounded">
                <option value="camera">Camera (built-in)</option>
                <option value="bluetooth">Bluetooth Scanner</option>
                <option value="usb">USB Scanner</option>
              </select>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Inventory Alerts</h3>
              <label className="text-sm text-gray-500 mb-1 block">Low Stock Threshold</label>
              <input type="number" min="0" step="1" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} className="w-full p-2 border rounded" />
              <p className="text-xs text-gray-400 mt-1">Products with stock ≤ this value will be shown on the Dashboard.</p>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2 flex items-center gap-1"><Smartphone size={16} /> Mobile Money Settings</h3>
              <input placeholder="Business Number" value={form.business_mobile_money_number} onChange={e => setForm({...form, business_mobile_money_number: e.target.value})} className="w-full p-2 border rounded mb-2" />
              <input placeholder="Currency (ZMW)" value={form.local_currency} onChange={e => setForm({...form, local_currency: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <button type="submit" disabled={saving} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700">
              <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* Payment Modal – Monthly / Annual choice */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b"><h2 className="text-xl font-bold">Subscribe</h2></div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium">{storeCount} Store{storeCount !== 1 ? 's' : ''}</p>
                <p className="text-sm mt-1">Monthly: ZMW {monthlyPrice} | Annual: ZMW {annualPrice}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Choose Billing Cycle</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="billingCycle" value="monthly" checked={billingCycle === 'monthly'} onChange={() => setBillingCycle('monthly')} />
                    <span>Monthly (ZMW {monthlyPrice})</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="billingCycle" value="annual" checked={billingCycle === 'annual'} onChange={() => setBillingCycle('annual')} />
                    <span>Annual (ZMW {annualPrice})</span>
                  </label>
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-medium">Total to Send: <span className="text-xl font-bold">ZMW {paymentAmount}</span></p>
                <p className="text-sm mt-1">Send to: <span className="font-bold">{businessNumber}</span></p>
                <p className="text-xs mt-2 text-gray-500">Use Airtel Money and save the confirmation SMS.</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-sm">
                <p className="font-medium">Instructions:</p>
                <ol className="list-decimal ml-4 mt-1 space-y-1">
                  <li>Send the exact amount above to {businessNumber} via Airtel Money.</li>
                  <li>Copy the confirmation SMS you receive.</li>
                  <li>Paste it below and click "Submit for Verification".</li>
                  <li>A super admin will verify and activate your subscription.</li>
                </ol>
              </div>
              <textarea
                value={smsText}
                onChange={e => setSmsText(e.target.value)}
                rows={4}
                className="w-full p-2 border rounded font-mono text-sm"
                placeholder="Paste the Airtel Money confirmation SMS..."
              />
              <div className="flex gap-2">
                <button onClick={handlePaste} className="px-3 py-1.5 bg-gray-200 rounded flex items-center gap-1"><ClipboardPaste size={14} /> Paste</button>
                <button onClick={handleSubmitForVerification} disabled={sending} className="flex-1 bg-blue-600 text-white py-1.5 rounded">
                  {sending ? 'Sending...' : 'Submit for Verification'}
                </button>
              </div>
            </div>
            <div className="p-3 border-t flex justify-end"><button onClick={() => setShowPaymentModal(false)} className="px-4 py-1.5 border rounded">Cancel</button></div>
          </div>
        </div>
      )}

      {/* New Store Modal */}
      {showNewStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b"><h2 className="text-xl font-bold">Add New Store</h2></div>
            <form onSubmit={handleCreateStore} className="p-4 space-y-4">
              <input placeholder="Store Name" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="w-full p-2 border rounded" required autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewStoreModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded">Create Store</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
