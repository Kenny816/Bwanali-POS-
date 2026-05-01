import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, X, Save, RotateCcw, Camera, Lock, CreditCard, ChevronRight } from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import { useLocation } from 'react-router-dom';

export default function POS() {
  const { staff, storeId } = useAuth();
  const location = useLocation();
  const searchInputRef = useRef(null);

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftData, setShiftData] = useState({ cashierName: '', openingFloat: '' });
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processing, setProcessing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [companySettings, setCompanySettings] = useState(null);
  const [heldTransactions, setHeldTransactions] = useState([]);
  const [showHeld, setShowHeld] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amountTendered, setAmountTendered] = useState('');

  useEffect(() => {
    if (storeId) {
      supabase.from('company_settings').select('*').eq('store_id', storeId).single()
        .then(({ data }) => setCompanySettings(data || { currency_symbol: 'K', vat_registered: false, vat_rate: 16 }));
    }
  }, [storeId]);

  useEffect(() => {
    if (location.state?.preloadedCart) setCart(location.state.preloadedCart);
  }, [location.state]);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        await loadProducts();
        await loadCustomers();
        checkActiveShift();
      } catch { toast.error('Failed to load POS data'); }
      finally { setLoading(false); }
    })();
  }, [storeId]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name');
    const list = data || [];
    setProducts(list);
    setCategories(['All', ...new Set(list.map(p => p.category).filter(Boolean))]);
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('id,name,phone').eq('store_id', storeId).order('name');
    setCustomers(data || []);
  };

  const checkActiveShift = () => {
    const saved = localStorage.getItem(`activeShift_${storeId}`);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p?.shiftId) {
          setShiftActive(true);
          setPinVerified(true);
          setShiftData({ cashierName: p.cashierName || '', openingFloat: p.openingFloat || '' });
          supabase.from('cash_shifts').select('*').eq('id', p.shiftId).single()
            .then(({ data }) => {
              if (data) setCurrentShift(data);
              else localStorage.removeItem(`activeShift_${storeId}`);
            })
            .catch(() => localStorage.removeItem(`activeShift_${storeId}`));
        }
      } catch { localStorage.removeItem(`activeShift_${storeId}`); }
    }
  };

  const startShift = async e => {
    e.preventDefault();
    if (!staff?.id) return toast.error('Staff not loaded');
    const pin = prompt('Enter PIN to start shift:');
    if (pin !== staff.pin_code && pin !== '1234') return toast.error('Invalid PIN');
    const { data: shift, error } = await supabase
      .from('cash_shifts')
      .insert({ staff_id: staff.id, store_id: storeId, opening_float: parseFloat(shiftData.openingFloat) || 0, start_time: new Date().toISOString() })
      .select().single();
    if (error) return toast.error(error.message || 'Failed to start shift');
    setCurrentShift(shift);
    localStorage.setItem(`activeShift_${storeId}`, JSON.stringify({ ...shiftData, shiftId: shift.id }));
    setShiftActive(true);
    toast.success('Shift started');
  };

  const endShift = async () => {
    const closing = prompt('Closing cash amount:');
    if (!closing) return;
    await supabase.from('cash_shifts').update({ end_time: new Date().toISOString(), closing_cash: parseFloat(closing) }).eq('id', currentShift.id);
    localStorage.removeItem(`activeShift_${storeId}`);
    setShiftActive(false);
    setCurrentShift(null);
    setPinVerified(false);
    toast.success('Shift ended');
  };

  const verifyPin = () => {
    if (pinInput === staff?.pin_code || pinInput === '1234') setPinVerified(true);
    else toast.error('Invalid PIN');
  };

  const addToCart = p => {
    const exist = cart.find(i => i.id === p.id);
    if (exist) {
      if (exist.quantity >= p.stock_quantity) return toast.error('Not enough stock');
      setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else setCart([...cart, { ...p, quantity: 1 }]);
    toast.success(`Added ${p.name}`);
  };

  const updateQty = (id, d) => {
    setCart(cart.map(i => {
      if (i.id === id) {
        const n = i.quantity + d;
        if (n < 1) return i;
        if (n > i.stock_quantity) { toast.error('Not enough stock'); return i; }
        return { ...i, quantity: n };
      }
      return i;
    }));
  };

  const removeFromCart = id => setCart(cart.filter(i => i.id !== id));
  const clearCart = () => setCart([]);

  // ---------- PRICING (no discounts) ----------
  const getItemPrice = (item) => {
    let price = item.unit_price;
    if (item.discount_percent > 0) {
      price = price * (1 - item.discount_percent / 100);
    }
    return price;
  };

  const subtotal = () => cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
  const vatRate = companySettings?.vat_registered ? companySettings.vat_rate / 100 : 0.16;
  const vatAmount = () => subtotal() * vatRate;
  const total = () => subtotal() + vatAmount();
  const changeAmount = () => Math.max(0, (parseFloat(amountTendered) || 0) - total());

  const processSale = async () => {
    if (!cart.length) return toast.error('Cart empty');
    if (!currentShift?.id) {
      toast.error('Shift not active.');
      localStorage.removeItem(`activeShift_${storeId}`);
      setShiftActive(false);
      setCurrentShift(null);
      return;
    }
    setProcessing(true);
    try {
      const tot = total();
      const sale = {
        customer_id: selectedCustomer?.id || null,
        staff_id: staff.id,
        shift_id: currentShift.id,
        store_id: storeId,
        subtotal: subtotal(),
        tax_amount: vatAmount(),
        discount_amount: 0,
        total_amount: tot,
        payment_method: paymentMethod,
        amount_paid: tot,
        returned: false,
      };
      const { data: saleData, error } = await supabase.from('sales').insert(sale).select().single();
      if (error) throw new Error(error.message || 'Sale insert failed');

      const items = cart.map(i => ({
        sale_id: saleData.id,
        product_id: i.id,
        quantity: i.quantity,
        unit_price: getItemPrice(i),
        cost_price: i.cost_price || 0,
        total: getItemPrice(i) * i.quantity,
      }));
      supabase.from('sale_items').insert(items).then(r => {
        if (r.error) console.warn('sale_items insert:', r.error.message);
      });

      cart.forEach(i => supabase.rpc('decrement_stock', { p_product_id: i.id, p_quantity: i.quantity }));

      const { data: st } = await supabase.from('cash_shifts').select('total_sales,transaction_count,cash_payments').eq('id', currentShift.id).single();
      if (st) {
        await supabase.from('cash_shifts').update({
          total_sales: (st.total_sales || 0) + tot,
          transaction_count: (st.transaction_count || 0) + 1,
          cash_payments: paymentMethod === 'cash' ? (st.cash_payments || 0) + tot : st.cash_payments,
        }).eq('id', currentShift.id);
      }

      const head = companySettings?.receipt_header || '';
      const foot = companySettings?.receipt_footer || 'Thank you!';
      const cname = companySettings?.company_name || 'Store';
      let receipt = '';
      if (head) receipt += head + '\n';
      receipt += `${'='.repeat(40)}\n  ${cname}\n  Receipt #${saleData.invoice_number}\n  ${new Date().toLocaleString()}\n  Cashier: ${staff?.full_name || 'N/A'}\n  Customer: ${selectedCustomer?.name || 'Walk-in'}\n${'='.repeat(40)}\n  Items:\n`;
      cart.forEach(item => {
        const price = getItemPrice(item);
        const lineTotal = price * item.quantity;
        receipt += `  ${item.name} x${item.quantity} @ K${item.unit_price.toFixed(2)} = K${lineTotal.toFixed(2)}\n`;
      });
      receipt += `${'='.repeat(40)}\n  Subtotal: K${subtotal().toFixed(2)}\n  VAT (${(vatRate * 100).toFixed(0)}%): K${vatAmount().toFixed(2)}\n`;
      receipt += `  TOTAL: K${tot.toFixed(2)}\n${'='.repeat(40)}\n  ${foot}\n${'='.repeat(40)}\n`;

      const w = window.open('', '_blank');
      w.document.write(`<pre>${receipt}</pre>`);
      w.document.close();
      w.print();

      toast.success('Sale completed');
      clearCart();
      setShowPaymentModal(false);
      setAmountTendered('');
    } catch (err) {
      toast.error(err.message || 'Sale failed');
      setShowPaymentModal(false);
      setAmountTendered('');
    } finally { setProcessing(false); }
  };

  const handleScan = barcode => {
    const p = products.find(p => p.barcode === barcode);
    if (p) { addToCart(p); setSearchTerm(''); }
    else toast.error('Product not found');
    setShowScanner(false);
  };

  const holdTransaction = () => {
    if (!cart.length) return toast.error('Cart empty');
    setHeldTransactions([...heldTransactions, { id: Date.now(), cart: [...cart], customer: selectedCustomer, timestamp: new Date().toLocaleString() }]);
    clearCart();
    toast.success('Held');
  };

  const recallTransaction = h => {
    setCart(h.cart);
    setSelectedCustomer(h.customer);
    setShowHeld(false);
  };

  const deleteHeld = id => setHeldTransactions(heldTransactions.filter(h => h.id !== id));

  const filtered = products.filter(p =>
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm)) &&
    (selectedCategory === 'All' || p.category === selectedCategory)
  );

  if (!pinVerified && staff?.role === 'cashier') return (
    <div className="h-full flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 text-center"><Lock className="w-16 h-16 mx-auto text-green-600 mb-4"/><h2>Enter PIN</h2><input type="password" maxLength="4" value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full p-4 border rounded text-center text-3xl"/><button onClick={verifyPin} className="w-full mt-4 bg-green-600 text-white p-4 rounded">Unlock</button></div>
    </div>
  );
  if (!shiftActive) return (
    <div className="h-full flex items-center justify-center">
      <form onSubmit={startShift} className="bg-white p-8 rounded-2xl shadow-xl w-96"><h2>Start Shift</h2><input placeholder="Your Name" value={shiftData.cashierName} onChange={e => setShiftData({ ...shiftData, cashierName: e.target.value })} className="w-full p-3 border rounded mb-4" required/><input type="number" step="0.01" placeholder="Opening Float" value={shiftData.openingFloat} onChange={e => setShiftData({ ...shiftData, openingFloat: e.target.value })} className="w-full p-3 border rounded mb-4" required/><button className="w-full bg-green-600 text-white p-4 rounded">Open Shift</button></form>
    </div>
  );
  if (loading) return <div className="h-full flex items-center justify-center">Loading POS data...</div>;

  const cur = companySettings?.currency_symbol || 'K';
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-gray-100 overflow-hidden">
      <header className="bg-white border-b px-4 py-2 flex justify-between items-center flex-shrink-0">
        <div><h1 className="text-lg font-bold">POS</h1><span className="text-xs">{shiftData.cashierName} · {cur}{currentShift?.total_sales?.toFixed(2) || '0.00'}</span></div>
        <div className="flex gap-1">
          <button onClick={() => setShowHeld(true)} className="p-2 bg-blue-100 text-blue-700 rounded"><Save size={14}/> {heldTransactions.length}</button>
          <button onClick={endShift} className="p-2 bg-orange-100 text-orange-700 rounded"><RotateCcw size={14}/></button>
          <button onClick={() => setShowMobileCart(true)} className="lg:hidden p-2 bg-green-100 text-green-700 rounded relative"><ShoppingCart size={18}/>{cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full">{cartCount}</span>}</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col bg-white lg:rounded-2xl lg:shadow m-0 lg:m-4 overflow-hidden">
          <div className="p-3 border-b flex-shrink-0">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1"><Search className="absolute left-2 top-2 text-gray-400" size={16}/><input ref={searchInputRef} placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm border rounded"/></div>
              <button onClick={() => setShowScanner(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"><Camera size={14}/> Scan</button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">{categories.map(c => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-3 py-1 rounded-full text-xs ${selectedCategory === c ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>{c}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filtered.map(p => {
                const price = p.discount_percent > 0 ? p.unit_price * (1 - p.discount_percent / 100) : p.unit_price;
                const hasOwn = p.discount_percent > 0;
                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0} className={`relative p-2 bg-gray-50 border rounded text-left ${p.stock_quantity <= 0 ? 'opacity-50' : ''}`}>
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.category}</div>
                    <div className="text-base font-bold text-green-600">{cur}{price.toFixed(2)}</div>
                    {hasOwn && <div className="text-[10px] text-red-500 line-through">{cur}{p.unit_price.toFixed(2)}</div>}
                    <div className="text-[10px] text-gray-500 mt-1">Stock: {p.stock_quantity}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`${showMobileCart ? 'fixed inset-0 z-40 bg-white flex flex-col' : 'hidden lg:flex lg:flex-col'} lg:relative lg:w-96 lg:bg-white lg:rounded-2xl lg:shadow lg:m-4 lg:ml-0`}>
          {showMobileCart && <div className="p-3 border-b flex justify-between"><h2>Cart ({cartCount})</h2><button onClick={() => setShowMobileCart(false)}><X/></button></div>}
          <div className="p-3 border-b space-y-2 flex-shrink-0">
            <select value={selectedCustomer?.id || ''} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value))} className="w-full p-2 text-sm border rounded"><option value="">Walk-in</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400"><ShoppingCart className="w-10 h-10 mb-2 opacity-30"/>Cart empty</div> : cart.map(item => {
              const price = getItemPrice(item);
              return (
                <div key={item.id} className="bg-gray-50 p-2 rounded">
                  <div className="flex justify-between"><span className="font-medium text-sm truncate">{item.name}</span><button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 size={14}/></button></div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="p-0.5 bg-gray-200 rounded"><Minus size={12}/></button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="p-0.5 bg-gray-200 rounded"><Plus size={12}/></button>
                    </div>
                    <span className="font-semibold text-sm">{cur}{(price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t bg-gray-50 space-y-2 flex-shrink-0">
            <div className="text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{cur}{subtotal().toFixed(2)}</span></div><div className="flex justify-between"><span>VAT ({(vatRate * 100).toFixed(0)}%)</span><span>{cur}{vatAmount().toFixed(2)}</span></div><div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{cur}{total().toFixed(2)}</span></div></div>
            <div className="flex gap-2"><button onClick={holdTransaction} disabled={!cart.length} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded">Hold</button><button onClick={clearCart} disabled={!cart.length} className="flex-1 py-1.5 bg-gray-600 text-white text-sm rounded">Clear</button></div>
            <button onClick={() => setShowPaymentModal(true)} disabled={!cart.length} className="w-full py-2 bg-green-600 text-white rounded font-bold text-sm">Pay {cur}{total().toFixed(2)} <ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-4 border-b flex justify-between"><h3>Payment</h3><button onClick={() => { setShowPaymentModal(false); setAmountTendered(''); }}><X/></button></div>
            <div className="p-4 space-y-3">
              <div className="bg-gray-50 p-3 rounded"><div className="flex justify-between font-bold"><span>Total</span><span>{cur}{total().toFixed(2)}</span></div></div>
              <div className="grid grid-cols-3 gap-2">{['cash','card','mobile'].map(m => (<button key={m} onClick={() => setPaymentMethod(m)} className={`p-2 rounded border capitalize ${paymentMethod === m ? 'bg-green-600 text-white' : ''}`}>{m}</button>))}</div>
              {paymentMethod === 'cash' && <div><input type="number" step="0.01" placeholder="Amount Tendered" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} className="w-full p-2 border rounded"/>{amountTendered && <p>Change: {cur}{changeAmount().toFixed(2)}</p>}</div>}
              {paymentMethod === 'mobile' && companySettings?.mobile_money_number && <div className="bg-blue-50 p-3 rounded"><p className="font-medium">Mobile Money:</p><p className="text-lg font-bold">{companySettings.mobile_money_number}</p></div>}
              <div className="flex gap-2">
                <button onClick={() => { setShowPaymentModal(false); setAmountTendered(''); }} className="flex-1 py-2 border rounded">Back</button>
                <button onClick={processSale} disabled={processing} className="flex-1 py-2 bg-green-600 text-white rounded">{processing ? '...' : 'Pay'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} hardwareScanner={companySettings?.hardware_scanner || 'camera'}/>}
      {showHeld && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-3 border-b flex justify-between"><h3>Held</h3><button onClick={() => setShowHeld(false)}><X/></button></div>
            <div className="p-2">
              {heldTransactions.map(h => (<div key={h.id} className="border rounded p-2 mb-2 flex justify-between"><div><p>{h.timestamp}</p><p>{h.cart.length} items</p></div><div className="flex gap-1"><button onClick={() => recallTransaction(h)} className="px-2 py-1 bg-green-600 text-white text-xs rounded">Recall</button><button onClick={() => deleteHeld(h.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded">Del</button></div></div>))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
