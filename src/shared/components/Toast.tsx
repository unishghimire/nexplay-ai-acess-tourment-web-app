import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = type === 'error' ? 'bg-red-900/90 border-red-500 text-red-100' : type === 'success' ? 'bg-green-900/90 border-green-500 text-green-100' : 'bg-slate-800 border-brand-500 text-white';
    const icon = type === 'success' ? <CheckCircle className="w-5 h-5" aria-hidden="true" /> : type === 'error' ? <AlertTriangle className="w-5 h-5" aria-hidden="true" /> : <Info className="w-5 h-5" aria-hidden="true" />;

    return (
        <div
            className={`toast mb-3 p-4 rounded-lg shadow-lg border-l-4 flex items-center gap-3 ${colors} backdrop-blur-sm`}
            role={type === 'error' ? 'alert' : 'status'}
            aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
            {icon}
            <span className="flex-grow">{message}</span>
            <button type="button" onClick={onClose} aria-label="Close notification" className="text-gray-400 hover:text-white transition touch-target flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;
