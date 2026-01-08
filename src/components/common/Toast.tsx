import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`
        pointer-events-auto
        flex items-center gap-3 min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-lg
        ${type === 'success' ? 'bg-green-500 text-white' : ''}
        ${type === 'error' ? 'bg-red-500 text-white' : ''}
        ${type === 'info' ? 'bg-blue-500 text-white' : ''}
        ${type === 'warning' ? 'bg-amber-500 text-white' : ''}
      `}
    >
      {type === 'success' && <CheckCircle className="h-5 w-5" />}
      {type === 'error' && <AlertCircle className="h-5 w-5" />}
      {type === 'info' && <Info className="h-5 w-5" />}
      {type === 'warning' && <AlertTriangle className="h-5 w-5" />}
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, removeToast }: { toasts: Omit<ToastProps, 'onClose'>[], removeToast: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
