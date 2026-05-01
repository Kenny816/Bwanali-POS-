import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users, Plus, Search, X, Edit2, Trash2, CreditCard } from 'lucide-react';

export default function Customers() {
  const { storeId, isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', credit_limit: '', credit_balance: '' });

  const loadCustomers = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId).order('name');
    setCustomers(data?.data || data || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { if (storeId) loadCustomers(); }, [storeId, loadCustomers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    const payload = {
      ...form,
      credit_limit: parseFloat(form.credit_limit) || 0,
      credit_balance: parseFloat(form.credit_balance) || 0,
      store_id: storeId,
    };
    try {
      if (editing) {
        await supabase.from('customers').update(payload).eq('id', editing.id);
        toast.success('Customer updated');
      } else {
        await supabase.from('customers').insert(payload);
        toast.success('Customer added');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', phone: '', credit_limit: '', credit_balance: '' });
      loadCustomers();
    } catch (err) { toast.error(err.message); }
  };

  const deleteCustomer = async (cust) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm(`Delete ${cust.name}?`)) return;
    await supabase.from('customers').delete().eq('id', cust.id);
    toast.success('Deleted');
    loadCustomers();
  };

  const openEdit = (cust) => {
    setEditing(cust);
    setForm({ name: cust.name, phone: cust.phone || '', credit_limit: cust.credit_limit || '', credit_balance: cust.credit_balance || '' });
    setShowModal(true);
  };

  const filtered = customers.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm));

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold"><Users className="inline mr-2" />Customers</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', credit_limit: '', credit_balance: '' }); setShowModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18} /> Add Customer
        </button>
      </div>
      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg" /></div>
      <div className="space-y-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">{c.name}</p>
              <p className="text-sm text-gray-500">{c.phone || 'No phone'}</p>
              <p className="text-sm">Credit: <span className="font-medium">K{c.credit_balance || 0}</span> / Limit: K{c.credit_limit || 0}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
              {isAdmin && <button onClick={() => deleteCustomer(c)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>}
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between"><h2>{editing ? 'Edit' : 'Add'} Customer</h2><button onClick={() => setShowModal(false)}><X/></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 border rounded" required />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-2 border rounded" />
              <input type="number" placeholder="Credit Limit" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} className="w-full p-2 border rounded" />
              <input type="number" placeholder="Current Balance" value={form.credit_balance} onChange={e => setForm({ ...form, credit_balance: e.target.value })} className="w-full p-2 border rounded" />
              <div className="flex gap-2"><button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded">Cancel</button><button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">{editing ? 'Update' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
