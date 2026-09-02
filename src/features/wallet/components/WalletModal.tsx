import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, AlertTriangle, Upload, Copy, Check, QrCode, ShieldCheck } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { PaymentMethod, PaymentCategory, SiteSettings } from '../../../shared/types/types';
import { formatCurrency } from '../../../shared/utils/utils';
import { uploadImage, MediaCategory } from '../../../shared/services/mediaService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw';
}

const DEFAULT_CATEGORIES: PaymentCategory[] = [
  { id: 'cat_wallets', name: 'Digital Wallets', description: 'eSewa, Khalti, IME Pay instant transfers', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_banking', name: 'Mobile Banking & QR', description: 'FonePay QR & ConnectIPS', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_bank', name: 'Direct Bank Transfer', description: 'National & Commercial Banks', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }
];

const DEFAULT_METHODS: PaymentMethod[] = [
  {
    id: 'method_esewa',
    categoryId: 'cat_wallets',
    name: 'eSewa',
    type: 'Digital Wallet',
    accountName: 'NexPlay Official',
    accountNumber: '9800000000',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-Deposit-NexPlay',
    instructions: 'Send payment via eSewa to the account number above. Include your NexPlay username in the remarks and upload the payment receipt screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_khalti',
    categoryId: 'cat_wallets',
    name: 'Khalti',
    type: 'Digital Wallet',
    accountName: 'NexPlay Official',
    accountNumber: '9800000000',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Khalti-Deposit-NexPlay',
    instructions: 'Send payment via Khalti to the account number above. Include your username in remarks and attach the transfer receipt screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_fonepay',
    categoryId: 'cat_banking',
    name: 'FonePay QR',
    type: 'Mobile Banking QR',
    accountName: 'NexPlay Esports Ltd',
    accountNumber: 'FonePay ID: 01020304',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=FonePay-NexPlay-Official',
    instructions: 'Scan FonePay QR using any Mobile Banking App. Enter your Transaction Reference ID and attach confirmation screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_bank',
    categoryId: 'cat_bank',
    name: 'Bank Transfer',
    type: 'Direct Bank',
    accountName: 'NexPlay Esports Organization',
    accountNumber: 'Nabil Bank: 01201017500123',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Bank-NexPlay-Official',
    instructions: 'Transfer to Global IME / Nabil Bank. Include your username in the payment remark and upload transfer slip screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

const PRESET_AMOUNTS = [200, 500, 1000, 2000, 5000];

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, initialTab = 'deposit' }) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Deposit State
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(DEFAULT_METHODS[0]);
  const [depositAmount, setDepositAmount] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchData();
    }
  }, [isOpen, initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const paySnap = await getDocs(query(
        collection(db, 'paymentMethods'),
        where('isActive', '==', true)
      ));
      const loadedMethods = paySnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          accountName: data.accountName || 'NexPlay Official',
          accountNumber: data.accountNumber || '9800000000',
        } as PaymentMethod;
      });

      const finalMethods = loadedMethods.length > 0 ? loadedMethods : DEFAULT_METHODS;
      setPaymentMethods(finalMethods);
      if (!selectedMethod || !finalMethods.some(m => m.id === selectedMethod.id)) {
        setSelectedMethod(finalMethods[0]);
      }

      const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as SiteSettings);
      }
    } catch (error) {
      console.warn('Using fallback payment options:', error);
      setPaymentMethods(DEFAULT_METHODS);
      if (!selectedMethod) {
        setSelectedMethod(DEFAULT_METHODS[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    showToast(`${label} copied to clipboard!`, 'success');
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleScreenshotUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image must be under 15MB', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setProofPreview(previewUrl);

      const res = await uploadImage(file, MediaCategory.PAYMENT_PROOF);
      if (res && res.success && res.url) {
        setProofUrl(res.url);
        setProofPreview(res.url);
        showToast('Payment screenshot attached successfully', 'success');
      } else {
        showToast(res?.error || 'Failed to upload screenshot to ImgBB', 'error');
      }
    } catch (error: any) {
      console.error('Screenshot upload error:', error);
      showToast('Failed to attach screenshot. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDepositSubmit = async () => {
    if (!user) {
      return showToast('You must be signed in to submit a deposit', 'error');
    }
    if (!selectedMethod) {
      return showToast('Please select a payment method', 'error');
    }
    if (!depositAmount) {
      return showToast('Please enter deposit amount', 'error');
    }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      return showToast('Please enter a valid amount greater than 0', 'error');
    }
    if (!senderName.trim()) {
      return showToast('Please enter your sender account name', 'error');
    }
    if (!senderNumber.trim()) {
      return showToast('Please enter your sender mobile or account number', 'error');
    }
    if (!transactionCode.trim()) {
      return showToast('Please enter the transaction reference code / ID', 'error');
    }
    if (!proofUrl) {
      return showToast('Please upload your payment screenshot/receipt', 'error');
    }

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showToast('Authentication required — please sign in again', 'error');
        return;
      }

      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          method: selectedMethod.name || 'Digital Wallet',
          senderName: senderName.trim(),
          senderNumber: senderNumber.trim(),
          transactionCode: transactionCode.trim(),
          proofUrl: proofUrl.trim(),
        }),
      });

      const data = await res.json().catch(() => ({ success: false, message: 'Server response could not be parsed' }));
      if (!res.ok || !data.success) {
        showToast(data.message || 'Failed to submit deposit', 'error');
        return;
      }

      showToast('Deposit request submitted! Admin will verify and credit your balance.', 'success');
      setDepositAmount('');
      setSenderName('');
      setSenderNumber('');
      setTransactionCode('');
      setProofUrl('');
      setProofPreview('');
      onClose();
    } catch (error: any) {
      console.error('Error submitting deposit:', error);
      showToast(error.message || 'Failed to submit deposit request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!user || !withdrawAmount || !withdrawMethod || !accountDetails) {
      return showToast('Please fill all fields', 'error');
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');
    if (settings?.minWithdrawal && amount < settings.minWithdrawal) {
      return showToast(`Minimum withdrawal amount is ${formatCurrency(settings.minWithdrawal)}`, 'error');
    }
    const totalAvailable = (profile?.balance || 0) + (profile?.orgWalletBalance || 0);
    if (amount > totalAvailable) return showToast('Insufficient balance', 'error');

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showToast('Authentication required', 'error');
        return;
      }

      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          method: withdrawMethod,
          accountDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to withdraw', 'error');
        return;
      }

      showToast('Withdrawal request submitted!', 'success');
      setWithdrawAmount('');
      setWithdrawMethod('');
      setAccountDetails('');
      onClose();
    } catch (error) {
      showToast('Failed to submit withdrawal request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative w-full sm:max-w-xl bg-card rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-gray-900 via-gray-900 to-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                {activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {activeTab === 'deposit' ? 'Instant QR & Manual Bank Settlement' : 'Transfer to your verified account'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface rounded-full transition text-gray-400 hover:text-white" aria-label="Close modal">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-800/80 bg-black/40 px-4 sm:px-6 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'deposit'
                ? 'text-brand-400 border-brand-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Deposit (Add Funds)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'withdraw'
                ? 'text-brand-400 border-brand-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Withdraw (Cash Out)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-grow space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loading payment options...</p>
            </div>
          ) : activeTab === 'deposit' ? (
            <div className="space-y-6 animate-fade-in">
              {/* 1. SELECT PAYMENT METHOD (Direct single-click selector) */}
              <div>
                <label className="text-[11px] text-gray-400 uppercase font-black tracking-wider block mb-2.5">
                  1. Select Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {paymentMethods.map(method => {
                    const isSelected = selectedMethod?.id === method.id;
                    return (
                      <button
                        type="button"
                        key={method.id}
                        onClick={() => setSelectedMethod(method)}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-brand-500/15 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                            : 'bg-dark/80 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-surface/80 border border-gray-800 flex items-center justify-center overflow-hidden">
                          {method.qrUrl ? (
                            <img src={method.qrUrl} alt={method.name} className="w-7 h-7 object-contain" loading="lazy" />
                          ) : (
                            <QrCode className="w-5 h-5 text-brand-400" />
                          )}
                        </div>
                        <div className="font-black text-xs uppercase tracking-tight truncate w-full">{method.name}</div>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{method.type || 'Transfer'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. OFFICIAL PAYMENT DETAILS (Method Name, Account Name, Account Number, QR Image, Instruction) */}
              {selectedMethod && (
                <div className="bg-dark/90 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                  {/* Method Name Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-400" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Official {selectedMethod.name} Details
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20 uppercase tracking-widest">
                      {selectedMethod.type || 'Verified Provider'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* QR Image */}
                    <div className="sm:col-span-5 flex flex-col items-center">
                      <div className="w-36 h-36 sm:w-40 sm:h-40 bg-white p-2.5 rounded-2xl border-2 border-brand-500/40 shadow-xl flex items-center justify-center">
                        <img
                          src={selectedMethod.qrUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=NexPlay-Official'}
                          alt={`${selectedMethod.name} QR Code`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2 text-center">
                        Scan to pay via {selectedMethod.name}
                      </span>
                    </div>

                    {/* Account Name & Account Number with Copy Buttons */}
                    <div className="sm:col-span-7 space-y-3">
                      {/* Account Name */}
                      <div className="bg-black/60 p-3 rounded-xl border border-gray-800/80">
                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-0.5">
                          Account Name
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {selectedMethod.accountName || 'NexPlay Official'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedMethod.accountName || 'NexPlay Official', 'Account Name')}
                            className="text-brand-400 hover:text-brand-300 p-1 rounded transition flex items-center gap-1 text-[10px] font-bold uppercase shrink-0"
                            aria-label="Copy Account Name"
                          >
                            {copiedField === 'Account Name' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedField === 'Account Name' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Account Number */}
                      <div className="bg-black/60 p-3 rounded-xl border border-gray-800/80">
                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-0.5">
                          Account Number / ID
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-brand-400 font-mono tracking-wide truncate">
                            {selectedMethod.accountNumber || '9800000000'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedMethod.accountNumber || '9800000000', 'Account Number')}
                            className="text-brand-400 hover:text-brand-300 p-1 rounded transition flex items-center gap-1 text-[10px] font-bold uppercase shrink-0"
                            aria-label="Copy Account Number"
                          >
                            {copiedField === 'Account Number' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedField === 'Account Number' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Instruction */}
                      <div className="bg-brand-500/10 border border-brand-500/20 p-2.5 rounded-xl">
                        <div className="text-[9px] text-brand-300 font-black uppercase tracking-widest mb-1">
                          Instructions
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                          {selectedMethod.instructions || 'Send payment and upload the receipt screenshot below.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SUBMIT TRANSFER DETAILS FORM */}
              <div className="space-y-4 pt-2 border-t border-gray-800">
                <label className="text-[11px] text-gray-400 uppercase font-black tracking-wider block">
                  2. Enter Your Payment Details
                </label>

                {/* Amount with Quick Presets */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Deposit Amount (Rs.)</span>
                    <span className="text-[10px] text-gray-500 font-bold">Min Rs. 50</span>
                  </div>
                  <input
                    type="number"
                    aria-label="Deposit Amount"
                    placeholder="Enter amount (e.g. 500)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-base"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setDepositAmount(amt.toString())}
                        className="px-2.5 py-1 bg-surface border border-gray-800 hover:border-brand-500/50 rounded-lg text-[10px] font-bold text-gray-300 hover:text-white transition"
                      >
                        + Rs. {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sender Account Name */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Sender Account Name (Name on your payment app)
                  </label>
                  <input
                    type="text"
                    aria-label="Sender Account Name"
                    placeholder="e.g., Ram Bahadur Shrestha"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                  />
                </div>

                {/* Sender Number / Mobile */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Sender Mobile / Account Number
                  </label>
                  <input
                    type="text"
                    aria-label="Sender Number"
                    placeholder="e.g., 98XXXXXXXX (Account sent from)"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                  />
                </div>

                {/* Transaction Code / ID */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Transaction ID / Reference Number
                  </label>
                  <input
                    type="text"
                    aria-label="Transaction Code"
                    placeholder="e.g., 9X0192A82B (From payment slip)"
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm font-mono"
                  />
                </div>

                {/* Screenshot Upload */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1.5 block">
                    Payment Receipt Screenshot (Required)
                  </label>
                  {proofPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black/60 p-2">
                      <img
                        src={proofPreview}
                        alt="Payment screenshot preview"
                        className="w-full max-h-48 object-contain rounded-xl"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => { setProofPreview(''); setProofUrl(''); }}
                        className="absolute top-4 right-4 bg-black/80 hover:bg-red-600 rounded-full p-1.5 text-white transition cursor-pointer"
                        aria-label="Remove screenshot"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleScreenshotUpload(file);
                      }}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (const item of items) {
                          if (item.type.startsWith('image/')) {
                            const file = item.getAsFile();
                            if (file) handleScreenshotUpload(file);
                            break;
                          }
                        }
                      }}
                      tabIndex={0}
                      className="w-full bg-dark/70 border-2 border-dashed border-gray-700 rounded-2xl py-6 flex flex-col items-center gap-2 hover:border-brand-500 transition group cursor-pointer focus:focus-visible:outline-none focus:border-brand-500"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-gray-400 font-bold">Uploading screenshot to ImgBB...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center group-hover:bg-brand-500/10 transition border border-gray-800">
                            <Upload className="w-5 h-5 text-gray-400 group-hover:text-brand-500" />
                          </div>
                          <p className="text-xs text-gray-300 font-bold">Click, drag & drop, or paste screenshot</p>
                          <p className="text-[10px] text-gray-500">PNG, JPG, WEBP up to 15MB</p>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleScreenshotUpload(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleDepositSubmit}
                  disabled={isSubmitting || isUploading}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Deposit Request</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Withdrawal Tab */
            <div className="space-y-6 animate-fade-in">
              <div className="bg-dark p-4 rounded-2xl border border-gray-800 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Available Balance</p>
                <p className="text-2xl font-black text-brand-400">
                  {formatCurrency((profile?.balance || 0) + (profile?.orgWalletBalance || 0))}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Withdrawal Amount</label>
                  <input
                    type="number"
                    aria-label="Withdraw Amount"
                    placeholder="Enter amount (Rs.)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Withdrawal Method</label>
                  <select
                    value={withdrawMethod}
                    aria-label="Withdraw Method"
                    onChange={(e) => setWithdrawMethod(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                  >
                    <option value="">Select Method</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.name}>{pm.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Account Details</label>
                  <textarea
                    aria-label="Account Details"
                    placeholder="Your Account Name, Mobile Number / Account Number, Bank Name..."
                    value={accountDetails}
                    onChange={(e) => setAccountDetails(e.target.value)}
                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold h-24 resize-none"
                  />
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-200 uppercase font-black leading-tight">
                    Processed within 24-48 hours. Ensure your account details are exact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleWithdrawSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50 cursor-pointer text-sm"
                >
                  {isSubmitting ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
