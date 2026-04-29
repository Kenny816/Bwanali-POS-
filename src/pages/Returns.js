import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RotateCcw, Search, Camera, Eye, Printer, Download, X, Copy, Trash2 } from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Returns() {
  const { staff, storeId } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [companySettings, setCompanySettings] = useState({
    hardware_scanner: 'camera',
    currency_symbol: 'K',
    company_name: 'Store',
  });
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [saleItems, setSaleItems] = useState([]);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [refundAmount, setRefundAmount] = useState('0.00');

  const isAdmin = staff?.role === 'admin';
  const currency = companySettings.currency_symbol;

  const loadSales = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('sales')
      .select('*,customer:customers(name)')
      .eq('store_id', storeId)
      .eq('returned', false)
      .order('created_at', { ascending: false })
      .limit(50);
    setSales(data || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      loadSales();
      supabase
        .from('company_settings')
        .select('hardware_scanner,currency_symbol,company_name')
        .eq('store_id', storeId)
        .single()
        .then(({ data }) => { if (data) setCompanySettings(data); });
    }
  }, [storeId, loadSales]);

  const fetchSaleItemsData = async (saleId) => {
    const { data } = await supabase
      .from('sale_items')
      .select('*,product:products(name)')
      .eq('sale_id', saleId);
    return data || [];
  };

  const handleScan = (barcode) => {
    setSearchTerm(barcode);
    setShowScanner(false);
    toast.success(`Scan: ${barcode}`);
  };

  // Preview original sale
  const openPreview = async (sale) => {
    setSelectedSale(sale);
    setShowPreview(true);
  };

  // Return modal
  const openReturnModal = async (sale) => {
    setSelectedSale(sale);
    const items = await fetchSaleItemsData(sale.id);
    setSaleItems(items);
    const qty = {};
    items.forEach(item => qty[item.id] = 0);
    setReturnQuantities(qty);
    setRefundAmount('0.00');
    setShowReturnModal(true);
  };

  const handleQuantityChange = (itemId, value) => {
    const max = saleItems.find(i => i.id === itemId)?.quantity || 0;
    const newQty = Math.max(0, Math.min(parseInt(value) || 0, max));
    const updated = { ...returnQuantities, [itemId]: newQty };
    setReturnQuantities(updated);
    let total = 0;
    saleItems.forEach(item => { total += item.unit_price * (updated[item.id] || 0); });
    setRefundAmount(total.toFixed(2));
  };

  const processReturn = async () => {
    if (!selectedSale) return;
    const itemsToReturn = saleItems.filter(i => returnQuantities[i.id] > 0);
    if (!itemsToReturn.length) return toast.error('Select quantity to return');
    const refund = parseFloat(refundAmount);
    if (isNaN(refund) || refund <= 0) return toast.error('Invalid refund amount');
    try {
      await supabase.from('returns').insert({
        store_id: storeId,
        sale_id: selectedSale.id,
        staff_id: staff.id,
        refund_amount: refund,
        reason: 'Customer return',
      });
      for (const item of itemsToReturn) {
        await supabase.rpc('increment_stock', { p_product_id: item.product_id, p_quantity: returnQuantities[item.id] });
      }
      const totalReturned = Object.values(returnQuantities).reduce((a, b) => a + b, 0);
      const totalSale = saleItems.reduce((a, b) => a + b.quantity, 0);
      if (totalReturned >= totalSale) {
        await supabase.from('sales').update({ returned: true }).eq('id', selectedSale.id);
      }
      toast.success('Return processed');
      setShowReturnModal(false);
      loadSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const originalReceiptText = (sale) => {
    return `${companySettings.company_name}\nORIGINAL RECEIPT\nInvoice #${sale.invoice_number}\nDate: ${new Date(sale.created_at).toLocaleString()}\nCustomer: ${sale.customer?.name || 'Walk-in'}\nTotal: ${currency}${sale.total_amount?.toFixed(2)}`;
  };

  const printOriginal = (sale) => {
    const w = window.open('', '_blank');
    w.document.write(`<pre>${originalReceiptText(sale)}</pre><script>window.print()</script>`);
    w.document.close();
  };

  const downloadOriginal = (sale) => {
    const blob = new Blob([originalReceiptText(sale)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receipt_${sale.invoice_number}.txt`;
    a.click();
  };

  const deleteSale = async (sale) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm(`Delete sale #${sale.invoice_number} permanently?`)) return;
    try {
      await supabase.from('sales').delete().eq('id', sale.id);
      toast.success('Sale deleted');
      loadSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = sales.filter(s =>
    s.invoice_number?.toString().includes(searchTerm) ||
    s.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4"><RotateCcw className="inline mr-2"/>Returns</h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            placeholder="Search by invoice or customer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 border rounded-lg"
          />
        </div>
        <button onClick={() => setShowScanner(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-1">
          <Camera size={18} /> <span className="hidden sm:inline">Scan</span>
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Invoice #</th>
              <th className="p-3">Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{s.invoice_number}</td>
                <td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="p-3">{s.customer?.name || 'Walk-in'}</td>
                <td className="p-3 text-right font-medium">{currency}{s.total_amount?.toFixed(2)}</td>
                <td className="p-3">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => openPreview(s)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Preview"><Eye size={18} /></button>
                    <button onClick={() => printOriginal(s)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Print"><Printer size={18} /></button>
                    <button onClick={() => downloadOriginal(s)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Download"><Download size={18} /></button>
                    <button onClick={() => openReturnModal(s)} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-xs">Return</button>
                    {isAdmin && <button onClick={() => deleteSale(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={18} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">#{s.invoice_number}</p>
                <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</p>
                <p className="text-sm mt-1">{s.customer?.name || 'Walk-in'}</p>
              </div>
              <span className="text-lg font-bold text-green-600">{currency}{s.total_amount?.toFixed(2)}</span>
            </div>
            <div className="mt-4 flex gap-2 justify-end border-t pt-3">
              <button onClick={() => openPreview(s)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Eye size={18} /></button>
              <button onClick={() => printOriginal(s)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Printer size={18} /></button>
              <button onClick={() => downloadOriginal(s)} className="p-2 bg-green-50 text-green-600 rounded-lg"><Download size={18} /></button>
              <button onClick={() => openReturnModal(s)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Return</button>
              {isAdmin && <button onClick={() => deleteSale(s)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18} /></button>}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2>Receipt #{selectedSale.invoice_number}</h2>
              <button onClick={() => setShowPreview(false)}><X/></button>
            </div>
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {originalReceiptText(selectedSale)}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(originalReceiptText(selectedSale)); toast.success('Copied'); }} className="px-3 py-1.5 bg-gray-600 text-white rounded"><Copy size={14} /> Copy</button>
              <button onClick={() => printOriginal(selectedSale)} className="px-3 py-1.5 bg-blue-600 text-white rounded"><Printer size={14} /> Print</button>
              <button onClick={() => downloadOriginal(selectedSale)} className="px-3 py-1.5 bg-green-600 text-white rounded"><Download size={14} /> Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2>Return Invoice #{selectedSale.invoice_number}</h2>
              <button onClick={() => setShowReturnModal(false)}><X/></button>
            </div>
            <div className="p-4 space-y-4">
              {saleItems.length === 0 ? (
                <p className="text-gray-500">No items found for this sale.</p>
              ) : (
                saleItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.product?.name || 'Unknown product'}</p>
                      <p className="text-sm text-gray-500">Price: {currency}{item.unit_price?.toFixed(2)} × Max: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{currency}{item.unit_price?.toFixed(2)}</span>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={returnQuantities[item.id] || 0}
                        onChange={e => handleQuantityChange(item.id, e.target.value)}
                        className="w-16 p-1 border rounded text-center"
                      />
                    </div>
                  </div>
                ))
              )}
              <div>
                <label className="block text-sm mb-1">Refund Amount ({currency})</label>
                <input type="text" value={refundAmount} readOnly className="w-full p-2 border rounded bg-gray-100" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={processReturn} className="px-4 py-2 bg-blue-600 text-white rounded">Confirm Return</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
