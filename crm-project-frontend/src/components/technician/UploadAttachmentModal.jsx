import React, { useState, useRef } from "react";
import {
  X,
  Camera,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Paperclip,
} from "lucide-react";

export default function UploadAttachmentModal({
  service,
  isOpen,
  onClose,
  onSuccess,
  baseApi,
  defaultStage = "other",
}) {
  const [stage, setStage] = useState(defaultStage);
  const [title, setTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const newPreviews = files.map((file) => {
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      return {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        isPdf,
        url: isPdf ? null : URL.createObjectURL(file),
        file,
      };
    });
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      if (prev[index]?.url) URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Please take a photo or select at least one file to upload.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      const formData = new FormData();
      const workType =
        service.work_type ||
        (service.visit_number || service.contract_id ? "amc_visit" : "single_service");

      formData.append("work_type", workType);
      formData.append("stage", stage);
      if (title.trim()) formData.append("title", title.trim());

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch(`${baseApi}/technician/services/${service.id}/attachments/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to upload attachments");
      }

      const uploadedData = await res.json();
      if (onSuccess) onSuccess(uploadedData);
      onClose();
    } catch (err) {
      console.error("Error uploading attachments:", err);
      setError(err.message || "Failed to upload files.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100/80">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Upload Site Photos & Documents</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {service.service_number || `VIS-${service.id}`} • {service.customer_name || "Customer"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleUpload} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Stage / Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Document / Photo Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { value: "before", label: "Before Photo", icon: "📷", desc: "Breakdown" },
                { value: "after", label: "After Photo", icon: "✨", desc: "Resolved" },
                { value: "document", label: "PDF / Report", icon: "📄", desc: "Signed Sheet" },
                { value: "other", label: "General File", icon: "📎", desc: "Other" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setStage(item.value)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    stage === item.value
                      ? "bg-cyan-50/80 border-cyan-500 ring-2 ring-cyan-200 text-cyan-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 font-medium"
                  }`}
                >
                  <span className="block text-base mb-0.5">{item.icon}</span>
                  <span className="block text-[11px] leading-tight">{item.label}</span>
                  <span className="block text-[9px] text-slate-400 mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Picker Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Camera Capture Input */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Camera</span>
            </button>

            {/* Gallery / PDF File Browse Input */}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              ref={fileInputRef}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Photos / PDF File</span>
            </button>
          </div>

          {/* Selected Files List & Previews */}
          {filePreviews.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                Selected Attachments ({filePreviews.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filePreviews.map((prev, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {prev.isPdf ? (
                        <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-rose-200">
                          PDF
                        </div>
                      ) : (
                        <img
                          src={prev.url}
                          alt={prev.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate leading-tight text-[11px]">
                          {prev.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {prev.size}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Caption / Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Title / Description (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pump inlet filter inspection, Signed customer slip"
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-slate-400"
            />
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedFiles.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? "Uploading..."
                  : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

