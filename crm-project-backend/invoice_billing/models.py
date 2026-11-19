from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
import math

User = get_user_model()


def number_to_indian_words(num):
    """Converts a number to Indian currency words format (e.g. Fifteen Thousand Nine Hundred and Thirty One Rupees only)"""
    try:
        num = float(num)
    except (ValueError, TypeError):
        return ""

    if num == 0:
        return "Zero Rupees only"

    units = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ]
    tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ]

    def two_digits(n):
        if n < 20:
            return units[n]
        div, rem = divmod(n, 10)
        return tens[div] + (" " + units[rem] if rem > 0 else "")

    def three_digits(n):
        div, rem = divmod(n, 100)
        res = ""
        if div > 0:
            res += units[div] + " Hundred"
            if rem > 0:
                res += " and " + two_digits(rem)
        else:
            res += two_digits(rem)
        return res.strip()

    integer_part = int(math.floor(num))
    paisa_part = int(round((num - integer_part) * 100))

    parts = []
    # Crores
    crores, rem = divmod(integer_part, 10000000)
    if crores > 0:
        parts.append(two_digits(crores) + " Crore")

    # Lakhs
    lakhs, rem = divmod(rem, 100000)
    if lakhs > 0:
        parts.append(two_digits(lakhs) + " Lakh")

    # Thousands
    thousands, rem = divmod(rem, 1000)
    if thousands > 0:
        parts.append(two_digits(thousands) + " Thousand")

    # Hundreds & remainder
    if rem > 0:
        parts.append(three_digits(rem))

    words = " ".join(parts).strip()
    result = f"{words} Rupees" if words else "Zero Rupees"

    if paisa_part > 0:
        result += f" and {two_digits(paisa_part)} Paise"

    return result + " only"


class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = [
        ('PROJECT', 'Project'),
        ('AMC', 'AMC Contract'),
        ('SERVICE', 'Service / Repair'),
        ('DIRECT', 'Direct / Other'),
    ]

    STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('UNPAID', 'Unpaid'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Invoice Identifier & Timing
    invoice_number = models.CharField(max_length=50, unique=True, verbose_name="Invoice Number")
    invoice_date = models.DateField(default=timezone.now, verbose_name="Invoice Date")
    invoice_time = models.CharField(max_length=20, default="11:00 AM", blank=True, verbose_name="Invoice Time")
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPE_CHOICES, default='DIRECT', verbose_name="Invoice Type")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PAID', verbose_name="Status")

    # Relations
    project = models.ForeignKey(
        'lead_management.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked Project"
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked AMC Contract"
    )
    service = models.ForeignKey(
        'amc.AMCService', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked Service"
    )
    customer = models.ForeignKey(
        'lead_management.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Customer"
    )
    billing_detail = models.ForeignKey(
        'quotation.BillingDetail', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Selected Company Bank"
    )

    # Fixed DS Aqua Company Header (default values)
    company_name = models.CharField(max_length=255, default="D S WATER TECH PVT LTD", verbose_name="Company Name")
    company_address = models.TextField(
        default="GROUND FLOOR BELHEKAR COMPLEX SR. NO. 156/5A, OFFICE NO. 1 MANJARI BUDRUK Pune",
        verbose_name="Company Address"
    )
    company_phone = models.CharField(max_length=50, default="+919881653030", verbose_name="Company Phone")
    company_email = models.CharField(max_length=100, default="dswatertech1@gmail.com", verbose_name="Company Email")
    company_gstin = models.CharField(max_length=50, default="27AALCD8065C1ZJ", verbose_name="Company GSTIN")
    company_state = models.CharField(max_length=50, default="27-Maharashtra", verbose_name="Company State")

    # Bill To
    bill_to_name = models.CharField(max_length=255, verbose_name="Bill To Name / Company")
    bill_to_address = models.TextField(blank=True, default='', verbose_name="Billing Address")
    bill_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Contact Number")
    bill_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer GSTIN")
    bill_to_state = models.CharField(max_length=100, default='27-Maharashtra', blank=True, verbose_name="Billing State")

    # Ship To
    ship_to_name = models.CharField(max_length=255, blank=True, default='', verbose_name="Ship To Name")
    ship_to_address = models.TextField(blank=True, default='', verbose_name="Shipping Address")
    ship_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping Contact")
    ship_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping GSTIN")
    ship_to_state = models.CharField(max_length=100, default='27-Maharashtra', blank=True, verbose_name="Shipping State")

    # Place of supply & PO
    place_of_supply = models.CharField(max_length=100, default='27-Maharashtra', verbose_name="Place of Supply")
    po_number = models.CharField(max_length=100, blank=True, default='', verbose_name="PO Number")
    po_date = models.DateField(null=True, blank=True, verbose_name="PO Date")

    # Pay To (Banking Information Snapshot)
    bank_name = models.CharField(max_length=255, default='Icici Bank Limited, S. P. Pune', blank=True, verbose_name="Bank Name")
    bank_account_no = models.CharField(max_length=50, default='645105006800', blank=True, verbose_name="Account Number")
    bank_ifsc = models.CharField(max_length=30, default='ICIC0006451', blank=True, verbose_name="IFSC Code")
    account_holder_name = models.CharField(max_length=255, default='D S WATER TECH PVT LTD', blank=True, verbose_name="Account Holder Name")

    # Financial Summary
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Sub Total")
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Total")
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="CGST Total")
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="SGST Total")
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Total")
    round_off = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'), verbose_name="Round Off")
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Grand Total")
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Received Amount")
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Balance Amount")
    you_saved = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="You Saved")
    payment_mode = models.CharField(max_length=100, default='ICICI BANK', blank=True, verbose_name="Payment Mode")
    previous_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Previous Balance")
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Current Balance")

    amount_in_words = models.CharField(max_length=500, blank=True, default='', verbose_name="Amount in Words")
    terms_conditions = models.TextField(default="Thank you for doing business with us.", blank=True, verbose_name="Terms & Conditions")
    notes = models.TextField(blank=True, default='', verbose_name="Internal Notes")

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']
        verbose_name = "Tax Invoice"
        verbose_name_plural = "Tax Invoices"

    def __str__(self):
        return f"{self.invoice_number} - {self.bill_to_name} (₹{self.grand_total})"

    def save(self, *args, **kwargs):
        # Auto-compute amount in words if not provided or total changed
        if self.grand_total is not None and not self.amount_in_words:
            self.amount_in_words = number_to_indian_words(self.grand_total)
        # Compute balance amount
        if self.grand_total is not None and self.received_amount is not None:
            self.balance_amount = max(Decimal('0.00'), self.grand_total - self.received_amount)
        super().save(*args, **kwargs)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=255, verbose_name="Item Name / Description")
    hsn_sac = models.CharField(max_length=50, default='8421', blank=True, verbose_name="HSN/SAC Code")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'), verbose_name="Quantity")
    unit = models.CharField(max_length=30, default='Nos', blank=True, verbose_name="Unit")
    price_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Price / Unit")
    discount_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount %")
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Amount")
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")

    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'), verbose_name="GST Rate %")
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="GST Amount")
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('9.00'), verbose_name="CGST Rate %")
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="CGST Amount")
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('9.00'), verbose_name="SGST Rate %")
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="SGST Amount")
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Rate %")
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Amount")

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = "Invoice Line Item"
        verbose_name_plural = "Invoice Line Items"

    def __str__(self):
        return f"{self.item_name} ({self.quantity} {self.unit}) - ₹{self.total_amount}"
