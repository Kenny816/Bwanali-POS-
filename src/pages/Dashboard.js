import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Truck, DollarSign, ShoppingCart, Package, TrendingUp, Clock, Users, BarChart3, Receipt, RotateCcw, CheckCircle, AlertTriangle, Shield, AlertOctagon, FileText, UserCheck, Settings, ArrowRightLeft, CreditCard, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { staff, subscriptionStatus, trialDaysLeft, isLocked, availableStores, storeId, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const storeCount = availableStores?.length || 0;
  const currentStore = availableStores.find(s => s.id === storeId);

  const [expiringProducts, setExpiringProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [activeLaybyCount, setActiveLaybyCount] = useState(0);
  const [activeCashierCount, setActiveCashierCount] = useState(0);

  const [todaySales, setTodaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [salesChartData, setSalesChartData] = useState([]);

  const [totalCredit, setTotalCredit] = useState(0);
  const [recentTransfers, setRecentTransfers] = useState([]);

  const [crossStore, setCrossStore] = useState({
    todaySales: 0, monthSales: 0, transactions: 0, laybys: 0, cashiers: 0, credit: 0,
  });

  const [topSellingProducts, setTopSellingProducts] = useState([]);

  const isCashier = staff?.role === 'cashier';
  const allStoreIds = useMemo(() => availableStores?.map(s => s.id) || [], [availableStores]);

  const fetchAllData = useCallback(async () => {
    if (!storeId) return;
    try {
      // ---------- CURRENT STORE DATA ----------
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
      const products = productsData || [];
      setLowStockProducts(products.filter(p => (p.stock_quantity || 0) <= lowStockThreshold));
      const expiring = products.filter(p => p.expiry_date &&
        new Date(p.expiry_date) <= new Date(Date.now() + 7*24*60*60*1000) &&
        new Date(p.expiry_date) >= new Date());
      setExpiringProducts(expiring.map(p => ({ ...p, daysLeft: Math.ceil((new Date(p.expiry_date) - new Date()) / (1000*60*60*24)) })));

      const { data: activeLaybys } = await supabase
        .from('laybys')
        .select('id')
        .eq('store_id', storeId)
        .eq('status', 'active');
      setActiveLaybyCount((activeLaybys || []).length);

      if (isAdmin) {
        const { data: activeCashiers } = await supabase
          .from('staff')
          .select('id')
          .eq('store_id', storeId)
          .eq('role', 'cashier')
          .eq('is_active', true);
        setActiveCashierCount((activeCashiers || []).length);

        const { data: customers } = await supabase.from('customers').select('credit_balance').eq('store_id', storeId);
        const custData = customers || [];
        const creditSum = custData.reduce((sum, c) => sum + (parseFloat(c.credit_balance) || 0), 0);
        setTotalCredit(creditSum);

        const { data: transfers } = await supabase
          .from('stock_transfers')
          .select('*')
          .or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentTransfers(transfers || []);
      }

      // Top Selling Products
      const rawItems = localStorage.getItem('bwanali_sale_items');
      let allItems = rawItems ? JSON.parse(rawItems) : [];
      allItems = allItems.filter(item => item.store_id === storeId);
      const productQuantities = {};
      allItems.forEach(item => {
        const pid = item.product_id;
        if (!pid) return;
        productQuantities[pid] = (productQuantities[pid] || 0) + (item.quantity || 1);
      });
      const topProducts = Object.entries(productQuantities)
        .map(([productId, qty]) => {
          const prod = products.find(p => p.id === productId);
          return { id: productId, name: prod?.name || productId, quantity: qty };
        })
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      setTopSellingProducts(topProducts);

      // Cross-store
      if (isAdmin && availableStores.length > 1) {
        const storeIdsNeeded = allStoreIds;
        const allSales = JSON.parse(localStorage.getItem('bwanali_sales') || '[]').filter(s => storeIdsNeeded.includes(s.store_id) && !s.returned);
        const crossToday = allSales.filter(s => { const d = new Date(s.created_at); return d >= todayStart && d <= todayEnd; }).reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const crossMonth = allSales.filter(s => { const d = new Date(s.created_at); return d >= monthStart && d <= todayEnd; }).reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const allLaybys = JSON.parse(localStorage.getItem('bwanali_laybys') || '[]').filter(l => storeIdsNeeded.includes(l.store_id) && l.status === 'active');
        const allStaff = JSON.parse(localStorage.getItem('bwanali_staff') || '[]').filter(s => storeIdsNeeded.includes(s.store_id) && s.role === 'cashier' && s.is_active);
        const allCustomers = JSON.parse(localStorage.getItem('bwanali_customers') || '[]').filter(c => storeIdsNeeded.includes(c.store_id));
        const crossCredit = allCustomers.reduce((sum, c) => sum + (parseFloat(c.credit_balance) || 0), 0);
        setCrossStore({ todaySales: crossToday, monthSales: crossMonth, transactions: allSales.length, laybys: allLaybys.length, cashiers: allStaff.length, credit: crossCredit });
      }
    } catch (err) { console.error(err); }
  }, [storeId, lowStockThreshold, isCashier, staff?.id, isAdmin, allStoreIds, availableStores]);

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

  const currency = 'K';
  const monthlyPrice = 150 * storeCount;
  const annualPrice = 1500 * storeCount;

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto overflow-x-hidden">
      {/* Subscription card */}
      {isAdmin && (
        <div className="mb-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-gray-100">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Shield className="w-5 h-5 sm:w-7 sm:h-7 text-green-600" />
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Current Subscription</h2>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{storeCount} Store{storeCount !== 1 ? 's' : ''}</p>
              <p className="text-base sm:text-lg text-green-700 font-medium mt-1">
                ZMW {monthlyPrice}<span className="text-gray-500 text-sm">/month</span> or ZMW {annualPrice}<span className="text-gray-500 text-sm">/year</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                {subscriptionStatus === 'active' && <CheckCircle className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" />}
                {subscriptionStatus === 'trialing' && <Clock className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />}
                {subscriptionStatus === 'expired' && <AlertTriangle className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" />}
                <span className={`text-sm sm:text-lg font-semibold ${subscriptionStatus === 'active' ? 'text-green-700' : subscriptionStatus === 'trialing' ? 'text-blue-700' : 'text-red-700'}`}>
                  {subscriptionStatus === 'active' ? 'Active' : subscriptionStatus === 'trialing' ? `Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : 'Expired'}
                </span>
              </div>
              <button onClick={() => navigate('/app/settings')} className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base hover:bg-green-700 whitespace-nowrap">
                {subscriptionStatus === 'active' ? 'Upgrade Subscription' : 'Subscribe Now'}
              </button>
            </div>
          </div>
          {isLocked && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm">
              <AlertTriangle className="text-red-600 w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-red-700">Access restricted — subscription required.</span>
            </div>
          )}
        </div>
      )}

      {/* Store Switcher (admin with multiple stores) */}
      {isAdmin && availableStores.length > 1 && (
        <div className="mb-6 flex items-center gap-3 text-sm bg-white p-3 rounded-2xl shadow-sm">
          <span className="text-gray-500 font-medium">Active store:</span>
          <select
            value={storeId}
            onChange={(e) => {
              const newId = e.target.value;
              if (newId !== storeId) {
                localStorage.setItem(`activeStore_${staff.id}`, newId);
                window.location.reload();
              }
            }}
            className="flex-1 p-2 border rounded-lg bg-white shadow-sm max-w-xs"
          >
            {availableStores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">Today's Sales</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1">{currency} {todaySales.toFixed(2)}</p>
            </div>
            <DollarSign className="w-6 h-6 sm:w-10 sm:h-10 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">This Month</p>
              <p className="text-lg sm:text-2xl font-bold mt-1">{currency} {monthSales.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-6 h-6 sm:w-10 sm:h-10 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">Transactions</p>
              <p className="text-lg sm:text-2xl font-bold mt-1">{totalTransactions}</p>
            </div>
            <ShoppingCart className="w-6 h-6 sm:w-10 sm:h-10 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">Active Lay By</p>
              <p className="text-lg sm:text-2xl font-bold mt-1">{activeLaybyCount}</p>
            </div>
            <Package className="w-6 h-6 sm:w-10 sm:h-10 text-orange-600" />
          </div>
        </div>
        {isAdmin && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500">Active Cashiers</p>
                <p className="text-lg sm:text-2xl font-bold mt-1">{activeCashierCount}</p>
              </div>
              <UserCheck className="w-6 h-6 sm:w-10 sm:h-10 text-indigo-600" />
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500">Customer Credit</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1">{currency} {totalCredit.toFixed(2)}</p>
              </div>
              <CreditCard className="w-6 h-6 sm:w-10 sm:h-10 text-blue-600" />
            </div>
          </div>
        )}
      </div>

      {/* Cross-store overview */}
      {isAdmin && availableStores.length > 1 && (
        <>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" /> All Stores Overview
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Total Today</p>
              <p className="text-lg sm:text-xl font-bold text-green-700">{currency} {crossStore.todaySales.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Total This Month</p>
              <p className="text-lg sm:text-xl font-bold text-blue-700">{currency} {crossStore.monthSales.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Total Transactions</p>
              <p className="text-lg sm:text-xl font-bold text-purple-700">{crossStore.transactions}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Active Lay‑bys</p>
              <p className="text-lg sm:text-xl font-bold text-orange-700">{crossStore.laybys}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Active Cashiers</p>
              <p className="text-lg sm:text-xl font-bold text-indigo-700">{crossStore.cashiers}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
              <p className="text-xs text-gray-500">Outstanding Credit</p>
              <p className="text-lg sm:text-xl font-bold text-red-600">{currency} {crossStore.credit.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}

      {/* Top Selling Products */}
      {topSellingProducts.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            <h2 className="font-semibold text-base sm:text-lg">Top Selling Products</h2>
          </div>
          <div className="space-y-2">
            {topSellingProducts.map((prod, idx) => (
              <div key={prod.id} className="flex items-center justify-between py-1 border-b text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-mono text-xs">{idx + 1}.</span>
                  <span className="font-medium">{prod.name}</span>
                </div>
                <span className="text-gray-600">{prod.quantity} sold</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button onClick={() => navigate('/app/pos')} className="bg-green-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-green-700 text-sm sm:text-base">
          <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" /><span>POS</span>
        </button>
        <button onClick={() => navigate('/app/inventory')} className="bg-blue-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-blue-700 text-sm sm:text-base">
          <Package className="w-6 h-6 sm:w-8 sm:h-8" /><span>Inventory</span>
        </button>
        {isAdmin && (
          <button onClick={() => navigate('/app/employees')} className="bg-purple-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-purple-700 text-sm sm:text-base">
            <Users className="w-6 h-6 sm:w-8 sm:h-8" /><span>Employees</span>
          </button>
        )}
        <button onClick={() => navigate('/app/layby')} className="bg-orange-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-orange-700 text-sm sm:text-base">
          <Package className="w-6 h-6 sm:w-8 sm:h-8" /><span>Lay By</span>
        </button>
        <button onClick={() => navigate('/app/invoices')} className="bg-teal-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-teal-700 text-sm sm:text-base">
          <FileText className="w-6 h-6 sm:w-8 sm:h-8" /><span>Invoices</span>
        </button>
        <button onClick={() => navigate('/app/customers')} className="bg-indigo-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-indigo-700 text-sm sm:text-base">
          <Users className="w-6 h-6 sm:w-8 sm:h-8" /><span>Customers</span>
        </button>
        {isAdmin && (
          <button onClick={() => navigate('/app/stock-transfers')} className="bg-teal-700 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-teal-800 text-sm sm:text-base">
            <ArrowRightLeft className="w-6 h-6 sm:w-8 sm:h-8" /><span>Transfers</span>
          </button>
        )}
        {isAdmin && (
          <button onClick={() => navigate('/app/suppliers')} className="bg-emerald-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-emerald-700 text-sm sm:text-base">
            <Truck className="w-6 h-6 sm:w-8 sm:h-8" /><span>Suppliers</span>
          </button>
        )}
        {isAdmin && (
          <button onClick={() => navigate('/app/cashier-shifts')} className="bg-pink-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-pink-700 text-sm sm:text-base">
            <Users className="w-6 h-6 sm:w-8 sm:h-8" /><span className="font-medium">Cashier Shifts</span>
          </button>
        )}
        <button onClick={() => navigate('/app/sales')} className="bg-cyan-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-cyan-700 text-sm sm:text-base">
          <Receipt className="w-6 h-6 sm:w-8 sm:h-8" /><span>Sales</span>
        </button>
        {(isAdmin || isManager) && (
          <button onClick={() => navigate('/app/reports')} className="bg-violet-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-violet-700 text-sm sm:text-base">
            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8" /><span>Reports</span>
          </button>
        )}
        <button onClick={() => navigate('/app/returns')} className="bg-red-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-red-700 text-sm sm:text-base">
          <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" /><span>Returns</span>
        </button>
        {isAdmin && (
          <button onClick={() => navigate('/app/settings')} className="bg-gray-600 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1 sm:gap-2 hover:bg-gray-700 text-sm sm:text-base">
            <Settings className="w-6 h-6 sm:w-8 sm:h-8" /><span>Settings</span>
          </button>
        )}
      </div>

      {/* Recent Transfers */}
      {isAdmin && recentTransfers.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6 text-teal-500" />
            <h2 className="font-semibold text-base sm:text-lg">Recent Stock Transfers</h2>
          </div>
          <div className="space-y-2 text-sm">
            {recentTransfers.map(t => (
              <div key={t.id} className="flex flex-col sm:flex-row sm:justify-between border-b pb-1 gap-1">
                <span>Product: {t.product_id}</span>
                <span>Qty: {t.quantity}</span>
                <span className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
            <h2 className="font-semibold text-base sm:text-lg">Low Stock (&le; {lowStockThreshold})</h2>
          </div>
          <div className="space-y-3">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b">
                <p className="font-medium text-sm sm:text-base">{p.name}</p>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">{p.stock_quantity} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring */}
      {expiringProducts.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
            <h2 className="font-semibold text-base sm:text-lg">Expiring Soon</h2>
          </div>
          <div className="space-y-3">
            {expiringProducts.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b gap-2">
                <div>
                  <p className="font-medium text-sm sm:text-base">{p.name}</p>
                  <p className="text-xs text-gray-500">Expires {new Date(p.expiry_date).toLocaleDateString()}</p>
                </div>
                <span className={`self-start sm:self-center px-3 py-1 text-xs rounded-full ${p.daysLeft<=2?'bg-red-100 text-red-700':p.daysLeft<=5?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-700'}`}>
                  {p.daysLeft} days
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Trend */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Sales Trend (Last 7 Days)</h2>
        {salesChartData.every(d => d.sales === 0) ? (
          <div className="text-center py-10 text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Make your first sale to see trends</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250} className="mt-2">
            <LineChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${currency} ${value}`} />
              <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
