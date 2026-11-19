import React, { useState, useEffect, useMemo } from "react";
import { MdClose } from "react-icons/md";
import {
  ArrowDownLeft,
  UserCheck,
  Package,
  Wrench,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  User,
  Layers,
  Clock
} from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";

export default function ReturnStockModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  baseApi,
  preselectedItem = null,
  preselectedIssue = null,
  preselectedProject = null,
  currentUser = null,
  allocatedTechnicians = [],
}) {
  const api = baseApi || getBaseApiUrl();
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // External data
  const [issuedTransactions, setIssuedTransactions] = useState([]);
  const [returnTransactions, setReturnTransactions] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  // Active user / technician detection
  const getCachedUser = () => {
    try {
      const u = localStorage.getItem("crm_user_info");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  };

  const activeUser = currentUser || getCachedUser();
  const roleName = (activeUser?.role?.name || activeUser?.role_name || "").toLowerCase();
  const isTechnician =
    roleName === "technician" ||
    roleName.includes("technician") ||
    Boolean(activeUser?.is_technician);

  // Filter & selections
  const [selectedTechFilter, setSelectedTechFilter] = useState("ALL");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState(preselectedIssue?.id ? String(preselectedIssue.id) : "");
  const [selectedItemId, setSelectedItemId] = useState(
    preselectedIssue?.item || preselectedItem?.id || ""
  );

  // Quantities: Used / Installed vs Returning to Store
  const [usedQuantity, setUsedQuantity] = useState("0");
  const [returnQuantity, setReturnQuantity] = useState("");
  const [validationError, setValidationError] = useState("");

  const [reason, setReason] = useState("Unused / Surplus from Site Repair");
  const [notes, setNotes] = useState("");

  const returnReasons = [
    "Unused / Surplus from Site Repair",
    "Service Job Completed with leftover parts",
    "Service Job Cancelled / Rescheduled",
    "Customer had existing parts",
    "Defective / Faulty part removed from site",
    "Wrong item taken / Replacement exchange",
    "Excess stock returned to store",
    "Other"
  ];

  // Fetch issued transactions & technicians
  useEffect(() => {
    if (!isOpen) return;

    const fetchDropdownData = async () => {
      setLoadingOptions(true);
      const token = localStorage.getItem("access") || localStorage.getItem("access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      try {
        const txQuery = preselectedProject?.id
          ? `${api}/inventory/transactions/?project=${preselectedProject.id}&limit=500`
          : `${api}/inventory/transactions/?limit=500`;

        const returnTxQuery = preselectedProject?.id
          ? `${api}/inventory/transactions/?transaction_type=RETURN_STOCK&project=${preselectedProject.id}&limit=500`
          : `${api}/inventory/transactions/?transaction_type=RETURN_STOCK&limit=500`;

        const [txRes, retRes] = await Promise.all([
          fetch(txQuery, { headers }).catch(() => null),
          fetch(returnTxQuery, { headers }).catch(() => null)
        ]);

        if (txRes && txRes.ok) {
          const d = await txRes.json();
          const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          const issues = list.filter((t) => t.transaction_type === "ISSUE_STOCK");
          setIssuedTransactions(issues);
        }

        if (retRes && retRes.ok) {
          const d = await retRes.json();
          const list = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          setReturnTransactions(list);
        }

        // Fetch staff with fallback across all authenticated endpoints
        let staffList = [];
        try {
          const staffAllRes = await fetch(`${api}/auth/staff/all/`, { headers });
          if (staffAllRes.ok) {
            const d = await staffAllRes.json();
            staffList = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
          }
        } catch {}

        if (staffList.length === 0) {
          try {
            const techRes = await fetch(`${api}/technician/technicians/`, { headers });
            if (techRes.ok) {
              const d = await techRes.json();
              staffList = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
            }
          } catch {}
        }

        if (staffList.length === 0) {
          try {
            const staffRes = await fetch(`${api}/auth/staff/?limit=1000`, { headers });
            if (staffRes.ok) {
              const d = await staffRes.json();
              staffList = Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : [];
            }
          } catch {}
        }

        // Merge project technicians, allocatedTechnicians, and activeUser
        const combinedMap = new Map();
        staffList.forEach((t) => { if (t?.id) combinedMap.set(String(t.id), t); });
        (allocatedTechnicians || []).forEach((t) => { if (t?.id) combinedMap.set(String(t.id), t); });
        if (Array.isArray(preselectedProject?.technicians)) {
          preselectedProject.technicians.forEach((t) => { if (t?.id) combinedMap.set(String(t.id), t); });
        }

        if (activeUser?.id && !combinedMap.has(String(activeUser.id))) {
          combinedMap.set(String(activeUser.id), {
            id: activeUser.id,
            first_name: activeUser.first_name || activeUser.full_name || "Technician",
            last_name: activeUser.last_name || "",
            username: activeUser.username || activeUser.email,
            email: activeUser.email || "",
          });
        }

        const finalTechs = Array.from(combinedMap.values());
        setTechnicians(finalTechs);

        // Auto-select technician for technician login
        if (isTechnician && activeUser?.id) {
          setSelectedTechFilter(String(activeUser.id));
          setSelectedTechnicianId(String(activeUser.id));
        } else if (finalTechs.length === 1) {
          setSelectedTechFilter(String(finalTechs[0].id));
          setSelectedTechnicianId(String(finalTechs[0].id));
        }
      } catch (err) {
        console.warn("Error fetching return stock options:", err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchDropdownData();
  }, [isOpen, api, preselectedProject?.id, isTechnician, activeUser?.id]);

  // Set initial selections when preselectedIssue or preselectedItem changes
  useEffect(() => {
    if (preselectedIssue?.id) {
      setSelectedIssueId(String(preselectedIssue.id));
      setSelectedItemId(preselectedIssue.item);
      if (preselectedIssue.technician) {
        setSelectedTechnicianId(String(preselectedIssue.technician));
      }
    } else if (preselectedItem?.id) {
      setSelectedItemId(preselectedItem.id);
    }
  }, [preselectedIssue, preselectedItem]);

  // Filtered issue transactions by technician and project
  const availableIssues = useMemo(() => {
    let list = issuedTransactions;
    if (preselectedProject) {
      list = list.filter(
        (tx) =>
          tx.project === preselectedProject.id ||
          tx.project_id === preselectedProject.id ||
          (preselectedProject.project_code && tx.reference_number === preselectedProject.project_code)
      );
    }
    if (selectedTechFilter !== "ALL") {
      list = list.filter(
        (tx) => String(tx.technician) === String(selectedTechFilter) || tx.technician_name === selectedTechFilter
      );
    }
    return list;
  }, [issuedTransactions, selectedTechFilter, preselectedProject]);

  // Auto-select first available issue if not yet selected
  useEffect(() => {
    if (!selectedIssueId && availableIssues.length > 0) {
      const first = availableIssues[0];
      setSelectedIssueId(String(first.id));
      setSelectedItemId(first.item);
      if (first.technician) {
        setSelectedTechnicianId(String(first.technician));
      }
    }
  }, [availableIssues, selectedIssueId]);

  // Find currently selected issue
  const currentIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return issuedTransactions.find((tx) => String(tx.id) === String(selectedIssueId)) || preselectedIssue;
  }, [selectedIssueId, issuedTransactions, preselectedIssue]);

  // Calculate previously returned quantity against this issue
  const previouslyReturned = useMemo(() => {
    if (!currentIssue) return 0;
    const ref = currentIssue.reference_number;
    const itemId = currentIssue.item;
    const techId = currentIssue.technician;

    return returnTransactions.reduce((acc, ret) => {
      const matchItem = ret.item === itemId;
      const matchTech = !techId || ret.technician === techId;
      const matchRef = ref && ret.reference_number === ref;
      if (matchItem && (matchRef || matchTech)) {
        return acc + (Number(ret.quantity) || 0);
      }
      return acc;
    }, 0);
  }, [currentIssue, returnTransactions]);

  // Max returnable quantity currently in hand
  const maxReturnable = useMemo(() => {
    if (!currentIssue) return null;
    const issuedQty = Number(currentIssue.quantity) || 0;
    return Math.max(0, issuedQty - previouslyReturned);
  }, [currentIssue, previouslyReturned]);

  // Find inventory item details
  const currentItem = useMemo(() => {
    const idToFind = currentIssue?.item || selectedItemId;
    return items.find((it) => String(it.id) === String(idToFind)) || preselectedItem;
  }, [currentIssue, selectedItemId, items, preselectedItem]);

  const unit = currentItem?.unit || currentIssue?.unit || "Nos";

  // When current issue or maxReturnable resolves, prefill: 0 used, all inHand returning
  useEffect(() => {
    if (maxReturnable !== null) {
      setUsedQuantity("0");
      setReturnQuantity(String(maxReturnable));
      setValidationError("");
    } else {
      setUsedQuantity("0");
      setReturnQuantity("");
      setValidationError("");
    }
  }, [selectedIssueId, maxReturnable]);

  // Handle used quantity change with automatic return calculation and validation
  const handleUsedQtyChange = (valStr) => {
    setValidationError("");
    if (valStr === "") {
      setUsedQuantity("");
      setReturnQuantity(String(maxReturnable ?? 0));
      return;
    }

    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) {
      setUsedQuantity("0");
      setReturnQuantity(String(maxReturnable ?? 0));
      return;
    }

    const inHand = maxReturnable !== null ? maxReturnable : Infinity;
    if (val > inHand + 0.0001) {
      // Used quantity cannot exceed issued quantity
      setUsedQuantity(valStr);
      setValidationError(
        `Used quantity (${val} ${unit}) cannot exceed issued in-hand quantity (${inHand} ${unit}).`
      );
      return;
    }

    setUsedQuantity(valStr);
    // Directly and automatically calculate return quantity
    const autoReturned = Math.max(0, parseFloat((inHand - val).toFixed(4)));
    setReturnQuantity(String(autoReturned));
  };

  // Handle return quantity change
  const handleReturnQtyChange = (valStr) => {
    setValidationError("");
    if (valStr === "") {
      setReturnQuantity("");
      return;
    }

    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) {
      setReturnQuantity("0");
      return;
    }

    const inHand = maxReturnable !== null ? maxReturnable : Infinity;
    const currentUsed = parseFloat(usedQuantity || 0);

    if (val + currentUsed > inHand + 0.0001) {
      setReturnQuantity(valStr);
      setValidationError(
        `Total used (${currentUsed}) + returning (${val}) exceeds issued in-hand quantity (${inHand} ${unit}).`
      );
      return;
    }

    setReturnQuantity(valStr);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const targetItemId = currentIssue?.item || selectedItemId;
    if (!targetItemId) {
      Swal.fire({
        icon: "error",
        title: "Validation",
        text: "Please select an inventory item or an issued stock record."
      });
      return;
    }

    const inHand = maxReturnable !== null ? maxReturnable : Infinity;
    const usedNum = parseFloat(usedQuantity || 0);
    const retNum = parseFloat(returnQuantity || 0);

    if (usedNum > inHand + 0.0001) {
      Swal.fire({
        icon: "error",
        title: "Used Quantity Exceeds Issued Stock",
        text: `Used quantity (${usedNum} ${unit}) cannot exceed the issued quantity (${inHand} ${unit}).`
      });
      return;
    }

    if (usedNum + retNum > inHand + 0.0001) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: `Total used (${usedNum}) + returning (${retNum}) cannot exceed total issued quantity (${inHand} ${unit}).`
      });
      return;
    }

    if (usedNum <= 0 && retNum <= 0) {
      Swal.fire({
        icon: "error",
        title: "Validation",
        text: "Please specify either how much was used on site or how much is returning to warehouse."
      });
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("access") || localStorage.getItem("access_token");

    try {
      const payload = {
        issue_transaction_id: currentIssue?.id || null,
        item_id: targetItemId,
        quantity: retNum,
        used_quantity: usedNum,
        technician_id: selectedTechnicianId || currentIssue?.technician || (activeUser?.id ? activeUser.id : null),
        service_id: currentIssue?.service || null,
        visit_id: currentIssue?.visit || null,
        project_id: currentIssue?.project || currentIssue?.project_id || preselectedProject?.id || null,
        reference_number:
          currentIssue?.reference_number ||
          (preselectedProject ? preselectedProject.project_code || `PRJ-${preselectedProject.id}` : ""),
        reason,
        notes: notes.trim(),
      };

      const res = await fetch(`${api}/inventory/items/return-stock/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Failed to submit return request.");
      }

      const resJson = await res.json().catch(() => ({}));

      Swal.fire({
        icon: "success",
        title: "Stock Reconciled Successfully",
        text: resJson.message || `Return request for ${retNum} ${unit} submitted for approval${usedNum > 0 ? ` (${usedNum} ${unit} used on site)` : ""}.`,
        timer: 2500,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Resolve technician display name for technician login
  const activeTechName =
    activeUser?.first_name || activeUser?.full_name || activeUser?.username || "Technician";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ArrowDownLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Return & Reconcile Material Stock
              </h3>
              <p className="text-xs text-slate-500">
                Specify parts consumed on site and return unused surplus back to warehouse inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Target Job / Project Context Banner */}
          {preselectedProject && (
            <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[10px]">
                  PROJECT
                </span>
                <span className="font-bold text-slate-800 truncate">
                  {preselectedProject.project_code || `PRJ-${preselectedProject.id}`}
                </span>
                <span className="text-slate-400 truncate hidden sm:inline">
                  · {preselectedProject.customer_details?.company_name || preselectedProject.customer || "Project Job"}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-purple-700 shrink-0">
                {preselectedProject.project_stage_display || "Active"}
              </span>
            </div>
          )}

          {/* TECHNICIAN SECTION: Auto-detected for technician login; selectable for admin */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-sky-600" />
                Allocated Field Technician <span className="text-rose-500">*</span>
              </span>
              {isTechnician && (
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                  Logged In Technician
                </span>
              )}
            </label>

            {isTechnician ? (
              <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {(activeTechName[0] || "T").toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">
                      {activeTechName} {activeUser?.last_name || ""}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {activeUser?.email || "Field Technician"}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Auto-assigned
                </span>
              </div>
            ) : (
              <select
                value={selectedTechnicianId}
                onChange={(e) => {
                  setSelectedTechnicianId(e.target.value);
                  setSelectedTechFilter(e.target.value || "ALL");
                }}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Select Technician --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name || t.name || t.email} {t.last_name || ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ISSUED STOCK RECORD SELECTION */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Select Issued Material Record <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedIssueId}
              onChange={(e) => {
                setSelectedIssueId(e.target.value);
                const found = issuedTransactions.find((tx) => String(tx.id) === String(e.target.value));
                if (found) {
                  setSelectedItemId(found.item);
                  if (found.technician) setSelectedTechnicianId(String(found.technician));
                }
              }}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium truncate"
            >
              <option value="">-- Choose Issued Material Record --</option>
              {availableIssues.map((tx) => {
                const jobRef = tx.reference_number || (tx.project ? `PRJ-${tx.project}` : "Job");
                return (
                  <option key={tx.id} value={tx.id}>
                    {tx.item_name} [{tx.quantity} {tx.unit || "Nos"} issued] · {tx.technician_name || "Tech"} ({jobRef})
                  </option>
                );
              })}
            </select>
            {availableIssues.length === 0 && !loadingOptions && (
              <span className="text-[10px] text-amber-600 block mt-0.5">
                No issued material records found for this selection.
              </span>
            )}
          </div>

          {/* Fallback Manual Item selector if no issued record selected */}
          {!selectedIssueId && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Or Select Material Directly from Catalog
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Choose Inventory Item --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.item_code}) {it.capacity ? `[${it.capacity}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Issued Stock Information Card */}
          {currentIssue && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-700" />
                  {currentIssue.item_name}
                </span>
                <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200 text-slate-700 font-semibold">
                  {currentIssue.item_code || "INV-ITEM"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-amber-200/60">
                <div>
                  <span className="text-[10px] text-amber-800/80 block uppercase font-medium">Technician</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {currentIssue.technician_name || activeTechName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block uppercase font-medium">Linked Job</span>
                  <span className="font-semibold text-blue-700 truncate block">
                    {currentIssue.reference_number || "Project"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block uppercase font-medium">Originally Issued</span>
                  <span className="font-bold text-slate-800">
                    {currentIssue.quantity} {unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 block uppercase font-bold">Current In Hand</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {maxReturnable} {unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* QUANTITY INPUTS: "HOW MUCH USED" & "HOW MUCH RETURNING" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Input 1: Used / Installed Qty */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-sky-600" />
                  How much USED / INSTALLED?
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Max {maxReturnable !== null ? maxReturnable : "—"} {unit}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={maxReturnable !== null ? maxReturnable : undefined}
                  value={usedQuantity}
                  onChange={(e) => handleUsedQtyChange(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 pr-12 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-medium">
                  {unit}
                </span>
              </div>
              <span className="text-[9.5px] text-slate-400 block">
                Directly calculates remaining surplus to return
              </span>
            </div>

            {/* Input 2: Returning Qty (Auto-calculated) */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  How much RETURNING? <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">
                  (Auto-calculated)
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={maxReturnable !== null ? maxReturnable : undefined}
                  value={returnQuantity}
                  onChange={(e) => handleReturnQtyChange(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 pr-12 font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
                <span className="absolute right-3 top-2 text-[10px] text-amber-600 font-medium">
                  {unit}
                </span>
              </div>
              <span className="text-[9.5px] text-amber-700 block">
                Will be submitted for warehouse approval
              </span>
            </div>
          </div>

          {/* Validation Error Warning */}
          {validationError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Reconciliation Summary Card */}
          {maxReturnable !== null && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Total Issued In Hand:</span>
                <strong className="text-slate-800">{maxReturnable} {unit}</strong>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-bold text-xs">
                <span className="text-slate-700">Reconciliation:</span>
                <span className="text-right">
                  <span className="text-sky-700">{parseFloat(usedQuantity || 0)} {unit} Used</span>
                  <span className="text-slate-400 mx-1.5">+</span>
                  <span className="text-amber-700">{parseFloat(returnQuantity || 0)} {unit} Returning</span>
                </span>
              </div>
            </div>
          )}

          {/* Reason / Site Condition */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Reason / Site Condition
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {returnReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Condition & Inspection Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1 unit installed on site, 2 surplus units in sealed condition returned..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none text-slate-800"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(validationError)}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>{loading ? "Reconciling..." : "Confirm Return & Reconciliation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
