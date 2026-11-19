from django.contrib import admin
from .models import Vendor, InventoryItem, PurchaseOrder, PurchaseOrderItem, GRN, GRNItem, StockTransaction


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('vendor_code', 'name', 'contact_person', 'phone', 'email', 'city', 'is_active')
    search_fields = ('name', 'vendor_code', 'phone', 'email')
    list_filter = ('is_active', 'state')


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('po_number', 'vendor', 'order_date', 'status', 'total_amount')
    list_filter = ('status', 'order_date')
    search_fields = ('po_number', 'vendor__name')
    inlines = [PurchaseOrderItemInline]


class GRNItemInline(admin.TabularInline):
    model = GRNItem
    extra = 1


@admin.register(GRN)
class GRNAdmin(admin.ModelAdmin):
    list_display = ('grn_number', 'vendor', 'purchase_order', 'received_date', 'status', 'invoice_number')
    list_filter = ('status', 'received_date')
    search_fields = ('grn_number', 'vendor__name', 'invoice_number')
    inlines = [GRNItemInline]


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('item_code', 'name', 'category', 'available_stock', 'used_stock', 'unit', 'unit_price', 'reorder_level', 'location')
    search_fields = ('item_code', 'name', 'category')
    list_filter = ('category', 'unit', 'is_active')


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ('item', 'transaction_type', 'quantity', 'previous_available', 'new_available', 'reference_number', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('item__name', 'reference_number')
