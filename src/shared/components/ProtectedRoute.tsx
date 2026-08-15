import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, profile, loading, authError } = useAuth();
    const location = useLocation();
    // ponytail: 5s timeout — if profile never loads (Firestore hang), stop blocking
    // Ceiling: user with truly missing profile doc gets redirected to dashboard instead of stuck spinner
    // Upgrade: server-side profile creation on first login
    const [profileTimeout, setProfileTimeout] = useState(false);

    useEffect(() => {
        if (user && !profile && !loading && allowedRoles) {
            const timer = setTimeout(() => setProfileTimeout(true), 5000);
            return () => clearTimeout(timer);
        }
        setProfileTimeout(false);
    }, [user, profile, loading, allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Verifying session...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // The user is authenticated but the profile could not be loaded (Firestore
    // error/timeout). Send them to /login where a retry is offered instead of
    // rendering the app with a missing profile.
    if (authError) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Wait for profile to load before checking roles — prevents race condition
    // where authorized users get redirected to /dashboard during initial load
    if (allowedRoles && !profile && !profileTimeout) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading profile...</p>
            </div>
        );
    }

    // Profile timed out or role doesn't match
    if (allowedRoles && profileTimeout && !profile) {
        return <Navigate to="/dashboard" replace />;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <>
            <Helmet>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            {children}
        </>
    );
};

export default ProtectedRoute;
