import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  BarChart3, DollarSign, TrendingUp, Package,
  Filter, Download, RefreshCw, X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
  const { storeId, staff } = useAuth();
  const [tab, setTab] = useState('sales');
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [salesData, setSalesData] = useState([]);
  const [profitData, setProfitData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState('K');

  const isAdminOrManager = staff?.role === 'admin' || staff?.role === 'manager';

  useEffect(() => {
    if (storeId) {
      supabase.from('company_settings').select('currency_symbol').eq('store_id', storeId).single()
        .then(({ data }) => { if (data?.currency_symbol) setCurrencySymbol(data.currency_symbol); });
    }
  }, [storeId]);

  const getDateRange = () => {
    const now = new Date();
    let start = new Date(), end = new Date();
    switch (dateRange) {
      case 'today': start.setHours(0,0,0,0); end.setHours(23,59,59,999); break;
      case 'yesterday': start.setDate(now.getDate()-1); start.setHours(0,0,0,0); end.setDate(now.getDate()-1); end.setHours(23,59,59,999); break;
      case 'thisWeek': const day = now.getDay(); start.setDate(now.getDate()-day); start.setHours(0,0,0,0); end.setHours(23,59,59,999); break;
      case 'thisMonth': start.setDate(1); start.setHours(0,0,0,0); end.setHours(23,59,59,999); break;
      case 'lastMonth': start.setMonth(now.getMonth()-1,1); start.setHours(0,0,0,0); end.setMonth(now.getMonth(),0); end.setHours(23,59,59,999); break;
      default: if (startDate && endDate) { start = new Date(startDate); end = new Date(endDate); end.setHours(23,59,59,999); } break;
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange();
      if (tab === 'sales') {
        const { data } = await supabase.from('sales').select('*').eq('store_id', storeId).eq('returned', false)
          .gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
        setSalesData(data?.data || data || []);
      } else if (tab === 'profit') {
        const { data: sales } = await supabase.from('sales').select('total_amount').eq('store_id', storeId).eq('returned', false)
          .gte('created_at', start).lte('created_at', end);
        const { data: items } = await supabase.from('sale_items').select('quantity,cost_price').gte('created_at', start).lte('created_at', end);
        const salesArr = sales?.data || sales || [];
        const itemsArr = items?.data || items || [];
        const totalRevenue = salesArr.reduce((sum, s) => sum + (s.total_amount||0), 0);
        const totalCost = itemsArr.reduce((sum, i) => sum + (i.cost_price||0)*(i.quantity||0), 0);
        setProfitData({ totalRevenue, totalCost, grossProfit: totalRevenue-totalCost, margin: totalRevenue>0?(totalRevenue-totalCost)/totalRevenue*100:0, transactionCount: salesArr.length });
      } else if (tab === 'inventory') {
        const { data: prods } = await supabase.from('products').select('name,stock_quantity,cost_price,unit_price').eq('store_id', storeId).eq('is_active', true);
        const prodArr = prods?.data || prods || [];
        const items = prodArr.map(p => ({ ...p, costValue: (p.cost_price||0)*(p.stock_quantity||0), retailValue: (p.unit_price||0)*(p.stock_quantity||0) }));
        setInventoryData({ totalCost: items.reduce((s,i)=>s+i.costValue,0), totalRetail: items.reduce((s,i)=>s+i.retailValue,0), potentialProfit: items.reduce((s,i)=>s+i.retailValue-i.costValue,0), items });
      }
    } catch (err) { setError(err.message); toast.error('Failed to load data'); } finally { setLoading(false); }
  }, [storeId, tab, dateRange, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { window.addEventListener('db-change', loadData); return () => window.removeEventListener('db-change', loadData); }, [loadData]);

  const formatCurrency = (v) => `${currencySymbol}${v.toFixed(2)}`;

  if (!isAdminOrManager) return <div className="p-8 text-red-600">Access Denied</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold"><BarChart3 className="inline mr-2"/>Reports</h1>
        <button onClick={loadData} disabled={loading} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"><RefreshCw size={14}/> {loading?'...':'Refresh'}</button>
      </div>
      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg"><X className="inline mr-2"/>{error}</div>}
      <div className="flex gap-2 mb-4">{['sales','profit','inventory'].map(t=>(
        <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded ${tab===t?'bg-green-600 text-white':'bg-gray-100'}`}>{t}</button>
      ))}</div>
      <div className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded-xl shadow">
        <select value={dateRange} onChange={e=>setDateRange(e.target.value)} className="p-2 border rounded text-sm">
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="thisWeek">This Week</option>
          <option value="thisMonth">This Month</option><option value="lastMonth">Last Month</option><option value="custom">Custom</option>
        </select>
        {dateRange==='custom'&&<><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border rounded text-sm"/><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border rounded text-sm"/></>}
        <button onClick={loadData} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded text-sm"><Filter size={16}/> Apply</button>
      </div>
      <div className="space-y-6">
        {tab==='sales'&&<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Total Sales</p><p className="text-2xl font-bold text-green-600">{formatCurrency(salesData.reduce((s,i)=>s+(i.total_amount||0),0))}</p></div>
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Transactions</p><p className="text-2xl font-bold">{salesData.length}</p></div>
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Avg Sale</p><p className="text-2xl font-bold">{formatCurrency(salesData.length?salesData.reduce((s,i)=>s+(i.total_amount||0),0)/salesData.length:0)}</p></div>
          </div>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-3">Invoice</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Cashier</th><th className="p-3">Total</th></tr></thead>
              <tbody>{salesData.map(s=>(<tr key={s.id} className="border-t"><td className="p-3">{s.invoice_number}</td><td className="p-3">{new Date(s.created_at).toLocaleString()}</td><td className="p-3">{s.customer?.name||'Walk-in'}</td><td className="p-3">{s.staff?.full_name||''}</td><td className="p-3 text-right">{formatCurrency(s.total_amount)}</td></tr>))}</tbody>
            </table>
          </div>
        </>}
        {tab==='profit'&&profitData&&<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Revenue</p><p className="text-2xl font-bold">{formatCurrency(profitData.totalRevenue)}</p></div>
          <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Cost</p><p className="text-2xl font-bold">{formatCurrency(profitData.totalCost)}</p></div>
          <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Profit</p><p className="text-2xl font-bold text-green-600">{formatCurrency(profitData.grossProfit)}</p></div>
          <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Margin</p><p className="text-2xl font-bold">{profitData.margin.toFixed(1)}%</p></div>
        </div>}
        {tab==='inventory'&&inventoryData&&<>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Cost Value</p><p className="text-2xl font-bold">{formatCurrency(inventoryData.totalCost)}</p></div>
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Retail Value</p><p className="text-2xl font-bold">{formatCurrency(inventoryData.totalRetail)}</p></div>
            <div className="bg-white p-4 rounded-xl shadow"><p className="text-sm text-gray-500">Potential Profit</p><p className="text-2xl font-bold text-green-600">{formatCurrency(inventoryData.potentialProfit)}</p></div>
          </div>
        </>}
      </div>
    </div>
  );
}
