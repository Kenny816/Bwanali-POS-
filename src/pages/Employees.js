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
    password: '1234',  // temporary password (offline)
  });
  const [showCreatedMessage, setShowCreatedMessage] = useState(null);

  const isAdmin = currentStaff?.role === 'admin';
  const canManage = isAdmin;

  const loadStaff = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    try {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      setStaffList(data?.data || data || []);
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
        await supabase
          .from('staff')
          .update({
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
            // do not change password unless provided
          })
          .eq('id', editing.id);
        toast.success('Employee updated');
        setShowModal(false);
        setEditing(null);
        loadStaff();
      } catch (err) { toast.error(err.message); }
      return;
    }

    // Create new employee – direct insert, no signUp (no new store)
    try {
      const newUser = {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        is_active: true,
        store_id: storeId,  // <-- same store as admin
      };
      const { error } = await supabase.from('staff').insert(newUser);
      if (error) throw error;

      // Show the temporary password
      setShowCreatedMessage({
        full_name: form.full_name,
        email: form.email,
        tempPassword: form.password,
        phone: form.phone,
      });

      toast.success('Employee created');
      setShowModal(false);
      setEditing(null);
      loadStaff();
    } catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (staffMember) => {
    if (!canManage || staffMember.id === currentStaff?.id) return;
    try {
      await supabase.from('staff').update({ is_active: !staffMember.is_active }).eq('id', staffMember.id);
      toast.success(`Employee ${staffMember.is_active ? 'deactivated' : 'activated'}`);
      loadStaff();
    } catch (err) { toast.error(err.message); }
  };

  const promoteToAdmin = async (staffMember) => {
    if (!isAdmin || staffMember.role === 'admin') return;
    try {
      await supabase.from('staff').update({ role: 'admin' }).eq('id', staffMember.id);
      toast.success('Promoted to admin');
      loadStaff();
    } catch (err) { toast.error(err.message); }
  };

  const deleteEmployee = async (staffMember) => {
    if (!canManage || staffMember.id === currentStaff?.id) return;
    try {
      await supabase.from('staff').delete().eq('id', staffMember.id);
      toast.success('Employee deleted');
      loadStaff();
    } catch (err) { toast.error(err.message); }
  };

  const openEdit = (staffMember) => {
    setEditing(staffMember);
    setForm({
      full_name: staffMember.full_name,
      email: staffMember.email,
      phone: staffMember.phone || '',
      role: staffMember.role,
      password: '', // clear password field for edit
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', phone: '', role: 'cashier', password: '1234' });
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

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Actions</th></tr>
          </thead>
          <tbody>
            {staffList.map(s => (
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
                    <button onClick={() => openEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18}/></button>
                    {s.id !== currentStaff?.id && (
                      <button onClick={() => toggleActive(s)} className={`p-1.5 rounded ${s.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {s.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                      </button>
                    )}
                    {s.role !== 'admin' && isAdmin && (
                      <button onClick={() => promoteToAdmin(s)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"><Shield size={18}/></button>
                    )}
                    {s.id !== currentStaff?.id && (
                      <button onClick={() => deleteEmployee(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {staffList.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div><h3 className="font-bold">{s.full_name}</h3><p className="text-sm text-gray-500">{s.email}</p><p className="text-xs capitalize text-gray-400">{s.role}</p></div>
              <span className={`px-2 py-1 rounded-full text-xs ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.is_active ? 'Active' : 'Disabled'}</span>
            </div>
            <div className="mt-4 flex gap-2 justify-end border-t pt-3">
              <button onClick={() => openEdit(s)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={18}/></button>
              {s.id !== currentStaff?.id && (
                <button onClick={() => toggleActive(s)} className={`p-2 rounded-lg ${s.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {s.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                </button>
              )}
              {s.role !== 'admin' && isAdmin && (
                <button onClick={() => promoteToAdmin(s)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Shield size={18}/></button>
              )}
              {s.id !== currentStaff?.id && (
                <button onClick={() => deleteEmployee(s)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button>
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
              <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full p-2 border rounded" required />
              {!editing && <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full p-2 border rounded" required />}
              {!editing && <input placeholder="Temporary Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full p-2 border rounded" required />}
              <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded" />
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full p-2 border rounded bg-white">
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Employee Credentials */}
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
                <button onClick={() => {
                  const msg = `Hi ${showCreatedMessage.full_name}, your Bwanali POS account:\nEmail: ${showCreatedMessage.email}\nPassword: ${showCreatedMessage.tempPassword}\nLogin: ${window.location.origin}`;
                  window.open(`https://wa.me/${showCreatedMessage.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                }} className="w-full bg-green-600 text-white py-3 rounded-lg"><Smartphone size={20} /> Send via WhatsApp</button>
                <button onClick={() => { navigator.clipboard?.writeText(`Email: ${showCreatedMessage.email}\nPassword: ${showCreatedMessage.tempPassword}`); toast.success('Copied'); }} className="w-full border py-2 rounded-lg">Copy Credentials</button>
              </div>
              <button onClick={() => setShowCreatedMessage(null)} className="w-full py-2 border rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
