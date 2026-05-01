import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { hashString } from '../lib/crypto';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Crown, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password, remember: true });
      if (error) throw error;
      toast.success('Welcome back!');
      window.location.href = '/app';
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    if (!recoveryEmail || !recoveryKey) return toast.error('Email and recovery key required');
    setRecoveryLoading(true);
    try {
      const { data: staff } = await supabase.from('staff').select('*').eq('email', recoveryEmail).maybeSingle();
      if (!staff) { toast.error('No account with that email'); setRecoveryLoading(false); return; }
      if (!staff.recovery_key_hash) { toast.error('No recovery key set for this account'); setRecoveryLoading(false); return; }
      const enteredHash = await hashString(recoveryKey);
      if (enteredHash !== staff.recovery_key_hash) { toast.error('Incorrect recovery key'); setRecoveryLoading(false); return; }
      const newPassword = 'reset' + Math.random().toString(36).slice(2, 8);
      await supabase.from('staff').update({ password: newPassword, pin_code: newPassword }).eq('id', staff.id);
      toast.success(`Password reset to: ${newPassword}`);
      setShowRecovery(false);
      setEmail(recoveryEmail);
      setPassword(newPassword);
    } catch (err) { toast.error(err.message); }
    finally { setRecoveryLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-green-600 to-emerald-700 text-white p-12 flex-col justify-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold leading-tight mb-4">Run Your Store Smarter</h1>
          <p className="text-xl opacity-90 mb-12">All-in-one POS, inventory, Lay By, and analytics.</p>
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3"><Crown className="w-8 h-8" />Choose Your Plan</h2>
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6"><div className="flex justify-between items-baseline"><div><p className="text-sm opacity-75">Monthly • 1 Store</p><p className="text-5xl font-bold">K150</p></div><p className="text-sm opacity-75">per month</p></div></div>
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border-2 border-white"><div className="flex justify-between items-baseline"><div><p className="text-sm opacity-75">Monthly • 2 Stores</p><p className="text-5xl font-bold">K250</p></div><p className="text-sm opacity-75">per month • Save K50</p></div></div>
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6"><div className="flex justify-between items-baseline"><div><p className="text-sm opacity-75">Annual • Best Value</p><p className="text-5xl font-bold">K1,500</p></div><p className="text-sm opacity-75">per year • 1 store</p></div><p className="text-xs opacity-75 mt-1">or K2,400 for 2 stores (20% off)</p></div>
          </div>
          <div className="mt-12 text-sm opacity-75">Start with 3-day free trial • No credit card required • Cancel anytime</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-10"><h1 className="text-4xl font-bold text-green-600">Bwanali POS</h1><p className="text-gray-500 mt-2">Sign in to your store</p></div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-5 py-4 border border-gray-300 rounded-3xl focus:outline-none focus:border-green-500" placeholder="your@email.com"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-5 py-4 border border-gray-300 rounded-3xl focus:outline-none focus:border-green-500" placeholder="••••••••"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-3xl text-lg disabled:opacity-70">{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-8">Don't have an account? <a href="/subscribe" className="text-green-600 font-medium">Subscribe</a></p>
          <button onClick={() => setShowRecovery(!showRecovery)} className="text-xs text-gray-400 mt-4 block mx-auto hover:text-gray-600 underline">Forgot password?</button>
          {showRecovery && (
            <div className="mt-4 p-4 border rounded-2xl bg-white shadow-lg">
              <div className="flex items-start gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" /><p className="text-sm text-gray-600">Enter the email and recovery key you set in Settings.</p></div>
              <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} placeholder="Email" className="w-full p-2 border rounded mb-2" />
              <input type="password" value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} placeholder="Recovery key" className="w-full p-2 border rounded mb-2" />
              <button onClick={handleRecovery} disabled={recoveryLoading} className="w-full py-2 bg-amber-600 text-white rounded font-medium disabled:opacity-50">{recoveryLoading ? 'Checking...' : 'Reset Password'}</button>
            </div>
          )}
          <p className="text-center text-xs text-gray-400 mt-12">© 2026 Bwanali POS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
