import logging
import re
from decimal import Decimal
from django.db.models import Sum, Count, Q
from django.http import HttpResponse, Http404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Invoice, InvoiceItem
from .serializers import InvoiceSerializer, InvoiceItemSerializer
from .utils.pdf_generator import generate_invoice_pdf, render_invoice_html

logger = logging.getLogger(__name__)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().prefetch_related('items').select_related(
        'project', 'amc_contract', 'service', 'customer', 'billing_detail'
    ).order_by('-id')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'invoice_number',
        'bill_to_name',
        'bill_to_contact',
        'bill_to_gstin',
        'po_number',
        'project__project_code',
        'amc_contract__contract_id',
    ]

    def get_queryset(self):
        qs = super().get_queryset()

        # Type filter
        invoice_type = self.request.query_params.get('invoice_type')
        if invoice_type and invoice_type.upper() != 'ALL':
            qs = qs.filter(invoice_type=invoice_type.upper())

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        # Project filter
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        # AMC Contract filter
        amc_id = self.request.query_params.get('amc_contract')
        if amc_id:
            qs = qs.filter(amc_contract_id=amc_id)

        # Service filter
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(invoice_date__gte=start_date)
        if end_date:
            qs = qs.filter(invoice_date__lte=end_date)

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Returns KPI metrics for invoices"""
        total_invoices = Invoice.objects.count()
        aggregates = Invoice.objects.aggregate(
            total_billed=Sum('grand_total'),
            total_received=Sum('received_amount'),
            total_balance=Sum('balance_amount'),
        )

        paid_count = Invoice.objects.filter(status='PAID').count()
        unpaid_count = Invoice.objects.filter(status='UNPAID').count()
        partially_paid_count = Invoice.objects.filter(status='PARTIALLY_PAID').count()

        project_invoices_count = Invoice.objects.filter(invoice_type='PROJECT').count()
        amc_invoices_count = Invoice.objects.filter(invoice_type='AMC').count()
        service_invoices_count = Invoice.objects.filter(invoice_type='SERVICE').count()

        return Response({
            'total_invoices': total_invoices,
            'total_billed': float(aggregates['total_billed'] or 0),
            'total_received': float(aggregates['total_received'] or 0),
            'total_balance': float(aggregates['total_balance'] or 0),
            'paid_count': paid_count,
            'unpaid_count': unpaid_count,
            'partially_paid_count': partially_paid_count,
            'project_invoices_count': project_invoices_count,
            'amc_invoices_count': amc_invoices_count,
            'service_invoices_count': service_invoices_count,
        })

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_invoice_number(self, request):
        """Generates the next sequential invoice number (e.g. 13, 14, ...)"""
        invoices = Invoice.objects.values_list('invoice_number', flat=True)
        max_num = 0
        for num_str in invoices:
            # Extract digits
            match = re.search(r'(\d+)', str(num_str))
            if match:
                val = int(match.group(1))
                if val > max_num:
                    max_num = val

        next_val = max(13, max_num + 1)
        return Response({
            'next_number': str(next_val),
            'formatted': f"{next_val}"
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Generate and stream Tax Invoice PDF (or HTML if format=html or fallback)"""
        try:
            invoice = self.get_object()
        except Http404:
            return HttpResponse("Invoice not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching invoice {pk}: {e}")
            return HttpResponse(f"Error retrieving invoice: {e}", status=500)

        format_param = request.query_params.get('format', '').lower()

        if format_param == 'html':
            try:
                html_content = render_invoice_html(invoice)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as e:
                logger.exception(f"Error rendering HTML invoice {pk}: {e}")
                return HttpResponse(f"Error rendering HTML invoice: {e}", status=500)

        try:
            pdf_bytes = generate_invoice_pdf(invoice)
            disposition = request.query_params.get('disposition', 'inline')
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"Tax_Invoice_{invoice.invoice_number}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            return response
        except Exception as e:
            logger.warning(f"WeasyPrint PDF generation failed ({e}), falling back to HTML invoice view")
            try:
                html_content = render_invoice_html(invoice)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as html_err:
                logger.exception(f"Error rendering fallback HTML invoice {pk}: {html_err}")
                return HttpResponse(f"Error generating invoice view: {html_err}", status=500)

    @action(detail=True, methods=['get'], url_path='html')
    def html(self, request, pk=None):
        """Render standalone HTML invoice page"""
        try:
            invoice = self.get_object()
        except Http404:
            return HttpResponse("Invoice not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching invoice {pk}: {e}")
            return HttpResponse(f"Error retrieving invoice: {e}", status=500)

        try:
            html_content = render_invoice_html(invoice)
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.exception(f"Error rendering HTML invoice {pk}: {e}")
            return HttpResponse(f"Error rendering HTML invoice: {e}", status=500)
