import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'sm:max-w-lg' }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const location = useLocation();
    // ponytail: only close on actual route path change, not on mount.
    const prevPath = useRef(location.pathname);
    useEffect(() => {
        if (isOpen && prevPath.current !== location.pathname) {
            onClose();
            prevPath.current = location.pathname;
        }
    }, [location.pathname, isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex min-h-screen items-center justify-center p-0 sm:p-4 sm:pt-8 sm:pb-20">
                <div className="fixed inset-0 modal-backdrop transition-opacity" onClick={onClose} aria-hidden="true"></div>
                <div className={`relative w-full ${maxWidth} max-w-[calc(100vw-0px)] sm:max-w-[calc(100vw-2rem)] bg-card rounded-t-2xl sm:rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 border border-gray-700 max-h-[100vh] sm:max-h-[90vh] flex flex-col`}>
                    {title && (
                        <div className="bg-gray-800 px-4 sm:px-6 py-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                            <h3 className="text-base sm:text-lg font-bold text-white break-anywhere">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition shrink-0 touch-target flex items-center justify-center" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
