import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const UOM_OPTIONS = [
    { label: "Centimeter (cm)", value: "Centimeter" },
    { label: "Inches (in)", value: "Inches" },
    { label: "Square Feet (sq.ft)", value: "Square Feet" },
    { label: "Millimeter (mm)", value: "Millimeter" },
    { label: "Meter (m)", value: "Meter" },
    { label: "Feet (ft)", value: "Feet" },
    { label: "Square Meter (sq.m)", value: "Square Meter" },
    { label: "Square Inch (sq.in)", value: "Square Inch" },
    { label: "Kilogram (kg)", value: "Kilogram" },
    { label: "Gram (g)", value: "Gram" },
    { label: "Metric Ton (MT)", value: "Metric Ton" },
    { label: "Pieces / Nos (pcs)", value: "Pieces" },
    { label: "Units (unt)", value: "Units" },
    { label: "Sets (set)", value: "Sets" },
    { label: "Rolls (roll)", value: "Rolls" },
    { label: "Bundles", value: "Bundles" },
    { label: "Running Meter (Rmt)", value: "Running Meter" },
    { label: "Liters (L)", value: "Liters" },
];

const ProductForm = ({ open, onClose, productId, baseApi, token, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const fileInputRef = useRef(null);
    
    const [formData, setFormData] = useState({
        name: '',
        product_code: '',
        category: '',
        capacity_lph: '',
        unit_price: '0',
        hsn_sac_code: '',
        status: 'ACTIVE',
        description: '',
        product_image_url: '',
        gst_percentage: 18,
        is_active: true,
        is_service: false,
        material: '',
        width: '',
        length: '',
        thickness: '',
        density: '',
        description_size: '',
        uom: '',
        weight: '',
        net_weight: '',
        cutting_length: '',
        extra_attributes: {}
    });

    const authHeadersJson = useMemo(() => ({
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        }
    }), [token]);

    useEffect(() => {
        if (!open) return;
        
        // Reset state on modal open
        setImageFile(null);
        setImagePreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        setFormData({
            name: '',
            product_code: '',
            category: '',
            capacity_lph: '',
            unit_price: '0',
            hsn_sac_code: '',
            status: 'ACTIVE',
            description: '',
            product_image_url: '',
            gst_percentage: 18,
            is_active: true,
            is_service: false,
            material: '',
            width: '',
            length: '',
            thickness: '',
            density: '',
            description_size: '',
            uom: '',
            weight: '',
            net_weight: '',
            cutting_length: '',
            extra_attributes: {}
        });

        const fetchCategories = async () => {
            try {
                const response = await axios.get(`${baseApi}/product/categories/?is_active=true`, authHeadersJson);
                setCategories(response.data.results || response.data || []);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };

        const fetchProduct = async () => {
            try {
                const response = await axios.get(`${baseApi}/product/products/${productId}/`, authHeadersJson);
                const data = response.data;
                const extra = (data.extra_attributes && typeof data.extra_attributes === 'object') ? data.extra_attributes : {};
                setFormData({
                    ...data,
                    category: data.category || '',
                    capacity_lph: data.capacity_lph || '',
                    unit_price: data.unit_price || '0',
                    gst_percentage: data.gst_percentage || 18,
                    material: extra.material || data.material || '',
                    width: extra.width || data.width || '',
                    length: extra.length || data.length || '',
                    thickness: extra.thickness || data.thickness || '',
                    density: extra.density || data.density || '',
                    description_size: extra.description_size || data.description_size || '',
                    uom: extra.uom || data.uom || '',
                    weight: extra.weight || data.weight || '',
                    net_weight: extra.net_weight || data.net_weight || '',
                    cutting_length: extra.cutting_length || data.cutting_length || '',
                    extra_attributes: extra
                });
                if (data.product_image_url) {
                    setImagePreview(data.product_image_url);
                }
            } catch (error) {
                console.error('Error fetching product:', error);
            }
        };

        fetchCategories();
        if (productId) {
            fetchProduct();
        }
    }, [open, productId, baseApi, authHeadersJson]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        setFormData({ ...formData, product_image_url: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const extra_attributes = {
                ...(formData.extra_attributes && typeof formData.extra_attributes === 'object' ? formData.extra_attributes : {}),
                material: typeof formData.material === 'string' ? formData.material.trim() : (formData.material || ''),
                width: typeof formData.width === 'string' ? formData.width.trim() : (formData.width || ''),
                length: typeof formData.length === 'string' ? formData.length.trim() : (formData.length || ''),
                thickness: typeof formData.thickness === 'string' ? formData.thickness.trim() : (formData.thickness || ''),
                density: typeof formData.density === 'string' ? formData.density.trim() : (formData.density || ''),
                description_size: typeof formData.description_size === 'string' ? formData.description_size.trim() : (formData.description_size || ''),
                uom: formData.uom || '',
                weight: typeof formData.weight === 'string' ? formData.weight.trim() : (formData.weight || ''),
                net_weight: typeof formData.net_weight === 'string' ? formData.net_weight.trim() : (formData.net_weight || ''),
                cutting_length: typeof formData.cutting_length === 'string' ? formData.cutting_length.trim() : (formData.cutting_length || '')
            };

            let submitData = {
                ...formData,
                unit_price: parseFloat(formData.unit_price) || 0,
                gst_percentage: parseFloat(formData.gst_percentage) || 0,
                extra_attributes
            };
            
            if (imageFile) {
                const formDataObj = new FormData();
                formDataObj.append('image', imageFile);
                
                const uploadResponse = await axios.post(
                    `${baseApi}/product/upload-image/`,
                    formDataObj,
                    {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
                submitData.product_image_url = uploadResponse.data.image_url;
            }
            
            if (productId) {
                await axios.put(`${baseApi}/product/products/${productId}/`, submitData, authHeadersJson);
                Swal.fire({ icon: "success", text: "Product updated successfully", timer: 1000, showConfirmButton: false });
            } else {
                await axios.post(`${baseApi}/product/products/`, submitData, authHeadersJson);
                Swal.fire({ icon: "success", text: "Product created successfully", timer: 1000, showConfirmButton: false });
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving product:', error);
            const errData = error.response?.data;
            let errMsg = "Please review form fields parameters.";
            if (errData && typeof errData === 'object') {
                errMsg = Object.entries(errData)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n');
            } else if (typeof errData === 'string') {
                errMsg = errData;
            }
            Swal.fire({ icon: "error", title: "Save failed", text: errMsg });
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            {/* Parent Modal Window - flex structure with overflow-hidden ensures perfect curved edges on all sides identical to the left */}
            <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-3xl w-full mx-auto my-4 sm:my-8 relative max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* Fixed Top Section Header */}
                <div className="bg-white px-6 pt-6 pb-2 flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {productId ? 'Edit Product' : 'Add New Product'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Configure system product, material specifications, and catalog classification metrics.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 font-bold text-lg transition-colors p-1 cursor-pointer"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Inner Form Scroll Area - Scrollbar track respects outer borders cleanly */}
                <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
                    <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Product Name */}
                            <div className="md:col-span-2 space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Product / Service Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Product / Service Name"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                />
                            </div>

                            {/* Product Code */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Product Code
                                </label>
                                <input
                                    type="text"
                                    name="product_code"
                                    value={formData.product_code}
                                    onChange={handleChange}
                                    placeholder="Enter custom product code (e.g. PRD-001)"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                />
                                <p className="text-[10px] text-slate-400">Enter custom code manually, or leave blank to auto-generate.</p>
                            </div>

                            {/* Category */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Category *
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white h-[38px]"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Unit Price */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Unit Price (₹) *
                                </label>
                                <input
                                    type="number"
                                    name="unit_price"
                                    value={formData.unit_price}
                                    onChange={handleChange}
                                    required
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                />
                            </div>

                            {/* HSN Code */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    HSN / SAC Code
                                </label>
                                <input
                                    type="text"
                                    name="hsn_sac_code"
                                    value={formData.hsn_sac_code}
                                    onChange={handleChange}
                                    placeholder="e.g. 99831"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                />
                            </div>

                            {/* Capacity (LPH) */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Capacity (LPH)
                                </label>
                                <input
                                    type="text"
                                    name="capacity_lph"
                                    value={formData.capacity_lph || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. 250 LPH, 500 LPH, 1000 LPH"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-cyan-500 text-slate-800 bg-white"
                                />
                                <p className="text-[10px] text-slate-400">Water purification / filtration flow rate capacity (Liters Per Hour).</p>
                            </div>

                            {/* GST Percentage */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    GST Percentage (%)
                                </label>
                                <input
                                    type="number"
                                    name="gst_percentage"
                                    value={formData.gst_percentage}
                                    onChange={handleChange}
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    placeholder="18"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                />
                            </div>

                            {/* Status */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white h-[38px]"
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="DRAFT">Draft</option>
                                    <option value="DISCONTINUED">Discontinued</option>
                                </select>
                            </div>
                        </div>

                        {/* PHYSICAL & MATERIAL SPECIFICATIONS SECTION */}
                        <div className="pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-sky-600 rounded-full inline-block"></span>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Material & Dimensions Specifications
                                    </h4>
                                </div>
                                <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-semibold border border-sky-100">
                                    Physical Parameters
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                                {/* Material */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Material
                                    </label>
                                    <input
                                        type="text"
                                        name="material"
                                        value={formData.material || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. Stainless Steel 304, MS, Aluminum"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* UOM */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        UOM (Unit of Measurement)
                                    </label>
                                    <select
                                        name="uom"
                                        value={formData.uom || ''}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white h-[38px]"
                                    >
                                        <option value="">Select UOM</option>
                                        {UOM_OPTIONS.map((u) => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Description / Size */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Description / Size
                                    </label>
                                    <input
                                        type="text"
                                        name="description_size"
                                        value={formData.description_size || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 2400 x 1200 x 12 mm / Size 40"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Width */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Width
                                    </label>
                                    <input
                                        type="text"
                                        name="width"
                                        value={formData.width || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 50 cm / 1200 mm"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Length */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Length
                                    </label>
                                    <input
                                        type="text"
                                        name="length"
                                        value={formData.length || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 100 cm / 2400 mm"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Thickness */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Thickness
                                    </label>
                                    <input
                                        type="text"
                                        name="thickness"
                                        value={formData.thickness || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 5 mm / 16 Gauge"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Density */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Density
                                    </label>
                                    <input
                                        type="text"
                                        name="density"
                                        value={formData.density || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 7.85 g/cm³"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Weight */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Weight
                                    </label>
                                    <input
                                        type="text"
                                        name="weight"
                                        value={formData.weight || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 25 kg / 55 lbs"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Net Weight */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Net Weight
                                    </label>
                                    <input
                                        type="text"
                                        name="net_weight"
                                        value={formData.net_weight || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 23.5 kg"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>

                                {/* Cutting Length */}
                                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Cutting Length
                                    </label>
                                    <input
                                        type="text"
                                        name="cutting_length"
                                        value={formData.cutting_length || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 1500 mm / 60 inches"
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">
                                Product Description
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                placeholder="e.g. Hello. Hii. Say something."
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800 bg-white"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                💡 <strong className="text-slate-600">Bullet Format:</strong> End each point/sentence with a period (<code className="bg-slate-100 px-1 rounded text-sky-600 font-bold">.</code>) to format it into separate bullet points in Quotations & PDFs.
                            </p>

                            {formData.description && formData.description.trim().length > 0 && (
                                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Bullet Preview:</p>
                                    <ul className="space-y-1">
                                        {(() => {
                                            const raw = formData.description.trim();
                                            const parts = raw.split('.');
                                            const bullets = [];
                                            parts.forEach(p => {
                                                const c = p.replace(/\s+/g, ' ').trim();
                                                if (c) bullets.push(c + '.');
                                            });
                                            if (!raw.endsWith('.') && bullets.length > 0) {
                                                bullets[bullets.length - 1] = bullets[bullets.length - 1].replace(/\.$/, '');
                                            }
                                            return bullets.map((b, i) => (
                                                <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                                                    <span className="text-sky-500 font-bold leading-none mt-0.5">•</span>
                                                    <span>{b}</span>
                                                </li>
                                            ));
                                        })()}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Image Upload Row */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-600">
                                Product Image
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 flex-1 border border-slate-200 rounded-lg p-1 bg-white cursor-pointer"
                                />
                                {imagePreview && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            {imagePreview && (
                                <div className="pt-1">
                                    <img 
                                        src={imagePreview} 
                                        alt="Preview" 
                                        className="h-20 w-20 object-cover rounded-xl border border-slate-200 shadow-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Checkboxes Row */}
                        <div className="flex gap-6 pt-2">
                            <label className="flex items-center cursor-pointer select-none text-xs font-semibold text-slate-600">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 mr-2 cursor-pointer"
                                />
                                Active
                            </label>
                            <label className="flex items-center cursor-pointer select-none text-xs font-semibold text-slate-600">
                                <input
                                    type="checkbox"
                                    name="is_service"
                                    checked={formData.is_service}
                                    onChange={handleChange}
                                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 mr-2 cursor-pointer"
                                />
                                Service Product (AMC)
                            </label>
                        </div>

                        {/* Actions Control Area */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                            >
                                {loading ? 'Saving...' : (productId ? 'Update Item' : 'Create Item')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProductForm;