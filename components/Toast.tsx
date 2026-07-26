'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
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
    <div className="flex flex-col gap-2 bg-gray-900 text-white p-4 rounded-lg shadow-lg min-w-[300px] max-w-md">
      <div className="flex items-center gap-3">
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
      {toast.action && (
        <div className="ml-9">
          <button
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            {toast.action.label}
          </button>
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent<Toast>) => {
      setToasts(prev => [...prev, event.detail]);
    };
    const handleDismiss = (event: CustomEvent<{ id: string }>) => {
      setToasts(prev => prev.filter(t => t.id !== event.detail.id));
    };

    window.addEventListener('toast' as any, handleToast);
    window.addEventListener('toast-dismiss' as any, handleDismiss);
    return () => {
      window.removeEventListener('toast' as any, handleToast);
      window.removeEventListener('toast-dismiss' as any, handleDismiss);
    };
  }, []);
  
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  if (toasts.length === 0) return null;
  
  // Toasts must clear GlobalNowPlayingBar rather than cover it. The bar is fixed at
  // bottom 0 with z-50, and ToastContainer mounts after it in `layout.tsx`, so at equal
  // z-index toasts won and sat on top of the transport — which matters because these
  // toasts carry action buttons ("Reconnect", "Retry"), so the overlap could put a
  // toast's button over the bar's play/skip controls.
  //
  // One offset at every breakpoint: the bar measures 89px on mobile and 81px at
  // md/desktop widths, plus the home-indicator inset. `6.5rem + var(--sk-safe-bottom)`
  // clears all three. The old value was `bottom-24` (96px) with an `sm:bottom-4`
  // override — 96px happened to clear a 0-inset bar but not a notched iPhone's 123px,
  // and the 16px desktop override sat inside the bar outright.
  return (
    <div className="fixed bottom-[calc(var(--sk-safe-bottom)+6.5rem)] right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

// Toast utility functions
export const toast = {
  show: (type: ToastType, message: string, duration = 5000, action?: { label: string; onClick: () => void }): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const event = new CustomEvent('toast', {
      detail: { id, type, message, duration, action },
    });
    window.dispatchEvent(event);
    return id;
  },

  /** Dismiss a toast by its id (from toast.show() return value). */
  dismiss: (id: string) => {
    const event = new CustomEvent('toast-dismiss', { detail: { id } });
    window.dispatchEvent(event);
  },

  success: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }): string => {
    return toast.show('success', message, options?.duration, options?.action);
  },

  error: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }): string => {
    return toast.show('error', message, options?.duration, options?.action);
  },

  warning: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }): string => {
    return toast.show('warning', message, options?.duration, options?.action);
  },

  info: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }): string => {
    return toast.show('info', message, options?.duration, options?.action);
  },
};