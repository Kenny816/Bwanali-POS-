import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users, Plus, Edit2, X, UserPlus, ToggleLeft, ToggleRight, Trash2, Shield, Smartphone } from 'lucide-react';

export default function Employees() {
  const { storeId, staff: currentStaff } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'cashier',
    pin_code: '1234',
  });
  const [showCreatedMessage, setShowCreatedMessage] = useState(null);

  const isAdmin = currentStaff?.role === 'admin';
  const canManage = isAdmin;

  const loadStaff = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) loadStaff();
  }, [storeId, loadStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return toast.error('Permission denied');

    if (editing) {
      try {
        const { error } = await supabase
          .from('staff')
          .update({
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
            pin_code: form.pin_code,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Employee updated');
        setShowModal(false);
        setEditing(null);
        loadStaff();
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }

    // Create new employee
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminToken = sessionData.session?.access_token;
      if (!adminToken) return toast.error('Session expired. Please log in again.');

      const tempPassword = 'temp1234';
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: tempPassword,
        options: { data: { full_name: form.full_name } },
      });
      if (signUpError) throw signUpError;

      await supabase.auth.setSession({
        access_token: adminToken,
        refresh_token: sessionData.session.refresh_token,
      });

      const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .insert({
          user_id: signUpData.user.id,
          store_id: storeId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          pin_code: form.pin_code,
          is_active: true,
        })
        .select()
        .single();
      if (staffError) throw staffError;

      toast.success('Employee created');
      setShowModal(false);
      setEditing(null);
      setShowCreatedMessage({
        ...staffRecord,
        tempPassword,
      });
      loadStaff();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (staffMember) => {
    if (!canManage) return;
    // Prevent self-deactivation
    if (staffMember.id === currentStaff?.id) {
      toast.error('Cannot deactivate yourself');
      return;
    }
    const newStatus = !staffMember.is_active;
    try {
      await supabase.from('staff').update({ is_active: newStatus }).eq('id', staffMember.id);
      toast.success(`Employee ${newStatus ? 'activated' : 'deactivated'}`);
      loadStaff();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const promoteToAdmin = async (staffMember) => {
    if (!isAdmin || staffMember.role === 'admin') return;
    if (!window.confirm(`Promote ${staffMember.full_name} to admin?`)) return;
    try {
      await supabase.from('staff').update({ role: 'admin' }).eq('id', staffMember.id);
      toast.success('Promoted');
      loadStaff();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteEmployee = async (staffMember) => {
    if (!canManage) return;
    if (staffMember.id === currentStaff?.id) return toast.error('Cannot delete yourself');
    if (!window.confirm(`Delete ${staffMember.full_name} permanently?`)) return;
    try {
      await supabase.from('staff').delete().eq('id', staffMember.id);
      toast.success('Employee deleted');
      loadStaff();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (staffMember) => {
    setEditing(staffMember);
    setForm({
      full_name: staffMember.full_name,
      email: staffMember.email,
      phone: staffMember.phone || '',
      role: staffMember.role,
      pin_code: staffMember.pin_code || '1234',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', phone: '', role: 'cashier', pin_code: '1234' });
    setShowModal(true);
  };

  if (loading) return <div className="p-8 text-center">Loading employees...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6"/> Employees</h1>
        {canManage && (
          <button onClick={openCreate} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <UserPlus size={18} /> Add Employee
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <X className="text-red-600" /> {error}
          <button onClick={loadStaff} className="ml-auto px-3 py-1 bg-blue-600 text-white rounded text-sm">Retry</button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500">No employees found</td></tr>
            ) : (
              staffList.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{s.full_name}</td>
                  <td className="p-3">{s.email}</td>
                  <td className="p-3 capitalize">{s.role}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {s.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 size={18} /></button>
                      {/* Hide toggle for currently logged-in user */}
                      {s.id !== currentStaff?.id && (
                        <button onClick={() => toggleActive(s)} className={`p-1.5 rounded ${s.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`} title={s.is_active ? 'Deactivate' : 'Activate'}>
                          {s.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      )}
                      {s.role !== 'admin' && (
                        <button onClick={() => promoteToAdmin(s)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Promote"><Shield size={18} /></button>
                      )}
                      {s.id !== currentStaff?.id && (
                        <button onClick={() => deleteEmployee(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={18} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {staffList.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{s.full_name}</h3>
                <p className="text-sm text-gray-500">{s.email}</p>
                <p className="text-xs capitalize text-gray-400">{s.role}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {s.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="mt-4 flex gap-2 justify-end border-t pt-3">
              <button onClick={() => openEdit(s)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={18} /></button>
              {s.id !== currentStaff?.id && (
                <button onClick={() => toggleActive(s)} className={`p-2 rounded-lg ${s.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {s.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              )}
              {s.role !== 'admin' && (
                <button onClick={() => promoteToAdmin(s)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Shield size={18} /></button>
              )}
              {s.id !== currentStaff?.id && (
                <button onClick={() => deleteEmployee(s)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2>{editing ? 'Edit' : 'Add'} Employee</h2>
              <button onClick={() => setShowModal(false)}><X/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <input
                placeholder="Full Name"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
              {!editing && (
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              )}
              <input
                placeholder="Phone"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2 border rounded"
              />
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full p-2 border rounded bg-white"
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <input
                placeholder="PIN (4 digits)"
                maxLength="4"
                value={form.pin_code}
                onChange={e => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, '') })}
                className="w-full p-2 border rounded"
                required
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreatedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-4 border-b"><h2 className="text-lg font-bold">Employee Created</h2></div>
            <div className="p-6 space-y-4">
              <p><strong>{showCreatedMessage.full_name}</strong> added.</p>
              <div className="bg-gray-100 p-4 rounded-lg space-y-1">
                <p><strong>Email:</strong> {showCreatedMessage.email}</p>
                <p><strong>Password:</strong> {showCreatedMessage.tempPassword}</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const msg = `Hi ${showCreatedMessage.full_name}, your Bwanali POS account:\nEmail: ${showCreatedMessage.email}\nPassword: ${showCreatedMessage.tempPassword}\nLogin: ${window.location.origin}`;
                    window.open(`https://wa.me/${showCreatedMessage.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <Smartphone size={20} /> Send via WhatsApp
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`Email: ${showCreatedMessage.email}\nPassword: ${showCreatedMessage.tempPassword}`);
                    toast.success('Copied');
                  }}
                  className="w-full border py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  Copy Credentials
                </button>
              </div>
              <button onClick={() => setShowCreatedMessage(null)} className="w-full py-2 border rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
