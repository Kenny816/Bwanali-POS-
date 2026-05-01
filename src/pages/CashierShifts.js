import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users, Search, Eye, X, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

export default function CashierShifts() {
  const { storeId, isAdmin } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadStaff = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('store_id', storeId)
      .eq('role', 'cashier')
      .eq('is_active', true)
      .order('full_name');
    setStaffList(data?.data || data || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const loadShifts = async (staffId) => {
    const { data } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('staff_id', staffId)
      .order('start_time', { ascending: false })
      .limit(20);
    setShifts(data?.data || data || []);
  };

  const viewCashier = (staff) => {
    setSelectedStaff(staff);
    loadShifts(staff.id);
  };

  const filteredStaff = staffList.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) return <div className="p-8 text-red-600">Access Denied</div>;
  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Users className="inline" /> Cashier Shifts</h1>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          placeholder="Search cashiers..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 p-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredStaff.map(cashier => (
          <div key={cashier.id} className="bg-white rounded-xl shadow p-4">
            <p className="font-bold text-lg">{cashier.full_name}</p>
            <p className="text-sm text-gray-500">{cashier.email}</p>
            <button onClick={() => viewCashier(cashier)} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm">
              View Shifts
            </button>
          </div>
        ))}
      </div>

      {/* Shifts Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2 className="text-xl font-bold">{selectedStaff.full_name} – Shifts</h2>
              <button onClick={() => setSelectedStaff(null)}><X/></button>
            </div>
            <div className="p-4 space-y-4">
              {shifts.length === 0 ? (
                <p className="text-gray-500">No shifts recorded</p>
              ) : (
                shifts.map(shift => {
                  const discrepancy = (shift.closing_cash || 0) - (shift.opening_float || 0) - (shift.total_sales || 0);
                  return (
                    <div key={shift.id} className="border rounded p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {new Date(shift.start_time).toLocaleDateString()}{' '}
                            {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {shift.end_time ? ` – ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Active)'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${shift.end_time ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                          {shift.end_time ? 'Closed' : 'Active'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 text-sm">
                        <div><p className="text-gray-500">Opening Float</p><p className="font-semibold">K{shift.opening_float?.toFixed(2) || '0.00'}</p></div>
                        <div><p className="text-gray-500">Total Sales</p><p className="font-semibold text-green-700">K{shift.total_sales?.toFixed(2) || '0.00'}</p></div>
                        <div><p className="text-gray-500">Transactions</p><p className="font-semibold">{shift.transaction_count || 0}</p></div>
                        <div><p className="text-gray-500">Closing Cash</p><p className="font-semibold">K{shift.closing_cash?.toFixed(2) || '0.00'}</p></div>
                        <div><p className="text-gray-500">Discrepancy</p><p className={`font-semibold ${discrepancy !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {discrepancy === 0 ? 'OK' : `K${discrepancy.toFixed(2)}`}
                        </p></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
