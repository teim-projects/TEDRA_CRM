import React, { useState, useRef, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  FileText,
  Upload,
  Trash2,
  Paperclip,
  Check,
  Package,
  RotateCcw,
  Layers,
  Wrench
} from "lucide-react";
import { isServiceDue, formatDisplayDate } from "../../utils/serviceDateUtils";
import { getCurrentCoordinates } from "../../utils/navigation";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function CompleteVisitModal({ service, isOpen, onClose, onSuccess, baseApi }) {
  const api = (baseApi || getBaseApiUrl() || "").replace(/\/$/, "");
  const todayStr = new Date().toISOString().split("T")[0];
  const [completionDate, setCompletionDate] = useState(todayStr);
  const [diagnosis, setDiagnosis] = useState(service?.diagnosis || "");
  const [resolutionNotes, setResolutionNotes] = useState(service?.resolution_notes || "");
  const [customerFeedback, setCustomerFeedback] = useState(service?.customer_feedback || "excellent");
  const [notes, setNotes] = useState("");
  const [afterImages, setAfterImages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Issued Inventory / Spare Parts State
  const [issuedItems, setIssuedItems] = useState([]);
  const [loadingIssuedItems, setLoadingIssuedItems] = useState(false);
  const [stockUsage, setStockUsage] = useState({}); // itemId -> { usedQty, returnedQty, inHandQty }

  // Load Issued Inventory for this specific Service / AMC Visit
  useEffect(() => {
    if (!isOpen || !service?.id) return;

    const fetchServiceStock = async () => {
      setLoadingIssuedItems(true);
      try {
        const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
        const isVisit = Boolean(
          service.work_type === "amc_visit" ||
          service.visit_number ||
          service.contract_id ||
          service.amc_contract
        );
        const targetQuery = isVisit ? `visit=${service.id}` : `service=${service.id}`;
        const res = await fetch(`${api}/inventory/transactions/?${targetQuery}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        let txs = [];
        if (res.ok) {
          const data = await res.json();
          txs = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        } else if (Array.isArray(service.issued_inventory)) {
          txs = service.issued_inventory;
        }

        // Aggregate transactions by item ID
        const itemMap = {};
        txs.forEach((tx) => {
          const itemId = tx.item || tx.item_id;
          if (!itemId) return;
          if (!itemMap[itemId]) {
            itemMap[itemId] = {
              itemId,
              name: tx.item_name || "Spare Part",
              code: tx.item_code || "",
              capacity: tx.item_capacity || tx.capacity || "",
              unit: tx.unit || "Nos",
              issuedQty: 0,
              alreadyUsedQty: 0,
              alreadyReturnedQty: 0,
            };
          }
          const q = parseFloat(tx.quantity || 0);
          if (tx.transaction_type === "ISSUE_STOCK") {
            itemMap[itemId].issuedQty += q;
          } else if (tx.transaction_type === "USED_STOCK") {
            itemMap[itemId].alreadyUsedQty += q;
          } else if (tx.transaction_type === "RETURN_STOCK") {
            itemMap[itemId].alreadyReturnedQty += q;
          }
        });

        const list = Object.values(itemMap).filter((item) => item.issuedQty > 0);
        setIssuedItems(list);

        // Prepopulate: default used = inHand, returning = 0
        const initialUsage = {};
        list.forEach((it) => {
          const inHand = Math.max(0, it.issuedQty - (it.alreadyUsedQty || 0) - (it.alreadyReturnedQty || 0));
          initialUsage[it.itemId] = {
            usedQty: inHand,
            returnedQty: 0,
            inHandQty: inHand,
          };
        });
        setStockUsage(initialUsage);
      } catch (err) {
        console.warn("Could not load issued stock for service:", err);
      } finally {
        setLoadingIssuedItems(false);
      }
    };

    fetchServiceStock();
  }, [isOpen, service?.id, api]);

  const handleUsedQtyChange = (itemId, valStr) => {
    const val = valStr === "" ? "" : Math.max(0, parseFloat(valStr) || 0);
    setStockUsage((prev) => {
      const cur = prev[itemId] || { inHandQty: 0, usedQty: 0, returnedQty: 0 };
      const inHand = cur.inHandQty || 0;
      const numUsed = val === "" ? 0 : val;
      const autoReturned = Math.max(0, inHand - numUsed);
      return {
        ...prev,
        [itemId]: {
          ...cur,
          usedQty: val,
          returnedQty: autoReturned,
        },
      };
    });
  };

  const handleReturnedQtyChange = (itemId, valStr) => {
    const val = valStr === "" ? "" : Math.max(0, parseFloat(valStr) || 0);
    setStockUsage((prev) => {
      const cur = prev[itemId] || { inHandQty: 0, usedQty: 0, returnedQty: 0 };
      return {
        ...prev,
        [itemId]: {
          ...cur,
          returnedQty: val,
        },
      };
    });
  };

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const docInputRef = useRef(null);

  const handleImageFiles = (files) => {
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((file) => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      previewUrl: URL.createObjectURL(file),
    }));
    setAfterImages((prev) => [...prev, ...newItems]);
  };

  const handleDocFiles = (files) => {
    if (!files || files.length === 0) return;
    const newDocs = Array.from(files).map((file) => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      isPdf: file.name.toLowerCase().endsWith(".pdf"),
    }));
    setDocuments((prev) => [...prev, ...newDocs]);
  };

  const removeImage = (index) => {
    setAfterImages((prev) => {
      const copy = [...prev];
      if (copy[index]?.previewUrl) {
        URL.revokeObjectURL(copy[index].previewUrl);
      }
      copy.splice(index, 1);
      return copy;
    });
  };

  const removeDoc = (index) => {
    setDocuments((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const submitCompletion = async (skipAttachments = false) => {
    const serviceDate = service.service_date || service.visit_date;
    if (serviceDate && !isServiceDue(serviceDate)) {
      setError(`This service/visit is scheduled for ${formatDisplayDate(serviceDate)}. It cannot be marked complete before the scheduled date.`);
      return;
    }

    if (service.status !== "in_progress" && service.status !== "completed") {
      setError("You must start the service/visit (set to In Progress) before it can be marked as completed.");
      return;
    }

    if (!resolutionNotes.trim()) {
      setError("Please describe the work performed or resolution notes.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const token = localStorage.getItem("access") || localStorage.getItem("token") || "";
    try {
      // Capture live GPS coordinates on completion
      const coords = await getCurrentCoordinates().catch(() => ({ latitude: null, longitude: null, accuracy: null }));

      const formData = new FormData();
      formData.append(
        "work_type",
        service.work_type || (service.visit_number || service.contract_id ? "amc_visit" : "single_service")
      );
      formData.append("completion_date", completionDate);
      formData.append("diagnosis", diagnosis.trim());
      formData.append("resolution_notes", resolutionNotes.trim());
      formData.append("customer_feedback", customerFeedback);
      formData.append("notes", notes.trim() || "Service visit completed by technician.");
      if (coords.latitude != null) formData.append("latitude", coords.latitude);
      if (coords.longitude != null) formData.append("longitude", coords.longitude);
      if (coords.accuracy != null) formData.append("accuracy", coords.accuracy);

      // Reconcile Spare Parts & Materials
      const reconciliationData = issuedItems.map((it) => {
        const u = stockUsage[it.itemId] || {};
        return {
          item_id: it.itemId,
          name: it.name,
          issued_qty: it.issuedQty,
          used_qty: u.usedQty === "" ? 0 : parseFloat(u.usedQty || 0),
          returned_qty: u.returnedQty === "" ? 0 : parseFloat(u.returnedQty || 0),
        };
      });

      for (const rec of reconciliationData) {
        const inHand = (stockUsage[rec.item_id]?.inHandQty) || 0;
        if (rec.used_qty + rec.returned_qty > inHand + 0.001) {
          setError(`Total used (${rec.used_qty}) + returned (${rec.returned_qty}) for "${rec.name}" exceeds the issued in-hand quantity (${inHand}).`);
          setIsSubmitting(false);
          return;
        }
      }

      if (reconciliationData.length > 0) {
        formData.append("stock_reconciliation", JSON.stringify(reconciliationData));
      }

      if (!skipAttachments) {
        afterImages.forEach((item) => {
          formData.append("after_images", item.file);
        });
        documents.forEach((item) => {
          formData.append("documents", item.file);
        });
      }

      const res = await fetch(`${api}/technician/services/${service.id}/complete-visit/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to complete visit");
      }

      const updatedService = await res.json();
      if (onSuccess) onSuccess(updatedService);
      onClose();
    } catch (err) {
      console.error("Error completing visit:", err);
      setError(err.message || "Failed to submit completion report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitCompletion(false);
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/80">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Complete Service Visit</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {service.service_number} • {service.customer_name || "Customer"}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Equipment preview badge */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Equipment</span>
              <span className="font-semibold text-slate-700">{service.equipment || "Water Treatment System"}</span>
            </div>
            {service.serial_number && (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Serial #</span>
                <span className="font-mono text-slate-600 text-[11px]">{service.serial_number}</span>
              </div>
            )}
          </div>

          {/* Completion Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Completion Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {/* Diagnosis / Finding */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Inspection Finding / Diagnosis
            </label>
            <textarea
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Pre-filter saturated; membrane pressure below normal operating range..."
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Work Performed / Resolution */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Work Performed / Resolution Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              required
              placeholder="e.g. Replaced PP cartridge, flushed membrane housing, calibrated pressure switch and tested flow rate..."
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Issued Spare Parts & Materials Reconciliation */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Issued Spare Parts & Stock Reconciliation
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Account for parts used on-site vs. returning to warehouse inventory
                  </span>
                </div>
              </div>
              {issuedItems.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                  {issuedItems.length} {issuedItems.length === 1 ? "Item" : "Items"} Issued
                </span>
              )}
            </div>

            {loadingIssuedItems ? (
              <div className="py-2.5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                <span>Checking issued spare parts...</span>
              </div>
            ) : issuedItems.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 text-[11px] text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>No inventory or spare parts were issued for this service visit.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {issuedItems.map((item) => {
                  const usage = stockUsage[item.itemId] || {
                    usedQty: item.issuedQty,
                    returnedQty: 0,
                    inHandQty: item.issuedQty,
                  };
                  const inHand = usage.inHandQty !== undefined ? usage.inHandQty : item.issuedQty;
                  return (
                    <div
                      key={item.itemId}
                      className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{item.name}</span>
                            {item.code && (
                              <span className="text-[10px] font-mono text-slate-400">
                                [{item.code}]
                              </span>
                            )}
                            {item.capacity && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {item.capacity}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Unit: <span className="font-semibold text-slate-700">{item.unit}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs">
                            Issued: {item.issuedQty} {item.unit}
                          </span>
                          {item.alreadyReturnedQty > 0 && (
                            <span className="block text-[9px] text-slate-400 mt-0.5">
                              (Prev. returned: {item.alreadyReturnedQty})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inputs: How much used vs How much returning */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>How much was USED? *</span>
                            <span className="text-slate-400 font-normal">Max {inHand}</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={inHand}
                              value={usage.usedQty}
                              onChange={(e) => handleUsedQtyChange(item.itemId, e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 pr-10"
                            />
                            <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-medium">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>How much RETURNING?</span>
                            <span className="text-slate-400 font-normal">To Warehouse</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={inHand}
                              value={usage.returnedQty}
                              onChange={(e) => handleReturnedQtyChange(item.itemId, e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 pr-10"
                            />
                            <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-medium">
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reconcile Summary Pill */}
                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <span className="text-slate-500">
                          Consumed: <strong className="text-slate-800">{usage.usedQty || 0} {item.unit}</strong>
                        </span>
                        {parseFloat(usage.returnedQty || 0) > 0 ? (
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>{usage.returnedQty} {item.unit} will be returned to inventory</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">0 returning</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Feedback */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Sign-Off / Rating
            </label>
            <select
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="excellent">⭐⭐⭐⭐⭐ Excellent - Customer fully satisfied</option>
              <option value="good">⭐⭐⭐⭐ Good - System operating normally</option>
              <option value="satisfactory">⭐⭐⭐ Satisfactory - Minor observations noted</option>
              <option value="unsatisfactory">⭐ Unsatisfactory - Follow-up requested</option>
            </select>
          </div>

          {/* After / Completion Photos & Service Report Upload (Optional) */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  After Service Photos & Report
                </span>
                <p className="text-[10px] text-slate-500">
                  Optional — capture finished work, replacement parts, or signed job card PDF
                </p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                Optional
              </span>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleImageFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleImageFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                handleDocFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Action buttons for capture / upload */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg border border-slate-200 hover:border-sky-300 text-xs font-medium shadow-2xs transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-sky-600" />
                <span>Camera</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg border border-slate-200 hover:border-sky-300 text-xs font-medium shadow-2xs transition-all cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 hover:border-emerald-300 text-xs font-medium shadow-2xs transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>PDF / Doc</span>
              </button>
            </div>

            {/* Preview of images */}
            {afterImages.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Photos ({afterImages.length})
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {afterImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                      <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview of documents */}
            {documents.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Documents ({documents.length})
                </span>
                <div className="space-y-1.5">
                  {documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium text-slate-700 text-[11px]">{doc.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({doc.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer signature taken on physical job card #1042"
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Actions with Skip Option */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => submitCompletion(true)}
                disabled={isSubmitting}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Skip & Complete
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {afterImages.length > 0 || documents.length > 0
                        ? `Complete & Upload (${afterImages.length + documents.length})`
                        : "Complete Service"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
