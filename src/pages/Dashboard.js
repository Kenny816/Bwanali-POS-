import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, ShoppingCart, Package, TrendingUp, Clock, Users, BarChart3, Receipt, RotateCcw, Percent, CheckCircle, AlertTriangle, Shield, Tag, AlertOctagon, FileText, UserCheck, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { staff, subscriptionStatus, trialDaysLeft, isLocked, availableStores, storeId, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const storeCount = availableStores?.length || 0;
  const currentStore = availableStores.find(s => s.id === storeId);
  const subscriptionPlan = currentStore?.subscription_plan;

  const [expiringProducts, setExpiringProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [activeLaybyCount, setActiveLaybyCount] = useState(0);
  const [activeCashierCount, setActiveCashierCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [todaySales, setTodaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [salesChartData, setSalesChartData] = useState([]);

  const isCashier = staff?.role === 'cashier';

  const fetchAllData = useCallback(async () => {
    if (!storeId) return;
    setRefreshing(true);
    try {
      const rawSales = localStorage.getItem('bwanali_sales');
      let salesArray = rawSales ? JSON.parse(rawSales) : [];
      salesArray = salesArray.filter(s => s.store_id === storeId && !s.returned);
      if (isCashier && staff?.id) {
        salesArray = salesArray.filter(s => s.staff_id === staff.id);
      }

      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

      const todayFiltered = salesArray.filter(s => {
        const d = new Date(s.created_at);
        return d >= todayStart && d <= todayEnd;
      });
      const monthFiltered = salesArray.filter(s => {
        const d = new Date(s.created_at);
        return d >= monthStart && d <= todayEnd;
      });

      setTodaySales(todayFiltered.reduce((sum, s) => sum + (s.total_amount || 0), 0));
      setMonthSales(monthFiltered.reduce((sum, s) => sum + (s.total_amount || 0), 0));
      setTotalTransactions(salesArray.length);

      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23,59,59,999);
        const dayTotal = salesArray
          .filter(s => {
            const d = new Date(s.created_at);
            return d >= dayStart && d <= dayEnd;
          })
          .reduce((sum, s) => sum + (s.total_amount || 0), 0);
        chartData.push({
          day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayStart.getDay()],
          sales: dayTotal,
        });
      }
      setSalesChartData(chartData);

      const { data: productsData } = await supabase.from('products').select('*').eq('store_id', storeId).eq('is_active', true);
      const products = productsData?.data || productsData || [];
      setLowStockProducts(products.filter(p => (p.stock_quantity || 0) <= lowStockThreshold));
      const expiring = products.filter(p => p.expiry_date &&
        new Date(p.expiry_date) <= new Date(Date.now() + 7*24*60*60*1000) &&
        new Date(p.expiry_date) >= new Date());
      setExpiringProducts(expiring.map(p => ({ ...p, daysLeft: Math.ceil((new Date(p.expiry_date) - new Date()) / (1000*60*60*24)) })));

      const { data: laybyData } = await supabase
        .from('laybys')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'active');
      setActiveLaybyCount(laybyData?.count || 0);

      if (isAdmin) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('role', 'cashier')
          .eq('is_active', true);
        setActiveCashierCount(staffData?.count || 0);
      }
    } catch (err) { console.error(err); }
    finally { setRefreshing(false); }
  }, [storeId, lowStockThreshold, isCashier, staff?.id, isAdmin]);

  // Auto‑refresh when any sale is made (or data changes)
  useEffect(() => {
    fetchAllData();
    const handler = () => fetchAllData();
    window.addEventListener('db-change', handler);
    return () => window.removeEventListener('db-change', handler);
  }, [fetchAllData]);

  useEffect(() => {
    if (storeId) {
      supabase.from('company_settings').select('low_stock_threshold').eq('store_id', storeId).single()
        .then(({ data }) => { if (data?.low_stock_threshold) setLowStockThreshold(Number(data.low_stock_threshold)); });
    }
  }, [storeId]);

  const handleAddDiscount = (product) => {
    navigate(`/app/discounts?productId=${product.id}&productName=${encodeURIComponent(product.name)}`);
  };

  const currency = 'K';
  const monthlyPrice = 150 * storeCount;
  const annualPrice = 1500 * storeCount;

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      {/* Subscription card – admin only */}
      {isAdmin && (
        <div className="mb-6 bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-7 h-7 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-800">Current Subscription</h2>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-gray-900">{storeCount} Store{storeCount !== 1 ? 's' : ''}</p>
              <p className="text-lg text-green-700 font-medium mt-1">
                ZMW {monthlyPrice}<span className="text-gray-500 text-sm">/month</span> or ZMW {annualPrice}<span className="text-gray-500 text-sm">/year</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {subscriptionStatus === 'active' && <CheckCircle className="text-green-600" size={24} />}
                {subscriptionStatus === 'trialing' && <Clock className="text-blue-600" size={24} />}
                {subscriptionStatus === 'expired' && <AlertTriangle className="text-red-600" size={24} />}
                <span className={`text-lg font-semibold ${subscriptionStatus === 'active' ? 'text-green-700' : subscriptionStatus === 'trialing' ? 'text-blue-700' : 'text-red-700'}`}>
                  {subscriptionStatus === 'active' ? 'Active' : subscriptionStatus === 'trialing' ? `Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : 'Expired'}
                </span>
              </div>
              <button onClick={() => navigate('/app/settings')} className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 whitespace-nowrap">
                {subscriptionStatus === 'active' ? 'Upgrade Subscription' : 'Subscribe Now'}
              </button>
            </div>
          </div>
          {isLocked && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              <span className="font-medium text-red-700">Access restricted — subscription required.</span>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-3xl p-6 shadow"><div className="flex justify-between"><div><p className="text-xs text-gray-500">Today's Sales</p><p className="text-2xl font-bold text-green-600">{currency} {todaySales.toFixed(2)}</p></div><DollarSign className="w-10 h-10 text-green-600"/></div></div>
        <div className="bg-white rounded-3xl p-6 shadow"><div className="flex justify-between"><div><p className="text-xs text-gray-500">This Month</p><p className="text-2xl font-bold">{currency} {monthSales.toFixed(2)}</p></div><TrendingUp className="w-10 h-10 text-blue-600"/></div></div>
        <div className="bg-white rounded-3xl p-6 shadow"><div className="flex justify-between"><div><p className="text-xs text-gray-500">Transactions</p><p className="text-2xl font-bold">{totalTransactions}</p></div><ShoppingCart className="w-10 h-10 text-purple-600"/></div></div>
        <div className="bg-white rounded-3xl p-6 shadow"><div className="flex justify-between"><div><p className="text-xs text-gray-500">Active Lay By</p><p className="text-2xl font-bold">{activeLaybyCount}</p></div><Package className="w-10 h-10 text-orange-600"/></div></div>
        {isAdmin && (
          <div className="bg-white rounded-3xl p-6 shadow"><div className="flex justify-between"><div><p className="text-xs text-gray-500">Active Cashiers</p><p className="text-2xl font-bold">{activeCashierCount}</p></div><UserCheck className="w-10 h-10 text-indigo-600"/></div></div>
        )}
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
        <button onClick={() => navigate('/app/pos')} className="bg-green-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-green-700"><ShoppingCart className="w-8 h-8"/><span>POS</span></button>
        <button onClick={() => navigate('/app/inventory')} className="bg-blue-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-blue-700"><Package className="w-8 h-8"/><span>Inventory</span></button>
        {isAdmin && <button onClick={() => navigate('/app/employees')} className="bg-purple-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-purple-700"><Users className="w-8 h-8"/><span>Employees</span></button>}
        {isAdmin && <button onClick={() => navigate('/app/discounts')} className="bg-amber-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-amber-700"><Percent className="w-8 h-8"/><span>Discounts</span></button>}
        <button onClick={() => navigate('/app/layby')} className="bg-orange-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-orange-700"><Package className="w-8 h-8"/><span>Lay By</span></button>
        <button onClick={() => navigate('/app/invoices')} className="bg-teal-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-teal-700"><FileText className="w-8 h-8"/><span>Invoices</span></button>
        <button onClick={() => navigate('/app/sales')} className="bg-cyan-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-cyan-700"><Receipt className="w-8 h-8"/><span>Sales</span></button>
        {(isAdmin || isManager) && <button onClick={() => navigate('/app/reports')} className="bg-violet-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-violet-700"><BarChart3 className="w-8 h-8"/><span>Reports</span></button>}
        <button onClick={() => navigate('/app/returns')} className="bg-red-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-red-700"><RotateCcw className="w-8 h-8"/><span>Returns</span></button>
        <button onClick={() => navigate('/app/settings')} className="bg-gray-600 text-white p-6 rounded-3xl flex flex-col items-center gap-2 hover:bg-gray-700"><Settings className="w-8 h-8"/><span>Settings</span></button>
      </div>

      {/* Low Stock */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow mb-8">
          <div className="flex items-center gap-3 mb-4"><AlertOctagon className="w-6 h-6 text-orange-500"/><h2 className="font-semibold">Low Stock (&le; {lowStockThreshold})</h2></div>
          <div className="space-y-4">{lowStockProducts.map(p=>(<div key={p.id} className="flex items-center justify-between py-2 border-b"><p className="font-medium">{p.name}</p><span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">{p.stock_quantity} left</span></div>))}</div>
        </div>
      )}

      {/* Expiring */}
      {expiringProducts.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow mb-8">
          <div className="flex items-center gap-3 mb-4"><Clock className="w-6 h-6 text-red-500"/><h2 className="font-semibold">Products Expiring Soon</h2></div>
          <div className="space-y-4">{expiringProducts.map(p=>(<div key={p.id} className="flex items-center justify-between py-2 border-b"><div><p className="font-medium">{p.name}</p><p className="text-xs text-gray-500">Expires {new Date(p.expiry_date).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><span className={`px-3 py-1 text-xs rounded-full ${p.daysLeft<=2?'bg-red-100 text-red-700':p.daysLeft<=5?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-700'}`}>{p.daysLeft} days</span>{isAdmin && <button onClick={()=>handleAddDiscount(p)} className="text-xs bg-green-600 text-white px-4 py-2 rounded-xl">Add Discount</button>}</div></div>))}</div>
        </div>
      )}

      {/* Sales Trend (real data) */}
      <div className="bg-white rounded-3xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">Sales Trend (Last 7 Days)</h2>
        {salesChartData.every(d => d.sales === 0) ? (
          <div className="text-center py-10 text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Make your first sale to see trends</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => `${currency} ${value}`} />
              <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={4} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
