import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { hashString } from '../lib/crypto';
import toast from 'react-hot-toast';
import {
  Clock, Store, Shield, AlertTriangle, CheckCircle,
  CreditCard, ClipboardPaste, Plus, Save, Building2, Smartphone, Camera, Upload, Key
} from 'lucide-react';

export default function Settings() {
  const {
    staff, storeId, availableStores, subscriptionStatus, trialDaysLeft,
    isLocked, checkSubscription, user, reloadStaff
  } = useAuth();

  // Subscription
  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [now, setNow] = useState(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Company settings
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
    receipt_header: '',
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

  // New store modal
  const [showNewStoreModal, setShowNewStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');

  // ------ Recovery key ------
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoverySaving, setRecoverySaving] = useState(false);

  const isAdmin = staff?.role === 'admin';

  // Load company settings
  useEffect(() => {
    if (!selectedStoreId) return;
    setLoading(true);
    supabase
      .from('company_settings')
      .select('*')
      .eq('store_id', selectedStoreId)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            company_name: data.company_name || '',
            tpin: data.tpin || '',
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            business_mobile_money_number: data.business_mobile_money_number || '',
            local_currency: data.local_currency || 'ZMW',
            receipt_header: data.receipt_header || '',
            receipt_footer: data.receipt_footer || 'Thank you for your business!',
            vat_registered: data.vat_registered || false,
            vat_rate: String(data.vat_rate || '16'),
            hardware_scanner: data.hardware_scanner || 'camera',
            low_stock_threshold: String(data.low_stock_threshold || '5'),
            logo_url: data.logo_url || '',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedStoreId]);

  // Check subscription expiration
  useEffect(() => {
    const checkExpiry = () => {
      const stores = JSON.parse(localStorage.getItem('bwanali_stores') || '[]');
      const store = stores.find(s => s.id === storeId);
      if (store?.subscription_end) {
        setSubscriptionEnd(new Date(store.subscription_end));
      }
    };
    checkExpiry();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [storeId]);

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const existing = await supabase
        .from('company_settings')
        .select('id')
        .eq('store_id', selectedStoreId)
        .single();
      const payload = { ...form, store_id: selectedStoreId };
      if (existing.data) {
        await supabase.from('company_settings').update(payload).eq('id', existing.data.id);
      } else {
        await supabase.from('company_settings').insert(payload);
      }
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return toast.error('Enter a store name');
    try {
      const newStoreId = Date.now().toString(36);
      const stores = JSON.parse(localStorage.getItem('bwanali_stores') || '[]');
      stores.push({
        id: newStoreId,
        name: newStoreName.trim(),
        subscription_status: 'trialing',
        trial_started_at: new Date().toISOString(),
        subscription_plan: 'monthly',
        locked: false,
      });
      localStorage.setItem('bwanali_stores', JSON.stringify(stores));
// Link current admin to the new store      const admins = JSON.parse(localStorage.getItem('bwanali_store_admins') || '[]');      admins.push({ user_id: user?.id || staff?.id, store_id: newStoreId });      localStorage.setItem('bwanali_store_admins', JSON.stringify(admins));      window.dispatchEvent(new CustomEvent('db-change', { detail: { table: 'store_admins' } }));
      window.dispatchEvent(new CustomEvent('db-change', { detail: { table: 'stores' } }));
      // Also create company_settings entry for the new store
      const settings = JSON.parse(localStorage.getItem('bwanali_company_settings') || '[]');
      settings.push({
        id: Date.now().toString(36),
        store_id: newStoreId,
        company_name: newStoreName.trim(),
        local_currency: 'ZMW',
        receipt_footer: 'Thank you!',
        currency_symbol: 'K',
        receipt_header: '',
        logo_url: '',
      });
      localStorage.setItem('bwanali_company_settings', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('db-change', { detail: { table: 'company_settings' } }));
      toast.success('New store created');
      setNewStoreName('');
      setShowNewStoreModal(false);
      // Refresh available stores (will reload context)
      window.location.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ------ Recovery key handling ------
  const handleSaveRecoveryKey = async () => {
    if (!recoveryKey.trim()) return toast.error('Enter a recovery key');
    setRecoverySaving(true);
    try {
      const hash = await hashString(recoveryKey.trim());
      await supabase
        .from('staff')
        .update({ recovery_key_hash: hash })
        .eq('id', staff.id);
      toast.success('Recovery key saved');
      setRecoveryKey('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRecoverySaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-lg">Loading settings...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h1>

      {/* Subscription Card (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            <h2 className="font-semibold text-base sm:text-lg">Subscription</h2>
          </div>
          <div className="text-sm space-y-1">
            <p>Status: <span className="font-medium capitalize">{subscriptionStatus}</span></p>
            {trialDaysLeft !== null && <p>Trial days left: <span className="font-medium">{trialDaysLeft}</span></p>}
            {subscriptionEnd && <p>Expires: {subscriptionEnd.toLocaleDateString()}</p>}
          </div>
          <button onClick={() => setShowPaymentModal(true)} className="mt-4 w-full sm:w-auto bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700">
            Subscribe / Pay
          </button>
        </div>
      )}

      {/* Company Settings Form */}
      <form onSubmit={handleSaveCompany} className="bg-white rounded-2xl shadow p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          <h2 className="font-semibold text-base sm:text-lg">Company Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input placeholder="My Store" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">TPIN</label>
            <input placeholder="Taxpayer ID" value={form.tpin} onChange={e => setForm({...form, tpin: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input placeholder="Street, City" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input placeholder="+260..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" placeholder="info@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mobile Money Number</label>
            <input placeholder="097..." value={form.business_mobile_money_number} onChange={e => setForm({...form, business_mobile_money_number: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select value={form.local_currency} onChange={e => setForm({...form, local_currency: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm bg-white">
              <option value="ZMW">ZMW (Zambian Kwacha)</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.vat_registered} onChange={e => setForm({...form, vat_registered: e.target.checked})} className="rounded" />
              VAT Registered
            </label>
            {form.vat_registered && (
              <input placeholder="VAT Rate %" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} className="w-20 p-2.5 border rounded-lg text-sm" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Receipt Header</label>
            <input placeholder="Receipt Header" value={form.receipt_header} onChange={e => setForm({...form, receipt_header: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Receipt Footer</label>
            <input placeholder="Thank you!" value={form.receipt_footer} onChange={e => setForm({...form, receipt_footer: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
            <input type="number" min="1" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Company Settings'}
        </button>
      </form>

      {/* Recovery Key Section (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            <h2 className="font-semibold text-base sm:text-lg">Account Recovery Key</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Set a secret phrase that you can use to reset your password if you ever lose it.
            This is stored securely (hashed) and works completely offline.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              placeholder="Enter a secret phrase"
              value={recoveryKey}
              onChange={e => setRecoveryKey(e.target.value)}
              className="flex-1 p-2.5 border rounded-lg text-sm"
            />
            <button onClick={handleSaveRecoveryKey} disabled={recoverySaving} className="w-full sm:w-auto bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50">
              <Save size={16} /> {recoverySaving ? 'Saving...' : 'Save Recovery Key'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">After saving, you can use this phrase on the login screen to reset your password.</p>
        </div>
      )}

      {/* Store Management (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            <h2 className="font-semibold text-base sm:text-lg">Stores</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="New store name"
              value={newStoreName}
              onChange={e => setNewStoreName(e.target.value)}
              className="flex-1 p-2.5 border rounded-lg text-sm"
            />
            <button onClick={handleCreateStore} className="w-full sm:w-auto bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-700">
              <Plus size={16} /> Add Store
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal (placeholder) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="font-bold text-lg mb-4">Subscribe</h2>
            <p className="text-sm text-gray-600 mb-4">Payment integration can be added here.</p>
            <button onClick={() => setShowPaymentModal(false)} className="w-full py-2.5 border rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
