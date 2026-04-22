import React,{useState,useEffect} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {Save,Lock,UserCircle} from 'lucide-react';

export default function Profile() {
  const {staff,setStaff} = useAuth();
  const [form,setForm] = useState({full_name:'',phone:'',pin_code:''});
  const [loading,setLoading] = useState(false);

  useEffect(() => {
    if (staff) {
      setForm({
        full_name: staff.full_name || '',
        phone: staff.phone || '',
        pin_code: ''
      });
    }
  }, [staff]);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = {
        full_name: form.full_name,
        phone: form.phone
      };
      if (form.pin_code && form.pin_code.length === 4) {
        updates.pin_code = form.pin_code;
      }
      const {error} = await supabase
        .from('staff')
        .update(updates)
        .eq('id', staff.id);
      if (error) throw error;
      
      // Update local staff state
      setStaff({...staff, ...updates});
      toast.success('Profile updated');
      setForm({...form, pin_code:''});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6"><UserCircle className="inline mr-2"/>My Profile</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            value={form.full_name}
            onChange={e=>setForm({...form,full_name:e.target.value})}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={e=>setForm({...form,phone:e.target.value})}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1"><Lock size={14} className="inline mr-1"/>New PIN (4 digits)</label>
          <input
            type="password"
            maxLength="4"
            placeholder="Leave blank to keep current"
            value={form.pin_code}
            onChange={e=>setForm({...form,pin_code:e.target.value.replace(/\D/g,'')})}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="text-sm text-gray-500">
          <p>Email: {staff?.email}</p>
          <p>Role: <span className="capitalize">{staff?.role}</span></p>
        </div>
        <button disabled={loading} className="w-full bg-green-600 text-white py-2 rounded flex items-center justify-center gap-2">
          <Save size={18}/>{loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
