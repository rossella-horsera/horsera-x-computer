import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import CadenceDrawer from '../components/layout/CadenceDrawer';

interface CadenceContextValue {
  openCadence: () => void;
}

const CadenceContext = createContext<CadenceContextValue>({ openCadence: () => {} });

export function useCadence() {
  return useContext(CadenceContext);
}

export function CadenceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CadenceContext.Provider value={{ openCadence: () => setOpen(true) }}>
      {children}
      <CadenceDrawer open={open} onClose={() => setOpen(false)} />
    </CadenceContext.Provider>
  );
}
