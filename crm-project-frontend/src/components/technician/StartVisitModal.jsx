import React, { useState, useRef } from "react";
import {
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  SkipForward,
  Trash2,
} from "lucide-react";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";
import { getCurrentCoordinates } from "../../utils/navigation";

export default function StartVisitModal({
  service,
  isOpen,
  onClose,
  onSuccess,
  baseApi,
}) {
  const [notes, setNotes] = useState("");
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

    const newPreviews = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      url: URL.createObjectURL(file),
      file,
    }));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index]?.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const startVisitRequest = async (skipPhotos = false) => {
    const serviceDate = service.service_date || service.visit_date;
    if (serviceDate && !isServiceDue(serviceDate)) {
      setError(
        `This service/visit is scheduled for ${formatDisplayDate(
          serviceDate
        )}. You can only start the visit on or after the scheduled date.`
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      const coords = await getCurrentCoordinates().catch(() => ({
        latitude: null,
        longitude: null,
        accuracy: null,
      }));

      const formData = new FormData();
      const workType =
        service.work_type ||
        (service.visit_number || service.contract_id ? "amc_visit" : "single_service");

      formData.append("work_type", workType);
      formData.append(
        "notes",
        notes.trim() || "Technician checked in on-site and initiated inspection."
      );
      if (coords.latitude) formData.append("latitude", coords.latitude);
      if (coords.longitude) formData.append("longitude", coords.longitude);
      if (coords.accuracy) formData.append("accuracy", coords.accuracy);

      if (!skipPhotos && selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append("before_images", file);
        });
      }

      const res = await fetch(`${baseApi}/technician/services/${service.id}/start-visit/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: fetch will automatically set multipart/form-data boundary when body is FormData
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to start visit");
      }

      const updatedService = await res.json();
      if (onSuccess) onSuccess(updatedService);
      onClose();
    } catch (err) {
      console.error("Error starting visit:", err);
      setError(err.message || "Failed to start visit.");
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
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Start Service Inspection</h2>
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
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Site Notice Banner */}
          <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs text-sky-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>📷</span>
              <span>Site Inspection & Breakdown Photos (Optional)</span>
            </p>
            <p className="text-[11px] text-sky-700 leading-relaxed">
              You can capture before-photos or equipment breakdown images to document the initial site condition. This is optional—you can click <strong>Skip</strong> to start working right away.
            </p>
          </div>

          {/* Photo Capture / Upload Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
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
              <span>Take Photo</span>
            </button>

            {/* Gallery / File Browse Input */}
            <input
              type="file"
              accept="image/*"
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
              <span>From Gallery</span>
            </button>
          </div>

          {/* Photo Previews */}
          {filePreviews.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                Selected Photos ({filePreviews.length}):
              </span>
              <div className="grid grid-cols-3 gap-2">
                {filePreviews.map((prev, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100"
                  >
                    <img
                      src={prev.url}
                      alt={prev.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 transition-colors cursor-pointer"
                      title="Remove Photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[9px] px-1 py-0.5 truncate text-center">
                      {prev.size}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations / Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Initial Observations / Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Pump pressure low, filter clogged, minor valve leakage observed..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => startVisitRequest(true)}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <SkipForward className="w-3.5 h-3.5 text-slate-500" />
            <span>Skip & Start</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => startVisitRequest(false)}
            className="px-5 py-2 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {isSubmitting
                ? "Starting Visit..."
                : selectedFiles.length > 0
                ? `Start with ${selectedFiles.length} Photo${selectedFiles.length > 1 ? "s" : ""}`
                : "Start Visit"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

