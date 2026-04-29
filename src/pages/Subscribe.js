import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Store, Shield } from 'lucide-react';

export default function Subscribe() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="bg-white shadow-sm py-4">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-700">Bwanali POS</h1>
          <div className="text-sm text-gray-600">
            <Link to="/login" className="hover:underline">Sign In</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-4xl font-bold mb-4">Run Your Store Smarter</h2>
        <p className="text-xl text-gray-600 mb-8">
          All-in-one POS, inventory, and analytics.
        </p>
        <Link
          to="/signup"
          className="bg-green-600 text-white px-8 py-3 rounded-full font-bold text-lg inline-flex items-center gap-2 shadow-lg"
        >
          Start 3-Day Free Trial <ArrowRight size={20} />
        </Link>
        <p className="text-sm text-gray-500 mt-3">
          No credit card required • Cancel anytime
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-green-100">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-2">Simple, Scalable Pricing</h3>
            <p className="text-lg text-gray-600">
              Manage one store or many — price adjusts automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Monthly */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-200 flex flex-col items-center text-center">
              <Store className="text-green-600 mb-3" size={32} />
              <p className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">Monthly</p>
              <p className="text-5xl font-bold text-green-800">ZMW 150</p>
              <p className="text-gray-500 mt-1">per store / month</p>
              <ul className="mt-6 space-y-3 text-left w-full">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> Unlimited products & sales</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> Employee management</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> Advanced reporting</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> Barcode scanning</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> Return processing</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-600" size={18} /> 24/7 support</li>
              </ul>
            </div>

            {/* Annual */}
            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-300 flex flex-col items-center text-center">
              <Shield className="text-blue-600 mb-3" size={32} />
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">Annual (Save 20%)</p>
              <p className="text-5xl font-bold text-blue-800">ZMW 1,500</p>
              <p className="text-gray-500 mt-1">per store / year</p>
              <p className="text-xs text-blue-600 mt-2 font-medium">Equivalent to ZMW 125/month</p>
              <ul className="mt-6 space-y-3 text-left w-full">
                <li className="flex items-center gap-2"><CheckCircle className="text-blue-600" size={18} /> All Monthly features</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-blue-600" size={18} /> Priority support</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-blue-600" size={18} /> Early access to new features</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Each store adds <span className="font-semibold text-green-700">ZMW 150/month</span> or <span className="font-semibold text-blue-700">ZMW 1,500/year</span> to your total. Add stores anytime — no limits.
            </p>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/signup"
              className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-700 inline-flex items-center gap-2 shadow-lg"
            >
              Start Free Trial <ArrowRight size={20} />
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              3-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 font-medium">Sign in</Link>
        </p>
      </div>

      <footer className="text-center py-8 text-gray-400 text-sm">
        © 2026 Bwanali POS. All rights reserved.
      </footer>
    </div>
  );
}
