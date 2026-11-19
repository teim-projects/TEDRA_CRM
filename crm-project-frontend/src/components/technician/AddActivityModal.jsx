import React, { useState } from "react";
import { X, MessageSquare, AlertCircle, Send } from "lucide-react";

export default function AddActivityModal({ service, isOpen, onClose, onSuccess, baseApi }) {
  if (!isOpen || !service) return null;

  const [actionType, setActionType] = useState("general_note");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Please enter note details.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      const res = await fetch(`${baseApi}/technician/services/${service.id}/add-note/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: actionType,
          notes: notes.trim(),
          work_type: service.work_type || (service.amc_contract || service.visit_number || service.visit_index !== undefined ? "amc_visit" : "single_service"),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to add activity log");
      }

      const createdActivity = await res.json();
      if (onSuccess) onSuccess(createdActivity);
      onClose();
    } catch (err) {
      console.error("Error adding activity:", err);
      setError(err.message || "Failed to record log.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Add Service Log / Note</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {service.service_number || service.visit_number || "Service"} • {service.customer_name || service.customer_details?.company_name || service.customer_details?.name || "Customer"}
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Log Type
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="general_note">General Site Note / Observation</option>
              <option value="parts_requested">Parts / Spares Required</option>
              <option value="diagnosis_recorded">Diagnosis / Inspection Note</option>
              <option value="customer_signoff">Customer Communication</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Note Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              placeholder="Enter field details, parts needed, observations or customer requests..."
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Save Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

