import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FileText, Plus, Search, X, Printer, Download, Trash2, User, Phone, MapPin } from 'lucide-react';

export default function Invoices() {
  const { staff, storeId } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cart, setCart] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const isAdmin = staff?.role === 'admin' || staff?.role === 'manager';
  const currency = 'K';

  const loadInvoices = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('invoices')
      .select('*, staff:staff(full_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    setInvoices(data?.data || data || []);
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
    if (storeId) { loadInvoices(); loadCustomers(); loadProducts(); }
  }, [storeId, loadInvoices]);

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

  const generateInvoiceNumber = () => `INV-${Date.now().toString(36).toUpperCase()}`;

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!cart.length) return toast.error('Add at least one product');
    if (!customerName.trim()) return toast.error('Customer name required');
    const invoiceNumber = generateInvoiceNumber();
    try {
      const { data: invoice, error } = await supabase.from('invoices').insert({
        store_id: storeId,
        customer_id: selectedCustomer || null,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        staff_id: staff.id,
        invoice_number: invoiceNumber,
        total_amount: cartTotal,
        status: 'draft',
        due_date: dueDate || null,
        notes,
      }).select().single();
      if (error) throw error;

      const items = cart.map(i => ({
        invoice_id: invoice.id,
        product_id: i.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));
      await supabase.from('invoice_items').insert(items);

      toast.success('Invoice created');
      setShowCreate(false);
      resetForm();
      loadInvoices();
    } catch (err) { toast.error(err.message); }
  };

  const printInvoice = async (invoiceId) => {
    const { data: invoice } = await supabase.from('invoices').select('*, customer:customers(name)').eq('id', invoiceId).single();
    const { data: items } = await supabase.from('invoice_items').select('*, product:products(name)').eq('invoice_id', invoiceId);
    if (!invoice) return;

    let receipt = `
${'='.repeat(40)}
  INVOICE
${'='.repeat(40)}
Invoice #: ${invoice.invoice_number}
Customer: ${invoice.customer_name || invoice.customer?.name || 'N/A'}
Phone: ${invoice.phone || 'N/A'}
Address: ${invoice.address || 'N/A'}
Date: ${new Date(invoice.created_at).toLocaleString()}
${invoice.due_date ? `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}
${'='.repeat(40)}
Items:
${items?.map(i => `  ${i.product?.name || 'Unknown'} x${i.quantity} @ K${i.unit_price} = K${(i.quantity * i.unit_price).toFixed(2)}`).join('\n')}
${'='.repeat(40)}
Total: K${invoice.total_amount?.toFixed(2)}
Status: ${invoice.status}
${'='.repeat(40)}
  Thank you for your business!
${'='.repeat(40)}
`;
    const w = window.open('', '_blank');
    w.document.write(`<pre>${receipt}</pre><script>window.print()</script>`);
    w.document.close();
    w.print();
  };

  const downloadInvoice = (invoiceId) => {
    const generateText = async () => {
      const { data: invoice } = await supabase.from('invoices').select('*, customer:customers(name)').eq('id', invoiceId).single();
      const { data: items } = await supabase.from('invoice_items').select('*, product:products(name)').eq('invoice_id', invoiceId);
      if (!invoice) return;
      let text = `${'='.repeat(40)}\n  INVOICE\n${'='.repeat(40)}\nInvoice #: ${invoice.invoice_number}\nCustomer: ${invoice.customer_name || invoice.customer?.name || 'N/A'}\nPhone: ${invoice.phone || 'N/A'}\nAddress: ${invoice.address || 'N/A'}\nDate: ${new Date(invoice.created_at).toLocaleString()}\n${invoice.due_date ? `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}\n${'='.repeat(40)}\nItems:\n${items?.map(i => `  ${i.product?.name || 'Unknown'} x${i.quantity} @ K${i.unit_price} = K${(i.quantity * i.unit_price).toFixed(2)}`).join('\n')}\n${'='.repeat(40)}\nTotal: K${invoice.total_amount?.toFixed(2)}\nStatus: ${invoice.status}\n${'='.repeat(40)}\n  Thank you for your business!\n${'='.repeat(40)}\n`;
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `invoice_${invoice.invoice_number}.txt`;
      a.click();
    };
    generateText();
  };

  const deleteInvoice = async (invoice) => {
    if (!isAdmin) return toast.error('Admin only');
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}?`)) return;
    await supabase.from('invoices').delete().eq('id', invoice.id);
    toast.success('Invoice deleted');
    loadInvoices();
  };

  const resetForm = () => {
    setCart([]);
    setDueDate('');
    setSelectedCustomer('');
    setCustomerName('');
    setPhone('');
    setAddress('');
    setNotes('');
  };

  const filteredInvoices = invoices.filter(i =>
    i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Loading invoices...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold"><FileText className="inline mr-2" />Invoices</h1>
        <button onClick={() => setShowCreate(true)} className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2">
          <Plus size={18} /> New Invoice
        </button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input placeholder="Search by invoice or customer..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg" />
      </div>

      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center"><FileText size={48} className="mx-auto mb-4 opacity-30"/><p>No invoices found</p></div>
        ) : (
          filteredInvoices.map(inv => (
            <div key={inv.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <p className="font-bold text-lg">{inv.invoice_number}</p>
                  <p className="text-sm">{inv.customer_name || inv.customer?.name || 'Walk-in'}</p>
                  {inv.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/>{inv.phone}</span>}
                  {inv.address && <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/>{inv.address}</span>}
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inv.status === 'draft' ? 'bg-gray-100 text-gray-800' : inv.status === 'sent' ? 'bg-blue-100 text-blue-800' : inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{inv.status}</span>
                  <p className="font-bold text-green-600 mt-1">{currency}{inv.total_amount?.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end border-t pt-3">
                <button onClick={() => printInvoice(inv.id)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Printer size={18} /></button>
                <button onClick={() => downloadInvoice(inv.id)} className="p-2 bg-green-50 text-green-600 rounded-lg"><Download size={18} /></button>
                {isAdmin && (
                  <button onClick={() => deleteInvoice(inv)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18} /></button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between"><h2 className="text-xl font-bold">New Invoice</h2><button onClick={() => setShowCreate(false)}><X/></button></div>
            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {products.map(p => (
                    <button key={p.id} onClick={() => addToCart(p)} className="p-2 bg-gray-50 border rounded text-left text-sm">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{currency}{p.unit_price?.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full lg:w-96 p-4 space-y-3">
                <div>
                  <label className="block text-sm mb-1">Existing Customer (optional)</label>
                  <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full p-2 border rounded">
                    <option value="">New customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input placeholder="Full Name *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-2 border rounded" required />
                  <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 border rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded" rows={2} />
                <div className="max-h-40 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-1 border-b">
                      <span className="text-sm truncate flex-1">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateCartQty(item.id, -1)} className="p-0.5 bg-gray-200 rounded"><X size={12}/></button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} className="p-0.5 bg-gray-200 rounded">+</button>
                      </div>
                      <span className="text-sm w-16 text-right">{currency}{(item.quantity * item.unit_price).toFixed(2)}</span>
                      <button onClick={() => removeFromCart(item.id)} className="p-0.5 text-red-500"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
                <div className="font-bold text-lg">Total: {currency}{cartTotal.toFixed(2)}</div>
                <button onClick={handleCreateInvoice} className="w-full bg-green-600 text-white py-2 rounded">Create Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
