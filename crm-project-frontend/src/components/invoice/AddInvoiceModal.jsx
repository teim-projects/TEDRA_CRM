import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { State, City } from "country-state-city";
import { RxCross2 } from "react-icons/rx";
import {
  MdDelete,
  MdAdd,
  MdCheckCircle,
  MdSave,
  MdInfoOutline
} from "react-icons/md";
import {
  Receipt,
  CreditCard,
  Briefcase,
  Wrench,
  ShieldAlert,
  UserCheck,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  Repeat
} from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";

// Live Indian Currency Number to Words Converter
function numberToIndianWords(amount) {
  const num = Math.round(parseFloat(amount) || 0);
  if (num <= 0) return "Zero Rupees only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n) {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : " ");
    } else {
      str += a[n];
    }
    return str;
  }

  let words = "";
  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundred = Math.floor(rem / 100);
  rem = rem % 100;

  if (crore > 0) words += inWords(crore) + "Crore ";
  if (lakh > 0) words += inWords(lakh) + "Lakh ";
  if (thousand > 0) words += inWords(thousand) + "Thousand ";
  if (hundred > 0) words += inWords(hundred) + "Hundred ";
  if (rem > 0) words += (words !== "" ? "and " : "") + inWords(rem);

  return words.trim() + " Rupees only";
}

// Axios instance configured with token interceptor
const BASE_API = getBaseApiUrl();
const api = axios.create({
  baseURL: `${BASE_API.replace(/\/$/, "")}/`,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function AddInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  invoiceId = null,
  initialInvoice = null,
  initialProjectId = null,
}) {
  const isEdit = Boolean(invoiceId);

  const [_loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingNumber, setFetchingNumber] = useState(false);

  // Source Type: PROJECT, AMC, SERVICE, DIRECT
  const [invoiceType, setInvoiceType] = useState("PROJECT");
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || "");
  const [selectedAmcKey, setSelectedAmcKey] = useState("");
  const [selectedAmcId, setSelectedAmcId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Detailed selected cards state for rich feedback
  const [activeAmcInfo, setActiveAmcInfo] = useState(null);
  const [activeProjectInfo, setActiveProjectInfo] = useState(null);
  const [activeServiceInfo, setActiveServiceInfo] = useState(null);

  // Masters
  const [projectsList, setProjectsList] = useState([]);
  const [amcList, setAmcList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [billingDetailsList, setBillingDetailsList] = useState([]);
  const [_availableProducts, setAvailableProducts] = useState([]);

  // Fixed DS Aqua Company Details
  const companyDetails = {
    company_name: "D S WATER TECH PVT LTD",
    company_address: "GROUND FLOOR BELHEKAR COMPLEX SR. NO. 156/5A, OFFICE NO. 1 MANJARI BUDRUK Pune",
    company_phone: "+919881653030",
    company_email: "dswatertech1@gmail.com",
    company_gstin: "27AALCD8065C1ZJ",
    company_state: "27-Maharashtra"
  };

  // State & City helper lists
  const states = useMemo(() => State.getStatesOfCountry("IN"), []);

  // Invoice Meta
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [invoiceTime, setInvoiceTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  });
  const [placeOfSupply, setPlaceOfSupply] = useState("27-Maharashtra");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");

  // Bill To Party (matching AddQuotation form fields)
  const [billToCompanyName, setBillToCompanyName] = useState("");
  const [billToContactPerson, setBillToContactPerson] = useState("");
  const [billToContact, setBillToContact] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [billToState, setBillToState] = useState("Maharashtra");
  const [billToCity, setBillToCity] = useState("Pune");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToGstin, setBillToGstin] = useState("");
  const [billToPan, setBillToPan] = useState("");

  // Ship To Party
  const [shipToSameAsBillTo, setShipToSameAsBillTo] = useState(true);
  const [shipToCompanyName, setShipToCompanyName] = useState("");
  const [shipToContactPerson, setShipToContactPerson] = useState("");
  const [shipToContact, setShipToContact] = useState("");
  const [_shipToEmail, setShipToEmail] = useState("");
  const [shipToState, setShipToState] = useState("Maharashtra");
  const [shipToCity, setShipToCity] = useState("Pune");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGstin, setShipToGstin] = useState("");

  // Cities filtered by selected states
  const billToCities = useMemo(() => {
    if (!billToState) return [];
    const matched = states.find(
      (s) =>
        s.name.toLowerCase() === billToState.toLowerCase() ||
        s.isoCode.toLowerCase() === billToState.toLowerCase() ||
        billToState.toLowerCase().includes(s.name.toLowerCase())
    );
    return matched ? City.getCitiesOfState("IN", matched.isoCode) : [];
  }, [billToState, states]);

  const shipToCities = useMemo(() => {
    if (!shipToState) return [];
    const matched = states.find(
      (s) =>
        s.name.toLowerCase() === shipToState.toLowerCase() ||
        s.isoCode.toLowerCase() === shipToState.toLowerCase() ||
        shipToState.toLowerCase().includes(s.name.toLowerCase())
    );
    return matched ? City.getCitiesOfState("IN", matched.isoCode) : [];
  }, [shipToState, states]);

  // Bank Account
  const [selectedBillingDetailId, setSelectedBillingDetailId] = useState("");
  const [bankName, setBankName] = useState("Icici Bank Limited, S. P. Pune");
  const [bankAccountNo, setBankAccountNo] = useState("645105006800");
  const [bankIfscCode, setBankIfscCode] = useState("ICIC0006451");
  const [bankAccountHolder, setBankAccountHolder] = useState("D S WATER TECH PVT LTD");
  const [_bankBranch, setBankBranch] = useState("S. P. Pune");

  // Line Items
  const [items, setItems] = useState([
    {
      item_name: "D S AQUA ® INDUSTRIAL RO WATER PURIFICATION SYSTEM",
      description: "Complete water treatment & filtration unit",
      hsn_sac: "8421",
      quantity: 1,
      unit: "NOS",
      price_per_unit: 14500,
      discount_percent: 0,
      discount_amount: 0,
      gst_rate: 18,
      gst_amount: 2610,
      taxable_amount: 14500,
      total_amount: 17110,
    }
  ]);

  // Payment & Balances
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("ICICI BANK");
  const [previousBalance, setPreviousBalance] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [termsAndConditions, setTermsAndConditions] = useState("Thank you for doing business with us.");
  const [_status, setStatus] = useState("PAID");

  // Function to fetch next invoice number
  const fetchNextInvoiceNumber = useCallback(async () => {
    setFetchingNumber(true);
    try {
      const res = await api.get("invoice/invoices/next-number/");
      if (res.data?.next_number) {
        setInvoiceNumber(String(res.data.next_number));
      }
    } catch (e) {
      console.warn("Could not fetch next number:", e);
      setInvoiceNumber((prev) => prev || "14");
    } finally {
      setFetchingNumber(false);
    }
  }, []);

  // Construct structured AMC options including renewed cycles
  const amcSelectOptions = useMemo(() => {
    const list = [];
    amcList.forEach((c) => {
      const custName = c.customer_details?.name || c.customer_details?.company_name || c.customer_name || "Customer";
      const prodName = c.product || "Water Treatment System";
      const cycles = Array.isArray(c.cycles) ? c.cycles : [];

      if (cycles.length === 0) {
        list.push({
          key: `${c.id}`,
          contractId: c.id,
          cycleId: null,
          contractCode: c.contract_id || `AMC-${c.id}`,
          custName,
          product: prodName,
          startDate: c.start_date || "",
          endDate: c.end_date || "",
          noOfVisits: c.no_of_visits || 4,
          frequency: c.service_frequency_display || c.service_frequency || "Quarterly",
          annualValue: parseFloat(c.annual_value || c.contract_amount || 0),
          cycleNumber: 1,
          cycleLabel: "Initial Contract",
          status: c.status || "active",
          isRenewal: false,
          displayLabel: `${c.contract_id || `AMC-${c.id}`} • ${custName} — ${prodName} (${c.start_date || ""} to ${c.end_date || ""} • ${c.no_of_visits || 4} Visits)`
        });
      } else {
        cycles.forEach((cyc) => {
          const isRenewal = cyc.cycle_number > 1;
          const cycleLabel = isRenewal ? `Renewal Cycle #${cyc.cycle_number}` : `Initial Cycle #${cyc.cycle_number}`;
          const statusBadge = cyc.status ? `[${cyc.status.toUpperCase()}]` : "";
          list.push({
            key: `${c.id}__${cyc.id}`,
            contractId: c.id,
            cycleId: cyc.id,
            contractCode: c.contract_id || `AMC-${c.id}`,
            custName,
            product: prodName,
            startDate: cyc.start_date || c.start_date || "",
            endDate: cyc.end_date || c.end_date || "",
            noOfVisits: cyc.no_of_visits || c.no_of_visits || 4,
            frequency: cyc.service_frequency_display || cyc.service_frequency || c.service_frequency || "Quarterly",
            annualValue: parseFloat(cyc.annual_value || c.annual_value || 0),
            cycleNumber: cyc.cycle_number,
            cycleLabel,
            status: cyc.status || c.status,
            isRenewal,
            displayLabel: `${c.contract_id || `AMC-${c.id}`} ${statusBadge} ${cycleLabel} • ${custName} — ${prodName} (${cyc.start_date || ""} to ${cyc.end_date || ""} • ${cyc.no_of_visits || 4} Visits)`
          });
        });
      }
    });
    return list;
  }, [amcList]);

  // Fetch initial masters and next invoice number
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    // 1. Fetch next invoice number if creating new invoice
    if (!isEdit && !initialInvoice) {
      fetchNextInvoiceNumber();
    }

    // 2. Projects
    api.get("lead/projects/?limit=1000")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setProjectsList(list);
      })
      .catch((e) => console.warn("Projects fetch error:", e));

    // 3. AMC Contracts (with cycles & renewal details)
    api.get("lead/amc/contracts/?limit=1000")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setAmcList(list);
      })
      .catch(() => {
        api.get("amc/contracts/?limit=1000")
          .then((r2) => {
            if (!isMounted) return;
            const l2 = Array.isArray(r2.data) ? r2.data : r2.data?.results || [];
            setAmcList(l2);
          })
          .catch((err) => console.warn("AMC fetch error:", err));
      });

    // 4. Services (single services & scheduled/breakdown visits)
    Promise.allSettled([
      api.get("amc/services/?limit=1000"),
      api.get("amc/visits/?limit=1000"),
    ]).then(([srvRes, visRes]) => {
      if (!isMounted) return;
      const singleList =
        srvRes.status === "fulfilled"
          ? Array.isArray(srvRes.value.data) ? srvRes.value.data : srvRes.value.data?.results || []
          : [];
      const visitList =
        visRes.status === "fulfilled"
          ? Array.isArray(visRes.value.data) ? visRes.value.data : visRes.value.data?.results || []
          : [];

      const combined = [
        ...singleList.map((s) => ({
          ...s,
          is_visit: false,
          display_label: `${s.service_number || `SRV-${s.id}`} • ${s.customer_details?.name || s.customer_name || 'Customer'} — ${s.equipment || s.description || 'Single Service'}`,
        })),
        ...visitList.map((v) => ({
          ...v,
          is_visit: true,
          display_label: `${v.visit_number || `VIS-${v.id}`} • ${v.customer_details?.name || 'Customer'} — ${v.equipment || 'Equipment'} (${v.status_display || 'Visit'})`,
        })),
      ];
      setServicesList(combined);
    });

    // 5. Customers
    api.get("lead/customer/?limit=1000")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCustomersList(list);
      })
      .catch((e) => console.warn("Customer fetch error:", e));

    // 6. Billing Details (Company Banks)
    api.get("quotation/billing-details/")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setBillingDetailsList(list);
        if (list.length > 0 && !selectedBillingDetailId) {
          const def = list.find((b) => b.is_default) || list[0];
          setSelectedBillingDetailId(def.id);
          setBankName(def.bank_name || "Icici Bank Limited, S. P. Pune");
          setBankAccountNo(def.account_number || "645105006800");
          setBankIfscCode(def.ifsc_code || "ICIC0006451");
          setBankAccountHolder(def.account_holder_name || "D S WATER TECH PVT LTD");
          setBankBranch(def.branch_name || "S. P. Pune");
        }
      })
      .catch((e) => console.warn("Billing details error:", e));

    // 7. Products catalog
    api.get("product/products/?limit=1000")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setAvailableProducts(list);
      })
      .catch((e) => console.warn("Products error:", e));

    return () => {
      isMounted = false;
    };
  }, [isOpen, isEdit, fetchNextInvoiceNumber]);

  // Load existing invoice data if editing or initial passed
  useEffect(() => {
    if (!isOpen) return;

    if (isEdit && invoiceId) {
      setLoading(true);
      api.get(`invoice/invoices/${invoiceId}/`)
        .then((res) => {
          const data = res.data;
          setInvoiceType(data.invoice_type || "PROJECT");
          setSelectedProjectId(data.project || "");
          setSelectedAmcId(data.amc_contract || "");
          setSelectedServiceId(data.service || "");
          setSelectedCustomerId(data.customer || "");

          setInvoiceNumber(data.invoice_number || "");
          setInvoiceDate(data.invoice_date || new Date().toISOString().split("T")[0]);
          setInvoiceTime(data.invoice_time || "11:00 AM");
          setPlaceOfSupply(data.place_of_supply || "27-Maharashtra");
          setPoNumber(data.po_number || "");
          setPoDate(data.po_date || "");

          // Bill To
          setBillToCompanyName(data.bill_to_name || "");
          setBillToContact(data.bill_to_contact || "");
          setBillToGstin(data.bill_to_gstin || "");
          setBillToState(data.bill_to_state || "Maharashtra");
          setBillToAddress(data.bill_to_address || "");

          // Ship To
          setShipToCompanyName(data.ship_to_name || data.bill_to_name || "");
          setShipToContact(data.ship_to_contact || data.bill_to_contact || "");
          setShipToGstin(data.ship_to_gstin || data.bill_to_gstin || "");
          setShipToState(data.ship_to_state || data.bill_to_state || "Maharashtra");
          setShipToAddress(data.ship_to_address || data.bill_to_address || "");
          setShipToSameAsBillTo(data.ship_to_address === data.bill_to_address);

          // Bank
          setSelectedBillingDetailId(data.billing_detail || "");
          setBankName(data.bank_name || "");
          setBankAccountNo(data.bank_account_no || "");
          setBankIfscCode(data.bank_ifsc || "");
          setBankAccountHolder(data.account_holder_name || "");

          // Financials
          setReceivedAmount(parseFloat(data.received_amount) || 0);
          setPaymentMode(data.payment_mode || "ICICI BANK");
          setPreviousBalance(parseFloat(data.previous_balance) || 0);
          setCurrentBalance(parseFloat(data.current_balance) || 0);
          setTermsAndConditions(data.terms_conditions || "Thank you for doing business with us.");
          setStatus(data.status || "PAID");

          // Items
          if (data.items && data.items.length > 0) {
            setItems(
              data.items.map((it) => ({
                id: it.id,
                item_name: it.item_name || "",
                description: it.description || "",
                hsn_sac: it.hsn_sac || "8421",
                quantity: parseFloat(it.quantity) || 1,
                unit: it.unit || "NOS",
                price_per_unit: parseFloat(it.price_per_unit) || 0,
                discount_percent: parseFloat(it.discount_percent) || 0,
                discount_amount: parseFloat(it.discount_amount) || 0,
                gst_rate: parseFloat(it.gst_rate ?? it.gst_percent) || 18,
                gst_amount: parseFloat(it.gst_amount) || 0,
                taxable_amount: parseFloat(it.taxable_amount) || 0,
                total_amount: parseFloat(it.total_amount) || 0,
              }))
            );
          }
        })
        .catch((err) => {
          console.error("Invoice fetch error:", err);
          Swal.fire({ icon: "error", title: "Error", text: "Failed to load invoice details" });
        })
        .finally(() => setLoading(false));
    } else if (initialInvoice) {
      setInvoiceType(initialInvoice.invoice_type || "PROJECT");
      setBillToCompanyName(initialInvoice.bill_to_name || "");
      setBillToAddress(initialInvoice.bill_to_address || "");
      setBillToContact(initialInvoice.bill_to_contact || "");
      setBillToGstin(initialInvoice.bill_to_gstin || "");
      if (initialInvoice.items) setItems(initialInvoice.items);
    }
  }, [isOpen, isEdit, invoiceId, initialInvoice]);

  // Keep Ship To synced when "Same as Bill To" is checked
  useEffect(() => {
    if (shipToSameAsBillTo) {
      setShipToCompanyName(billToCompanyName);
      setShipToContactPerson(billToContactPerson);
      setShipToContact(billToContact);
      setShipToEmail(billToEmail);
      setShipToState(billToState);
      setShipToCity(billToCity);
      setShipToAddress(billToAddress);
      setShipToGstin(billToGstin);
    }
  }, [
    shipToSameAsBillTo,
    billToCompanyName,
    billToContactPerson,
    billToContact,
    billToEmail,
    billToState,
    billToCity,
    billToAddress,
    billToGstin
  ]);

  // Handle Bank Change
  const handleBankChange = (bankId) => {
    setSelectedBillingDetailId(bankId);
    const selected = billingDetailsList.find((b) => String(b.id) === String(bankId));
    if (selected) {
      setBankName(selected.bank_name || "");
      setBankAccountNo(selected.account_number || "");
      setBankIfscCode(selected.ifsc_code || "");
      setBankAccountHolder(selected.account_holder_name || "D S WATER TECH PVT LTD");
      setBankBranch(selected.branch_name || "");
    }
  };

  // AUTO-POPULATION: Project Selection
  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId);
    if (!projId) {
      setActiveProjectInfo(null);
      return;
    }

    const proj = projectsList.find((p) => String(p.id) === String(projId));
    if (!proj) return;

    const cust = proj.customer_details || {};
    const company = cust.name || cust.company_name || proj.customer_name || "";
    const contactPerson = cust.contact_person || "";
    const contact = cust.contact_number || cust.phone || cust.mobile_number || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || cust.gstin || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "";
    const address = cust.billing_address || cust.address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const placeSupply = state.toLowerCase().includes("maharashtra") ? "27-Maharashtra" : state;
    setPlaceOfSupply(placeSupply);

    if (cust.id) setSelectedCustomerId(cust.id);
    if (proj.project_code) setPoNumber(proj.project_code);

    // Extract product(s) robustly from string, array of strings, or array of objects
    let raw = proj.product;
    if (!raw && cust.product_purchased) raw = cust.product_purchased;

    let parsed = [];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          parsed = JSON.parse(trimmed.replace(/'/g, '"'));
        } catch {
          parsed = [trimmed.replace(/[[\]'"]/g, "").trim()];
        }
      } else if (trimmed) {
        parsed = [trimmed];
      }
    } else if (Array.isArray(raw)) {
      parsed = raw;
    }

    const prodItems = [];
    parsed.forEach((item) => {
      let name = "";
      let rate = parseFloat(proj.project_value) || 14500;
      let qty = 1;

      if (typeof item === "string" && item.trim()) {
        name = item.trim();
      } else if (typeof item === "object" && item !== null) {
        name = item.product || item.product_name || item.name || "";
        if (item.value || item.price || item.unit_price) {
          rate = parseFloat(item.value || item.price || item.unit_price) || rate;
        }
        if (item.quantity || item.qty) {
          qty = parseFloat(item.quantity || item.qty) || 1;
        }
      }

      if (name) {
        if (parsed.length > 1 && !item.value && !item.price) {
          rate = Math.round((parseFloat(proj.project_value) || 14500) / parsed.length);
        }
        const fullName = name.toUpperCase().includes("D S AQUA") ? name : `D S AQUA ® ${name.toUpperCase()}`;
        const taxable = rate * qty;
        const gstAmt = parseFloat(((taxable * 18) / 100).toFixed(2));
        prodItems.push({
          item_name: fullName,
          description: `Project Code: ${proj.project_code || 'PRJ-' + proj.id}`,
          hsn_sac: "8421",
          quantity: qty,
          unit: "NOS",
          price_per_unit: rate,
          discount_percent: 0,
          discount_amount: 0,
          gst_rate: 18,
          gst_amount: gstAmt,
          taxable_amount: taxable,
          total_amount: parseFloat((taxable + gstAmt).toFixed(2)),
        });
      }
    });

    if (prodItems.length === 0) {
      const val = parseFloat(proj.project_value) || 14500;
      const taxable = val;
      const gstAmt = parseFloat(((taxable * 18) / 100).toFixed(2));
      prodItems.push({
        item_name: "D S AQUA ® INDUSTRIAL RO WATER TREATMENT PLANT",
        description: `Project Code: ${proj.project_code || 'PRJ-' + proj.id}`,
        hsn_sac: "8421",
        quantity: 1,
        unit: "NOS",
        price_per_unit: val,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: 18,
        gst_amount: gstAmt,
        taxable_amount: taxable,
        total_amount: parseFloat((taxable + gstAmt).toFixed(2)),
      });
    }

    setItems(prodItems);
    setActiveProjectInfo({
      projectCode: proj.project_code || `PRJ-${proj.id}`,
      product: prodItems.map((p) => p.item_name).join(", "),
      projectValue: proj.project_value,
      stage: proj.project_stage_display || proj.project_stage || "In Progress"
    });
  };

  // AUTO-POPULATION: AMC Selection (including renewed cycles & start/end dates, visits, frequency)
  const handleAmcSelect = (selectedKey) => {
    setSelectedAmcKey(selectedKey);
    if (!selectedKey) {
      setSelectedAmcId("");
      setActiveAmcInfo(null);
      return;
    }

    const opt = amcSelectOptions.find((o) => o.key === selectedKey);
    if (!opt) return;

    setSelectedAmcId(String(opt.contractId));
    setActiveAmcInfo(opt);

    const contract = amcList.find((c) => String(c.id) === String(opt.contractId));
    const cust = contract?.customer_details || {};
    const company = cust.name || cust.company_name || opt.custName || "";
    const contactPerson = cust.contact_person || "";
    const contact = cust.contact_number || cust.phone || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "";
    const address = cust.billing_address || cust.address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const placeSupply = state.toLowerCase().includes("maharashtra") ? "27-Maharashtra" : state;
    setPlaceOfSupply(placeSupply);

    const siteAddr = contract?.site_address || address;
    if (shipToSameAsBillTo) {
      setShipToAddress(siteAddr);
    }

    if (cust.id) setSelectedCustomerId(cust.id);
    setPoNumber(opt.contractCode);
    if (opt.startDate) setPoDate(opt.startDate);

    const val = opt.annualValue || 25000;
    const taxable = val;
    const gstAmt = parseFloat(((taxable * 18) / 100).toFixed(2));
    const total = parseFloat((taxable + gstAmt).toFixed(2));

    const prodTitle = opt.product.toUpperCase().includes("D S AQUA")
      ? opt.product
      : `D S AQUA ® ${opt.product.toUpperCase()}`;

    setItems([
      {
        item_name: `ANNUAL MAINTENANCE CONTRACT - ${prodTitle}`,
        description: `Contract ID: ${opt.contractCode} (${opt.cycleLabel}) | Product: ${opt.product} | Period: ${opt.startDate} to ${opt.endDate} | Frequency: ${opt.frequency} | Total Visits: ${opt.noOfVisits} Visits`,
        hsn_sac: "9987",
        quantity: 1,
        unit: "YR",
        price_per_unit: val,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: 18,
        gst_amount: gstAmt,
        taxable_amount: taxable,
        total_amount: total,
      }
    ]);
  };

  // AUTO-POPULATION: Service Selection (with equipment/product details)
  const handleServiceSelect = (srvId) => {
    setSelectedServiceId(srvId);
    if (!srvId) {
      setActiveServiceInfo(null);
      return;
    }

    const srv = servicesList.find((s) => String(s.id) === String(srvId));
    if (!srv) return;

    const cust = srv.customer_details || {};
    const company = cust.name || cust.company_name || srv.customer_name || "";
    const contactPerson = cust.contact_person || srv.contact_person || "";
    const contact = cust.contact_number || cust.phone || srv.contact_phone || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "";
    const address = cust.billing_address || cust.address || srv.visit_address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const placeSupply = state.toLowerCase().includes("maharashtra") ? "27-Maharashtra" : state;
    setPlaceOfSupply(placeSupply);

    const siteAddr = srv.visit_address || address;
    if (shipToSameAsBillTo) {
      setShipToAddress(siteAddr);
    }

    if (cust.id) setSelectedCustomerId(cust.id);
    const srvNum = srv.service_number || srv.visit_number || `SRV-${srv.id}`;
    setPoNumber(srvNum);
    if (srv.visit_date || srv.service_date) {
      setPoDate(srv.visit_date || srv.service_date);
    }

    // Equipment / product name
    const equip = srv.equipment || srv.product || srv.description || "Water Purification System";
    const equipTitle = equip.toUpperCase().includes("D S AQUA") ? equip : `D S AQUA ® ${equip.toUpperCase()}`;

    const cost = parseFloat(srv.service_cost || srv.charge || 3500) || 3500;
    const taxable = cost;
    const gstAmt = parseFloat(((taxable * 18) / 100).toFixed(2));
    const total = parseFloat((taxable + gstAmt).toFixed(2));

    const srvTypeDisplay = srv.visit_type_display || srv.service_type || "Maintenance Service";

    setItems([
      {
        item_name: `SERVICE & REPAIR - ${equipTitle}`,
        description: `Job / Visit #: ${srvNum} | Equipment: ${equip} | Service Type: ${srvTypeDisplay} | Date: ${srv.visit_date || srv.service_date || ''}`,
        hsn_sac: "9987",
        quantity: 1,
        unit: "JOB",
        price_per_unit: cost,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: 18,
        gst_amount: gstAmt,
        taxable_amount: taxable,
        total_amount: total,
      }
    ]);

    setActiveServiceInfo({
      serviceNumber: srvNum,
      equipment: equip,
      serviceType: srvTypeDisplay,
      date: srv.visit_date || srv.service_date || "",
      status: srv.status_display || srv.status || "Completed"
    });
  };

  // AUTO-POPULATION: Direct Customer Selection
  const handleCustomerSelect = (custId) => {
    setSelectedCustomerId(custId);
    if (!custId) return;

    const cust = customersList.find((c) => String(c.id) === String(custId));
    if (!cust) return;

    const company = cust.name || cust.company_name || "";
    const contactPerson = cust.contact_person || "";
    const contact = cust.contact_number || cust.phone || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "";
    const address = cust.billing_address || cust.address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const placeSupply = state.toLowerCase().includes("maharashtra") ? "27-Maharashtra" : state;
    setPlaceOfSupply(placeSupply);
  };

  // Add Item to Invoice
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_name: "",
        description: "",
        hsn_sac: "8421",
        quantity: 1,
        unit: "NOS",
        price_per_unit: 0,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: 18,
        gst_amount: 0,
        taxable_amount: 0,
        total_amount: 0,
      }
    ]);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update Item field with automatic live recalculation
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };

      const qty = parseFloat(field === "quantity" ? value : cur.quantity) || 0;
      const rate = parseFloat(field === "price_per_unit" ? value : cur.price_per_unit) || 0;
      const gross = qty * rate;

      let discAmt = parseFloat(field === "discount_amount" ? value : cur.discount_amount) || 0;
      let discPct = parseFloat(field === "discount_percent" ? value : cur.discount_percent) || 0;

      if (field === "discount_percent") {
        discAmt = parseFloat(((gross * discPct) / 100).toFixed(2));
        cur.discount_amount = discAmt;
      } else if (field === "discount_amount") {
        discPct = gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
        cur.discount_percent = discPct;
      }

      const taxable = Math.max(0, gross - discAmt);
      const gstRate = parseFloat(field === "gst_rate" ? value : cur.gst_rate) || 0;
      const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));
      const lineTotal = parseFloat((taxable + gstAmt).toFixed(2));

      cur.taxable_amount = taxable;
      cur.gst_amount = gstAmt;
      cur.total_amount = lineTotal;

      updated[index] = cur;
      return updated;
    });
  };

  // LIVE FINANCIAL TOTALS
  const calculation = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let totalGst = 0;

    items.forEach((it) => {
      const qty = parseFloat(it.quantity) || 0;
      const rate = parseFloat(it.price_per_unit) || 0;
      const gross = qty * rate;
      const disc = parseFloat(it.discount_amount) || 0;
      const taxable = Math.max(0, gross - disc);
      const gstRate = parseFloat(it.gst_rate) || 0;
      const gst = (taxable * gstRate) / 100;

      subtotal += gross;
      discountTotal += disc;
      taxableTotal += taxable;
      totalGst += gst;
    });

    const isIntrastate =
      (billToState || "").toLowerCase().includes("maharashtra") ||
      (billToState || "").startsWith("27");
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isIntrastate) {
      cgstAmount = parseFloat((totalGst / 2).toFixed(2));
      sgstAmount = parseFloat((totalGst / 2).toFixed(2));
    } else {
      igstAmount = parseFloat(totalGst.toFixed(2));
    }

    const unroundedTotal = taxableTotal + totalGst;
    const roundedGrandTotal = Math.round(unroundedTotal);
    const roundOff = parseFloat((roundedGrandTotal - unroundedTotal).toFixed(2));

    const rec = parseFloat(receivedAmount) || 0;
    const balance = Math.max(0, roundedGrandTotal - rec);
    const words = numberToIndianWords(roundedGrandTotal);

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountTotal: parseFloat(discountTotal.toFixed(2)),
      taxableTotal: parseFloat(taxableTotal.toFixed(2)),
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOff,
      grandTotal: roundedGrandTotal,
      balance: parseFloat(balance.toFixed(2)),
      youSaved: parseFloat(discountTotal.toFixed(2)),
      words,
    };
  }, [items, billToState, receivedAmount]);

  // Set default received amount to grand total on create
  useEffect(() => {
    if (!isEdit && calculation.grandTotal > 0 && receivedAmount === 0) {
      setReceivedAmount(calculation.grandTotal);
    }
  }, [calculation.grandTotal, isEdit]);

  // SUBMIT FORM
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      Swal.fire({ icon: "error", title: "Validation Error", text: "Invoice number is required." });
      return;
    }

    if (!billToCompanyName.trim()) {
      Swal.fire({ icon: "error", title: "Validation Error", text: "Company / Client Name is required." });
      return;
    }

    if (items.length === 0 || !items[0].item_name) {
      Swal.fire({ icon: "error", title: "Validation Error", text: "At least one line item is required." });
      return;
    }

    setSaving(true);
    try {
      const fullBillToAddress = [billToAddress, billToCity, billToState]
        .filter(Boolean)
        .join(", ");

      const fullShipToAddress = shipToSameAsBillTo
        ? fullBillToAddress
        : [shipToAddress, shipToCity, shipToState].filter(Boolean).join(", ");

      const selectedService = servicesList.find((s) => String(s.id) === String(selectedServiceId));
      const linkedServiceId =
        invoiceType === "SERVICE" && selectedService && !selectedService.is_visit
          ? parseInt(selectedServiceId)
          : null;

      const payload = {
        invoice_type: invoiceType,
        project: invoiceType === "PROJECT" && selectedProjectId ? parseInt(selectedProjectId) : null,
        amc_contract: invoiceType === "AMC" && selectedAmcId ? parseInt(selectedAmcId) : null,
        service: linkedServiceId,
        customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,

        company_name: companyDetails.company_name,
        company_address: companyDetails.company_address,
        company_phone: companyDetails.company_phone,
        company_email: companyDetails.company_email,
        company_gstin: companyDetails.company_gstin,
        company_state: companyDetails.company_state,

        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_time: invoiceTime,
        place_of_supply: placeOfSupply,
        po_number: poNumber,
        po_date: poDate || null,

        bill_to_name: billToCompanyName,
        bill_to_address: fullBillToAddress,
        bill_to_contact: billToContact,
        bill_to_gstin: billToGstin,
        bill_to_state: billToState,

        ship_to_name: shipToSameAsBillTo ? billToCompanyName : (shipToCompanyName || billToCompanyName),
        ship_to_address: fullShipToAddress,
        ship_to_contact: shipToSameAsBillTo ? billToContact : (shipToContact || billToContact),
        ship_to_gstin: shipToSameAsBillTo ? billToGstin : (shipToGstin || billToGstin),
        ship_to_state: shipToSameAsBillTo ? billToState : (shipToState || billToState),

        billing_detail: selectedBillingDetailId ? parseInt(selectedBillingDetailId) : null,
        bank_name: bankName,
        bank_account_no: bankAccountNo,
        bank_ifsc: bankIfscCode,
        account_holder_name: bankAccountHolder,

        sub_total: calculation.subtotal,
        discount_total: calculation.discountTotal,
        taxable_amount: calculation.taxableTotal,
        cgst_amount: calculation.cgstAmount,
        sgst_amount: calculation.sgstAmount,
        igst_amount: calculation.igstAmount,
        round_off: calculation.roundOff,
        grand_total: calculation.grandTotal,
        received_amount: parseFloat(receivedAmount) || 0,
        balance_amount: calculation.balance,
        you_saved: calculation.youSaved,
        payment_mode: paymentMode,
        previous_balance: parseFloat(previousBalance) || 0,
        current_balance: parseFloat(currentBalance) || 0,
        amount_in_words: calculation.words,
        terms_conditions: termsAndConditions,
        status: calculation.balance <= 0 ? "PAID" : parseFloat(receivedAmount) > 0 ? "PARTIALLY_PAID" : "UNPAID",

        items: items.map((it) => {
          const qty = parseFloat(it.quantity) || 1;
          const rate = parseFloat(it.price_per_unit) || 0;
          const gross = qty * rate;
          const disc = parseFloat(it.discount_amount) || 0;
          const taxable = Math.max(0, gross - disc);
          const gstRate = parseFloat(it.gst_rate) || 18;
          const gstAmt = parseFloat(((taxable * gstRate) / 100).toFixed(2));
          const isIntrastate = (billToState || "").toLowerCase().includes("maharashtra") || (billToState || "").startsWith("27");

          return {
            item_name: it.item_name,
            hsn_sac: it.hsn_sac || "8421",
            quantity: qty,
            unit: it.unit || "NOS",
            price_per_unit: rate,
            discount_percent: parseFloat(it.discount_percent) || 0,
            discount_amount: disc,
            taxable_amount: taxable,
            gst_rate: gstRate,
            gst_amount: gstAmt,
            cgst_rate: isIntrastate ? gstRate / 2 : 0,
            cgst_amount: isIntrastate ? parseFloat((gstAmt / 2).toFixed(2)) : 0,
            sgst_rate: isIntrastate ? gstRate / 2 : 0,
            sgst_amount: isIntrastate ? parseFloat((gstAmt / 2).toFixed(2)) : 0,
            igst_rate: !isIntrastate ? gstRate : 0,
            igst_amount: !isIntrastate ? gstAmt : 0,
            total_amount: parseFloat((taxable + gstAmt).toFixed(2)),
          };
        }),
      };

      const url = isEdit ? `invoice/invoices/${invoiceId}/` : "invoice/invoices/";
      const method = isEdit ? "put" : "post";
      const res = await api[method](url, payload);

      Swal.fire({
        icon: "success",
        title: isEdit ? "Invoice Updated" : "Invoice Created",
        text: `Tax Invoice #${res.data?.invoice_number || invoiceNumber} saved successfully.`,
        timer: 1600,
        showConfirmButton: false,
      });

      onSuccess && onSuccess(res.data);
      onClose && onClose();
    } catch (err) {
      console.error("Save error:", err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      Swal.fire({ icon: "error", title: "Save Failed", text: msg || "Failed to save invoice" });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] p-2 sm:p-4 animate-fade-in font-sans">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-5xl w-full mx-auto relative flex flex-col overflow-hidden max-h-[96vh] sm:max-h-[92vh]"
        style={{ height: "96vh" }}
      >
        {/* Fixed Header */}
        <div className="bg-white px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-3.5 flex justify-between items-start shrink-0 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="w-1.5 h-8 bg-sky-600 rounded-full block shrink-0"></span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 shrink-0" />
                <span className="truncate">{isEdit ? `Edit Tax Invoice #${invoiceNumber}` : "Create New Tax Invoice"}</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Generate GST-compliant tax invoices auto-filled from Projects, AMC Contracts, or Services
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <RxCross2 size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6 scrollbar-thin">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 text-slate-800">
            {/* 1. SOURCE SELECTOR TABS */}
            <div className="bg-slate-50/70 p-3 sm:p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0"></span>
                  <span>Select Invoice Source</span>
                </span>
                <span className="text-[11px] text-slate-400">Pulls customer, GSTIN, address &amp; items automatically</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { type: "PROJECT", label: "Project", icon: Briefcase, desc: "Water plants & projects" },
                  { type: "AMC", label: "AMC Contract", icon: ShieldAlert, desc: "Annual maintenance" },
                  { type: "SERVICE", label: "Service Job", icon: Wrench, desc: "Service & breakdown visits" },
                  { type: "DIRECT", label: "Direct Sales", icon: UserCheck, desc: "Manual / Direct client" },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = invoiceType === tab.type;
                  return (
                    <button
                      type="button"
                      key={tab.type}
                      onClick={() => setInvoiceType(tab.type)}
                      className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected
                        ? "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                        }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-sky-600" : "text-slate-500"}`} />
                        <span className="text-xs font-bold">{tab.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5">{tab.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Source Dropdown & Rich Selection Summary */}
              <div className="pt-2 space-y-2">
                {invoiceType === "PROJECT" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Project <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => handleProjectSelect(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Choose Project ({projectsList.length} available) --</option>
                      {projectsList.map((p) => {
                        const custName = p.customer_details?.name || p.customer_details?.company_name || p.customer_name || "Customer";
                        const prod = Array.isArray(p.product) ? p.product.join(", ") : p.product || "Water Plant";
                        return (
                          <option key={p.id} value={p.id}>
                            {p.project_code || `PRJ-${p.id}`} • {custName} — {prod} (₹{parseFloat(p.project_value || 0).toLocaleString()})
                          </option>
                        );
                      })}
                    </select>

                    {/* Active Project Details Card */}
                    {activeProjectInfo && (
                      <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs animate-fade-in">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Project Code:</span>
                          <span className="font-bold text-sky-900">{activeProjectInfo.projectCode}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Product / Plant:</span>
                          <span className="font-bold text-slate-800">{activeProjectInfo.product}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Project Value:</span>
                          <span className="font-bold text-slate-800">₹{parseFloat(activeProjectInfo.projectValue || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Stage:</span>
                          <span className="font-bold text-emerald-700">{activeProjectInfo.stage}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invoiceType === "AMC" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select AMC Contract & Term / Renewal <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedAmcKey}
                      onChange={(e) => handleAmcSelect(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Choose AMC Contract / Renewal Term ({amcSelectOptions.length} available) --</option>
                      {amcSelectOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.displayLabel}
                        </option>
                      ))}
                    </select>

                    {/* Active AMC & Renewal Details Card */}
                    {activeAmcInfo && (
                      <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2 mt-2 animate-fade-in">
                        <div className="flex items-center justify-between pb-1.5 border-b border-sky-200/60">
                          <div className="flex items-center gap-1.5">
                            <Repeat className="w-3.5 h-3.5 text-sky-700" />
                            <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                              AMC Contract & Renewal Term Details
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            activeAmcInfo.isRenewal ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-sky-100 text-sky-800 border-sky-200"
                          }`}>
                            {activeAmcInfo.cycleLabel} • {activeAmcInfo.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Product / Equipment:</span>
                            <span className="font-bold text-slate-800">{activeAmcInfo.product}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Contract Period:</span>
                            <span className="font-bold text-slate-800">{activeAmcInfo.startDate || "N/A"} to {activeAmcInfo.endDate || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Number of Visits:</span>
                            <span className="font-bold text-slate-800">{activeAmcInfo.noOfVisits} Visits</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase">Visit Frequency:</span>
                            <span className="font-bold text-slate-800 capitalize">{activeAmcInfo.frequency}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invoiceType === "SERVICE" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Service Record / Visit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => handleServiceSelect(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Choose Service / Visit ({servicesList.length} available) --</option>
                      {servicesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.display_label || `${s.service_number || s.visit_number || `SRV-${s.id}`} • ${s.customer_details?.name || 'Customer'}`}
                        </option>
                      ))}
                    </select>

                    {/* Active Service Job Details Card */}
                    {activeServiceInfo && (
                      <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs animate-fade-in">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Service / Visit #:</span>
                          <span className="font-bold text-sky-900">{activeServiceInfo.serviceNumber}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Equipment / Product:</span>
                          <span className="font-bold text-slate-800">{activeServiceInfo.equipment}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Service Type:</span>
                          <span className="font-bold text-slate-800">{activeServiceInfo.serviceType}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">Date & Status:</span>
                          <span className="font-bold text-emerald-700">{activeServiceInfo.date} • {activeServiceInfo.status}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {invoiceType === "DIRECT" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Existing Customer (Optional)
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Choose Customer ({customersList.length} available) --</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_code ? `${c.customer_code} • ` : ""}{c.name || c.company_name} ({c.city || "India"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 2. INVOICE META & DOCUMENT DETAILS */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                <span>Invoice &amp; Document Details</span>
                <span className="text-[10px] text-sky-700 font-semibold bg-sky-50 px-2 py-0.5 rounded border border-sky-100 shrink-0">
                  Sequential Tax Document
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Invoice Number (Auto-Generated & Read-Only / Locked) */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100 flex items-center gap-1 shrink-0">
                      <Sparkles className="w-2.5 h-2.5" />
                      Auto-Generated (Locked)
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={invoiceNumber}
                      readOnly
                      title="Invoice number is automatically generated and cannot be modified"
                      className="w-full px-3 py-2 text-sm font-bold text-slate-700 border border-slate-200 rounded-lg bg-slate-100/90 cursor-not-allowed select-none pr-8 focus:outline-hidden shadow-2xs"
                      placeholder="Fetching next number..."
                      required
                    />
                    <button
                      type="button"
                      onClick={fetchNextInvoiceNumber}
                      title="Sync next invoice number from server"
                      className="absolute right-2 text-slate-400 hover:text-sky-600 p-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${fetchingNumber ? "animate-spin text-sky-600" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Invoice Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    required
                  />
                </div>

                {/* Invoice Time */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Invoice Time</label>
                  <input
                    type="text"
                    value={invoiceTime}
                    onChange={(e) => setInvoiceTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="11:00 AM"
                  />
                </div>

                {/* Place of Supply */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Place of Supply <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="27-Maharashtra"
                    required
                  />
                </div>

                {/* PO Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PO / Reference Number</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="e.g. PO-2026-088"
                  />
                </div>

                {/* PO Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PO Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. BILL TO PARTY (Matching AddQuotation Layout Exactly) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100 flex items-center justify-between">
                <span>1. Bill To Party (Client / Invoicing Details)</span>
                {billToCompanyName && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <MdCheckCircle className="text-xs text-emerald-600" />
                    Client Selected
                  </span>
                )}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Company / Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={billToCompanyName}
                    onChange={(e) => setBillToCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-medium"
                    placeholder="M/S. Sunrise Textile Processing Mills"
                    required
                  />
                </div>

                {/* Contact Person */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Contact Person</label>
                  <input
                    type="text"
                    value={billToContactPerson}
                    onChange={(e) => setBillToContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="e.g. Mahesh Patel"
                  />
                </div>

                {/* Mobile / Contact Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Mobile / Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={billToContact}
                    onChange={(e) => setBillToContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="9825011223"
                    required
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    value={billToEmail}
                    onChange={(e) => setBillToEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="billing@company.com"
                  />
                </div>

                {/* State Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">State</label>
                  <select
                    value={billToState}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBillToState(val);
                      setBillToCity("");
                      setPlaceOfSupply(val.toLowerCase().includes("maharashtra") ? "27-Maharashtra" : val);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                  >
                    <option value="">Select State</option>
                    {states.map((st) => (
                      <option key={st.isoCode} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">City</label>
                  {billToCities.length > 0 ? (
                    <select
                      value={billToCity}
                      onChange={(e) => setBillToCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    >
                      <option value="">Select City</option>
                      {billToCities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={billToCity}
                      onChange={(e) => setBillToCity(e.target.value)}
                      placeholder="Enter city"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    />
                  )}
                </div>

                {/* Billing Address Textarea */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Billing Address Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={billToAddress}
                    onChange={(e) => setBillToAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="Enter complete company billing address, street, landmark, PIN..."
                    required
                  />
                </div>

                {/* GST Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">GST Number</label>
                  <input
                    type="text"
                    value={billToGstin}
                    onChange={(e) => setBillToGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="24AAACS7890E1Z1"
                    maxLength={15}
                  />
                </div>

                {/* PAN Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PAN Number</label>
                  <input
                    type="text"
                    value={billToPan}
                    onChange={(e) => setBillToPan(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="AAACS7890E"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>

            {/* 4. SHIP TO PARTY (Matching AddQuotation Layout Exactly) */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ship To Party (Installation Site / Delivery Address)
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shipToSameAsBillTo}
                      onChange={(e) => setShipToSameAsBillTo(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                    />
                    <span>Same as Bill To</span>
                  </label>
                </div>
              </div>

              {shipToSameAsBillTo ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs text-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MdCheckCircle className="text-base text-emerald-600 shrink-0" />
                    <span>Shipping and site installation address matches the Billing Party details above.</span>
                  </div>
                  <span className="font-semibold text-sky-700 text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0 self-start sm:self-auto">
                    Same as Bill To
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Ship To Company / Site Name</label>
                    <input
                      type="text"
                      value={shipToCompanyName}
                      onChange={(e) => setShipToCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Site Name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Site Contact Person</label>
                    <input
                      type="text"
                      value={shipToContactPerson}
                      onChange={(e) => setShipToContactPerson(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Site Engineer / Receiver"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Site Contact Phone</label>
                    <input
                      type="text"
                      value={shipToContact}
                      onChange={(e) => setShipToContact(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Contact number"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Site State</label>
                    <select
                      value={shipToState}
                      onChange={(e) => {
                        setShipToState(e.target.value);
                        setShipToCity("");
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    >
                      <option value="">Select State</option>
                      {states.map((st) => (
                        <option key={st.isoCode} value={st.name}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Site City</label>
                    {shipToCities.length > 0 ? (
                      <select
                        value={shipToCity}
                        onChange={(e) => setShipToCity(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                      >
                        <option value="">Select City</option>
                        {shipToCities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={shipToCity}
                        onChange={(e) => setShipToCity(e.target.value)}
                        placeholder="Enter site city"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                      />
                    )}
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">Site / Installation Address</label>
                    <textarea
                      rows={2}
                      value={shipToAddress}
                      onChange={(e) => setShipToAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Full plant/site installation address..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 5. INVOICE LINE ITEMS */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Line Items &amp; Products ({items.length})</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    Auto-populated from source
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs scrollbar-thin">
                <table className="w-full min-w-[780px] text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Item Name & Description</th>
                      <th className="py-2.5 px-2 w-20 text-center">HSN/SAC</th>
                      <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                      <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                      <th className="py-2.5 px-2 w-24 text-right">Price / Unit (₹)</th>
                      <th className="py-2.5 px-2 w-20 text-right">Discount (₹)</th>
                      <th className="py-2.5 px-2 w-20 text-center">GST %</th>
                      <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 space-y-1">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(idx, "item_name", e.target.value)}
                            placeholder="Item name / product model..."
                            className="w-full px-2 py-1 text-xs font-semibold text-slate-800 border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                            required
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            placeholder="Specifications, contract period, visits, warranty, etc."
                            className="w-full px-2 py-0.5 text-[11px] text-slate-500 border border-slate-100 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.hsn_sac}
                            onChange={(e) => handleItemChange(idx, "hsn_sac", e.target.value)}
                            className="w-full px-1.5 py-1 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-full px-1.5 py-1 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            className="w-full px-1 py-1 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          >
                            <option value="NOS">NOS</option>
                            <option value="SET">SET</option>
                            <option value="LOT">LOT</option>
                            <option value="YR">YR</option>
                            <option value="JOB">JOB</option>
                            <option value="MTR">MTR</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.price_per_unit}
                            onChange={(e) => handleItemChange(idx, "price_per_unit", e.target.value)}
                            className="w-full px-2 py-1 text-xs text-right font-medium border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.discount_amount}
                            onChange={(e) => handleItemChange(idx, "discount_amount", e.target.value)}
                            className="w-full px-2 py-1 text-xs text-right border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={item.gst_rate}
                            onChange={(e) => handleItemChange(idx, "gst_rate", e.target.value)}
                            className="w-full px-1 py-1 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-sky-500 bg-white font-medium"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ₹{parseFloat(item.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <MdDelete size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. BANKING DETAILS & COMMERCIAL TERMS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              {/* Pay To Bank Selector */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                  Pay To: Company Bank Account
                </span>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Bank Account</label>
                    <select
                      value={selectedBillingDetailId}
                      onChange={(e) => handleBankChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Choose Account --</option>
                      {billingDetailsList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} • {b.account_number} ({b.account_holder_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block">Bank Name:</span>
                      <span className="font-semibold text-slate-800">{bankName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">A/C Number:</span>
                      <span className="font-semibold text-slate-800">{bankAccountNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">IFSC Code:</span>
                      <span className="font-semibold text-slate-800">{bankIfscCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Beneficiary:</span>
                      <span className="font-semibold text-slate-800">{bankAccountHolder}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and conditions */}
                <div className="space-y-1 pt-1">
                  <label className="block text-xs font-semibold text-slate-600">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>

              {/* Live Totals & Payment Summary Card */}
              <div className="bg-sky-50/40 p-3.5 sm:p-4 rounded-xl border border-sky-100 space-y-2.5">
                <span className="text-xs font-bold text-sky-900 uppercase tracking-wider flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-sky-200/60">
                  <span>Financial Summary</span>
                  <span className="text-[10px] font-bold bg-white text-sky-700 px-2 py-0.5 rounded border border-sky-200 shrink-0">
                    {calculation.cgstAmount > 0 ? "Intrastate GST (CGST+SGST)" : "Interstate GST (IGST)"}
                  </span>
                </span>

                <div className="space-y-1.5 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between text-slate-600 pt-0.5">
                    <span>Sub Total (Gross):</span>
                    <span className="font-semibold text-slate-800">₹{calculation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {calculation.discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-600 pt-1">
                      <span>Total Discount:</span>
                      <span className="font-semibold">- ₹{calculation.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold text-slate-800">₹{calculation.taxableTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {calculation.cgstAmount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600 pt-1">
                        <span>CGST (9.0%):</span>
                        <span className="font-semibold text-slate-800">₹{calculation.cgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 pt-1">
                        <span>SGST (9.0%):</span>
                        <span className="font-semibold text-slate-800">₹{calculation.sgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  {calculation.igstAmount > 0 && (
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>IGST (18.0%):</span>
                      <span className="font-semibold text-slate-800">₹{calculation.igstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {calculation.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-500 pt-1 text-[11px]">
                      <span>Round off:</span>
                      <span>{calculation.roundOff > 0 ? `+ ₹${calculation.roundOff}` : `- ₹${Math.abs(calculation.roundOff)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                    <span className="text-base text-sky-900">Grand Total:</span>
                    <span className="text-lg text-sky-700">₹{calculation.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 italic pt-1 break-words">
                    "{calculation.words}"
                  </div>

                  {/* Payment settlement */}
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Amount Received</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-emerald-700 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium h-[33px]"
                      >
                        <option value="ICICI BANK">ICICI BANK</option>
                        <option value="NEFT/RTGS">NEFT / RTGS</option>
                        <option value="UPI">UPI</option>
                        <option value="CASH">CASH</option>
                        <option value="CHEQUE">CHEQUE</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold pt-2">
                    <span className="text-slate-600">Balance Pending:</span>
                    <span className={`text-sm ${calculation.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      ₹{calculation.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
              >
                <MdSave className="text-base shrink-0" />
                <span>{saving ? "Saving Invoice..." : isEdit ? "Update Tax Invoice" : "Create Tax Invoice"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
