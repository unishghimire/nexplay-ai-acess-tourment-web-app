// FILE_ID: components/ImageUploader.tsx
// MODULE: Media Management
// PURPOSE: Reusable, accessibly styled dropzone and click banner image uploader that proxies to ImgBB and logs activity
// DEPENDENCIES: services/imageService.ts

import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Upload, X, Image as RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { MediaCategory, uploadImage, ALLOWED_MIME_TYPES } from "../services/mediaService";

interface ImageUploaderProps {
  id?: string;
  value?: string;
  onChange: (url: string) => void;
  category: MediaCategory;
  label?: string;
  aspectRatio?: "square" | "video" | "avatar" | "banner" | "product";
  className?: string;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  id = `uploader-${Math.random().toString(36).substring(2, 9)}`,
  value = "",
  onChange,
  category,
  label,
  aspectRatio = "video",
  className = "",
  disabled = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string>(value);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal preview with external value
  useEffect(() => {
    setPreview(value);
  }, [value]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || loading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled || loading) return;

    if (e.target.files && e.target.files[0]) {
      await processAndUploadFile(e.target.files[0]);
    }
  };

  const processAndUploadFile = async (file: File) => {
    setError(null);
    setSuccess(false);
    setLoading(true);
    setProgress(0);

    // Create a local fast preview while uploading
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const uploadResult = await uploadImage(file, category, (prog) => {
        setProgress(prog);
      });

      if (uploadResult.success && uploadResult.url) {
        setPreview(uploadResult.url);
        onChange(uploadResult.url);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(uploadResult.error || "Upload failed. Please try again.");
        setPreview(value);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during processing.");
      setPreview(value);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;

    setPreview("");
    onChange("");
    setError(null);
    setSuccess(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const onButtonClick = () => {
    if (disabled || loading) return;
    inputRef.current?.click();
  };

  // Determinar layout responsivo por aspect ratio
  const getAspectClass = () => {
    switch (aspectRatio) {
      case "avatar":
        return "w-32 h-32 rounded-full mx-auto overflow-hidden border-2 border-slate-700/50";
      case "square":
        return "aspect-square w-full rounded-xl overflow-hidden";
      case "banner":
        return "aspect-[21/9] w-full rounded-xl overflow-hidden";
      case "product":
        return "aspect-[4/3] w-full rounded-xl overflow-hidden";
      case "video":
      default:
        return "aspect-video w-full rounded-xl overflow-hidden";
    }
  };

  return (
    <div className={`w-full max-w-full ${className}`} id={id}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2 truncate">
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center justify-center border-2 border-dashed transition-all duration-200 cursor-pointer group bg-slate-900/50
          ${getAspectClass()}
          ${dragActive ? "border-amber-500 bg-amber-500/10 scale-[0.99]" : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"}
          ${error ? "border-rose-500/80 bg-rose-500/5" : ""}
          ${success ? "border-emerald-500bg-emerald-500/5" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-slate-800" : ""}
        `}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          id={`${id}-input`}
          className="hidden"
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleFileChange}
          disabled={disabled || loading}
        />

        {/* Existing Image / Uploading Preview */}
        {preview ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={preview}
              alt="Uploader Preview"
              className="w-full h-full object-cover select-none"
              referrerPolicy="no-referrer" loading="lazy" />
            
            {/* Hover overlay controls */}
            {!loading && !disabled && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onButtonClick();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/90 text-slate-100 hover:bg-amber-500 hover:text-black shadow flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 shadow flex items-center gap-1.5 transition-colors duration-150"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty placeholder slot */
          <div className="flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mb-3 group-hover:bg-slate-700/80 group-hover:scale-110 transition-all duration-200 shadow-md">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-amber-500 transition-colors" />
            </div>
            <p className="text-sm font-semibold text-slate-200 mb-1">
              Drag & drop image here
            </p>
            <p className="text-xs text-slate-500 mb-1">
              or <span className="text-amber-500 font-medium group-hover:underline">browse files</span>
            </p>
            <p className="text-[10px] text-slate-600 max-w-xs mt-2">
              Supports JPEG, PNG, WEBP, GIF (Max 10MB)
            </p>
          </div>
        )}

        {/* Loading / Progress Panel */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <span className="text-sm font-medium text-slate-200 mb-1">Uploading to ImgBB...</span>
            <div className="w-2/3 h-1.5 bg-slate-850 rounded-full overflow-hidden mb-1">
              <motion.div
                className="h-full bg-amber-500"
                style={{ width: `${progress}%` }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-xs text-slate-500">{progress}% completed</span>
          </div>
        )}

        {/* Error Notification Banner inside dropzone */}
        {error && !loading && (
          <div className="absolute bottom-2 inset-x-2 bg-rose-950/90 hover:bg-rose-950 border border-rose-500/55 rounded-lg p-2 flex items-start gap-1.5 shadow-lg backdrop-blur-sm z-10" onClick={(e) => e.stopPropagation()}>
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-rose-200 leading-tight font-medium line-clamp-2">{error}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
              }}
              className="text-rose-400 hover:text-rose-300 p-0.5 transition-colors rounded-md"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Success Tick */}
        {success && !loading && (
          <div className="absolute top-2 right-2 bg-emerald-950/95 border border-emerald-500/50 rounded-full p-1.5 shadow-md flex items-center justify-center z-10" onClick={(e) => e.stopPropagation()}>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
};
