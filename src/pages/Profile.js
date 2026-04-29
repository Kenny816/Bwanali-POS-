import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Save, Lock, UserCircle, Clock, History, ShoppingCart } from 'lucide-react';

export default function Profile() {
  const { staff, setStaff, storeId } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '', pin_code: '' });
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formReady, setFormReady] = useState(false); // ensure form only initializes once

  // Initialize form from staff on first mount (or when staff.id changes)
  useEffect(() => {
    if (staff && !formReady) {
      setForm({
        full_name: staff.full_name || '',
        phone: staff.phone || '',
        pin_code: ''
      });
      setFormReady(true);
    }
  }, [staff, formReady]);

  // Reset initialization if staff.id actually changes (rare, but safe)
  useEffect(() => {
    if (staff && formReady && form.full_name !== staff.full_name) {
      // Staff data changed externally? Re-init only if different staff id
      setFormReady(false);
    }
  }, [staff?.id]);

  // Fetch shift history and recent sales
  useEffect(() => {
    if (!staff?.id || !storeId) return;
    const fetchData = async () => {
      try {
        const [{ data: shiftData }, { data: saleData }] = await Promise.all([
          supabase
            .from('cash_shifts')
            .select('*')
            .eq('staff_id', staff.id)
            .order('start_time', { ascending: false })
            .limit(10),
          supabase
            .from('sales')
            .select('invoice_number, total_amount, created_at')
            .eq('staff_id', staff.id)
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(10)
        ]);
        setShifts(shiftData || []);
        setSales(saleData || []);
      } catch (err) {
        console.error('Failed to load profile data', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [staff?.id, storeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = { full_name: form.full_name, phone: form.phone };
      if (form.pin_code && form.pin_code.length === 4) {
        updates.pin_code = form.pin_code;
      }
      const { error } = await supabase.from('staff').update(updates).eq('id', staff.id);
      if (error) throw error;
      setStaff({ ...staff, ...updates }); // update local state, but don't trigger form reset
      toast.success('Profile updated');
      setForm(prev => ({ ...prev, pin_code: '' })); // only clear PIN
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start, end) => {
    if (!start) return 'N/A';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate - startDate;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const currency = 'K';

  return (
    <div className="p-4 h-full overflow-y-auto max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6"><UserCircle className="inline mr-2" />My Profile</h1>

      {/* Edit Profile Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            <Lock size={14} className="inline mr-1" />New PIN (4 digits)
          </label>
          <input
            type="password"
            maxLength="4"
            placeholder="Leave blank to keep current"
            value={form.pin_code}
            onChange={e => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, '') })}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="text-sm text-gray-500">
          <p>Email: {staff?.email}</p>
          <p>Role: <span className="capitalize">{staff?.role}</span></p>
        </div>
        <button
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded flex items-center justify-center gap-2 hover:bg-green-700"
        >
          <Save size={18} />{loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Shift History */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <History className="text-blue-600" size={20} /> Shift History
        </h2>
        {shifts.length === 0 ? (
          <p className="text-gray-500 text-sm">No shifts recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {shifts.map(shift => (
              <div key={shift.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium text-sm">
                    {new Date(shift.start_time).toLocaleDateString()} - {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    Duration: {formatDuration(shift.start_time, shift.end_time)}
                    {!shift.end_time && <span className="text-green-600 ml-1">(Active)</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-green-600">
                    {currency}{shift.total_sales?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-500">Sales</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ShoppingCart className="text-green-600" size={20} /> Recent Sales
        </h2>
        {sales.length === 0 ? (
          <p className="text-gray-500 text-sm">No sales recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {sales.map(sale => (
              <div key={sale.invoice_number} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium text-sm">#{sale.invoice_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(sale.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="font-bold text-sm">{currency}{sale.total_amount?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
