from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q, F, DecimalField, ExpressionWrapper
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import Vendor, InventoryItem, PurchaseOrder, PurchaseOrderItem, GRN, GRNItem, StockTransaction
from .serializers import (
    VendorSerializer,
    InventoryItemSerializer,
    PurchaseOrderSerializer,
    GRNSerializer,
    StockTransactionSerializer
)


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('-created_at')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'vendor_code', 'contact_person', 'phone', 'email', 'gst_number', 'city']

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get('is_active')
        if active_only is not None:
            qs = qs.filter(is_active=active_only.lower() in ['true', '1'])
        return qs


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by('name')
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'item_code', 'category', 'location', 'hsn_sac_code']

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__iexact=category)

        stock_filter = self.request.query_params.get('stock_status')
        if stock_filter == 'OUT_OF_STOCK':
            qs = qs.filter(available_stock__lte=0)
        elif stock_filter == 'LOW_STOCK':
            qs = qs.filter(available_stock__gt=0, available_stock__lte=F('reorder_level'))
        elif stock_filter == 'IN_STOCK':
            qs = qs.filter(available_stock__gt=F('reorder_level'))

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Inventory Pulse Dashboard Metrics"""
        items = InventoryItem.objects.filter(is_active=True)

        total_items = items.count()
        total_available = items.aggregate(total=Sum('available_stock'))['total'] or Decimal('0.00')
        total_used = items.aggregate(total=Sum('used_stock'))['total'] or Decimal('0.00')
        total_returned = items.aggregate(total=Sum('returned_stock'))['total'] or Decimal('0.00')

        # Stock valuation
        val_expr = ExpressionWrapper(F('available_stock') * F('unit_price'), output_field=DecimalField(max_digits=14, decimal_places=2))
        total_value = items.annotate(val=val_expr).aggregate(total=Sum('val'))['total'] or Decimal('0.00')

        # Stock status counts
        low_stock_count = items.filter(available_stock__gt=0, available_stock__lte=F('reorder_level')).count()
        out_of_stock_count = items.filter(available_stock__lte=0).count()
        in_stock_count = items.filter(available_stock__gt=F('reorder_level')).count()

        # Operational metrics
        total_vendors = Vendor.objects.filter(is_active=True).count()
        pending_pos = PurchaseOrder.objects.filter(status__in=['ORDERED', 'PARTIALLY_RECEIVED', 'DRAFT']).count()
        total_pos = PurchaseOrder.objects.count()
        total_grns = GRN.objects.count()

        # Unique categories
        categories = list(items.values_list('category', flat=True).distinct())
        clean_categories = [c for c in categories if c]

        return Response({
            'total_items': total_items,
            'total_available_stock': float(total_available),
            'total_used_stock': float(total_used),
            'total_returned_stock': float(total_returned),
            'total_stock_value': float(total_value),
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'in_stock_count': in_stock_count,
            'total_vendors': total_vendors,
            'pending_pos': pending_pos,
            'total_pos': total_pos,
            'total_grns': total_grns,
            'categories': clean_categories,
        })

    @action(detail=False, methods=['post'], url_path='add-stock')
    @transaction.atomic
    def add_stock(self, request):
        """Top action: Add Stock / Manual Inward"""
        item_id = request.data.get('item_id')
        qty = request.data.get('quantity')
        unit_price = request.data.get('unit_price')
        ref_no = request.data.get('reference_number', '')
        notes = request.data.get('notes', '')

        if not item_id or not qty:
            return Response({'error': 'item_id and quantity are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = Decimal(str(qty))
            if qty <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Quantity must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        price = Decimal(str(unit_price)) if unit_price is not None and str(unit_price).strip() != '' else item.unit_price

        prev_available = item.available_stock
        new_available = prev_available + qty
        item.available_stock = new_available
        if unit_price is not None and str(unit_price).strip() != '':
            item.unit_price = price
        item.save()

        # Audit movement
        StockTransaction.objects.create(
            item=item,
            transaction_type='ADD_STOCK',
            quantity=qty,
            previous_available=prev_available,
            new_available=new_available,
            unit_price=price,
            reference_number=ref_no or 'MANUAL_INWARD',
            notes=notes or 'Manual stock added via Inventory Dashboard',
            created_by=request.user if request.user and not request.user.is_anonymous else None
        )

        return Response({
            'message': f'Successfully added {qty} {item.unit} to {item.name}.',
            'item': InventoryItemSerializer(item).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='return-stock')
    @transaction.atomic
    def return_stock(self, request):
        """Action: Return Stock from Technician / Inward from Field back to Inventory"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        issue_id = request.data.get('issue_transaction_id')
        item_id = request.data.get('item_id')
        qty = request.data.get('quantity')
        used_qty_val = request.data.get('used_quantity')
        technician_id = request.data.get('technician_id')
        service_id = request.data.get('service_id')
        visit_id = request.data.get('visit_id')
        project_id = request.data.get('project_id')
        reason = request.data.get('reason', 'Unused surplus material returned from site')
        notes = request.data.get('notes', '')

        # Parse used_quantity (if technician installed on site)
        used_qty = Decimal('0.00')
        if used_qty_val is not None and str(used_qty_val).strip() != '':
            try:
                used_qty = Decimal(str(used_qty_val))
                if used_qty < 0:
                    used_qty = Decimal('0.00')
            except (ValueError, TypeError):
                used_qty = Decimal('0.00')

        # Parse return_quantity (surplus returning to warehouse)
        return_qty = Decimal('0.00')
        if qty is not None and str(qty).strip() != '':
            try:
                return_qty = Decimal(str(qty))
                if return_qty < 0:
                    return_qty = Decimal('0.00')
            except (ValueError, TypeError):
                return Response({'error': 'Return quantity must be a non-negative number.'}, status=status.HTTP_400_BAD_REQUEST)

        if return_qty <= 0 and used_qty <= 0:
            return Response({'error': 'Please enter a valid quantity for items used on site or items returning to warehouse.'}, status=status.HTTP_400_BAD_REQUEST)

        issue_tx = None
        if issue_id:
            try:
                issue_tx = StockTransaction.objects.get(id=issue_id)
                item_id = issue_tx.item_id
                if not technician_id and issue_tx.technician_id:
                    technician_id = issue_tx.technician_id
                if not service_id and issue_tx.service_id:
                    service_id = issue_tx.service_id
                if not visit_id and issue_tx.visit_id:
                    visit_id = issue_tx.visit_id
                if not project_id and getattr(issue_tx, 'project_id', None):
                    project_id = issue_tx.project_id
            except StockTransaction.DoesNotExist:
                pass

        if not item_id:
            return Response({'error': 'item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        tech_user = None
        if technician_id:
            try:
                tech_user = User.objects.get(id=technician_id)
            except User.DoesNotExist:
                pass
        if not tech_user and issue_tx and issue_tx.technician:
            tech_user = issue_tx.technician
        if not tech_user and request.user and not request.user.is_anonymous:
            tech_user = request.user

        srv = None
        vst = None
        prj = None
        ref_no = ''
        if service_id:
            from amc.models import AMCService
            try:
                srv = AMCService.objects.get(id=service_id)
                ref_no = srv.service_number
            except AMCService.DoesNotExist:
                pass
        elif visit_id:
            from amc.models import AMCVisit
            try:
                vst = AMCVisit.objects.get(id=visit_id)
                ref_no = vst.visit_number
            except AMCVisit.DoesNotExist:
                pass
        elif project_id:
            from lead_management.models import Project
            try:
                prj = Project.objects.get(id=project_id)
                ref_no = prj.project_code or f"PRJ-{prj.id}"
            except Project.DoesNotExist:
                pass

        if not ref_no and issue_tx:
            ref_no = issue_tx.reference_number or f"ISSUE-TX-{issue_tx.id}"
        if not ref_no:
            ref_no = request.data.get('reference_number', '') or 'TECH-RETURN'

        # Return request created with PENDING_APPROVAL status.
        # Stock will be added to available_stock and used_stock reduced upon approval in Inventory.
        prev_available = item.available_stock
        new_available = prev_available  # remains unchanged until approved

        tech_name = ""
        if tech_user:
            tech_name = f"{getattr(tech_user, 'first_name', '')} {getattr(tech_user, 'last_name', '')}".strip() or getattr(tech_user, 'email', '') or getattr(tech_user, 'mobile_no', 'Technician')
        tech_str = f" by {tech_name}" if tech_name else ""
        target_str = f" for {ref_no}" if ref_no else ""
        issue_info = f" [Issue Ref: #{issue_tx.id} - {issue_tx.quantity} {item.unit} issued]" if issue_tx else ""
        # 1. Log USED_STOCK if used_qty > 0
        used_tx = None
        if used_qty > 0:
            used_notes = f"Used / Installed on {ref_no}{tech_str}{issue_info} ({used_qty} {item.unit}). {notes}".strip()
            used_tx = StockTransaction.objects.create(
                item=item,
                transaction_type='USED_STOCK',
                status='COMPLETED',
                quantity=used_qty,
                previous_available=prev_available,
                new_available=new_available,
                unit_price=item.unit_price,
                reference_number=ref_no,
                notes=used_notes,
                technician=tech_user,
                service=srv,
                visit=vst,
                project=prj,
                created_by=request.user if request.user and not request.user.is_anonymous else None
            )

        # 2. Log RETURN_STOCK if return_qty > 0 (PENDING_APPROVAL)
        return_tx = None
        if return_qty > 0:
            full_notes = f"Return request{tech_str}{target_str}{issue_info} ({reason}). {notes}".strip()
            return_tx = StockTransaction.objects.create(
                item=item,
                transaction_type='RETURN_STOCK',
                status='PENDING_APPROVAL',
                quantity=return_qty,
                previous_available=prev_available,
                new_available=new_available,
                unit_price=item.unit_price,
                reference_number=ref_no,
                notes=full_notes,
                technician=tech_user,
                service=srv,
                visit=vst,
                project=prj,
                created_by=request.user if request.user and not request.user.is_anonymous else None
            )

        msg_parts = []
        if return_qty > 0:
            msg_parts.append(f'Return request for {return_qty} {item.unit} submitted for approval')
        if used_qty > 0:
            msg_parts.append(f'{used_qty} {item.unit} logged as used/installed on site')

        primary_tx = return_tx or used_tx

        return Response({
            'message': ". ".join(msg_parts) + ".",
            'item': InventoryItemSerializer(item).data,
            'transaction': StockTransactionSerializer(primary_tx).data if primary_tx else None
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='use-stock')
    @transaction.atomic
    def use_stock(self, request):
        """Action: Consume / Use Stock in Service / Project"""
        item_id = request.data.get('item_id')
        qty = request.data.get('quantity')
        ref_no = request.data.get('reference_number', '')
        notes = request.data.get('notes', '')

        if not item_id or not qty:
            return Response({'error': 'item_id and quantity are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = Decimal(str(qty))
            if qty <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Quantity must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item.available_stock < qty:
            return Response({
                'error': f'Insufficient available stock ({item.available_stock} {item.unit} available).'
            }, status=status.HTTP_400_BAD_REQUEST)

        prev_available = item.available_stock
        new_available = prev_available - qty
        item.available_stock = new_available
        item.used_stock = (item.used_stock or Decimal('0.00')) + qty
        item.save()

        StockTransaction.objects.create(
            item=item,
            transaction_type='USED_STOCK',
            quantity=qty,
            previous_available=prev_available,
            new_available=new_available,
            unit_price=item.unit_price,
            reference_number=ref_no or 'USED_IN_OPERATIONS',
            notes=notes or 'Consumed in field operations / service / installation',
            created_by=request.user if request.user and not request.user.is_anonymous else None
        )

        return Response({
            'message': f'Successfully issued {qty} {item.unit} for {item.name}.',
            'item': InventoryItemSerializer(item).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='request-stock')
    @transaction.atomic
    def request_stock(self, request):
        """Action: Submit a stock requisition request from a Technician for a Service or AMC Visit"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        item_id = request.data.get('item_id')
        qty = request.data.get('quantity')
        technician_id = request.data.get('technician_id')
        service_id = request.data.get('service_id')
        visit_id = request.data.get('visit_id')
        project_id = request.data.get('project_id')
        notes = request.data.get('notes', '')

        if not item_id or not qty:
            return Response({'error': 'item_id and quantity are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = Decimal(str(qty))
            if qty <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Quantity must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        tech_user = None
        if technician_id:
            try:
                tech_user = User.objects.get(id=technician_id)
            except User.DoesNotExist:
                pass
        if not tech_user and request.user and not request.user.is_anonymous:
            tech_user = request.user

        srv = None
        vst = None
        prj = None
        ref_no = ''
        if service_id:
            from amc.models import AMCService
            try:
                srv = AMCService.objects.get(id=service_id)
                ref_no = srv.service_number
            except AMCService.DoesNotExist:
                pass
        elif visit_id:
            from amc.models import AMCVisit
            try:
                vst = AMCVisit.objects.get(id=visit_id)
                ref_no = vst.visit_number
            except AMCVisit.DoesNotExist:
                pass
        elif project_id:
            from lead_management.models import Project
            try:
                prj = Project.objects.get(id=project_id)
                ref_no = prj.project_code or f"PRJ-{prj.id}"
            except Project.DoesNotExist:
                pass

        if not ref_no:
            ref_no = request.data.get('reference_number', '') or 'REQ-STOCK'

        tech_name = ""
        if tech_user:
            tech_name = f"{getattr(tech_user, 'first_name', '')} {getattr(tech_user, 'last_name', '')}".strip() or getattr(tech_user, 'email', '') or getattr(tech_user, 'username', 'Technician')
        tech_str = f" by {tech_name}" if tech_name else ""
        target_str = f" for {ref_no}" if ref_no else ""
        full_notes = f"Stock request{tech_str}{target_str}. {notes}".strip()

        tx = StockTransaction.objects.create(
            item=item,
            transaction_type='ISSUE_STOCK',
            status='PENDING_APPROVAL',
            quantity=qty,
            previous_available=item.available_stock,
            new_available=item.available_stock,
            unit_price=item.unit_price,
            reference_number=ref_no,
            notes=full_notes,
            technician=tech_user,
            service=srv,
            visit=vst,
            project=prj,
            created_by=request.user if request.user and not request.user.is_anonymous else None
        )

        return Response({
            'message': f'Stock request for {qty} {item.unit} of {item.name} has been submitted for approval.',
            'item': InventoryItemSerializer(item).data,
            'transaction': StockTransactionSerializer(tx).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='issue-stock')
    @transaction.atomic
    def issue_stock(self, request):
        """Action: Issue Stock to a Technician for a Service or AMC Visit"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # Technicians cannot directly issue stock; only SuperAdmin / Managers can directly issue
        user = request.user
        role_name = getattr(getattr(user, 'role', None), 'name', '').lower() if user and not user.is_anonymous else ''
        is_technician = getattr(user, 'is_technician', False) or role_name == 'technician' or 'technician' in role_name
        is_admin_or_super = user and not user.is_anonymous and (user.is_superuser or role_name in ['admin', 'superuser', 'manager', 'inventory manager', 'admin/manager'])
        if is_technician and not is_admin_or_super:
            return Response({
                'error': 'Technicians can only request stock. Please use the "Request Stock" option to submit a requisition for warehouse approval.'
            }, status=status.HTTP_403_FORBIDDEN)

        item_id = request.data.get('item_id')
        qty = request.data.get('quantity')
        technician_id = request.data.get('technician_id')
        service_id = request.data.get('service_id')
        visit_id = request.data.get('visit_id')
        project_id = request.data.get('project_id')
        notes = request.data.get('notes', '')

        if not item_id or not qty:
            return Response({'error': 'item_id and quantity are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = Decimal(str(qty))
            if qty <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Quantity must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item.available_stock < qty:
            return Response({
                'error': f'Insufficient available stock ({item.available_stock} {item.unit} available).'
            }, status=status.HTTP_400_BAD_REQUEST)

        tech_user = None
        if technician_id:
            try:
                tech_user = User.objects.get(id=technician_id)
            except User.DoesNotExist:
                pass

        srv = None
        vst = None
        prj = None
        ref_no = ''
        if service_id:
            from amc.models import AMCService
            try:
                srv = AMCService.objects.get(id=service_id)
                ref_no = srv.service_number
            except AMCService.DoesNotExist:
                pass
        elif visit_id:
            from amc.models import AMCVisit
            try:
                vst = AMCVisit.objects.get(id=visit_id)
                ref_no = vst.visit_number
            except AMCVisit.DoesNotExist:
                pass
        elif project_id:
            from lead_management.models import Project
            try:
                prj = Project.objects.get(id=project_id)
                ref_no = prj.project_code or f"PRJ-{prj.id}"
            except Project.DoesNotExist:
                pass

        if not ref_no:
            ref_no = request.data.get('reference_number', '') or 'ISSUE-STOCK'

        prev_available = item.available_stock
        new_available = prev_available - qty
        item.available_stock = new_available
        item.used_stock = (item.used_stock or Decimal('0.00')) + qty
        item.save()

        tech_name = ""
        if tech_user:
            tech_name = f"{getattr(tech_user, 'first_name', '')} {getattr(tech_user, 'last_name', '')}".strip() or getattr(tech_user, 'email', '') or getattr(tech_user, 'mobile_no', 'Technician')
        tech_str = f" to {tech_name}" if tech_name else ""
        target_str = f" for {ref_no}" if ref_no else ""
        full_notes = f"Issued{tech_str}{target_str}. {notes}".strip()

        tx = StockTransaction.objects.create(
            item=item,
            transaction_type='ISSUE_STOCK',
            quantity=qty,
            previous_available=prev_available,
            new_available=new_available,
            unit_price=item.unit_price,
            reference_number=ref_no,
            notes=full_notes,
            technician=tech_user,
            service=srv,
            visit=vst,
            project=prj,
            created_by=request.user if request.user and not request.user.is_anonymous else None
        )

        return Response({
            'message': f'Successfully issued {qty} {item.unit} of {item.name}.',
            'item': InventoryItemSerializer(item).data,
            'transaction': StockTransactionSerializer(tx).data
        }, status=status.HTTP_200_OK)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().select_related('vendor', 'created_by').prefetch_related('items__item').order_by('-created_at')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['po_number', 'vendor__name', 'notes', 'shipping_address']

    def perform_create(self, serializer):
        user = self.request.user if self.request.user and not self.request.user.is_anonymous else None
        serializer.save(created_by=user)

    def get_queryset(self):
        qs = super().get_queryset()
        st = self.request.query_params.get('status')
        if st:
            qs = qs.filter(status=st.upper())
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        return qs

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        po = self.get_object()
        new_status = request.data.get('status')
        if not new_status or new_status not in dict(PurchaseOrder.STATUS_CHOICES):
            return Response({'error': f'Invalid status. Allowed: {list(dict(PurchaseOrder.STATUS_CHOICES).keys())}'}, status=status.HTTP_400_BAD_REQUEST)
        po.status = new_status
        po.save(update_fields=['status', 'updated_at'])
        return Response({'message': f'PO status changed to {new_status}', 'po': PurchaseOrderSerializer(po).data})


class GRNViewSet(viewsets.ModelViewSet):
    queryset = GRN.objects.all().select_related('vendor', 'purchase_order', 'created_by').prefetch_related('items__item').order_by('-created_at')
    serializer_class = GRNSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['grn_number', 'vendor__name', 'purchase_order__po_number', 'invoice_number', 'challan_number']

    def get_queryset(self):
        qs = super().get_queryset()
        vendor_id = self.request.query_params.get('vendor')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        po_id = self.request.query_params.get('purchase_order')
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        return qs


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockTransaction.objects.all().select_related('item', 'created_by', 'technician', 'service', 'visit', 'project').order_by('-created_at')
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['item__name', 'item__item_code', 'reference_number', 'notes']

    def get_queryset(self):
        qs = super().get_queryset()
        item_id = self.request.query_params.get('item')
        if item_id:
            qs = qs.filter(item_id=item_id)
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        tx_type = self.request.query_params.get('transaction_type')
        if tx_type:
            if ',' in tx_type:
                types = [t.strip().upper() for t in tx_type.split(',') if t.strip()]
                qs = qs.filter(transaction_type__in=types)
            else:
                qs = qs.filter(transaction_type=tx_type.upper())
        status_param = self.request.query_params.get('status')
        if status_param:
            if ',' in status_param:
                statuses = [s.strip().upper() for s in status_param.split(',') if s.strip()]
                qs = qs.filter(status__in=statuses)
            else:
                qs = qs.filter(status=status_param.upper())
        technician_id = self.request.query_params.get('technician')
        if technician_id:
            qs = qs.filter(technician_id=technician_id)
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        visit_id = self.request.query_params.get('visit')
        if visit_id:
            qs = qs.filter(visit_id=visit_id)
        return qs

    @action(detail=True, methods=['post'], url_path='approve-return')
    @transaction.atomic
    def approve_return(self, request, pk=None):
        """Action: Approve a pending stock return request and add stock back to available warehouse inventory"""
        try:
            tx = StockTransaction.objects.select_for_update().get(pk=pk)
        except StockTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx.transaction_type != 'RETURN_STOCK':
            return Response({'error': 'Only return stock transactions can be approved.'}, status=status.HTTP_400_BAD_REQUEST)
        if tx.status != 'PENDING_APPROVAL':
            return Response({'error': f'Transaction is already {tx.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=tx.item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Linked inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        prev_avail = item.available_stock
        new_avail = prev_avail + tx.quantity
        item.available_stock = new_avail
        item.used_stock = max(Decimal('0.00'), (item.used_stock or Decimal('0.00')) - tx.quantity)
        item.returned_stock = (item.returned_stock or Decimal('0.00')) + tx.quantity
        item.save()

        tx.status = 'APPROVED'
        tx.previous_available = prev_avail
        tx.new_available = new_avail
        tx.approved_by = request.user if request.user.is_authenticated else None
        tx.approved_at = timezone.now()
        tx.save()

        return Response({
            'message': f'Return request approved! Added {tx.quantity} {item.unit} of {item.name} back to inventory.',
            'transaction': StockTransactionSerializer(tx).data,
            'item': InventoryItemSerializer(item).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject-return')
    @transaction.atomic
    def reject_return(self, request, pk=None):
        """Action: Reject a pending stock return request"""
        try:
            tx = StockTransaction.objects.select_for_update().get(pk=pk)
        except StockTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx.transaction_type != 'RETURN_STOCK':
            return Response({'error': 'Only return stock transactions can be rejected.'}, status=status.HTTP_400_BAD_REQUEST)
        if tx.status != 'PENDING_APPROVAL':
            return Response({'error': f'Transaction is already {tx.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', 'Rejected by inventory manager')
        tx.status = 'REJECTED'
        tx.rejection_reason = reason
        tx.approved_by = request.user if request.user.is_authenticated else None
        tx.approved_at = timezone.now()
        tx.save()

        return Response({
            'message': f'Return request for {tx.quantity} {tx.item.unit} of {tx.item.name} has been rejected.',
            'transaction': StockTransactionSerializer(tx).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve-issue')
    @transaction.atomic
    def approve_issue(self, request, pk=None):
        """Action: Approve a pending stock issue request and deduct stock from available warehouse inventory"""
        try:
            tx = StockTransaction.objects.select_for_update().get(pk=pk)
        except StockTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx.transaction_type != 'ISSUE_STOCK':
            return Response({'error': 'Only stock issue requests can be approved here.'}, status=status.HTTP_400_BAD_REQUEST)
        if tx.status != 'PENDING_APPROVAL':
            return Response({'error': f'Transaction is already {tx.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = InventoryItem.objects.select_for_update().get(id=tx.item_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Linked inventory item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item.available_stock < tx.quantity:
            return Response({
                'error': f'Insufficient available stock! Only {item.available_stock} {item.unit} available in warehouse, but requested {tx.quantity} {item.unit}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        prev_avail = item.available_stock
        new_avail = prev_avail - tx.quantity
        item.available_stock = new_avail
        item.used_stock = (item.used_stock or Decimal('0.00')) + tx.quantity
        item.save()

        tx.status = 'APPROVED'
        tx.previous_available = prev_avail
        tx.new_available = new_avail
        tx.approved_by = request.user if request.user.is_authenticated else None
        tx.approved_at = timezone.now()
        tx.save()

        return Response({
            'message': f'Stock issue request approved! Issued {tx.quantity} {item.unit} of {item.name}.',
            'transaction': StockTransactionSerializer(tx).data,
            'item': InventoryItemSerializer(item).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject-issue')
    @transaction.atomic
    def reject_issue(self, request, pk=None):
        """Action: Reject a pending stock issue request"""
        try:
            tx = StockTransaction.objects.select_for_update().get(pk=pk)
        except StockTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx.transaction_type != 'ISSUE_STOCK':
            return Response({'error': 'Only stock issue requests can be rejected here.'}, status=status.HTTP_400_BAD_REQUEST)
        if tx.status != 'PENDING_APPROVAL':
            return Response({'error': f'Transaction is already {tx.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', 'Rejected by inventory manager')
        tx.status = 'REJECTED'
        tx.rejection_reason = reason
        tx.approved_by = request.user if request.user.is_authenticated else None
        tx.approved_at = timezone.now()
        tx.save()

        return Response({
            'message': f'Stock issue request for {tx.quantity} {tx.item.unit} of {tx.item.name} has been rejected.',
            'transaction': StockTransactionSerializer(tx).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='pending-returns')
    def pending_returns(self, request):
        """Action: List all pending return stock approval requests"""
        qs = self.get_queryset().filter(transaction_type='RETURN_STOCK', status='PENDING_APPROVAL')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='pending-requests')
    def pending_requests(self, request):
        """Action: List all pending approval requests (both RETURN_STOCK and ISSUE_STOCK)"""
        qs = self.get_queryset().filter(status='PENDING_APPROVAL')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
