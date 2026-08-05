import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../../../shared/config/firebase';
import ReCAPTCHA from 'react-google-recaptcha';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [captchaValue, setCaptchaValue] = useState<string | null>(null);
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();

    const { showToast } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (recaptchaSiteKey && !captchaValue) {
            setError('Please complete the CAPTCHA');
            return;
        }

        setIsLoading(true);
        const startTime = performance.now();

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Welcome back!', 'success');
            navigate('/');
        } catch (err: any) {
            console.error('Login error:', err);
            const errMsg = err.message || 'Login failed';
            setError(errMsg);
            showToast('Login failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsGoogleLoading(true);
        const startTime = performance.now();

        try {
            const result = await signInWithPopup(auth, googleProvider);
            showToast('Welcome back!', 'success');
            navigate('/');
        } catch (err: any) {
            console.error('Google Sign-In error:', err);
            const errMsg = err.message || 'Google Sign-In failed';
            setError(errMsg);
            showToast('Google Sign-In failed', 'error');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address first', 'warning');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showToast('Password reset link sent to your email!', 'success');
        } catch (err: any) {
            console.error('Password reset error:', err);
            showToast(err.message || 'Failed to send reset link', 'error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-black">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 mb-6">
                        <ShieldCheck className="w-10 h-10 text-brand-500" />
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Welcome Back</h2>
                    <p className="text-gray-400 font-bold">Login to access your NexPlay account</p>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 md:p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-14 pr-6 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label htmlFor="password" className="block text-xs font-black text-gray-500 uppercase tracking-widest">Password</label>
                                <button 
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-black text-brand-500 hover:text-brand-400 uppercase tracking-widest transition"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-14 pr-14 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest"
                            >
                                {error}
                            </motion.div>
                        )}

                        {recaptchaSiteKey ? (
                            <div className="flex justify-center">
                                <ReCAPTCHA
                                    sitekey={recaptchaSiteKey}
                                    onChange={(val) => setCaptchaValue(val)}
                                    theme="dark"
                                />
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading}
                            className="w-full flex items-center justify-center py-5 px-6 rounded-2xl text-sm font-black text-white bg-brand-500 hover:bg-brand-400 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest shadow-lg shadow-brand-500/20"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Login Now <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="flex-1 border-t border-gray-800"></div>
                            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Or continue with</span>
                            <div className="flex-1 border-t border-gray-800"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading || isGoogleLoading}
                            className="w-full flex items-center justify-center py-5 px-6 border border-gray-800 rounded-2xl bg-black text-sm font-black text-white hover:bg-gray-900 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                        >
                            {isGoogleLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Google
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-10 pt-8 border-t border-gray-800 text-center">
                        <p className="text-sm text-gray-500 font-bold">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-brand-500 font-black hover:text-brand-400 transition uppercase tracking-widest text-xs">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
