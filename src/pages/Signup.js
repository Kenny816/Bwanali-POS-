import React,{useState} from 'react';
import {supabase} from '../lib/supabase';
import {useNavigate,Link} from 'react-router-dom';
import toast from 'react-hot-toast';
import {Building2,Save} from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState({
    full_name:'', email:'', password:'', phone:'',
    company_name:'', tpin:'', address:'', currency_symbol:'K',
    vat_registered:false, vat_rate:16
  });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.company_name) return toast.error('Company name required');
    setLoading(true);
    try {
      // 1. Create auth user
      console.log('1️⃣ Creating auth user...');
      const { data:authData, error:signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name } }
      });
      if (signUpError) {
        console.error('❌ Auth signup failed:', signUpError);
        throw signUpError;
      }
      console.log('✅ Auth user created:', authData.user.id);

      // 2. Create store
      console.log('2️⃣ Creating store...');
      const { data:store, error:storeError } = await supabase
        .from('stores')
        .insert({ 
          name: form.company_name,
          subscription_status: 'trialing',
          trial_started_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (storeError) {
        console.error('❌ Store insert failed:', storeError);
        throw new Error('Store creation failed: ' + storeError.message);
      }
      console.log('✅ Store created:', store.id);

      // 3. Create company_settings
      console.log('3️⃣ Creating company settings...');
      const { error:settingsError } = await supabase
        .from('company_settings')
        .insert({
          store_id: store.id,
          company_name: form.company_name,
          tpin: form.tpin,
          address: form.address,
          phone: form.phone,
          email: form.email,
          currency_symbol: form.currency_symbol,
          vat_registered: form.vat_registered,
          vat_rate: form.vat_rate,
          receipt_footer: 'Thank you for your business!'
        });
      if (settingsError) {
        console.error('❌ Company settings insert failed:', settingsError);
        throw new Error('Settings creation failed: ' + settingsError.message);
      }
      console.log('✅ Company settings created');

      // 4. Create staff record (admin)
      console.log('4️⃣ Creating staff record...');
      const { error:staffError } = await supabase
        .from('staff')
        .insert({
          user_id: authData.user.id,
          store_id: store.id,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          role: 'admin',
          is_active: true
        });
      if (staffError) {
        console.error('❌ Staff insert failed:', staffError);
        throw new Error('Staff creation failed: ' + staffError.message);
      }
      console.log('✅ Staff record created');

      // 5. Add to store_admins
      console.log('5️⃣ Creating store admin record...');
      const { error:adminError } = await supabase
        .from('store_admins')
        .insert({
          user_id: authData.user.id,
          store_id: store.id,
          role: 'admin'
        });
      if (adminError) {
        console.error('❌ Store admin insert failed:', adminError);
        // Non-critical, continue
        console.warn('⚠️ Store admin insert failed but continuing');
      } else {
        console.log('✅ Store admin record created');
      }

      toast.success('Account created! Check your email to confirm.');
      navigate('/login');
    } catch (err) {
      console.error('❌ Signup error:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="text-green-600" />
          <h1 className="text-2xl font-bold">Create Your Store</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">3-day free trial included. No payment required.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Your Full Name *" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="p-3 border rounded" required />
            <input type="email" placeholder="Email *" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="p-3 border rounded" required />
            <input type="password" placeholder="Password *" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="p-3 border rounded" required />
            <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="p-3 border rounded" />
            <input placeholder="Company Name *" value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} className="p-3 border rounded" required />
            <input placeholder="TPIN" value={form.tpin} onChange={e=>setForm({...form,tpin:e.target.value})} className="p-3 border rounded" />
            <input placeholder="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="p-3 border rounded md:col-span-2" />
            <input placeholder="Currency Symbol" value={form.currency_symbol} onChange={e=>setForm({...form,currency_symbol:e.target.value})} className="p-3 border rounded" />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.vat_registered} onChange={e=>setForm({...form,vat_registered:e.target.checked})} />
              <span>VAT Registered</span>
              {form.vat_registered && <input type="number" placeholder="VAT %" value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})} className="w-20 p-2 border rounded" />}
            </div>
          </div>
          <button disabled={loading} className="bg-green-600 text-white px-6 py-3 rounded flex items-center justify-center gap-2 w-full">
            <Save size={18} /> {loading ? 'Creating...' : 'Start Free Trial'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-green-600">Already have an account? Sign In</Link>
        </div>
      </div>
    </div>
  );
}
