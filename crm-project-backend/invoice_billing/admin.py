from django.contrib import admin
from .models import Invoice, InvoiceItem


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'invoice_date', 'invoice_type', 'bill_to_name', 'grand_total', 'status']
    list_filter = ['invoice_type', 'status', 'invoice_date']
    search_fields = ['invoice_number', 'bill_to_name', 'bill_to_gstin', 'po_number']
    inlines = [InvoiceItemInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'item_name', 'hsn_sac', 'quantity', 'unit', 'price_per_unit', 'total_amount']
