import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check style={{ width: 18, height: 18, flexShrink: 0 }} />;
      case 'error':
        return <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />;
      case 'warning':
        return <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />;
      case 'info':
        return <Info style={{ width: 18, height: 18, flexShrink: 0 }} />;
    }
  };

  const getStyles = () => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--radius)',
      fontSize: 14,
      fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      minWidth: 280,
      maxWidth: 400,
      pointerEvents: 'auto' as const,
      animation: 'slideUp 0.2s ease-out',
    };

    switch (toast.type) {
      case 'success':
        return {
          ...baseStyles,
          background: 'hsl(var(--foreground))',
          color: 'hsl(var(--background))',
        };
      case 'error':
        return {
          ...baseStyles,
          background: '#dc2626',
          color: '#ffffff',
        };
      case 'warning':
        return {
          ...baseStyles,
          background: '#f59e0b',
          color: '#ffffff',
        };
      case 'info':
        return {
          ...baseStyles,
          background: '#3b82f6',
          color: '#ffffff',
        };
    }
  };

  return (
    <>
      <div style={getStyles()}>
        {getIcon()}
        <span style={{ flex: 1 }}>{toast.message}</span>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          aria-label="Dismiss"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

