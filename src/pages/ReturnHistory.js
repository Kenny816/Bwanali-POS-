import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { History, Search, Eye, Printer, Download, X, Copy, Trash2, Undo2 } from 'lucide-react';

export default function ReturnHistory() {
  const { staff, storeId } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [companySettings, setCompanySettings] = useState({ currency_symbol: 'K', company_name: 'Store' });

  const isAdmin = staff?.role === 'admin';
  const currency = companySettings.currency_symbol;

  const loadReturns = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*,sale:sales(*,customer:customers(name)),staff:staff(full_name)')
        .eq('store_id', storeId)
        .order('return_date', { ascending: false });
      if (error) throw error;
      setReturns(data || []);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      loadReturns();
      supabase
        .from('company_settings')
        .select('currency_symbol,company_name')
        .eq('store_id', storeId)
        .single()
        .then(({ data }) => { if (data) setCompanySettings(data); });
    }
  }, [storeId, loadReturns]);

  const returnReceiptText = (ret) => {
    return `${companySettings.company_name}\nRETURN RECEIPT\nInvoice #${ret.sale?.invoice_number}\nDate: ${new Date(ret.return_date).toLocaleString()}\nCustomer: ${ret.sale?.customer?.name || 'Walk-in'}\nOriginal: ${currency}${ret.sale?.total_amount?.toFixed(2)}\nRefund: ${currency}${ret.refund_amount?.toFixed(2)}\nProcessed by: ${ret.staff?.full_name}`;
  };

  const openPreview = (ret) => { setSelectedReturn(ret); setShowPreview(true); };

  const printReturn = (ret) => {
    const w = window.open('', '_blank');
    w.document.write(`<pre>${returnReceiptText(ret)}</pre><script>window.print()</script>`);
    w.document.close();
  };

  const downloadReturn = (ret) => {
    const blob = new Blob([returnReceiptText(ret)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `return_${ret.sale?.invoice_number}.txt`;
    a.click();
  };

  const copyReturn = (ret) => { navigator.clipboard?.writeText(returnReceiptText(ret)); toast.success('Copied'); };

  const deleteReturn = async (ret) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm('Delete this return record permanently?')) return;
    await supabase.from('returns').delete().eq('id', ret.id);
    toast.success('Return record deleted');
    loadReturns();
  };

  const undoReturn = async (ret) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm('Undo this return? The original sale will be restored.')) return;
    await supabase.from('sales').update({ returned: false }).eq('id', ret.sale_id);
    await supabase.from('returns').delete().eq('id', ret.id);
    toast.success('Return undone');
    loadReturns();
  };

  const filtered = returns.filter(r =>
    r.sale?.invoice_number?.toString().includes(searchTerm) ||
    r.sale?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold"><History className="inline mr-2" />Return History</h1>
        {error && (
          <button onClick={loadReturns} className="ml-auto px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-1">
            <Undo2 size={14} /> Retry
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <X className="text-red-600" /> <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          placeholder="Search by invoice or customer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 p-2 border rounded-lg"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Invoice #</th>
              <th className="p-3">Return Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Processed By</th>
              <th className="p-3 text-right">Original</th>
              <th className="p-3 text-right">Refund</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center">No returns found</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{r.sale?.invoice_number}</td>
                  <td className="p-3">{new Date(r.return_date).toLocaleString()}</td>
                  <td className="p-3">{r.sale?.customer?.name || 'Walk-in'}</td>
                  <td className="p-3">{r.staff?.full_name}</td>
                  <td className="p-3 text-right">{currency}{r.sale?.total_amount?.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-600">{currency}{r.refund_amount?.toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openPreview(r)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Preview"><Eye size={18} /></button>
                      <button onClick={() => printReturn(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Print"><Printer size={18} /></button>
                      <button onClick={() => downloadReturn(r)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Download"><Download size={18} /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => undoReturn(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Undo"><Undo2 size={18} /></button>
                          <button onClick={() => deleteReturn(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">Invoice #{r.sale?.invoice_number}</p>
                <p className="text-xs text-gray-500">Returned {new Date(r.return_date).toLocaleString()}</p>
                <p className="text-sm mt-1">{r.sale?.customer?.name || 'Walk-in'}</p>
              </div>
              <span className="text-lg font-bold text-green-600">{currency}{r.refund_amount?.toFixed(2)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Original:</span> {currency}{r.sale?.total_amount?.toFixed(2)}</div>
              <div><span className="text-gray-500">By:</span> {r.staff?.full_name}</div>
            </div>
            <div className="mt-4 flex gap-2 justify-end border-t pt-3">
              <button onClick={() => openPreview(r)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Eye size={18} /></button>
              <button onClick={() => printReturn(r)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Printer size={18} /></button>
              <button onClick={() => downloadReturn(r)} className="p-2 bg-green-50 text-green-600 rounded-lg"><Download size={18} /></button>
              {isAdmin && (
                <>
                  <button onClick={() => undoReturn(r)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Undo2 size={18} /></button>
                  <button onClick={() => deleteReturn(r)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between">
              <h2 className="font-bold">Return Receipt</h2>
              <button onClick={() => setShowPreview(false)}><X/></button>
            </div>
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {returnReceiptText(selectedReturn)}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => copyReturn(selectedReturn)} className="px-3 py-1.5 bg-gray-600 text-white rounded"><Copy size={14} /> Copy</button>
              <button onClick={() => printReturn(selectedReturn)} className="px-3 py-1.5 bg-blue-600 text-white rounded"><Printer size={14} /> Print</button>
              <button onClick={() => downloadReturn(selectedReturn)} className="px-3 py-1.5 bg-green-600 text-white rounded"><Download size={14} /> Download</button>
              <button onClick={() => setShowPreview(false)} className="px-3 py-1.5 bg-gray-200 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
