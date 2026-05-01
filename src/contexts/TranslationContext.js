import React, { createContext, useContext, useState } from 'react';

const TranslationContext = createContext();

export function TranslationProvider({ children }) {
  const [language] = useState('en');
  const t = (key) => key;   // simple fallback
  return (
    <TranslationContext.Provider value={{ t, language }}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslation = () => useContext(TranslationContext);
