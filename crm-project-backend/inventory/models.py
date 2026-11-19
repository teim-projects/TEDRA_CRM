from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal

User = get_user_model()


class Vendor(models.Model):
    """Vendor / Supplier Model"""
    vendor_code = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Vendor Code")
    name = models.CharField(max_length=255, verbose_name="Vendor Name")
    contact_person = models.CharField(max_length=200, blank=True, null=True, verbose_name="Contact Person")
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Contact Phone")
    email = models.EmailField(blank=True, null=True, verbose_name="Email Address")
    address = models.TextField(blank=True, null=True, verbose_name="Address")
    city = models.CharField(max_length=100, blank=True, null=True, verbose_name="City")
    state = models.CharField(max_length=100, blank=True, null=True, verbose_name="State")
    pincode = models.CharField(max_length=20, blank=True, null=True, verbose_name="Pincode")
    gst_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="GST Number")
    pan_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="PAN Number")
    payment_terms = models.CharField(max_length=100, blank=True, null=True, verbose_name="Payment Terms")
    bank_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="Bank Name")
    account_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="Account Number")
    ifsc_code = models.CharField(max_length=20, blank=True, null=True, verbose_name="IFSC Code")
    notes = models.TextField(blank=True, null=True, verbose_name="Notes")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.vendor_code or not str(self.vendor_code).strip():
            count = Vendor.objects.count() + 1
            self.vendor_code = f"VND-{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vendor_code} - {self.name}"

    class Meta:
        ordering = ['name']
        verbose_name = "Vendor"
        verbose_name_plural = "Vendors"


class InventoryItem(models.Model):
    """Inventory Item / Spare / Raw Material Model"""
    UNIT_CHOICES = [
        ('Pcs', 'Pieces (Pcs)'),
        ('Nos', 'Numbers (Nos)'),
        ('Kg', 'Kilograms (Kg)'),
        ('Liters', 'Liters (Ltr)'),
        ('Meters', 'Meters (Mtr)'),
        ('Sets', 'Sets (Set)'),
        ('Rolls', 'Rolls (Roll)'),
        ('Boxes', 'Boxes (Box)'),
        ('Bags', 'Bags (Bag)'),
        ('Packets', 'Packets (Pkt)'),
    ]

    item_code = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Item Code / SKU")
    name = models.CharField(max_length=255, verbose_name="Item Name")
    product = models.ForeignKey(
        'product_management.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
        verbose_name="Linked Catalog Product"
    )
    category = models.CharField(max_length=100, blank=True, null=True, default="General", verbose_name="Category")
    capacity = models.CharField(max_length=100, blank=True, null=True, verbose_name="Capacity")
    unit = models.CharField(max_length=50, choices=UNIT_CHOICES, default='Pcs', verbose_name="Unit of Measurement")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), blank=True, validators=[MinValueValidator(0)], verbose_name="Unit Price (Rs)")
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('5.00'), verbose_name="Reorder Level")
    available_stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Available Stock")
    used_stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Used / Consumed Stock")
    returned_stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Returned Stock")
    location = models.CharField(max_length=100, blank=True, null=True, default="", verbose_name="Storage Location / Rack")
    hsn_sac_code = models.CharField(max_length=50, blank=True, null=True, verbose_name="HSN / SAC Code")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.item_code or not str(self.item_code).strip():
            count = InventoryItem.objects.count() + 1
            self.item_code = f"INV-{count:04d}"
        super().save(*args, **kwargs)

    @property
    def total_stock(self):
        return (self.available_stock or Decimal('0.00')) + (self.used_stock or Decimal('0.00'))

    @property
    def stock_status(self):
        if (self.available_stock or 0) <= 0:
            return "OUT_OF_STOCK"
        elif (self.available_stock or 0) <= (self.reorder_level or 0):
            return "LOW_STOCK"
        return "IN_STOCK"

    @property
    def stock_value(self):
        return (self.available_stock or Decimal('0.00')) * (self.unit_price or Decimal('0.00'))

    def __str__(self):
        return f"{self.item_code} - {self.name} ({self.available_stock} {self.unit} available)"

    class Meta:
        ordering = ['name']
        verbose_name = "Inventory Item"
        verbose_name_plural = "Inventory Items"


class PurchaseOrder(models.Model):
    """Purchase Order Model"""
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ORDERED', 'Ordered / Sent'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('RECEIVED', 'Fully Received'),
        ('CANCELLED', 'Cancelled'),
    ]

    po_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="PO Number")
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='purchase_orders', verbose_name="Vendor")
    order_date = models.DateField(default=timezone.now, verbose_name="Order Date")
    expected_delivery_date = models.DateField(blank=True, null=True, verbose_name="Expected Delivery Date")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT', verbose_name="Status")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Subtotal")
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Tax Amount")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    shipping_address = models.TextField(blank=True, null=True, verbose_name="Shipping / Delivery Address")
    terms_and_conditions = models.TextField(blank=True, null=True, verbose_name="Terms & Conditions")
    notes = models.TextField(blank=True, null=True, verbose_name="Notes")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_pos')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.po_number or not str(self.po_number).strip():
            year = timezone.now().year
            count = PurchaseOrder.objects.filter(created_at__year=year).count() + 1
            self.po_number = f"PO-{year}-{count:04d}"
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        items = self.items.all()
        sub = sum((i.total_price or Decimal('0.00')) for i in items)
        self.subtotal = sub
        # Standard 18% tax calculation if not explicit
        self.tax_amount = (sub * Decimal('0.18')).quantize(Decimal('0.01'))
        self.total_amount = self.subtotal + self.tax_amount
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

    def __str__(self):
        return f"{self.po_number} - {self.vendor.name} (Rs {self.total_amount})"

    class Meta:
        ordering = ['-order_date', '-created_at']
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Orders"


class PurchaseOrderItem(models.Model):
    """Line Item in Purchase Order"""
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='po_items', verbose_name="Inventory Item")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))], verbose_name="Ordered Quantity")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Unit Price")
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'), verbose_name="Tax %")
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    received_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="Received Quantity")

    def save(self, *args, **kwargs):
        self.total_price = (self.quantity or Decimal('0')) * (self.unit_price or Decimal('0'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item.name} x {self.quantity} in {self.purchase_order.po_number}"


class GRN(models.Model):
    """Goods Receipt Note Model"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending Inspection'),
        ('ACCEPTED', 'Accepted & Stock Updated'),
        ('PARTIALLY_ACCEPTED', 'Partially Accepted'),
        ('REJECTED', 'Rejected'),
        ('COMPLETED', 'Completed & Inward Verified'),
    ]

    grn_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="GRN Number")
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='grns', verbose_name="Linked PO")
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='grns', verbose_name="Vendor")
    received_date = models.DateField(default=timezone.now, verbose_name="Received Date")
    invoice_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="Invoice / Bill No")
    challan_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="Delivery Challan No")
    challan_date = models.DateField(blank=True, null=True, verbose_name="Challan / Invoice Date")
    received_by = models.CharField(max_length=100, blank=True, null=True, verbose_name="Received By Person")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='ACCEPTED', verbose_name="Status")
    notes = models.TextField(blank=True, null=True, verbose_name="Remarks / Inspection Notes")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_grns')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.grn_number or not str(self.grn_number).strip():
            year = timezone.now().year
            count = GRN.objects.filter(created_at__year=year).count() + 1
            self.grn_number = f"GRN-{year}-{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.grn_number} - {self.vendor.name} ({self.received_date})"

    class Meta:
        ordering = ['-received_date', '-created_at']
        verbose_name = "Goods Receipt Note"
        verbose_name_plural = "Goods Receipt Notes"


class GRNItem(models.Model):
    """Line Item in Goods Receipt Note"""
    grn = models.ForeignKey(GRN, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='grn_items', verbose_name="Inventory Item")
    po_item = models.ForeignKey(PurchaseOrderItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='grn_receipts')
    ordered_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="PO Ordered Qty")
    received_quantity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Received Qty")
    accepted_quantity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Accepted Qty")
    rejected_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="Rejected Qty")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Unit Price")
    remarks = models.CharField(max_length=255, blank=True, null=True, verbose_name="Remarks / Reason for Rejection")

    def __str__(self):
        return f"{self.item.name} (Accepted: {self.accepted_quantity}) in {self.grn.grn_number}"


class StockTransaction(models.Model):
    """Complete Audit Trail for all Stock Movements"""
    TRANSACTION_TYPES = [
        ('ADD_STOCK', 'Stock Inward (Manual)'),
        ('GRN', 'GRN Inward'),
        ('ISSUE_STOCK', 'Stock Issued to Technician'),
        ('USED_STOCK', 'Stock Used / Consumed'),
        ('RETURN_STOCK', 'Stock Return'),
        ('ADJUSTMENT', 'Audit Adjustment'),
    ]

    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('COMPLETED', 'Completed'),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='transactions', verbose_name="Inventory Item")
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES, verbose_name="Transaction Type")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='COMPLETED', verbose_name="Status")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Quantity")
    previous_available = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Previous Stock")
    new_available = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="New Stock")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Unit Price")
    reference_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="Reference No (PO/GRN/Service/Invoice)")
    notes = models.TextField(blank=True, null=True, verbose_name="Notes / Reason")
    technician = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_stock_transactions', verbose_name="Issued To Technician")
    service = models.ForeignKey('amc.AMCService', on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_inventory', verbose_name="Linked Service")
    visit = models.ForeignKey('amc.AMCVisit', on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_inventory', verbose_name="Linked AMC Visit")
    project = models.ForeignKey('lead_management.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_inventory', verbose_name="Linked Project")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_transactions')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_stock_returns', verbose_name="Approved By")
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name="Approved At")
    rejection_reason = models.TextField(blank=True, null=True, verbose_name="Rejection Reason")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.item.name} - {self.get_transaction_type_display()} ({self.quantity} {self.item.unit}) at {self.created_at.strftime('%Y-%m-%d %H:%M')}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Stock Transaction"
        verbose_name_plural = "Stock Transactions"
