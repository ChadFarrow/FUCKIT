'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const Icon = icons[toast.type];
  
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);
  
  return (
    <div className="flex items-center gap-3 bg-gray-900 text-white p-4 rounded-lg shadow-lg min-w-[300px] max-w-md">
      <div className={`p-1 rounded ${styles[toast.type]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  useEffect(() => {
    const handleToast = (event: CustomEvent<Toast>) => {
      setToasts(prev => [...prev, event.detail]);
    };
    
    window.addEventListener('toast' as any, handleToast);
    return () => window.removeEventListener('toast' as any, handleToast);
  }, []);
  
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

// Toast utility functions
export const toast = {
  show: (type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const event = new CustomEvent('toast', {
      detail: { id, type, message, duration },
    });
    window.dispatchEvent(event);
  },
  
  success: (message: string, duration?: number) => {
    toast.show('success', message, duration);
  },
  
  error: (message: string, duration?: number) => {
    toast.show('error', message, duration);
  },
  
  warning: (message: string, duration?: number) => {
    toast.show('warning', message, duration);
  },
  
  info: (message: string, duration?: number) => {
    toast.show('info', message, duration);
  },
};