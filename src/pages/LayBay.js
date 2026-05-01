import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Package, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LayBay() {
  const { staff, storeId } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const { data: laybys = [], isLoading } = useQuery({
    queryKey: ['laybys', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laybys')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const createMutation = useMutation({
    mutationFn: async (newLayby) => {
      const { error } = await supabase
        .from('laybys')
        .insert({ ...newLayby, store_id: storeId, created_by: staff?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['laybys', storeId]);
      setShowModal(false);
      toast.success('Lay By created successfully!');
    },
    onError: (error) => toast.error(`Failed to create Lay By: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('laybys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['laybys', storeId]);
      toast.success('Deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredLaybys = laybys.filter(l =>
    l.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newLayby = {
      customer_name: formData.get('customer_name'),
      total_amount: parseFloat(formData.get('total_amount')),
      deposit: parseFloat(formData.get('deposit')),
      due_date: formData.get('due_date') || null,
      notes: formData.get('notes') || null,
    };
    createMutation.mutate(newLayby);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this Lay By?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Lay By</h1>
          <p className="text-gray-500">Customers pay deposit now, balance later</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-medium"
        >
          <Plus className="w-5 h-5" />
          New Lay By
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading lay-bys...</div>
      ) : filteredLaybys.length === 0 ? (
        <div className="bg-white rounded-3xl shadow p-12 text-center">
          <Package className="w-20 h-20 text-gray-300 mx-auto mb-6" />
          <h3 className="text-2xl font-medium text-gray-600">No Lay By orders yet</h3>
          <p className="text-gray-500 mt-2">Create one above to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-5 text-left font-medium text-gray-500">Customer</th>
                <th className="px-6 py-5 text-right font-medium text-gray-500">Total</th>
                <th className="px-6 py-5 text-right font-medium text-gray-500">Deposit</th>
                <th className="px-6 py-5 text-right font-medium text-gray-500">Balance</th>
                <th className="px-6 py-5 text-center font-medium text-gray-500">Due Date</th>
                <th className="px-6 py-5 text-center font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLaybys.map((layby) => (
                <tr key={layby.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-5 font-medium">{layby.customer_name}</td>
                  <td className="px-6 py-5 text-right font-semibold">K {layby.total_amount}</td>
                  <td className="px-6 py-5 text-right text-green-600 font-medium">K {layby.deposit}</td>
                  <td className="px-6 py-5 text-right text-orange-600 font-medium">K {layby.balance}</td>
                  <td className="px-6 py-5 text-center text-gray-500">
                    {layby.due_date ? new Date(layby.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-4 py-1 text-xs font-medium rounded-full ${
                      layby.status === 'completed' ? 'bg-green-100 text-green-700' :
                      layby.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {layby.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg mx-4">
            <form onSubmit={handleSubmit} className="p-8">
              <h2 className="text-2xl font-bold mb-6">Create New Lay By</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Customer Name</label>
                  <input name="customer_name" required className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300" placeholder="Customer name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Total Amount (K)</label>
                    <input name="total_amount" type="number" step="0.01" required className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Deposit (K)</label>
                    <input name="deposit" type="number" step="0.01" required className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Expected Pickup Date</label>
                  <input name="due_date" type="date" className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Notes (optional)</label>
                  <textarea name="notes" rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-green-300" placeholder="Any special instructions..." />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-700 font-medium bg-gray-100 rounded-2xl hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 py-4 bg-green-600 text-white font-medium rounded-2xl hover:bg-green-700 disabled:opacity-70">{createMutation.isPending ? 'Creating...' : 'Create Lay By'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
