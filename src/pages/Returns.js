import React,{useState,useEffect,useCallback} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {RotateCcw,Search,Camera,Eye,Printer,Download,X,Copy} from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import { useHardware } from '../hooks/useHardware';

export default function Returns() {
  const {staff,storeId} = useAuth();
  const [sales,setSales] = useState([]);
  const [loading,setLoading] = useState(true);
  const [searchTerm,setSearchTerm] = useState('');
  const [showScanner,setShowScanner] = useState(false);
  const [companySettings,setCompanySettings] = useState({hardware_scanner:'camera',currency_symbol:'K',company_name:'Store'});
  const [selectedSale,setSelectedSale] = useState(null);
  const [showPreview,setShowPreview] = useState(false);
  const [showReturnModal,setShowReturnModal] = useState(false);
  const [saleItems,setSaleItems] = useState([]);
  const [returnQuantities,setReturnQuantities] = useState({});
  const [refundAmount,setRefundAmount] = useState('');
  const { scanner } = useHardware();

  const loadSales = useCallback(async () => {
    if (!storeId) return;
    const {data} = await supabase.from('sales')
      .select('*,customer:customers(name)')
      .eq('store_id',storeId)
      .eq('returned',false)
      .order('created_at',{ascending:false})
      .limit(50);
    setSales(data||[]);
    setLoading(false);
  },[storeId]);

  useEffect(() => {
    if (storeId) {
      loadSales();
      supabase.from('company_settings')
        .select('hardware_scanner,currency_symbol,company_name')
        .eq('store_id',storeId)
        .single()
        .then(({data}) => {if(data) setCompanySettings(data);});
    }
  },[storeId,loadSales]);

  const fetchSaleItems = async (saleId) => {
    const {data} = await supabase.from('sale_items')
      .select('*,product:products(name)')
      .eq('sale_id',saleId);
    setSaleItems(data||[]);
  };

  const handleScan = (barcode) => {
    setSearchTerm(barcode);
    setShowScanner(false);
    toast.success(`Scan: ${barcode}`);
  };

  const handlePreview = async (sale) => {
    setSelectedSale(sale);
    await fetchSaleItems(sale.id);
    setShowPreview(true);
  };

  const openReturnModal = (sale) => {
    setSelectedSale(sale);
    fetchSaleItems(sale.id).then(() => {
      const qty = {};
      saleItems.forEach(i => qty[i.id] = 0);
      setReturnQuantities(qty);
      updateRefundAmount(qty);
      setShowReturnModal(true);
    });
  };

  const handleQuantityChange = (id, val) => {
    const max = saleItems.find(i => i.id === id)?.quantity || 0;
    const newQty = Math.max(0, Math.min(parseInt(val)||0, max));
    const updatedQuantities = { ...returnQuantities, [id]: newQty };
    setReturnQuantities(updatedQuantities);
    updateRefundAmount(updatedQuantities);
  };

  const updateRefundAmount = (quantities) => {
    let total = 0;
    saleItems.forEach(item => {
      const qty = quantities[item.id] || 0;
      total += item.unit_price * qty;
    });
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
        reason: 'Customer return'
      });

      for (const item of itemsToReturn) {
        await supabase.rpc('increment_stock', {
          p_product_id: item.product_id,
          p_quantity: returnQuantities[item.id]
        });
      }

      const totalReturned = Object.values(returnQuantities).reduce((a,b)=>a+b,0);
      const totalSale = saleItems.reduce((a,b)=>a+b.quantity,0);
      if (totalReturned >= totalSale) {
        await supabase.from('sales').update({returned:true}).eq('id',selectedSale.id);
      }

      toast.success('Return processed');
      setShowReturnModal(false);
      loadSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const generateReturnReceiptText = (sale) => {
    let text = `${companySettings.company_name}\nRETURN RECEIPT\nInvoice #${sale.invoice_number}\nDate: ${new Date().toLocaleString()}\nCustomer: ${sale.customer?.name||'Walk-in'}\n`;
    text += `Items Returned:\n`;
    saleItems.forEach(item => {
      const qty = returnQuantities[item.id] || 0;
      if (qty > 0) {
        text += `  ${item.product?.name} x${qty} @ ${companySettings.currency_symbol}${item.unit_price} = ${companySettings.currency_symbol}${(item.unit_price * qty).toFixed(2)}\n`;
      }
    });
    text += `Refund Total: ${companySettings.currency_symbol}${refundAmount}\nProcessed by: ${staff?.full_name}`;
    return text;
  };

  const printReturnReceipt = (sale) => {
    const w = window.open('','_blank');
    w.document.write(`<pre>${generateReturnReceiptText(sale)}</pre><script>window.print()</script>`);
    w.document.close();
  };

  const downloadReturnReceipt = (sale) => {
    const b = new Blob([generateReturnReceiptText(sale)],{type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `return_${sale.invoice_number}.txt`;
    a.click();
  };

  const handleCopy = (sale) => {
    navigator.clipboard?.writeText(generateReturnReceiptText(sale));
    toast.success('Copied');
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
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
          <input placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg"/>
        </div>
        <button onClick={()=>setShowScanner(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg"><Camera size={18}/>Scan</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-3">Invoice #</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b">
                <td className="p-3">{s.invoice_number}</td>
                <td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="p-3">{s.customer?.name||'Walk-in'}</td>
                <td className="p-3 text-right">{companySettings.currency_symbol}{s.total_amount?.toFixed(2)}</td>
                <td className="p-3">
                  <div className="flex gap-1 justify-center">
                    <button onClick={()=>handlePreview(s)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"><Eye size={18}/></button>
                    <button onClick={()=>printReturnReceipt(s)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"><Printer size={18}/></button>
                    <button onClick={()=>downloadReturnReceipt(s)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Download size={18}/></button>
                    <button onClick={()=>openReturnModal(s)} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-xs">Return</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2>Return Invoice #{selectedSale.invoice_number}</h2>
              <button onClick={()=>setShowReturnModal(false)}><X/></button>
            </div>
            <div className="p-4 space-y-4">
              {saleItems.map(item => (
                <div key={item.id} className="flex justify-between items-center border-b pb-2">
                  <span>{item.product?.name} (Max: {item.quantity})</span>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    value={returnQuantities[item.id]||0}
                    onChange={e=>handleQuantityChange(item.id,e.target.value)}
                    className="w-20 p-1 border rounded text-center"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm mb-1">Refund Amount ({companySettings.currency_symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-100"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={()=>setShowReturnModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={processReturn} className="px-4 py-2 bg-blue-600 text-white rounded">Confirm Return</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between">
              <h2>Receipt #{selectedSale.invoice_number}</h2>
              <button onClick={()=>setShowPreview(false)}><X/></button>
            </div>
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {generateReturnReceiptText(selectedSale)}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={()=>handleCopy(selectedSale)} className="px-3 py-1.5 bg-gray-600 text-white rounded"><Copy size={14}/>Copy</button>
              <button onClick={()=>printReturnReceipt(selectedSale)} className="px-3 py-1.5 bg-blue-600 text-white rounded"><Printer size={14}/>Print</button>
              <button onClick={()=>downloadReturnReceipt(selectedSale)} className="px-3 py-1.5 bg-green-600 text-white rounded"><Download size={14}/>Download</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={()=>setShowScanner(false)} />}
    </div>
  );
}
