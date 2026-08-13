import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
    isLoading?: boolean;
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title}>
            <div className="text-gray-300 mb-6">
                {message}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-3 bg-surface hover:bg-surface text-white rounded-lg touch-target font-bold transition"
                >
                    {cancelText}
                </button>
                <button
                    onClick={() => {
                        onConfirm();
                        onCancel();
                    }}
                    className={`px-4 py-3 text-white rounded-lg touch-target font-bold transition ${
                        isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'
                    }`}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
