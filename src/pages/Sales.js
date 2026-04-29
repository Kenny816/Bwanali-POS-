import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Receipt, Search, Eye, Printer, Download, X, Copy, Trash2 } from 'lucide-react';

export default function Sales() {
  const { storeId, canDelete } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [companySettings, setCompanySettings] = useState({ currency_symbol: 'K', company_name: 'Store' });

  const loadSales = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, customer:customers(name), staff:staff(full_name)')
        .eq('store_id', storeId)
        .eq('returned', false)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setSales(data?.data || data || []);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      loadSales();
      supabase
        .from('company_settings')
        .select('currency_symbol, company_name')
        .eq('store_id', storeId)
        .single()
        .then(({ data }) => { if (data) setCompanySettings(data); })
        .catch(() => {});
    }
  }, [storeId, loadSales]);

  // Auto‑refresh when data changes anywhere
  useEffect(() => {
    const handler = () => loadSales();
    window.addEventListener('db-change', handler);
    return () => window.removeEventListener('db-change', handler);
  }, [loadSales]);

  const handlePreview = (sale) => {
    setSelectedSale(sale);
    setShowPreview(true);
  };

  const generateReceiptText = (sale) => {
    return `${companySettings.company_name || 'Store'}\nReceipt #${sale.invoice_number}\nDate: ${new Date(sale.created_at).toLocaleString()}\nCashier: ${sale.staff?.full_name || 'N/A'}\nCustomer: ${sale.customer?.name || 'Walk-in'}\nTotal: ${companySettings.currency_symbol}${sale.total_amount?.toFixed(2)}\n--------------------------------\nThank you!`;
  };

  const printReceipt = (sale) => {
    const w = window.open('', '_blank');
    w.document.write(`<pre>${generateReceiptText(sale)}</pre>`);
    w.document.close();
    w.print();
  };

  const downloadReceipt = (sale) => {
    const blob = new Blob([generateReceiptText(sale)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receipt_${sale.invoice_number}.txt`;
    a.click();
  };

  const copyReceipt = (sale) => {
    navigator.clipboard?.writeText(generateReceiptText(sale));
    toast.success('Copied to clipboard');
  };

  const deleteSale = async (sale) => {
    if (!canDelete) return toast.error('Permission denied');
    if (!window.confirm(`Delete sale #${sale.invoice_number} permanently?`)) return;
    try {
      await supabase.from('sales').delete().eq('id', sale.id);
      toast.success('Sale deleted');
      loadSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredSales = (sales || []).filter(s =>
    s.invoice_number?.toString().includes(searchTerm) ||
    s.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading sales...</div>;

  const currency = companySettings.currency_symbol || 'K';

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Receipt className="inline" /> Sales History
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <X className="text-red-600" /> {error}
          <button onClick={loadSales} className="ml-auto px-3 py-1 bg-blue-600 text-white rounded text-sm">Retry</button>
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          placeholder="Search by invoice, customer, cashier..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 p-2 border rounded-lg"
        />
      </div>

      {/* ---- Desktop Table (hidden on mobile) ---- */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left">Invoice #</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Cashier</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-500">No sales found</td></tr>
            ) : (
              filteredSales.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{s.invoice_number}</td>
                  <td className="p-3">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3">{s.customer?.name || 'Walk-in'}</td>
                  <td className="p-3">{s.staff?.full_name || '-'}</td>
                  <td className="p-3 text-right font-medium">{currency}{s.total_amount?.toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handlePreview(s)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Preview"><Eye size={18} /></button>
                      <button onClick={() => printReceipt(s)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Print"><Printer size={18} /></button>
                      <button onClick={() => downloadReceipt(s)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Download"><Download size={18} /></button>
                      {canDelete && (
                        <button onClick={() => deleteSale(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={18} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Mobile Cards (hidden on desktop) ---- */}
      <div className="md:hidden space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No sales found</div>
        ) : (
          filteredSales.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg">#{s.invoice_number}</p>
                  <p className="text-sm text-gray-500">{new Date(s.created_at).toLocaleString()}</p>
                </div>
                <span className="text-xl font-bold text-green-600">{currency}{s.total_amount?.toFixed(2)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Customer:</span> {s.customer?.name || 'Walk-in'}</div>
                <div><span className="text-gray-500">Cashier:</span> {s.staff?.full_name || '-'}</div>
              </div>
              <div className="mt-4 flex gap-2 justify-end border-t pt-3">
                <button onClick={() => handlePreview(s)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Eye size={18} /></button>
                <button onClick={() => printReceipt(s)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Printer size={18} /></button>
                <button onClick={() => downloadReceipt(s)} className="p-2 bg-green-50 text-green-600 rounded-lg"><Download size={18} /></button>
                {canDelete && (
                  <button onClick={() => deleteSale(s)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18} /></button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2 className="font-bold">Receipt #{selectedSale.invoice_number}</h2>
              <button onClick={() => setShowPreview(false)}><X/></button>
            </div>
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {generateReceiptText(selectedSale)}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => copyReceipt(selectedSale)} className="px-3 py-1.5 bg-gray-600 text-white rounded flex items-center gap-1"><Copy size={14} /> Copy</button>
              <button onClick={() => printReceipt(selectedSale)} className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center gap-1"><Printer size={14} /> Print</button>
              <button onClick={() => downloadReceipt(selectedSale)} className="px-3 py-1.5 bg-green-600 text-white rounded flex items-center gap-1"><Download size={14} /> Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
