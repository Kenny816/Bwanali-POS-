import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Package, Plus, Search, X, Phone, MapPin, FileText, Trash2 } from 'lucide-react';

export default function Layby() {
  const { staff, storeId } = useAuth();
  const [laybys, setLaybys] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [cart, setCart] = useState([]);
  const [deposit, setDeposit] = useState('');
  const [installments, setInstallments] = useState(1);
  const [dueDate, setDueDate] = useState('');

  const canCancel = staff?.role === 'admin' || staff?.role === 'manager';
  const currency = 'K';

  const loadLaybys = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('laybys')
      .select('*, staff:staff(full_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    setLaybys(data?.data || data || []);
    setLoading(false);
  }, [storeId]);

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('id,name,phone').eq('store_id', storeId).order('name');
    setCustomers(data?.data || data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).eq('is_active', true).order('name');
    setProducts(data?.data || data || []);
  };

  useEffect(() => {
    if (storeId) { loadLaybys(); loadCustomers(); loadProducts(); }
  }, [storeId, loadLaybys]);

  useEffect(() => {
    if (selectedCustomer) {
      const cust = customers.find(c => c.id === selectedCustomer);
      if (cust) {
        setCustomerName(cust.name || '');
        setPhone(cust.phone || '');
      }
    }
  }, [selectedCustomer, customers]);

  const addToCart = (product) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing) setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { ...product, quantity: 1 }]);
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.id !== id));
  const updateCartQty = (id, delta) => {
    setCart(cart.map(i => {
      if (i.id === id) {
        const newQty = i.quantity + delta;
        if (newQty <= 0) return i;
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const remainingAfterDeposit = Math.max(0, cartTotal - (parseFloat(deposit) || 0));
  const suggestedInstallment = installments > 0 ? (remainingAfterDeposit / installments).toFixed(2) : '0.00';

  const handleCreateLayby = async (e) => {
    e.preventDefault();
    if (!cart.length) return toast.error('Add at least one product');
    if (!customerName.trim()) return toast.error('Customer name required');
    const depositVal = parseFloat(deposit) || 0;
    if (depositVal < 0) return toast.error('Deposit cannot be negative');
    const instCount = parseInt(installments) || 1;
    if (instCount <= 0) return toast.error('Installments must be at least 1');
    
    try {
      const { data: layby, error } = await supabase.from('laybys').insert({
        store_id: storeId,
        customer_id: selectedCustomer || null,
        customer_name: customerName.trim(),
        nrc_number: nrcNumber.trim(),
        phone: phone.trim(),
        location: location.trim(),
        staff_id: staff.id,
        total_amount: cartTotal,
        deposit_amount: depositVal,
        installments: instCount,
        installment_amount: parseFloat(suggestedInstallment),
        status: 'active',
        due_date: dueDate || null,
        notes: '',
      }).select().single();
      if (error) throw error;

      const items = cart.map(i => ({
        layby_id: layby.id,
        product_id: i.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));
      await supabase.from('layby_items').insert(items);
      for (const item of cart) await supabase.rpc('decrement_stock', { p_product_id: item.id, p_quantity: item.quantity });
      if (depositVal > 0) {
        await supabase.from('layby_payments').insert({ layby_id: layby.id, amount: depositVal, payment_method: 'cash' });
      }
      toast.success('Layby created');
      setShowCreate(false);
      resetCreateForm();
      loadLaybys();
    } catch (err) { toast.error(err.message); }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const layby = laybys.find(l => l.id === showPayment);
    if (!layby) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    const remaining = layby.total_amount - layby.deposit_amount;
    if (amount > remaining) return toast.error(`Amount exceeds remaining K${remaining.toFixed(2)}`);
    try {
      await supabase.from('layby_payments').insert({ layby_id: layby.id, amount, payment_method: 'cash' });
      const newDeposit = layby.deposit_amount + amount;
      const { error } = await supabase.from('laybys').update({ deposit_amount: newDeposit }).eq('id', layby.id);
      if (error) throw error;

      const isCompleted = newDeposit >= layby.total_amount;
      if (isCompleted) {
        await supabase.from('laybys').update({ status: 'completed' }).eq('id', layby.id);
        toast.success('Layby fully paid!');
        printReceipt(layby.id);
      } else {
        toast.success(`Payment of K${amount.toFixed(2)} recorded`);
      }
      setShowPayment(null);
      setPaymentAmount('');
      loadLaybys();
    } catch (err) { toast.error(err.message); }
  };

  const cancelLayby = async (layby) => {
    if (!canCancel) return toast.error('Only admin/manager can cancel');
    if (!window.confirm('Cancel this layby? Stock will be returned.')) return;
    try {
      const { data: items } = await supabase.from('layby_items').select('product_id,quantity').eq('layby_id', layby.id);
      for (const item of items || []) await supabase.rpc('increment_stock', { p_product_id: item.product_id, p_quantity: item.quantity });
      await supabase.from('laybys').update({ status: 'cancelled' }).eq('id', layby.id);
      toast.success('Layby cancelled');
      loadLaybys();
    } catch (err) { toast.error(err.message); }
  };

  // ========== LOCAL PRODUCT LOOKUP FOR RECEIPT ==========
  const getProductName = (productId) => {
    const allProds = JSON.parse(localStorage.getItem('bwanali_products') || '[]');
    const prod = allProds.find(p => p.id === productId);
    return prod ? prod.name : 'Unknown';
  };

  const printReceipt = async (laybyId) => {
    const allLaybys = JSON.parse(localStorage.getItem('bwanali_laybys') || '[]');
    const layby = allLaybys.find(l => l.id === laybyId);
    if (!layby) return;

    const allItems = JSON.parse(localStorage.getItem('bwanali_layby_items') || '[]');
    const items = allItems.filter(i => i.layby_id === laybyId);

    const allSettings = JSON.parse(localStorage.getItem('bwanali_company_settings') || '[]');
    const settings = allSettings.find(s => s.store_id === storeId);
    const logoUrl = settings?.logo_url || '';

    let receipt = `
${'='.repeat(40)}
  COMPLETION RECEIPT - LAY‑BY
${'='.repeat(40)}
Customer: ${layby.customer_name || 'N/A'}
NRC: ${layby.nrc_number || 'N/A'}
Phone: ${layby.phone || 'N/A'}
Location: ${layby.location || 'N/A'}
Date: ${new Date().toLocaleString()}
${'='.repeat(40)}
Items:
${items.map(i => `  ${getProductName(i.product_id)} x${i.quantity} @ K${i.unit_price} = K${(i.quantity * i.unit_price).toFixed(2)}`).join('\n')}
${'='.repeat(40)}
Total: K${layby.total_amount?.toFixed(2)}
Total Paid: K${layby.deposit_amount?.toFixed(2)}
Balance: K0.00
${'='.repeat(40)}
  Thank you for your purchase!
${'='.repeat(40)}
`;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><style>body{font-family:monospace; padding:10px;} img{max-width:150px; margin-bottom:5px;}</style></head><body>${logoUrl ? `<img src="${logoUrl}" alt="logo" />` : ''}<pre>${receipt}</pre></body></html>`);
    w.document.close();
    w.print();
  };

  const resetCreateForm = () => {
    setCart([]);
    setDeposit('');
    setDueDate('');
    setSelectedCustomer('');
    setCustomerName('');
    setNrcNumber('');
    setPhone('');
    setLocation('');
    setInstallments(1);
  };

  const filteredLaybys = laybys.filter(l =>
    l.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-8">Loading laybys...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold"><Package className="inline mr-2" />Lay‑by</h1>
        <button onClick={() => setShowCreate(true)} className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"><Plus size={18} /> New Lay‑by</button>
      </div>

      <div className="mb-4 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input placeholder="Search by name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg" /></div>

      <div className="space-y-4">
        {filteredLaybys.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center"><Package size={48} className="mx-auto mb-4 opacity-30"/><p>No lay‑bys found</p></div>
        ) : (
          filteredLaybys.map(l => {
            const remaining = l.total_amount - l.deposit_amount;
            const progressPercent = l.total_amount > 0 ? (l.deposit_amount / l.total_amount) * 100 : 0;
            return (
              <div key={l.id} className="bg-white rounded-xl shadow p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <p className="font-bold text-lg">{l.customer_name || l.customer?.name || 'Walk-in'}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      {l.phone && <span className="flex items-center gap-1"><Phone size={12}/>{l.phone}</span>}
                      {l.location && <span className="flex items-center gap-1"><MapPin size={12}/>{l.location}</span>}
                      {l.nrc_number && <span className="flex items-center gap-1"><FileText size={12}/>{l.nrc_number}</span>}
                    </div>
                    <p className="text-sm text-gray-500">Staff: {l.staff?.full_name}</p>
                    <p className="text-xs text-gray-400 mt-1">Installments: {l.installments} × K{l.installment_amount?.toFixed(2)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${l.status === 'active' ? 'bg-blue-100 text-blue-800' : l.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{l.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>Total: <span className="font-bold">{currency}{l.total_amount?.toFixed(2)}</span></div>
                  <div>Paid: <span className="font-bold text-green-600">{currency}{l.deposit_amount?.toFixed(2)}</span></div>
                  <div>Remaining: <span className="font-bold text-red-600">{currency}{remaining.toFixed(2)}</span></div>
                  {l.due_date && <div>Due: {new Date(l.due_date).toLocaleDateString()}</div>}
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-600 h-2.5 rounded-full" style={{width: `${progressPercent}%`}}></div></div>
                {l.status === 'active' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => { setShowPayment(l.id); setPaymentAmount(''); }} className="px-4 py-2 bg-blue-600 text-white rounded text-sm w-full sm:w-auto">Add Payment</button>
                    {canCancel && <button onClick={() => cancelLayby(l)} className="px-4 py-2 bg-red-600 text-white rounded text-sm w-full sm:w-auto">Cancel</button>}
                  </div>
                )}
                {l.status === 'completed' && (
                  <button onClick={() => printReceipt(l.id)} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded text-sm w-full sm:w-auto">Reprint Receipt</button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal & Payment Modal – same as before (omitted for brevity, keep existing ones) */}
    </div>
  );
}
