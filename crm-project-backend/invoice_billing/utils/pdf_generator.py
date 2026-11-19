import os
import base64
import logging
from decimal import Decimal
from django.conf import settings
from django.template.loader import render_to_string

try:
    from weasyprint import HTML
except Exception:
    HTML = None

logger = logging.getLogger(__name__)


def amount_to_indian_words(num_val):
    """Convert a numeric amount into standard Indian currency words (Title Cased)."""
    try:
        val = int(round(float(num_val or 0)))
        if val <= 0:
            return "Zero Rupees only"
        try:
            import num2words
            raw = num2words.num2words(val, lang='en_IN')
            # Clean up commas and ensure proper casing
            clean = raw.replace(',', '').replace('-', ' ')
            words = ' '.join(w.capitalize() for w in clean.split())
            return f"{words} Rupees only"
        except Exception:
            pass
    except Exception:
        pass
    return f"{num_val} Rupees only"


def build_invoice_pdf_context(invoice):
    """Build context for rendering invoice.html template"""
    items_qs = invoice.items.all()
    items_list = []
    total_quantity = Decimal('0')
    total_discount = Decimal('0')
    total_gst = Decimal('0')
    total_line_amount = Decimal('0')

    for it in items_qs:
        qty = Decimal(str(getattr(it, 'quantity', 0) or 0))
        rate = Decimal(str(getattr(it, 'price_per_unit', 0) or 0))
        gross = qty * rate
        disc = Decimal(str(getattr(it, 'discount_amount', 0) or 0))
        disc_pct = Decimal(str(getattr(it, 'discount_percent', 0) or 0))
        if disc == 0 and disc_pct > 0:
            disc = (gross * disc_pct) / Decimal('100')

        taxable = max(Decimal('0'), gross - disc)
        gst_pct = Decimal(str(getattr(it, 'gst_rate', None) or getattr(it, 'gst_percent', None) or 18))
        gst_amt = Decimal(str(getattr(it, 'gst_amount', 0) or 0))
        if gst_amt == 0 and gst_pct > 0:
            gst_amt = (taxable * gst_pct) / Decimal('100')
        line_total = Decimal(str(getattr(it, 'total_amount', None) or (taxable + gst_amt)))

        total_quantity += qty
        total_discount += disc
        total_gst += gst_amt
        total_line_amount += line_total

        items_list.append({
            'item_name': getattr(it, 'item_name', ''),
            'description': getattr(it, 'description', '') if hasattr(it, 'description') else '',
            'hsn_sac': getattr(it, 'hsn_sac', '8421') or '8421',
            'quantity': qty,
            'unit': getattr(it, 'unit', 'Nos') or 'Nos',
            'price_per_unit': rate,
            'discount_amount': disc,
            'discount_percent': disc_pct,
            'gst_percent': gst_pct,
            'gst_amount': gst_amt,
            'total_amount': line_total,
        })

    # Normalized fields for templates
    bank_name = getattr(invoice, 'bank_name', None) or 'Icici Bank Limited, S. P. Pune'
    bank_account_no = getattr(invoice, 'bank_account_no', None) or '645105006800'
    bank_ifsc = getattr(invoice, 'bank_ifsc', None) or getattr(invoice, 'bank_ifsc_code', None) or 'ICIC0006451'
    account_holder = getattr(invoice, 'account_holder_name', None) or getattr(invoice, 'bank_account_holder', None) or 'D S WATER TECH PVT LTD'
    sub_total = getattr(invoice, 'sub_total', None) or getattr(invoice, 'subtotal', Decimal('0.00'))
    terms_conditions = getattr(invoice, 'terms_conditions', None) or getattr(invoice, 'terms_and_conditions', None) or 'Thank you for doing business with us.'

    # Amount in words
    amount_in_words = amount_to_indian_words(invoice.grand_total)

    # Payment Mode display
    payment_mode_raw = getattr(invoice, 'payment_mode', None) or 'ICICI BANK'
    po_num = getattr(invoice, 'po_number', None)
    if po_num and f"({po_num})" not in payment_mode_raw:
        payment_mode_display = f"{payment_mode_raw}({po_num})"
    else:
        payment_mode_display = payment_mode_raw

    # Logo base64
    logo_base64 = ""
    candidate_logo_paths = [
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.jpg'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'dummy-logo.png'),
    ]

    for lpath in candidate_logo_paths:
        if os.path.exists(lpath):
            try:
                with open(lpath, 'rb') as lf:
                    ldata = lf.read()
                    lfmt = 'png' if lpath.lower().endswith('.png') else 'jpeg'
                    logo_base64 = f"data:image/{lfmt};base64," + base64.b64encode(ldata).decode('utf-8')
                    break
            except Exception as e:
                logger.error(f"Error reading logo file {lpath}: {e}")

    # Signature base64
    signature_base64 = ""
    candidate_sig_paths = [
        r"S:\installers\Downloads\aksn sign.png",
        os.path.join(settings.BASE_DIR, 'static', 'images', 'aksn-sign.png'),
        r"S:\installers\Downloads\aksn-sign.png",
    ]
    for spath in candidate_sig_paths:
        if os.path.exists(spath):
            try:
                with open(spath, 'rb') as sf:
                    sdata = sf.read()
                    signature_base64 = "data:image/png;base64," + base64.b64encode(sdata).decode('utf-8')
                    break
            except Exception as err:
                logger.error(f"Error encoding signature from {spath}: {err}")

    return {
        'invoice': invoice,
        'items_list': items_list,
        'total_quantity': total_quantity,
        'total_discount': total_discount,
        'total_gst': total_gst,
        'total_line_amount': total_line_amount,
        'amount_in_words': amount_in_words,
        'payment_mode_display': payment_mode_display,
        'logo_base64': logo_base64,
        'signature_base64': signature_base64,
        'bank_name': bank_name,
        'bank_account_no': bank_account_no,
        'bank_ifsc': bank_ifsc,
        'account_holder': account_holder,
        'sub_total': sub_total,
        'terms_conditions': terms_conditions,
    }


def render_invoice_html(invoice):
    """Render HTML string for invoice.html"""
    context = build_invoice_pdf_context(invoice)
    return render_to_string('pdf/invoice.html', context)


def generate_invoice_pdf(invoice):
    """Generate invoice PDF bytes using WeasyPrint"""
    context = build_invoice_pdf_context(invoice)
    html_string = render_to_string('pdf/invoice.html', context)

    if HTML is None:
        raise RuntimeError("WeasyPrint is not installed or unavailable on this system.")

    from weasyprint import default_url_fetcher
    def safe_url_fetcher(url, *args, **kwargs):
        if url.startswith('data:'):
            return default_url_fetcher(url, *args, **kwargs)
        return {'string': b'', 'mime_type': 'text/plain'}

    pdf = HTML(
        string=html_string,
        url_fetcher=safe_url_fetcher
    ).write_pdf()

    return pdf
