import React from 'react';

export default function Debug() {
  const rawSales = localStorage.getItem('bwanali_sales') || '[]';
  const sales = JSON.parse(rawSales);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug – Sales Table</h1>
      <p className="mb-2">Total records: <strong>{sales.length}</strong></p>
      <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-[80vh]">
        {JSON.stringify(sales, null, 2)}
      </pre>
    </div>
  );
}
