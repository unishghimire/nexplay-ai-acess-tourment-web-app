// FILE_ID: components/SmartImage.tsx
// MODULE: Reusable Image Display
// PURPOSE: Loading, error, fallback, lazy-loading image component for all NexPlay images
// ponytail: one component for all image display — no inline <img> error handling per component

import React, { useState, useEffect } from "react";

interface SmartImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  fallbackSrc?: string;
  referrerPolicy?: string;
}

/**
 * SmartImage — handles loading state, broken URLs, and fallbacks.
 * Shows a skeleton while loading, a placeholder if URL is missing, and a fallback on error.
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  loading = "lazy",
  objectFit = "cover",
  fallbackSrc = "",
  referrerPolicy = "no-referrer",
}) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "empty">(
    src ? "loading" : "empty"
  );
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    if (!src) {
      setStatus("empty");
      setCurrentSrc("");
      return;
    }
    setStatus("loading");
    setCurrentSrc(src);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setStatus("loading");
    } else {
      setStatus("error");
    }
  };

  const handleLoad = () => setStatus("loaded");

  if (status === "empty" || !currentSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 ${fallbackClassName || className}`}
        aria-label={alt} role="img"
      >
        <div className="w-8 h-8 rounded bg-slate-700/50" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 ${fallbackClassName || className}`}
        aria-label={alt} role="img"
      >
        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-slate-800/50 rounded-inherit" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        referrerPolicy={referrerPolicy as React.HTMLAttributeReferrerPolicy}
        onError={handleError}
        onLoad={handleLoad}
        className={`w-full h-full object-${objectFit} ${status === "loaded" ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
      />
    </div>
  );
};

export default SmartImage;
