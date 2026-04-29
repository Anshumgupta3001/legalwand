import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: {
    bg: '#f0faf5',
    border: '#5a9a7a',
    color: '#2d6a4f',
    icon: '✅',
  },
  error: {
    bg: '#fff5f5',
    border: '#c0392b',
    color: '#c0392b',
    icon: '❌',
  },
  info: {
    bg: 'rgba(184,134,11,0.07)',
    border: 'rgba(184,134,11,0.4)',
    color: '#b8860b',
    icon: 'ℹ️',
  },
  loading: {
    bg: '#fffbeb',
    border: '#f59e0b',
    color: '#92400e',
    icon: '⏳',
  },
};

const ToastItem = ({ message, type }) => {
  const s = STYLES[type] || STYLES.info;
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm font-medium shadow-lg pointer-events-auto max-w-xs w-full"
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span className="flex-shrink-0 mt-px">{s.icon}</span>
      <span className="leading-snug">{message}</span>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    // loading toasts stay until manually dismissed
    if (type !== 'loading') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const toast = {
    success : (msg, dur) => addToast(msg, 'success', dur),
    error   : (msg, dur) => addToast(msg, 'error',   dur),
    info    : (msg, dur) => addToast(msg, 'info',     dur),
    loading : (msg)      => addToast(msg, 'loading'),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
