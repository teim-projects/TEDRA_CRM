# quotation/utils/pdf_generator.py
from django.template.loader import render_to_string
from decimal import Decimal
from django.conf import settings
import logging

try:
    from weasyprint import HTML
except Exception:  # pragma: no cover
    HTML = None

logger = logging.getLogger(__name__)


def get_user_display_name(user_obj):
    if not user_obj:
        return "-"
    first_name = (getattr(user_obj, 'first_name', '') or '').strip()
    name = first_name or getattr(user_obj, 'username', '') or getattr(user_obj, 'email', '') or "-"
    mobile = getattr(user_obj, 'mobile_no', '') or getattr(user_obj, 'mobile_number', '') or getattr(user_obj, 'phone', '')
    if mobile:
        return f"{name} ({mobile})"
    return name


import re


def parse_description_bullets(text):
    if not text or not str(text).strip():
        return []
    raw = str(text).strip()
    parts = raw.split('.')
    bullets = []
    for p in parts:
        cleaned = ' '.join(p.split())
        if cleaned:
            bullets.append(cleaned + '.')
    if not raw.endswith('.') and bullets:
        bullets[-1] = bullets[-1].rstrip('.')
    return bullets


def parse_term_bullets(text):
    """
    Parse terms and condition description into bullet points split by full stop
    or newline, preserving numbers like 18.5% and stripping redundant leading bullet characters.
    """
    if not text or not str(text).strip():
        return []
    raw = str(text).strip()
    parts = re.split(r'(?<!\d)\.(?!\d)|[\n\r]+', raw)
    bullets = []
    for p in parts:
        cleaned = ' '.join(p.split()).strip()
        # Strip leading bullet symbols if user already typed them
        cleaned = re.sub(r'^[•\-\*\u2022\u2023\u25E6\u2043\u2219]\s*', '', cleaned).strip()
        if cleaned:
            if not cleaned.endswith(('.', ':', ';', '!', '?')):
                cleaned += '.'
            bullets.append(cleaned)
    return bullets


def _build_quotation_pdf_context(quotation, version):
    items = list(version.items.all())
    
    formatted_items = []
    total_quantity = Decimal('0')
    subtotal = Decimal('0')
    gst_total = Decimal('0')
    total_extra_discount = Decimal('0')
    has_extra_discount = False

    for idx, item in enumerate(items, 1):
        qty = Decimal(str(item.quantity or 0))
        rate = Decimal(str(item.unit_price or 0))
        base = Decimal(str(item.base_amount or (qty * rate)))
        gst_amt = Decimal(str(item.gst_amount or 0))
        if not gst_amt and getattr(item, 'gst_percentage', None):
            gst_amt = (base * Decimal(str(item.gst_percentage))) / Decimal('100')
        
        gross_total = base + gst_amt
        extra_disc = Decimal(str(getattr(item, 'extra_discount', 0) or 0))
        extra_disc_amt = Decimal(str(getattr(item, 'extra_discount_amount', 0) or 0))
        if extra_disc > Decimal('0'):
            has_extra_discount = True
            if not extra_disc_amt:
                extra_disc_amt = (gross_total * extra_disc) / Decimal('100')
        else:
            extra_disc_amt = Decimal('0')

        total_item = gross_total - extra_disc_amt
        if getattr(item, 'total_with_gst', None) and not extra_disc:
            total_item = Decimal(str(item.total_with_gst))

        total_quantity += qty
        subtotal += base
        gst_total += gst_amt
        total_extra_discount += extra_disc_amt

        item_desc = (item.description or '').strip()
        if not item_desc and item.product_id:
            try:
                from product_management.models import Product
                prod = Product.objects.filter(id=item.product_id).first()
                if prod and prod.description:
                    item_desc = prod.description.strip()
            except Exception:
                pass

        description_bullets = parse_description_bullets(item_desc)

        formatted_items.append({
            'sr': idx,
            'product_name': item.product_name,
            'product_code': item.product_code or '',
            'hsn_sac_code': item.hsn_sac_code or '',
            'description': item_desc,
            'description_bullets': description_bullets,
            'quantity': qty,
            'unit': item.unit or 'NOS',
            'unit_price': rate,
            'gst_percentage': item.gst_percentage,
            'extra_discount': extra_disc,
            'extra_discount_amount': extra_disc_amt,
            'base_amount': base,
            'gst_amount': gst_amt,
            'total_with_gst': total_item,
        })

    gst_amount = version.gst_amount or gst_total
    subtotal = version.subtotal or subtotal
    grand_total = version.grand_total or ((subtotal + gst_amount) - total_extra_discount)

    if subtotal and gst_amount:
        gst_percentage = (gst_amount / subtotal) * Decimal('100')
    else:
        gst_percentage = Decimal('18')

    # Selected Terms & Conditions (dynamically synchronized with active database master)
    raw_terms = version.terms_and_conditions or quotation.terms_and_conditions or []
    from quotation.serializers import filter_active_terms
    active_terms_list = filter_active_terms(raw_terms)

    # Master terms map to ensure latest master description and name are used (for both old and new quotations)
    from quotation.models import TermsConditions
    master_terms_by_id = {t.id: t for t in TermsConditions.objects.filter(is_active=True, category__is_active=True).select_related('category')}
    master_terms_by_name = {t.name.strip().lower(): t for t in master_terms_by_id.values()}

    formatted_terms = []
    for term in active_terms_list:
        if not isinstance(term, dict):
            continue
        term_id = term.get('id')
        term_name = (term.get('name') or '').strip()

        master_obj = None
        if term_id is not None:
            try:
                master_obj = master_terms_by_id.get(int(term_id))
            except (ValueError, TypeError):
                pass
        if not master_obj and term_name:
            master_obj = master_terms_by_name.get(term_name.lower())

        if master_obj:
            display_name = master_obj.name
            term_desc = master_obj.description if master_obj.description else (term.get('description') or '')
            category_name = master_obj.category.name if master_obj.category else term.get('category_name', '')
        else:
            display_name = term_name
            term_desc = term.get('description') or ''
            category_name = term.get('category_name', '')

        term_desc = term_desc.strip()
        bullets = parse_term_bullets(term_desc)
        formatted_terms.append({
            'id': term.get('id'),
            'name': display_name,
            'category_name': category_name,
            'description': term_desc,
            'bullets': bullets,
        })

    # Lead Fallbacks for Client Information
    lead = quotation.lead
    company_name = quotation.company_name or (lead.company_name if lead else '-')
    contact_person = quotation.contact_person or (lead.contact_person if lead else '-')
    mobile_number = quotation.mobile_number or (lead.mobile_number if lead else '-')
    email_address = quotation.email_address or (lead.email_address if lead else '-')
    address = quotation.address or (lead.address if lead else '')
    city = quotation.city or (lead.city if lead else '')
    state = quotation.state or (lead.state if lead else '')
    gst_number = quotation.gst_number or (lead.gst_number if lead else '')

    # Assigned Executive from Lead (First Name, Number)
    assigned_executive_str = "-"
    if lead and getattr(lead, 'assigned_executive', None):
        exec_obj = lead.assigned_executive
        assigned_executive_str = get_user_display_name(exec_obj)
    elif getattr(quotation, 'created_by', None):
        c_user = quotation.created_by
        assigned_executive_str = get_user_display_name(c_user)

    # Encode logo base64 (Checking DS Aqua branding logo first, then fallbacks)
    import os, base64
    logo_base64 = ""
    candidate_logo_paths = [
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.jpg'),
        r"S:\installers\Downloads\D_S_Logo.png",
        os.path.join(settings.BASE_DIR, 'static', 'images', 'dummy-logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'logo.png'),
    ]

    for lpath in candidate_logo_paths:
        if os.path.exists(lpath):
            try:
                with open(lpath, 'rb') as lf:
                    ldata = lf.read()
                    lfmt = 'png' if lpath.lower().endswith('.png') else ('jpeg' if lpath.lower().endswith(('.jpg', '.jpeg')) else 'png')
                    logo_base64 = f"data:image/{lfmt};base64," + base64.b64encode(ldata).decode('utf-8')
                    break
            except Exception as err:
                logger.error(f"Error encoding logo from {lpath}: {err}")

    # Encode signature base64 (Checking local static and user downloads folder)
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

    # Billing / Bank details (Quotation specific or default primary master from Billing app)
    from quotation.models import BillingDetail
    billing_detail = getattr(quotation, 'billing_detail', None)
    if not billing_detail:
        billing_detail = BillingDetail.objects.filter(is_active=True, is_default=True).first()
    if not billing_detail:
        billing_detail = BillingDetail.objects.filter(is_active=True).first()
    if not billing_detail:
        billing_detail = BillingDetail.objects.filter(is_default=True).first()
    if not billing_detail:
        billing_detail = BillingDetail.objects.first()

    # Fallback dictionary if no billing records exist in database
    if not billing_detail:
        billing_detail = {
            'bank_name': 'ICICI Bank Limited',
            'branch_name': 'S.P Pune',
            'account_number': '645105006800',
            'ifsc_code': 'ICIC0006451',
            'account_holder_name': 'D S Water Tech PVT LTD',
            'contact_number': '+91 9881653030',
        }

    billing_detail_contact = '+91 9881653030'
    if isinstance(billing_detail, dict):
        billing_detail_contact = billing_detail.get('contact_number') or billing_detail_contact
    elif hasattr(billing_detail, 'notes') and billing_detail.notes:
        match_phone = re.search(r'(\+?\d[\d\s\-]{8,}\d)', billing_detail.notes)
        if match_phone:
            billing_detail_contact = match_phone.group(1).strip()

    qr_code_base64 = ""
    if hasattr(billing_detail, 'qr_code') and billing_detail.qr_code:
        try:
            qr_file_path = billing_detail.qr_code.path
            if os.path.exists(qr_file_path):
                with open(qr_file_path, 'rb') as qf:
                    qdata = qf.read()
                    qext = 'png' if qr_file_path.lower().endswith('.png') else 'jpeg'
                    qr_code_base64 = f"data:image/{qext};base64," + base64.b64encode(qdata).decode('utf-8')
        except Exception as qr_err:
            logger.error(f"Error encoding QR code for PDF: {qr_err}")

    q_date = quotation.quotation_date or (version.created_at.date() if hasattr(version.created_at, 'date') else version.created_at)

    raw_thank_you = (quotation.thank_you_note or '').strip()
    thank_you_lines = [
        re.sub(r'^[•\-\*\u2022\u2023\u25E6\u2043\u2219]\s*', '', line).strip()
        for line in re.split(r'[\r\n]+', raw_thank_you)
        if line.strip()
    ]

    gst_type = getattr(version, 'gst_type', None) or getattr(quotation, 'gst_type', 'CGST_SGST') or 'CGST_SGST'
    gst_type = str(gst_type).strip().upper()

    if gst_type == 'NO_GST':
        igst_amount = Decimal('0')
        cgst_amount = Decimal('0')
        sgst_amount = Decimal('0')
        gst_amount = Decimal('0')
        gst_percentage = Decimal('0')
    elif gst_type == 'IGST':
        igst_amount = getattr(version, 'igst_amount', None)
        if not igst_amount:
            igst_amount = gst_amount or Decimal('0')
        cgst_amount = Decimal('0')
        sgst_amount = Decimal('0')
    else:
        igst_amount = Decimal('0')
        cgst_amount = getattr(version, 'cgst_amount', None)
        sgst_amount = getattr(version, 'sgst_amount', None)
        if (not cgst_amount or cgst_amount == Decimal('0')) and (not sgst_amount or sgst_amount == Decimal('0')) and gst_amount:
            cgst_amount = gst_amount / Decimal('2')
            sgst_amount = gst_amount / Decimal('2')
        else:
            cgst_amount = cgst_amount or Decimal('0')
            sgst_amount = sgst_amount or Decimal('0')

    # Ship To Party Details
    ship_to_same = getattr(version, 'ship_to_same_as_bill_to', None)
    if ship_to_same is None:
        ship_to_same = getattr(quotation, 'ship_to_same_as_bill_to', False)

    ship_to_company = getattr(version, 'ship_to_company_name', None) or getattr(quotation, 'ship_to_company_name', '')
    ship_to_person = getattr(version, 'ship_to_contact_person', None) or getattr(quotation, 'ship_to_contact_person', '')
    ship_to_mobile = getattr(version, 'ship_to_mobile_number', None) or getattr(quotation, 'ship_to_mobile_number', '')
    ship_to_email = getattr(version, 'ship_to_email_address', None) or getattr(quotation, 'ship_to_email_address', '')
    ship_to_addr = getattr(version, 'ship_to_address', None) or getattr(quotation, 'ship_to_address', '')
    ship_to_c = getattr(version, 'ship_to_city', None) or getattr(quotation, 'ship_to_city', '')
    ship_to_s = getattr(version, 'ship_to_state', None) or getattr(quotation, 'ship_to_state', '')
    ship_to_pin = getattr(version, 'ship_to_pincode', None) or getattr(quotation, 'ship_to_pincode', '')
    ship_to_gst = getattr(version, 'ship_to_gst_number', None) or getattr(quotation, 'ship_to_gst_number', '')

    if ship_to_same or (not ship_to_addr and not ship_to_company):
        ship_to_company = ship_to_company or company_name
        ship_to_person = ship_to_person or contact_person
        ship_to_mobile = ship_to_mobile or mobile_number
        ship_to_email = ship_to_email or email_address
        ship_to_addr = ship_to_addr or address
        ship_to_c = ship_to_c or city
        ship_to_s = ship_to_s or state
        ship_to_gst = ship_to_gst or gst_number

    # Dynamic proposal custom sections
    custom_sections = getattr(version, 'custom_sections', None) or getattr(quotation, 'custom_sections', None) or []
    plant_capacity = getattr(version, 'plant_capacity', None) or getattr(quotation, 'plant_capacity', '') or 'Nominal 1,000 litres per hour, subject to feed-water conditions'
    proposal_title = getattr(version, 'proposal_title', None) or getattr(quotation, 'proposal_title', '') or quotation.subject or 'Technical & Commercial Offer'

    import datetime
    from datetime import timedelta
    validity_days = getattr(version, 'validity_days', None) or getattr(quotation, 'validity_days', None) or 8
    valid_until = getattr(version, 'valid_until', None) or getattr(quotation, 'valid_until', None)
    if not valid_until:
        base_d = q_date if isinstance(q_date, (datetime.date, datetime.datetime)) else datetime.date.today()
        valid_until = base_d + timedelta(days=int(validity_days))

    valid_until_str = valid_until.strftime('%d %b %Y') if hasattr(valid_until, 'strftime') else str(valid_until)
    validity_display = f"{validity_days} Days (Valid till {valid_until_str})"
    is_expired = False
    if hasattr(quotation, 'is_expired'):
        is_expired = quotation.is_expired

    return {
        'quotation': quotation,
        'version': version,
        'quotation_no': quotation.quotation_no,
        'version_no': version.version_no,
        'quotation_date': q_date,
        'validity_days': validity_days,
        'valid_until': valid_until,
        'validity_display': validity_display,
        'is_expired': is_expired,
        'company_name': company_name,
        'contact_person': contact_person,
        'mobile_number': mobile_number,
        'email_address': email_address,
        'address': address,
        'city': city,
        'state': state,
        'gst_number': gst_number,
        'ship_to_same_as_bill_to': ship_to_same,
        'ship_to_company_name': ship_to_company,
        'ship_to_contact_person': ship_to_person,
        'ship_to_mobile_number': ship_to_mobile,
        'ship_to_email_address': ship_to_email,
        'ship_to_address': ship_to_addr,
        'ship_to_city': ship_to_c,
        'ship_to_state': ship_to_s,
        'ship_to_pincode': ship_to_pin,
        'ship_to_gst_number': ship_to_gst,
        'custom_sections': custom_sections,
        'plant_capacity': plant_capacity,
        'proposal_title': proposal_title,
        'subject': quotation.subject or 'Quotation for Products & Services',
        'assigned_executive': assigned_executive_str,
        'thank_you_note': raw_thank_you,
        'thank_you_lines': thank_you_lines,
        'quotation_items': formatted_items,
        'terms_list': formatted_terms,
        'gst_type': gst_type,
        'subtotal': subtotal,
        'gst_amount': gst_amount,
        'igst_amount': igst_amount,
        'sgst_amount': sgst_amount,
        'cgst_amount': cgst_amount,
        'gst_percentage': gst_percentage,
        'grand_total': grand_total,
        'has_extra_discount': has_extra_discount,
        'total_extra_discount': total_extra_discount,
        'total_quantity': total_quantity,
        'logo_base64': logo_base64,
        'quotation_for': getattr(quotation, 'quotation_for', 'Pune') or 'Pune',
        'company_address': "Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune 411028 | Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Deccan, Pune 411004",
        'billing_detail': billing_detail,
        'billing_detail_contact': billing_detail_contact,
        'qr_code_base64': qr_code_base64,
        'signature_base64': signature_base64,
    }


def generate_quotation_pdf(quotation, version, base_url=None):
    """
    Generate quotation PDF using WeasyPrint with full A4 HTML template (optimized).
    """
    try:
        if HTML is None:
            raise RuntimeError(
                "WeasyPrint is unavailable on this system. Please check system libraries."
            )
        context = _build_quotation_pdf_context(quotation, version)
        html_string = render_to_string('pdf/quotation.html', context)
        
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
    except Exception as e:
        logger.error(f"Error generating quotation PDF: {str(e)}", exc_info=True)
        raise
