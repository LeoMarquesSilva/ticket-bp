import React, { useState, useEffect } from 'react';
import { registerToastHandlers } from '../services/toastService';
import { X } from 'lucide-react';

// Tipos para os toasts
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Estilos para diferentes tipos de toast
const toastStyles = {
  success: "bg-green-100 border-green-400 text-green-700",
  error: "bg-red-100 border-red-400 text-red-700",
  info: "bg-blue-100 border-blue-400 text-blue-700",
  warning: "bg-yellow-100 border-yellow-400 text-yellow-700"
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  useEffect(() => {
    registerToastHandlers({
      success: (message) => {
        addToast({ type: 'success', message });
      },
      error: (message) => {
        addToast({ type: 'error', message });
      },
      info: (message) => {
        addToast({ type: 'info', message });
      },
      warning: (message) => {
        addToast({ type: 'warning', message });
      },
      dismiss: () => {
        setToasts([]);
      }
    });
  }, []);
  
  const addToast = (toast: { type: ToastType; message: string }) => {
    const id = Date.now().toString();
    setToasts((prevToasts) => [...prevToasts, { ...toast, id }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };
  
  const removeToast = (id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };
  
  return (
    <>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`px-4 py-3 rounded-md border shadow-md flex items-center justify-between ${toastStyles[toast.type]}`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};