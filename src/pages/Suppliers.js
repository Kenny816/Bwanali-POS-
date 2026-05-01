import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Truck, Plus, Search, X, Edit2, Trash2, Phone, MapPin, Package, DollarSign, CheckCircle, Clock, FileText, User } from 'lucide-react';

export default function Suppliers() {
  const { storeId, isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Supplier form
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', representative: '', notes: '' });

  // Supply form
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [supplyForm, setSupplyForm] = useState({ supplier_id: '', product_id: '', quantity: 0, amount_paid: 0, notes: '' });

  // Inline new product form inside supply modal
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', unit_price: '' });

  const loadData = useCallback(async () => {
    if (!storeId) return;
    const allSuppliers = JSON.parse(localStorage.getItem('bwanali_suppliers') || '[]');
    setSuppliers(allSuppliers.filter(s => s.store_id === storeId));

    const allSupplies = JSON.parse(localStorage.getItem('bwanali_supplies') || '[]');
    setSupplies(allSupplies.filter(s => s.store_id === storeId));

    const { data } = await supabase.from('products').select('id,name,unit_price').eq('store_id', storeId).eq('is_active', true).order('name');
    setProducts(data?.data || data || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSuppliers = (list) => {
    const all = JSON.parse(localStorage.getItem('bwanali_suppliers') || '[]');
    const others = all.filter(s => s.store_id !== storeId);
    localStorage.setItem('bwanali_suppliers', JSON.stringify([...others, ...list]));
    window.dispatchEvent(new CustomEvent('db-change'));
  };

  const saveSupplies = (list) => {
    const all = JSON.parse(localStorage.getItem('bwanali_supplies') || '[]');
    const others = all.filter(s => s.store_id !== storeId);
    localStorage.setItem('bwanali_supplies', JSON.stringify([...others, ...list]));
    window.dispatchEvent(new CustomEvent('db-change'));
  };

  // ---- Supplier CRUD ----
  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return toast.error('Name required');
    try {
      let updated;
      const base = { ...supplierForm, store_id: storeId, updated_at: new Date().toISOString() };
      if (editingSupplier) {
        base.id = editingSupplier.id;
        base.created_at = editingSupplier.created_at;
        updated = suppliers.map(s => s.id === editingSupplier.id ? base : s);
        toast.success('Supplier updated');
      } else {
        base.id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        base.created_at = new Date().toISOString();
        updated = [...suppliers, base];
        toast.success('Supplier added');
      }
      setSuppliers(updated);
      saveSuppliers(updated);
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', phone: '', email: '', address: '', representative: '', notes: '' });
    } catch (err) { toast.error(err.message); }
  };

  const deleteSupplier = async (sup) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm(`Delete ${sup.name}?`)) return;
    const updated = suppliers.filter(s => s.id !== sup.id);
    setSuppliers(updated);
    saveSuppliers(updated);
    toast.success('Deleted');
  };

  const openEditSupplier = (sup) => {
    setEditingSupplier(sup);
    setSupplierForm({ name: sup.name, phone: sup.phone || '', email: sup.email || '', address: sup.address || '', representative: sup.representative || '', notes: sup.notes || '' });
    setShowSupplierModal(true);
  };

  // ---- Supply Form ----
  const handleSupplySubmit = async (e) => {
    e.preventDefault();
    if (!supplyForm.supplier_id || !supplyForm.product_id) return toast.error('Select supplier and product');
    const qty = parseInt(supplyForm.quantity) || 0;
    if (qty <= 0) return toast.error('Invalid quantity');
    const amount = parseFloat(supplyForm.amount_paid) || 0;

    const newSupply = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      ...supplyForm,
      quantity: qty,
      amount_paid: amount,
      store_id: storeId,
      verified: false,
      created_at: new Date().toISOString(),
    };
    const updated = [...supplies, newSupply];
    setSupplies(updated);
    saveSupplies(updated);
    toast.success('Supply recorded');
    setShowSupplyModal(false);
    setSupplyForm({ supplier_id: '', product_id: '', quantity: 0, amount_paid: 0, notes: '' });
    setShowNewProduct(false);
  };

  // ---- Quick Add Product ----
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return toast.error('Product name required');
    const price = parseFloat(newProduct.unit_price) || 0;
    const { data } = await supabase.from('products').insert({
      name: newProduct.name.trim(),
      unit_price: price,
      cost_price: 0,
      store_id: storeId,
      is_active: true,
      stock_quantity: 0,
    }).select().single();
    toast.success('Product added');
    // Refresh product list and select the new product
    await loadData();
    if (data) {
      setSupplyForm({ ...supplyForm, product_id: data.id });
    }
    setShowNewProduct(false);
    setNewProduct({ name: '', unit_price: '' });
  };

  // ---- Verification ----
  const verifySupply = async (supply) => {
    if (!isAdmin) return toast.error('Admin only');
    if (supply.verified) return toast.info('Already verified');
    try {
      const allProducts = JSON.parse(localStorage.getItem('bwanali_products') || '[]');
      const product = allProducts.find(p => p.id === supply.product_id && p.store_id === storeId);
      if (!product) { toast.error('Product not found'); return; }
      const updatedProduct = { ...product, stock_quantity: (product.stock_quantity || 0) + supply.quantity };
      const updatedProducts = allProducts.map(p => p.id === product.id ? updatedProduct : p);
      localStorage.setItem('bwanali_products', JSON.stringify(updatedProducts));
      window.dispatchEvent(new CustomEvent('db-change'));

      const updatedSupplies = supplies.map(s => s.id === supply.id ? { ...s, verified: true, verified_at: new Date().toISOString() } : s);
      setSupplies(updatedSupplies);
      saveSupplies(updatedSupplies);
      toast.success('Supply verified and stock updated');
    } catch (err) { toast.error(err.message); }
  };

  const deleteSupply = async (supply) => {
    if (!isAdmin) return toast.error('Admin only');
    const updated = supplies.filter(s => s.id !== supply.id);
    setSupplies(updated);
    saveSupplies(updated);
    toast.success('Supply deleted');
  };

  const filteredSuppliers = suppliers.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const getSuppliesFor = (supId) => supplies.filter(s => s.supplier_id === supId);
  const getProductName = (pid) => products.find(p => p.id === pid)?.name || 'Unknown';

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold"><Truck className="inline mr-2" />Suppliers</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', email: '', address: '', representative: '', notes: '' }); setShowSupplierModal(true); }} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"><Plus size={18} /> Add Supplier</button>
          <button onClick={() => setShowSupplyModal(true)} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"><Package size={18} /> Record Supply</button>
        </div>
      </div>

      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input placeholder="Search suppliers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg" /></div>

      <div className="space-y-4">
        {filteredSuppliers.map(s => {
          const supps = getSuppliesFor(s.id);
          return (
            <div key={s.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold">{s.name}</h3>
                  {s.representative && <p className="text-sm flex items-center gap-1 mt-1"><User size={14} /> {s.representative}</p>}
                  {s.phone && <p className="text-sm flex items-center gap-1"><Phone size={14} /> {s.phone}</p>}
                  {s.email && <p className="text-sm flex items-center gap-1"><FileText size={14} /> {s.email}</p>}
                  {s.address && <p className="text-sm flex items-center gap-1"><MapPin size={14} /> {s.address}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditSupplier(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                  {isAdmin && <button onClick={() => deleteSupplier(s)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>}
                </div>
              </div>

              <div className="mt-4 border-t pt-3">
                <h4 className="font-medium text-sm mb-2">Supplies</h4>
                {supps.length === 0 ? <p className="text-xs text-gray-500">No supplies recorded</p> : (
                  <div className="space-y-2">
                    {supps.map(sup => (
                      <div key={sup.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                        <div className="flex-1">
                          <span className="font-medium">{getProductName(sup.product_id)}</span>
                          <span className="text-gray-500 ml-2">x{sup.quantity}</span>
                          <span className="text-green-700 ml-2">K{sup.amount_paid?.toFixed(2)}</span>
                          {sup.notes && <span className="text-xs text-gray-400 ml-2">({sup.notes})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {sup.verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs"><CheckCircle size={12} /> Verified</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs"><Clock size={12} /> Pending</span>
                          )}
                          {isAdmin && !sup.verified && (
                            <button onClick={() => verifySupply(sup)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Verify & add to inventory"><CheckCircle size={16} /></button>
                          )}
                          {isAdmin && <button onClick={() => deleteSupply(sup)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between"><h2>{editingSupplier ? 'Edit' : 'Add'} Supplier</h2><button onClick={() => setShowSupplierModal(false)}><X/></button></div>
            <form onSubmit={handleSupplierSubmit} className="p-4 space-y-3">
              <input placeholder="Name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full p-2 border rounded" required />
              <input placeholder="Representative / Contact Person" value={supplierForm.representative} onChange={e => setSupplierForm({ ...supplierForm, representative: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Phone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Address" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full p-2 border rounded" />
              <textarea placeholder="Notes" value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} className="w-full p-2 border rounded" rows={2} />
              <div className="flex gap-2"><button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 py-2 border rounded">Cancel</button><button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">{editingSupplier ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Supply Modal with inline Add Product */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between"><h2>Record Supply</h2><button onClick={() => setShowSupplyModal(false)}><X/></button></div>
            <form onSubmit={handleSupplySubmit} className="p-4 space-y-3">
              <select value={supplyForm.supplier_id} onChange={e => setSupplyForm({ ...supplyForm, supplier_id: e.target.value })} className="w-full p-2 border rounded" required>
                <option value="">Select supplier</option>
                {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <div className="relative">
                <select value={supplyForm.product_id} onChange={e => setSupplyForm({ ...supplyForm, product_id: e.target.value })} className="w-full p-2 border rounded" required>
                  <option value="">Select product</option>
                  {products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <button type="button" onClick={() => setShowNewProduct(!showNewProduct)} className="mt-1 text-sm text-blue-600 underline">
                  {showNewProduct ? 'Cancel' : '+ Add Product'}
                </button>
                {showNewProduct && (
                  <div className="mt-2 p-3 bg-gray-50 rounded border space-y-2">
                    <input placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full p-2 border rounded" />
                    <input type="number" step="0.01" placeholder="Selling Price" value={newProduct.unit_price} onChange={e => setNewProduct({ ...newProduct, unit_price: e.target.value })} className="w-full p-2 border rounded" />
                    <button type="button" onClick={handleAddProduct} className="w-full py-1.5 bg-green-600 text-white rounded text-sm">Add Product</button>
                  </div>
                )}
              </div>
              <input type="number" placeholder="Quantity" value={supplyForm.quantity} onChange={e => setSupplyForm({ ...supplyForm, quantity: e.target.value })} className="w-full p-2 border rounded" required min="1" />
              <input type="number" step="0.01" placeholder="Amount Paid" value={supplyForm.amount_paid} onChange={e => setSupplyForm({ ...supplyForm, amount_paid: e.target.value })} className="w-full p-2 border rounded" />
              <textarea placeholder="Notes" value={supplyForm.notes} onChange={e => setSupplyForm({ ...supplyForm, notes: e.target.value })} className="w-full p-2 border rounded" rows={2} />
              <div className="flex gap-2"><button type="button" onClick={() => setShowSupplyModal(false)} className="flex-1 py-2 border rounded">Cancel</button><button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded">Record</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
