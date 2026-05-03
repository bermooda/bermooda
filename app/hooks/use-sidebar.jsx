import { createContext, useContext, useState } from 'react';

const SidebarContext = createContext(null);

/**
 * Sidebar provider
 *
 * @param {{children: React.ReactNode}} props
 * @returns {React.ReactNode}
 */
export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);

  return (
    <SidebarContext.Provider value={{ isOpen, openSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * Sidebar hook
 *
 * @returns {{isOpen: boolean, openSidebar: () => void, closeSidebar: () => void}}
 */
export default function useSidebar() {
  const context = useContext(SidebarContext);

  if (context === null) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }

  return context;
}
