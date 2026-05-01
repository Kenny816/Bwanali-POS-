import { hashString } from '../lib/crypto';
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Store, Shield, ArrowRight } from 'lucide-react';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState('monthly');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Full name is required');
    if (!email.trim()) return toast.error('Email is required');
    if (!password || password.length < 6) return toast.error('Password must be at least 6 characters');

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name.trim(),
            plan,               // <-- passed to our local mock
          },
        },
      });
      if (error) throw error;
      toast.success('Account created! You are now logged in.');
if (recoveryKey) {        try {          const hash = await hashString(recoveryKey);          const { data: user } = await supabase.auth.getSession();          if (user?.user?.id) {            await supabase.from('staff').update({ recovery_key_hash: hash }).eq('id', user.user.id);          }        } catch (e) { console.error('Failed to save recovery key', e); }      }
      window.location.href = '/app';
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Store className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-green-700">Bwanali POS</h1>
          <p className="text-gray-500">Create your store account</p>
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full p-2 border rounded pr-10"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-gray-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Subscription plan selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Choose your plan</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPlan('monthly')}
                className={`flex-1 p-3 rounded-lg border text-center ${plan === 'monthly' ? 'border-green-600 bg-green-50 text-green-700 font-bold' : 'border-gray-200'}`}
              >
                <p className="text-lg">Monthly</p>
                <p className="text-xs text-gray-500">ZMW 150 / month</p>
              </button>
              <button
                type="button"
                onClick={() => setPlan('annual')}
                className={`flex-1 p-3 rounded-lg border text-center ${plan === 'annual' ? 'border-green-600 bg-green-50 text-green-700 font-bold' : 'border-gray-200'}`}
              >
                <p className="text-lg">Annual</p>
                <p className="text-xs text-gray-500">ZMW 1500 / year</p>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">3‑day free trial included. Cancel anytime.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {loading ? 'Creating...' : 'Create Account & Start Trial'}
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-green-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}
