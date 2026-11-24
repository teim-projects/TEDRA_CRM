import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Base from '../Base';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; 
import { MdEdit, MdDelete, MdFilterList, MdZoomIn, MdOutlineNavigateNext, MdOutlineNavigateBefore, MdDownload, MdAdd } from 'react-icons/md';
import { Package } from 'lucide-react'; 
import Swal from 'sweetalert2';
import ProductForm from './ProductForm'; 
import AdvancedTableFilter from '../AdvancedTableFilter';
import RecordViewer from '../RecordViewer';
import { useUserRole } from '../../hooks/useAuth';
import { exportToExcel, formatExcelDate } from '../../utils/excelExport';

const formatDescriptionAsBracketedCommas = (text) => {
    if (!text || typeof text !== "string" || !text.trim()) return "";
    const raw = text.trim();
    const parts = raw.split(".");
    const bullets = [];
    parts.forEach((p) => {
        const cleaned = p.replace(/\s+/g, " ").trim();
        if (cleaned) {
            bullets.push(cleaned + ".");
        }
    });
    if (!raw.endsWith(".") && bullets.length > 0) {
        bullets[bullets.length - 1] = bullets[bullets.length - 1].replace(/\.$/, "");
    }
    if (bullets.length === 0) return raw;
    return `[ ${bullets.join(", ")} ]`;
};

const ProductList = () => {
    const BASE_API = import.meta.env.VITE_BASE_API_URL ?? "http://127.0.0.1:8000";
    const { hasPermission } = useUserRole(BASE_API);
    const canCreateProduct = hasPermission("products", "create");
    const canEditProduct = hasPermission("products", "edit");
    const canDeleteProduct = hasPermission("products", "delete");
    const navigate = useNavigate(); 
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal interaction states 
    const [showProductForm, setShowProductForm] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null);

    // Active Selected Filter Pill State
    const [selectedCategory, setSelectedCategory] = useState("All");

    // Filter state
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filteredData, setFilteredData] = useState([]);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Record Viewer state
    const [viewOpen, setViewOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);

    const token = useMemo(() => (
        localStorage.getItem("access") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        ""
    ), []);

    // Create axios instance with auth header
    const apiClient = useMemo(() => {
        return axios.create({
            baseURL: BASE_API,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        });
    }, [BASE_API, token]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/product/products/?limit=1000');
            
            let results = [];
            if (response.data && Array.isArray(response.data.results)) {
                results = response.data.results;
            } else if (Array.isArray(response.data)) {
                results = response.data;
            } else {
                throw new Error("Unexpected product list payload structure");
            }
            
            const processed = results.map((p) => {
                const extra = (p.extra_attributes && typeof p.extra_attributes === 'object') ? p.extra_attributes : {};
                return {
                    ...p,
                    material: extra.material || p.material || '',
                    width: extra.width || p.width || '',
                    length: extra.length || p.length || '',
                    thickness: extra.thickness || p.thickness || '',
                    density: extra.density || p.density || '',
                    description_size: extra.description_size || p.description_size || '',
                    uom: extra.uom || p.uom || '',
                    weight: extra.weight || p.weight || '',
                    net_weight: extra.net_weight || p.net_weight || '',
                    cutting_length: extra.cutting_length || p.cutting_length || '',
                };
            });

            setAllProducts(processed);
            setFilteredData(processed);
            setCurrentPage(1);
        } catch (err) {
            console.error('Error fetching products:', err);
            if (err.response && err.response.status === 401) {
                setError("Authentication failed. Please login again.");
            } else {
                setError(err.message || String(err));
            }
            setAllProducts([]);
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    }, [apiClient]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleDelete = async (id) => {
        const res = await Swal.fire({
            title: "Delete Product?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#64748b"
        });
        if (!res.isConfirmed) return;

        try {
            await apiClient.delete(`/product/products/${id}/`);
            Swal.fire({ icon: "success", text: "Product deleted", timer: 1000, showConfirmButton: false });
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            if (error.response && error.response.status === 401) {
                Swal.fire({ icon: "error", title: "Authentication Error", text: "Please login again." });
            } else {
                Swal.fire({ icon: "error", title: "Delete failed", text: "Could not remove product resource." });
            }
        }
    };

    const categoriesNavigation = useMemo(() => {
        const counts = {};
        allProducts.forEach(p => {
            const catName = p.category_name || (p.is_service ? "Service" : "Product");
            counts[catName] = (counts[catName] || 0) + 1;
        });

        return [
            { name: "All", count: allProducts.length },
            ...Object.keys(counts).map(name => ({ name, count: counts[name] }))
        ];
    }, [allProducts]);

    // Filter by selected category pill on top of advanced filter
    const displayData = useMemo(() => {
        let data = filteredData;
        if (selectedCategory !== "All") {
            data = data.filter(p => {
                const catName = p.category_name || (p.is_service ? "Service" : "Product");
                return catName === selectedCategory;
            });
        }
        return data;
    }, [filteredData, selectedCategory]);

    const totalCount = displayData.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

    // Reset page to 1 whenever category filter or advanced filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, filteredData]);

    // Paginated slice for current page
    const currentPageData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return displayData.slice(startIndex, startIndex + itemsPerPage);
    }, [displayData, currentPage, itemsPerPage]);

    const formatCurrency = (amount) => {
        if (!amount) return "₹0.00";
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Columns for the filter (using product fields)
    const filterColumns = [
        { key: "name", label: "Product Name" },
        { key: "capacity_lph", label: "Capacity (LPH)" },
        { key: "product_code", label: "Product Code" },
        { key: "category_name", label: "Category" },
        { key: "material", label: "Material" },
        { key: "uom", label: "UOM" },
        { key: "description_size", label: "Description / Size" },
        { key: "weight", label: "Weight" },
        { key: "unit_price", label: "Unit Price" },
        { key: "hsn_sac_code", label: "HSN Code" },
        { key: "gst_percentage", label: "GST Percentage" },
        { key: "status", label: "Status" },
        { key: "is_service", label: "Is Service" },
    ];

    const handleExportExcel = () => {
        const dataToExport = displayData && displayData.length > 0 ? displayData : allProducts;
        const formatted = dataToExport.map((p, idx) => ({
            "Sr No": idx + 1,
            "Product Name": p.name || "-",
            "Product Code": p.product_code || "-",
            "Capacity (LPH)": p.capacity_lph || "-",
            "Category": p.category_name || (p.is_service ? "Service" : "Product"),
            "Material": p.material || p.extra_attributes?.material || "-",
            "UOM": p.uom || p.extra_attributes?.uom || "-",
            "Description / Size": p.description_size || p.extra_attributes?.description_size || "-",
            "Width": p.width || p.extra_attributes?.width || "-",
            "Length": p.length || p.extra_attributes?.length || "-",
            "Thickness": p.thickness || p.extra_attributes?.thickness || "-",
            "Density": p.density || p.extra_attributes?.density || "-",
            "Weight": p.weight || p.extra_attributes?.weight || "-",
            "Net Weight": p.net_weight || p.extra_attributes?.net_weight || "-",
            "Cutting Length": p.cutting_length || p.extra_attributes?.cutting_length || "-",
            "Type": p.is_service ? "Service" : "Product",
            "Unit Price (₹)": p.unit_price ? parseFloat(p.unit_price) : 0,
            "HSN / SAC Code": p.hsn_sac_code || "-",
            "GST Type": p.gst_type || "GST",
            "GST Percentage (%)": p.gst_percentage ? parseFloat(p.gst_percentage) : 18,
            "Price with GST (₹)": p.price_with_gst ? parseFloat(p.price_with_gst) : (
                p.unit_price ? parseFloat((parseFloat(p.unit_price) * (1 + (parseFloat(p.gst_percentage || 18) / 100))).toFixed(2)) : 0
            ),
            "Status": p.status || (p.is_active ? "ACTIVE" : "INACTIVE"),
            "Description": p.description || "-",
            "Created Date": formatExcelDate(p.created_at),
        }));

        exportToExcel({
            data: formatted,
            fileName: "Product_Services_Catalog",
            sheetName: "Products",
        });
    };

    return (
        <Base title="">
            <div className="w-full max-w-full space-y-4 sm:space-y-5 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-0.5 sm:px-1 overflow-hidden">
                
                {/* HEADER BLOCK */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-1 pt-1 gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className="w-1.5 h-9 sm:h-10 bg-sky-600 rounded-full block shrink-0"></span>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">Product & Service Master</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {loading ? "Synchronizing catalog records..." : `${totalCount} products / services`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto">
                        {/* Row 1 on mobile: Filter & Export */}
                        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className="col-span-1 w-full sm:w-auto px-2 sm:px-3.5 py-1.5 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                                <MdFilterList className="text-slate-400 shrink-0 text-sm" />
                                <span>Filter</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="col-span-1 w-full sm:w-auto px-2 sm:px-3.5 py-1.5 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                title="Export Products to Excel"
                            >
                                <MdDownload className="text-emerald-600 text-sm shrink-0" />
                                <span>Export</span>
                            </button>
                        </div>

                        {/* Row 2 on mobile: Manage Categories & Add Product */}
                        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                            <button 
                                onClick={() => navigate('/categories')}
                                className="col-span-1 w-full sm:w-auto px-2 sm:px-3.5 py-2 sm:py-1.5 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer whitespace-nowrap flex items-center justify-center text-center truncate"
                            >
                                <span className="truncate">Manage Categories</span>
                            </button>
                            {canCreateProduct && (
                                <button 
                                    onClick={() => {
                                        setSelectedProductId(null);
                                        setShowProductForm(true);
                                    }}
                                    className="col-span-1 w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
                                >
                                    <MdAdd className="text-base sm:text-sm shrink-0" />
                                    <span>Add Product</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* DYNAMIC CATEGORY FILTER PILLS BAR */}
                {!loading && allProducts.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
                        {categoriesNavigation.map((cat) => {
                            const isActive = selectedCategory === cat.name;
                            return (
                                <button
                                    key={cat.name}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer ${
                                        isActive
                                            ? 'bg-sky-600 text-white border-sky-600 shadow-md scale-[1.01]'
                                            : 'bg-white text-slate-600 border-slate-200 shadow-xs hover:shadow-md hover:bg-slate-50/80'
                                    }`}
                                >
                                    <span>{cat.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {cat.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* VISUAL CARDS GRID DISPLAY AREA */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200/80 shadow-sm text-sm text-slate-500">
                        Loading production catalog...
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-600 font-medium">
                        {error}
                    </div>
                ) : currentPageData.length === 0 ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200/80 shadow-sm text-sm text-slate-500">
                        No products available under the selected criteria category pill.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                        {currentPageData.map((product) => (
                            <div 
                                key={product.id} 
                                className="bg-white rounded-2xl border border-slate-200/60 p-3.5 sm:p-4 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-3 sm:space-y-4 overflow-hidden w-full max-w-full"
                            >
                                <div className="flex gap-3 sm:gap-4 items-start min-w-0">
                                    {product.product_image_url ? (
                                        <img 
                                            src={product.product_image_url} 
                                            alt={product.name} 
                                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-500 shrink-0 shadow-xs">
                                            <Package size={28} className="sm:w-8 sm:h-8" strokeWidth={1.5} />
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                                            <h3 className="font-bold text-slate-900 text-sm md:text-base leading-snug break-words">
                                                {product.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                                                    product.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : product.status === 'DRAFT'
                                                        ? 'bg-amber-50 text-amber-600'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {product.status ? product.status.toLowerCase() : 'active'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold tracking-wide break-words max-w-[160px] truncate" title={product.is_service ? "Service" : product.category_name || "Product"}>
                                                    {product.is_service ? "Service" : product.category_name || "Product"}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                            <div className="text-xs text-blue-600 font-semibold tracking-wide uppercase">
                                                {product.product_code || "—"}
                                            </div>
                                            {product.capacity_lph && (
                                                <span className="px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-200/60 text-cyan-700 text-[11px] font-semibold flex items-center gap-1">
                                                    💧 {product.capacity_lph}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-slate-600 font-medium bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 rounded-lg line-clamp-3 leading-relaxed mt-1 break-words">
                                            {formatDescriptionAsBracketedCommas(product.description) || "No item description overview configured inside system metadata parameters."}
                                        </p>

                                        {/* Physical & Material Specifications Badges */}
                                        {(product.material || product.description_size || product.uom || product.weight || product.width || product.length || product.thickness || product.cutting_length) && (
                                            <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px] sm:text-[11px] text-slate-600">
                                                {product.material && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700 break-words">
                                                        <span className="text-slate-400 font-normal">Mat:</span> {product.material}
                                                    </span>
                                                )}
                                                {product.description_size && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700 break-words">
                                                        <span className="text-slate-400 font-normal">Size:</span> {product.description_size}
                                                    </span>
                                                )}
                                                {(product.length || product.width || product.thickness) && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700 break-words">
                                                        <span className="text-slate-400 font-normal">Dim:</span> {[product.length, product.width, product.thickness].filter(Boolean).join(" × ")} {product.uom ? `(${product.uom})` : ''}
                                                    </span>
                                                )}
                                                {product.weight && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                                        <span className="text-slate-400 font-normal">Wt:</span> {product.weight}
                                                    </span>
                                                )}
                                                {product.net_weight && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                                        <span className="text-slate-400 font-normal">Net:</span> {product.net_weight}
                                                    </span>
                                                )}
                                                {product.density && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                                        <span className="text-slate-400 font-normal">Density:</span> {product.density}
                                                    </span>
                                                )}
                                                {product.cutting_length && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                                                        <span className="text-slate-400 font-normal">Cut:</span> {product.cutting_length}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100/80 my-1"></div>

                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-x-4 sm:gap-y-0.5 text-left w-full sm:max-w-lg">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Unit Price</div>
                                            <div className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                                                {formatCurrency(product.unit_price)}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">HSN Code</div>
                                            <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5 truncate">
                                                {product.hsn_sac_code || "—"}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Capacity</div>
                                            <div className="text-xs sm:text-sm font-semibold text-cyan-700 mt-0.5 truncate">
                                                {product.capacity_lph || "—"}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Tax Rate</div>
                                            <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5 truncate">
                                                {product.gst_percentage ? `${parseFloat(product.gst_percentage)}% GST` : "18% GST"}
                                            </div>
                                        </div>
                                        <div className="min-w-0 col-span-2 sm:col-span-1">
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Unit / UOM</div>
                                            <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5 truncate" title={product.uom || (product.is_service ? "Project" : "License")}>
                                                {product.uom || (product.is_service ? "Project" : "License")}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                        <button 
                                            onClick={() => {
                                                setSelectedProduct(product);
                                                setViewOpen(true);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-purple-600 rounded-md hover:bg-purple-50 transition-colors cursor-pointer"
                                            title="View Full Record"
                                        >
                                            <MdZoomIn size={18} />
                                        </button>

                                        {canEditProduct && (
                                            <button 
                                                onClick={() => {
                                                    setSelectedProductId(product.id);
                                                    setShowProductForm(true);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                                title="Edit Catalog Item"
                                            >
                                                <MdEdit size={18} />
                                            </button>
                                        )}
                                        {canDeleteProduct && (
                                            <button 
                                                onClick={() => handleDelete(product.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                                title="Delete Catalog Item"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PAGINATION PANEL (Consistent with Lead Management TableView) */}
                {!loading && !error && displayData.length > 0 && (
                    <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-600">
                            Page {currentPage} of {totalPages}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded border border-slate-200 bg-white text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center"
                                aria-label="Previous page"
                            >
                                <MdOutlineNavigateBefore />
                            </button>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded border border-slate-200 bg-white text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center"
                                aria-label="Next page"
                            >
                                <MdOutlineNavigateNext />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FILTER DRAWER - PORTAL TO BODY PREVENTS LAYOUT PUSH AND WHITE BOTTOM STRIP */}
            {typeof document !== "undefined" &&
                createPortal(
                    <>
                        {isFilterOpen && (
                            <div
                                className="fixed inset-0 w-screen h-screen bg-black/40 z-[9999]"
                                onClick={() => setIsFilterOpen(false)}
                            />
                        )}

                        <div
                            className={`fixed top-0 right-0 h-screen w-full max-w-[380px] sm:w-[380px] bg-white shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out ${
                                isFilterOpen ? "translate-x-0" : "translate-x-full"
                            }`}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
                                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1">
                                <AdvancedTableFilter
                                    data={allProducts}
                                    onFilter={setFilteredData}
                                    setItemsPerPage={setItemsPerPage}
                                    columns={filterColumns}
                                />
                            </div>
                        </div>
                    </>,
                    document.body
                )}

            {/* RECORD VIEWER - Slides in from right */}
            <RecordViewer
                isOpen={viewOpen}
                onClose={() => {
                    setViewOpen(false);
                    setSelectedProduct(null);
                }}
                record={selectedProduct}
                title="Product Details"
            />

            {/* Product Add / Edit Pop-up Modal Wrapper */}
            <ProductForm
                open={showProductForm}
                onClose={() => setShowProductForm(false)}
                productId={selectedProductId}
                baseApi={BASE_API}
                token={token}
                onSuccess={() => {
                    fetchProducts();
                    setShowProductForm(false);
                    setSelectedProductId(null);
                }}
            />
        </Base>
    );
};

export default ProductList;