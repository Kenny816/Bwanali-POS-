import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Package, Search, X, ArrowRightLeft } from 'lucide-react';

export default function StockTransfers() {
  const { staff, storeId, availableStores } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({ product_id: '', to_store_id: '', quantity: 1 });

  const isAdmin = staff?.role === 'admin';

  // Only show stores that belong to this admin (from AuthContext)
  useEffect(() => {
    if (isAdmin && availableStores) {
      setStores(availableStores.filter(s => s.id !== storeId));
    }
  }, [availableStores, storeId, isAdmin]);

  const loadTransfers = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
      .order('created_at', { ascending: false });
    setTransfers(data?.data || data || []);
    setLoading(false);
  }, [storeId]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name');
    setProducts(data?.data || data || []);
  };

  useEffect(() => {
    if (storeId) {
      loadTransfers();
      loadProducts();
    }
  }, [storeId, loadTransfers]);

  // Auto‑refresh
  useEffect(() => {
    const handler = () => loadTransfers();
    window.addEventListener('db-change', handler);
    return () => window.removeEventListener('db-change', handler);
  }, [loadTransfers]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!form.product_id || !form.to_store_id) return toast.error('Select product and destination store');
    const qty = parseInt(form.quantity) || 0;
    if (qty <= 0) return toast.error('Invalid quantity');
    const product = products.find(p => p.id === form.product_id);
    if (!product || qty > product.stock_quantity) return toast.error('Not enough stock');

    try {
      await supabase.from('stock_transfers').insert({
        from_store_id: storeId,
        to_store_id: form.to_store_id,
        product_id: form.product_id,
        quantity: qty,
        staff_id: staff.id,
      });

      // Decrement source
      await supabase.from('products').update({ stock_quantity: product.stock_quantity - qty }).eq('id', product.id);

      // Increment destination (try to find same product in destination store)
      const allProducts = JSON.parse(localStorage.getItem('bwanali_products') || '[]');
      const destProduct = allProducts.find(p => p.store_id === form.to_store_id && p.name === product.name);
      if (destProduct) {
        await supabase.from('products').update({ stock_quantity: destProduct.stock_quantity + qty }).eq('id', destProduct.id);
      } else {
        // Create new product entry in destination store
        await supabase.from('products').insert({
          store_id: form.to_store_id,
          name: product.name,
          barcode: product.barcode,
          category: product.category,
          unit_price: product.unit_price,
          cost_price: product.cost_price,
          stock_quantity: qty,
          is_active: true,
          expiry_date: product.expiry_date,
        });
      }

      toast.success('Stock transferred');
      setShowCreate(false);
      setForm({ product_id: '', to_store_id: '', quantity: 1 });
      loadTransfers();
      loadProducts();
      window.dispatchEvent(new CustomEvent('db-change'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!isAdmin) return <div className="p-8 text-red-600">Access Denied</div>;
  if (loading) return <div className="p-8">Loading transfers...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold"><ArrowRightLeft className="inline mr-2" />Stock Transfers</h1>
        <button onClick={() => setShowCreate(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Package size={18} /> New Transfer
        </button>
      </div>

      {stores.length === 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-4 text-sm">
          You need at least two stores to transfer stock. Create another store in Settings.
        </div>
      )}

      <div className="space-y-4">
        {transfers.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-30" />
            <p>No transfers yet</p>
          </div>
        ) : (
          transfers.map(t => (
            <div key={t.id} className="bg-white rounded-xl shadow p-4">
              <p className="font-medium">Product ID: {t.product_id}</p>
              <p className="text-sm">Qty: {t.quantity} | From: {t.from_store_id} → To: {t.to_store_id}</p>
              <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between"><h2>Transfer Stock</h2><button onClick={() => setShowCreate(false)}><X/></button></div>
            <form onSubmit={handleTransfer} className="p-4 space-y-3">
              <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} className="w-full p-2 border rounded">
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>)}
              </select>
              <select value={form.to_store_id} onChange={e => setForm({...form, to_store_id: e.target.value})} className="w-full p-2 border rounded">
                <option value="">Select destination store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full p-2 border rounded" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
