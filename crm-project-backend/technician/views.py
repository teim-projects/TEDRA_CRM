from rest_framework.views import APIView
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db import transaction
from django.db.models import Q
from decimal import Decimal
import json
from amc.models import AMCService, AMCVisit, ServiceStatus, ServicePriority, ServiceAttachment
from amc.serializers import ServiceAttachmentSerializer
from api.permissions import is_admin_or_subadmin
from .models import TechnicianActivity, TechnicianLiveLocation
from .serializers import (
    TechnicianServiceDetailSerializer,
    TechnicianVisitDetailSerializer,
    TechnicianActivitySerializer,
    TechnicianLiveLocationSerializer,
)


def get_base_technician_work(user, filter_technician_id=None):
    """
    Returns (single_services_qs, amc_visits_qs) scoped to technician.
    """
    srv_qs = AMCService.objects.all().select_related(
        'customer', 'project', 'service_engineer'
    ).prefetch_related('technicians', 'technician_activities')

    vis_qs = AMCVisit.objects.all().select_related(
        'customer', 'amc_contract', 'project', 'service_engineer'
    ).prefetch_related('technicians', 'technician_activities')

    if is_admin_or_subadmin(user):
        if filter_technician_id:
            srv_qs = srv_qs.filter(
                Q(technicians__id=filter_technician_id) |
                Q(service_engineer__id=filter_technician_id)
            ).distinct()
            vis_qs = vis_qs.filter(
                Q(technicians__id=filter_technician_id) |
                Q(service_engineer__id=filter_technician_id)
            ).distinct()
        return srv_qs, vis_qs

    srv_qs = srv_qs.filter(
        Q(technicians=user) | Q(service_engineer=user)
    ).distinct()
    vis_qs = vis_qs.filter(
        Q(technicians=user) | Q(service_engineer=user)
    ).distinct()
    return srv_qs, vis_qs


def _serialize_and_sort_work(srv_qs, vis_qs, reverse=False):
    srv_data = TechnicianServiceDetailSerializer(srv_qs, many=True).data
    vis_data = TechnicianVisitDetailSerializer(vis_qs, many=True).data
    combined = list(srv_data) + list(vis_data)
    combined.sort(
        key=lambda x: str(x.get('service_date') or x.get('created_at') or ''),
        reverse=reverse
    )
    return combined


class TechnicianDashboardView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        tech_id = request.query_params.get('technician_id')
        today = timezone.localdate()

        srv_qs, vis_qs = get_base_technician_work(user, tech_id)

        # KPI counts
        total_allocated = srv_qs.count() + vis_qs.count()
        todays_work_count = (
            srv_qs.filter(service_date=today).count() +
            vis_qs.filter(visit_date=today).count()
        )

        active_statuses = [
            ServiceStatus.SCHEDULED,
            ServiceStatus.IN_PROGRESS,
            ServiceStatus.PENDING_PARTS
        ]
        work_desk_count = (
            srv_qs.filter(status__in=active_statuses).count() +
            vis_qs.filter(status__in=active_statuses).count()
        )

        completed_count = (
            srv_qs.filter(status=ServiceStatus.COMPLETED).count() +
            vis_qs.filter(status=ServiceStatus.COMPLETED).count()
        )

        in_progress_count = (
            srv_qs.filter(status=ServiceStatus.IN_PROGRESS).count() +
            vis_qs.filter(status=ServiceStatus.IN_PROGRESS).count()
        )
        pending_parts_count = (
            srv_qs.filter(status=ServiceStatus.PENDING_PARTS).count() +
            vis_qs.filter(status=ServiceStatus.PENDING_PARTS).count()
        )
        high_priority_count = (
            srv_qs.filter(priority__in=[ServicePriority.CRITICAL, ServicePriority.HIGH]).exclude(status=ServiceStatus.COMPLETED).count() +
            vis_qs.filter(priority__in=[ServicePriority.CRITICAL, ServicePriority.HIGH]).exclude(status=ServiceStatus.COMPLETED).count()
        )

        completion_rate = round((completed_count / total_allocated * 100), 1) if total_allocated > 0 else 0

        # Collections for dashboard
        todays_items = _serialize_and_sort_work(
            srv_qs.filter(service_date=today).order_by('status', 'priority')[:10],
            vis_qs.filter(visit_date=today).order_by('status', 'priority')[:10]
        )[:10]

        recent_completed = _serialize_and_sort_work(
            srv_qs.filter(status=ServiceStatus.COMPLETED).order_by('-completion_date', '-updated_at')[:5],
            vis_qs.filter(status=ServiceStatus.COMPLETED).order_by('-completion_date', '-updated_at')[:5],
            reverse=True
        )[:5]

        upcoming_work = _serialize_and_sort_work(
            srv_qs.filter(service_date__gt=today).order_by('service_date', 'priority')[:5],
            vis_qs.filter(visit_date__gt=today).order_by('visit_date', 'priority')[:5]
        )[:5]

        active_now = _serialize_and_sort_work(
            srv_qs.filter(status=ServiceStatus.IN_PROGRESS).order_by('-updated_at')[:5],
            vis_qs.filter(status=ServiceStatus.IN_PROGRESS).order_by('-updated_at')[:5]
        )[:5]

        return Response({
            'kpis': {
                'total_allocated': total_allocated,
                'todays_work_count': todays_work_count,
                'work_desk_count': work_desk_count,
                'completed_count': completed_count,
                'in_progress_count': in_progress_count,
                'pending_parts_count': pending_parts_count,
                'high_priority_count': high_priority_count,
                'completion_rate': completion_rate,
            },
            'todays_date': str(today),
            'todays_work': todays_items,
            'active_now': active_now,
            'upcoming_work': upcoming_work,
            'recent_completed': recent_completed,
        }, status=status.HTTP_200_OK)


class TechnicianWorkDeskListView(APIView):
    """
    Returns all work list (Single Services and AMC Contract visits) for the technician.
    Supports filtering by quick filter type: all, today, overdue, completed.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        tech_id = request.query_params.get('technician_id')
        today = timezone.localdate()
        srv_qs, vis_qs = get_base_technician_work(user, tech_id)

        # Quick filter parameter (from the top dropdown: all, today, overdue, completed)
        filter_type = request.query_params.get('filter') or request.query_params.get('filter_type')

        if filter_type == 'today':
            srv_qs = srv_qs.filter(service_date=today).exclude(status=ServiceStatus.COMPLETED)
            vis_qs = vis_qs.filter(visit_date=today).exclude(status=ServiceStatus.COMPLETED)
        elif filter_type == 'overdue':
            srv_qs = srv_qs.filter(service_date__lt=today).exclude(status=ServiceStatus.COMPLETED)
            vis_qs = vis_qs.filter(visit_date__lt=today).exclude(status=ServiceStatus.COMPLETED)
        elif filter_type == 'completed':
            srv_qs = srv_qs.filter(status=ServiceStatus.COMPLETED)
            vis_qs = vis_qs.filter(status=ServiceStatus.COMPLETED)
        elif filter_type == 'scheduled':
            srv_qs = srv_qs.filter(status=ServiceStatus.SCHEDULED)
            vis_qs = vis_qs.filter(status=ServiceStatus.SCHEDULED)
        elif filter_type == 'in_progress':
            srv_qs = srv_qs.filter(status=ServiceStatus.IN_PROGRESS)
            vis_qs = vis_qs.filter(status=ServiceStatus.IN_PROGRESS)
        elif filter_type == 'pending_parts':
            srv_qs = srv_qs.filter(status=ServiceStatus.PENDING_PARTS)
            vis_qs = vis_qs.filter(status=ServiceStatus.PENDING_PARTS)

        status_param = request.query_params.get('status')
        if status_param and status_param != 'all':
            srv_qs = srv_qs.filter(status=status_param)
            vis_qs = vis_qs.filter(status=status_param)

        priority_param = request.query_params.get('priority')
        if priority_param and priority_param != 'all':
            srv_qs = srv_qs.filter(priority=priority_param)
            vis_qs = vis_qs.filter(priority=priority_param)

        category_param = request.query_params.get('category')
        if category_param and category_param != 'all':
            if category_param == 'single_service':
                vis_qs = vis_qs.none()
            elif category_param in ('amc_service', 'amc_visit'):
                srv_qs = srv_qs.none()

        search = request.query_params.get('search', '').strip()
        if search:
            srv_qs = srv_qs.filter(
                Q(service_number__icontains=search) |
                Q(customer__company_name__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(equipment__icontains=search) |
                Q(description__icontains=search) |
                Q(resolution_notes__icontains=search) |
                Q(diagnosis__icontains=search)
            )
            vis_qs = vis_qs.filter(
                Q(visit_number__icontains=search) |
                Q(customer__company_name__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(equipment__icontains=search) |
                Q(description__icontains=search) |
                Q(resolution_notes__icontains=search) |
                Q(diagnosis__icontains=search)
            )

        items = _serialize_and_sort_work(srv_qs, vis_qs)
        return Response(items, status=status.HTTP_200_OK)


class TechnicianTodaysWorkListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        tech_id = request.query_params.get('technician_id')
        date_str = request.query_params.get('date')
        target_date = parse_date(date_str) if date_str else timezone.localdate()

        srv_qs, vis_qs = get_base_technician_work(user, tech_id)
        srv_qs = srv_qs.filter(Q(service_date=target_date) | Q(status=ServiceStatus.IN_PROGRESS))
        vis_qs = vis_qs.filter(Q(visit_date=target_date) | Q(status=ServiceStatus.IN_PROGRESS))

        items = _serialize_and_sort_work(srv_qs, vis_qs)
        return Response(items, status=status.HTTP_200_OK)


class TechnicianCompletedWorkListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        tech_id = request.query_params.get('technician_id')
        srv_qs, vis_qs = get_base_technician_work(user, tech_id)
        srv_qs = srv_qs.filter(status=ServiceStatus.COMPLETED)
        vis_qs = vis_qs.filter(status=ServiceStatus.COMPLETED)

        items = _serialize_and_sort_work(srv_qs, vis_qs, reverse=True)
        return Response(items, status=status.HTTP_200_OK)


class TechnicianServiceDetailView(APIView):
    """
    Retrieve and update individual service/visit details by technician.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk=None):
        srv = AMCService.objects.filter(pk=pk).first()
        if srv:
            return Response(TechnicianServiceDetailSerializer(srv).data, status=status.HTTP_200_OK)
        vis = AMCVisit.objects.filter(pk=pk).first()
        if vis:
            return Response(TechnicianVisitDetailSerializer(vis).data, status=status.HTTP_200_OK)
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk=None):
        srv = AMCService.objects.filter(pk=pk).first()
        if srv:
            serializer = TechnicianServiceDetailSerializer(srv, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        vis = AMCVisit.objects.filter(pk=pk).first()
        if vis:
            serializer = TechnicianVisitDetailSerializer(vis, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


class TechnicianServiceActionViewSet(viewsets.ViewSet):
    """
    Dedicated action endpoints for starting, updating, completing service visits.
    Works for both Single Services (AMCService) and AMC Visits (AMCVisit).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _resolve_target(self, pk, request):
        work_type = (
            request.data.get('work_type') or
            request.query_params.get('work_type') or
            ('amc_visit' if (request.data.get('visit_number') or request.data.get('amc_contract') or request.data.get('is_visit')) else None)
        )
        if work_type in ['amc_visit', 'visit']:
            vis = AMCVisit.objects.filter(pk=pk).first()
            if vis:
                return None, vis
            srv = AMCService.objects.filter(pk=pk).first()
            return srv, None
        elif work_type in ['single_service', 'service']:
            srv = AMCService.objects.filter(pk=pk).first()
            if srv:
                return srv, None
            vis = AMCVisit.objects.filter(pk=pk).first()
            return None, vis

        # Fallback if work_type unspecified
        srv = AMCService.objects.filter(pk=pk).first()
        vis = AMCVisit.objects.filter(pk=pk).first()
        if srv and not vis:
            return srv, None
        if vis and not srv:
            return None, vis
        if srv and vis:
            # Disambiguate based on request payloads or query params
            if (
                request.data.get('visit_number') or
                request.data.get('visit_index') or
                request.query_params.get('visit_number') or
                request.data.get('cycle')
            ):
                return None, vis
            if request.data.get('service_number') or request.query_params.get('service_number'):
                return srv, None
            # Check technician assignment affinity
            user = request.user
            if user and user.is_authenticated:
                if srv.technicians.filter(id=user.id).exists() or srv.service_engineer_id == user.id:
                    return srv, None
                if vis.technicians.filter(id=user.id).exists() or vis.service_engineer_id == user.id:
                    return None, vis
            return srv, None

        return None, None

    @action(detail=True, methods=['post'], url_path='start-journey')
    def start_journey(self, request, pk=None):
        user = request.user
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        accuracy = request.data.get('accuracy')
        notes = request.data.get('notes', 'Technician started navigation journey to customer site.')
        srv, vis = self._resolve_target(pk, request)
        target = srv or vis

        if not target:
            return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_number = getattr(target, 'service_number', None) or getattr(target, 'visit_number', '')
        cust_name = getattr(target.customer, 'name', '') or getattr(target.customer, 'company_name', '')
        log_notes = f"{notes} (Towards {cust_name or target_number})"

        activity = TechnicianActivity.objects.create(
            service=srv,
            visit=vis,
            technician=user if user.is_authenticated else None,
            action='journey_started',
            notes=log_notes,
            latitude=lat if lat is not None else None,
            longitude=lng if lng is not None else None,
            accuracy=accuracy if accuracy is not None else None,
        )

        if user.is_authenticated and lat is not None and lng is not None:
            TechnicianLiveLocation.objects.update_or_create(
                technician=user,
                defaults={
                    'latitude': lat,
                    'longitude': lng,
                    'accuracy': accuracy,
                    'status': 'en_route',
                    'current_service_id': target.id,
                    'current_work_type': 'single_service' if srv else 'amc_visit',
                    'last_action': 'journey_started',
                }
            )

        return Response({
            'status': 'success',
            'message': 'Departure location and time recorded.',
            'activity': TechnicianActivitySerializer(activity).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='start-visit')
    def start_visit(self, request, pk=None):
        user = request.user
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        accuracy = request.data.get('accuracy')
        notes = request.data.get('notes', 'Technician arrived at site and started visit.')
        srv, vis = self._resolve_target(pk, request)
        today = timezone.localdate()

        if srv:
            if srv.service_date and srv.service_date > today:
                return Response(
                    {'error': f"Service is scheduled for {srv.service_date.strftime('%d-%m-%Y')}. It can only be started on or after the scheduled date."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            srv.status = ServiceStatus.IN_PROGRESS
            srv.save(update_fields=['status', 'updated_at'])
            activity = TechnicianActivity.objects.create(
                service=srv,
                technician=user if user.is_authenticated else None,
                action='visit_started',
                notes=notes,
                latitude=lat if lat is not None else None,
                longitude=lng if lng is not None else None,
                accuracy=accuracy if accuracy is not None else None,
            )
            if user.is_authenticated and lat is not None and lng is not None:
                TechnicianLiveLocation.objects.update_or_create(
                    technician=user,
                    defaults={
                        'latitude': lat,
                        'longitude': lng,
                        'accuracy': accuracy,
                        'status': 'on_site',
                        'current_service_id': srv.id,
                        'current_work_type': 'single_service',
                        'last_action': 'visit_started',
                    }
                )

            # Save optional before / breakdown images if uploaded
            before_files = (
                request.FILES.getlist('images') or
                request.FILES.getlist('files') or
                request.FILES.getlist('before_images') or
                ([request.FILES['file']] if 'file' in request.FILES else [])
            )
            for f in before_files:
                ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
                file_type = 'pdf' if ext == 'pdf' else ('image' if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'document')
                ServiceAttachment.objects.create(
                    service=srv,
                    uploaded_by=user if user.is_authenticated else None,
                    file=f,
                    file_type=file_type,
                    stage='before',
                    title='Site inspection / breakdown photo',
                )

            return Response(TechnicianServiceDetailSerializer(srv).data, status=status.HTTP_200_OK)

        if vis:
            target_date = vis.visit_date
            if target_date and target_date > today:
                return Response(
                    {'error': f"Visit is scheduled for {target_date.strftime('%d-%m-%Y')}. It can only be started on or after the scheduled date."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            vis.status = ServiceStatus.IN_PROGRESS
            vis.save(update_fields=['status', 'updated_at'])
            activity = TechnicianActivity.objects.create(
                visit=vis,
                technician=user if user.is_authenticated else None,
                action='visit_started',
                notes=notes,
                latitude=lat if lat is not None else None,
                longitude=lng if lng is not None else None,
                accuracy=accuracy if accuracy is not None else None,
            )
            if user.is_authenticated and lat is not None and lng is not None:
                TechnicianLiveLocation.objects.update_or_create(
                    technician=user,
                    defaults={
                        'latitude': lat,
                        'longitude': lng,
                        'accuracy': accuracy,
                        'status': 'on_site',
                        'current_service_id': vis.id,
                        'current_work_type': 'amc_visit',
                        'last_action': 'visit_started',
                    }
                )

            # Save optional before / breakdown images if uploaded
            before_files = (
                request.FILES.getlist('images') or
                request.FILES.getlist('files') or
                request.FILES.getlist('before_images') or
                ([request.FILES['file']] if 'file' in request.FILES else [])
            )
            for f in before_files:
                ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
                file_type = 'pdf' if ext == 'pdf' else ('image' if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'document')
                ServiceAttachment.objects.create(
                    visit=vis,
                    uploaded_by=user if user.is_authenticated else None,
                    file=f,
                    file_type=file_type,
                    stage='before',
                    title='Site inspection / breakdown photo',
                )

            return Response(TechnicianVisitDetailSerializer(vis).data, status=status.HTTP_200_OK)

        return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)

    def _process_stock_reconciliation(self, srv, vis, request, user):
        """
        Reconciles issued stock upon service/visit completion:
        - Logs USED_STOCK transaction for items consumed on site
        - Returns unused items back to available inventory and logs RETURN_STOCK transaction
        """
        raw_data = request.data.get('stock_reconciliation') or request.data.get('inventory_items')
        if not raw_data:
            return []

        try:
            from inventory.models import InventoryItem, StockTransaction
        except ImportError:
            return []

        if isinstance(raw_data, str):
            try:
                items_list = json.loads(raw_data)
            except Exception:
                return []
        elif isinstance(raw_data, list):
            items_list = raw_data
        else:
            return []

        ref_no = srv.service_number if srv else (vis.visit_number if vis else 'SERVICE-COMPLETION')
        tech_user = user if (user and user.is_authenticated) else None
        reconciled = []

        for entry in items_list:
            item_id = entry.get('item_id') or entry.get('id')
            if not item_id:
                continue
            try:
                inv_item = InventoryItem.objects.select_for_update().get(id=item_id)
            except InventoryItem.DoesNotExist:
                continue

            try:
                used_qty = Decimal(str(entry.get('used_qty', 0) or 0))
            except Exception:
                used_qty = Decimal('0.00')

            try:
                returned_qty = Decimal(str(entry.get('returned_qty', 0) or 0))
            except Exception:
                returned_qty = Decimal('0.00')

            # 1. Log Used Stock if used_qty > 0
            if used_qty > 0:
                StockTransaction.objects.create(
                    item=inv_item,
                    transaction_type='USED_STOCK',
                    quantity=used_qty,
                    previous_available=inv_item.available_stock,
                    new_available=inv_item.available_stock,
                    unit_price=inv_item.unit_price,
                    reference_number=ref_no,
                    notes=entry.get('notes') or f"Consumed during {ref_no} completion ({used_qty} {inv_item.unit}).",
                    technician=tech_user,
                    service=srv,
                    visit=vis,
                    created_by=tech_user
                )

            # 2. Return Stock created with PENDING_APPROVAL status (will be added to warehouse stock once approved in Inventory)
            if returned_qty > 0:
                StockTransaction.objects.create(
                    item=inv_item,
                    transaction_type='RETURN_STOCK',
                    status='PENDING_APPROVAL',
                    quantity=returned_qty,
                    previous_available=inv_item.available_stock,
                    new_available=inv_item.available_stock,
                    unit_price=inv_item.unit_price,
                    reference_number=ref_no,
                    notes=f"Returned unused parts upon {ref_no} completion ({returned_qty} {inv_item.unit}) (Pending Approval).",
                    technician=tech_user,
                    service=srv,
                    visit=vis,
                    created_by=tech_user
                )

            reconciled.append({
                'item_id': inv_item.id,
                'name': inv_item.name,
                'used_qty': str(used_qty),
                'returned_qty': str(returned_qty)
            })

        return reconciled

    @action(detail=True, methods=['post'], url_path='complete-visit')
    @transaction.atomic
    def complete_visit(self, request, pk=None):
        user = request.user
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        accuracy = request.data.get('accuracy')
        completion_date_str = request.data.get('completion_date')
        comp_date = parse_date(completion_date_str) if completion_date_str else timezone.localdate()
        notes = request.data.get('notes', 'Technician successfully completed service visit.')
        srv, vis = self._resolve_target(pk, request)
        today = timezone.localdate()

        if srv:
            if srv.service_date and srv.service_date > today:
                return Response(
                    {'error': f"Service is scheduled for {srv.service_date.strftime('%d-%m-%Y')}. It cannot be marked complete before the scheduled date."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if srv.status != ServiceStatus.IN_PROGRESS and srv.status != ServiceStatus.COMPLETED:
                return Response(
                    {'error': "Service must be started (In Progress) before it can be marked as completed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            srv.status = ServiceStatus.COMPLETED
            srv.diagnosis = request.data.get('diagnosis', srv.diagnosis)
            srv.resolution_notes = request.data.get('resolution_notes', srv.resolution_notes)
            srv.customer_feedback = request.data.get('customer_feedback', srv.customer_feedback)
            srv.completion_date = comp_date
            srv.save()

            # Process inventory spare parts reconciliation (used vs returned)
            stock_results = self._process_stock_reconciliation(srv=srv, vis=None, request=request, user=user)

            activity_notes = f"{notes} - Diagnosis: {srv.diagnosis or 'None'}. Resolution: {srv.resolution_notes or 'None'}."
            if stock_results:
                stock_summary_str = ", ".join([f"{r['name']}: used {r['used_qty']}, returned {r['returned_qty']}" for r in stock_results])
                activity_notes += f" | Parts Reconciled: {stock_summary_str}"

            activity = TechnicianActivity.objects.create(
                service=srv,
                technician=user if user.is_authenticated else None,
                action='job_completed',
                notes=activity_notes,
                latitude=lat if lat is not None else None,
                longitude=lng if lng is not None else None,
                accuracy=accuracy if accuracy is not None else None,
            )
            if user.is_authenticated and lat is not None and lng is not None:
                TechnicianLiveLocation.objects.update_or_create(
                    technician=user,
                    defaults={
                        'latitude': lat,
                        'longitude': lng,
                        'accuracy': accuracy,
                        'status': 'idle',
                        'last_action': 'job_completed',
                    }
                )

            # Save optional after / completion photos and PDF documents if uploaded
            after_files = (
                request.FILES.getlist('images') or
                request.FILES.getlist('files') or
                request.FILES.getlist('after_images') or
                ([request.FILES['file']] if 'file' in request.FILES else [])
            )
            doc_files = request.FILES.getlist('documents') or request.FILES.getlist('pdf_files')
            all_comp_files = [(f, 'after') for f in after_files] + [(f, 'document') for f in doc_files]
            for f, stg in all_comp_files:
                ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
                file_type = 'pdf' if ext == 'pdf' else ('image' if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'document')
                ServiceAttachment.objects.create(
                    service=srv,
                    uploaded_by=user if user.is_authenticated else None,
                    file=f,
                    file_type=file_type,
                    stage=stg,
                    title='Completion report / photo',
                )

            return Response(TechnicianServiceDetailSerializer(srv).data, status=status.HTTP_200_OK)

        if vis:
            target_date = vis.visit_date
            if target_date and target_date > today:
                return Response(
                    {'error': f"Visit is scheduled for {target_date.strftime('%d-%m-%Y')}. It cannot be marked complete before the scheduled date."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if vis.status != ServiceStatus.IN_PROGRESS and vis.status != ServiceStatus.COMPLETED:
                return Response(
                    {'error': "Visit must be started (In Progress) before it can be marked as completed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            vis.status = ServiceStatus.COMPLETED
            vis.diagnosis = request.data.get('diagnosis', vis.diagnosis)
            vis.resolution_notes = request.data.get('resolution_notes', vis.resolution_notes)
            vis.customer_feedback = request.data.get('customer_feedback', vis.customer_feedback)
            vis.completion_date = comp_date
            vis.save()

            # Process inventory spare parts reconciliation (used vs returned)
            stock_results = self._process_stock_reconciliation(srv=None, vis=vis, request=request, user=user)

            activity_notes = f"{notes} - Diagnosis: {vis.diagnosis or 'None'}. Resolution: {vis.resolution_notes or 'None'}."
            if stock_results:
                stock_summary_str = ", ".join([f"{r['name']}: used {r['used_qty']}, returned {r['returned_qty']}" for r in stock_results])
                activity_notes += f" | Parts Reconciled: {stock_summary_str}"

            activity = TechnicianActivity.objects.create(
                visit=vis,
                technician=user if user.is_authenticated else None,
                action='job_completed',
                notes=activity_notes,
                latitude=lat if lat is not None else None,
                longitude=lng if lng is not None else None,
                accuracy=accuracy if accuracy is not None else None,
            )
            if user.is_authenticated and lat is not None and lng is not None:
                TechnicianLiveLocation.objects.update_or_create(
                    technician=user,
                    defaults={
                        'latitude': lat,
                        'longitude': lng,
                        'accuracy': accuracy,
                        'status': 'idle',
                        'last_action': 'job_completed',
                    }
                )

            # Save optional after / completion photos and PDF documents if uploaded
            after_files = (
                request.FILES.getlist('images') or
                request.FILES.getlist('files') or
                request.FILES.getlist('after_images') or
                ([request.FILES['file']] if 'file' in request.FILES else [])
            )
            doc_files = request.FILES.getlist('documents') or request.FILES.getlist('pdf_files')
            all_comp_files = [(f, 'after') for f in after_files] + [(f, 'document') for f in doc_files]
            for f, stg in all_comp_files:
                ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
                file_type = 'pdf' if ext == 'pdf' else ('image' if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'document')
                ServiceAttachment.objects.create(
                    visit=vis,
                    uploaded_by=user if user.is_authenticated else None,
                    file=f,
                    file_type=file_type,
                    stage=stg,
                    title='Completion report / photo',
                )

            return Response(TechnicianVisitDetailSerializer(vis).data, status=status.HTTP_200_OK)

        return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get', 'post'], url_path='attachments', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def attachments(self, request, pk=None):
        srv, vis = self._resolve_target(pk, request)
        target = srv or vis
        if not target:
            return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'GET':
            qs = target.attachments.all().order_by('-created_at')
            return Response(ServiceAttachmentSerializer(qs, many=True, context={'request': request}).data, status=status.HTTP_200_OK)

        files = (
            request.FILES.getlist('files') or
            request.FILES.getlist('images') or
            request.FILES.getlist('documents') or
            ([request.FILES['file']] if 'file' in request.FILES else [])
        )
        if not files:
            return Response({'error': 'No file uploaded. Please select an image or document.'}, status=status.HTTP_400_BAD_REQUEST)

        stage = request.data.get('stage', 'other')
        title = request.data.get('title', '')
        user = request.user if request.user.is_authenticated else None

        created = []
        for f in files:
            ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
            file_type = 'pdf' if ext == 'pdf' else ('image' if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'document')
            stg = stage
            if stg == 'other' and file_type == 'pdf':
                stg = 'document'
            att = ServiceAttachment.objects.create(
                service=srv if srv else None,
                visit=vis if (vis and not srv) else None,
                uploaded_by=user,
                file=f,
                file_type=file_type,
                stage=stg,
                title=title or f.name,
            )
            created.append(att)

        return Response(
            ServiceAttachmentSerializer(created, many=True, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='add-note')
    def add_note(self, request, pk=None):
        user = request.user if request.user.is_authenticated else None
        notes = request.data.get('notes', '').strip()
        action_type = request.data.get('action') or request.data.get('note_type', 'general_note')

        if not notes:
            return Response({'error': 'Notes content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        srv, vis = self._resolve_target(pk, request)

        if srv:
            activity = TechnicianActivity.objects.create(
                service=srv,
                technician=user,
                action=action_type,
                notes=notes
            )
            return Response(TechnicianActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

        if vis:
            activity = TechnicianActivity.objects.create(
                visit=vis,
                technician=user,
                action=action_type,
                notes=notes
            )
            return Response(TechnicianActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

        return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)


class TechnicianDailyFieldMapView(APIView):
    """
    Dedicated view for Daily Field Dispatch & Site Route Map.
    Strictly filters for the requested date (defaults to today).
    Returns site GPS coordinates, addresses, technician details, and real-time status.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        tech_id = request.query_params.get('technician_id')
        if tech_id in ('', 'all', 'null', 'undefined'):
            tech_id = None

        date_str = request.query_params.get('date')
        status_param = request.query_params.get('status')
        target_date = parse_date(date_str) if date_str else timezone.localdate()
        if not target_date:
            target_date = timezone.localdate()

        srv_qs, vis_qs = get_base_technician_work(user, tech_id)
        srv_qs = srv_qs.select_related('amc_contract', 'customer', 'project', 'service_engineer').prefetch_related('technicians', 'technician_activities')
        vis_qs = vis_qs.select_related('amc_contract', 'customer', 'project', 'service_engineer').prefetch_related('technicians', 'technician_activities')

        # STRICT RULE: Only sites scheduled for that particular day are visible!
        srv_qs = srv_qs.filter(service_date=target_date)
        vis_qs = vis_qs.filter(visit_date=target_date)

        if status_param and status_param != 'all':
            srv_qs = srv_qs.filter(status=status_param)
            vis_qs = vis_qs.filter(status=status_param)

        sites = []
        technician_map = {}

        def extract_milestones(item):
            acts = list(item.technician_activities.all().order_by('created_at'))
            journey = next((a for a in acts if a.action == 'journey_started'), None)
            visit = next((a for a in acts if a.action == 'visit_started'), None)
            completed = next((a for a in acts if a.action == 'job_completed'), None)
            return {
                'journey_started_at': journey.created_at.isoformat() if journey else None,
                'journey_lat': float(journey.latitude) if journey and journey.latitude is not None else None,
                'journey_lng': float(journey.longitude) if journey and journey.longitude is not None else None,
                'visit_started_at': visit.created_at.isoformat() if visit else None,
                'visit_lat': float(visit.latitude) if visit and visit.latitude is not None else None,
                'visit_lng': float(visit.longitude) if visit and visit.longitude is not None else None,
                'job_completed_at': completed.created_at.isoformat() if completed else None,
                'job_completed_lat': float(completed.latitude) if completed and completed.latitude is not None else None,
                'job_completed_lng': float(completed.longitude) if completed and completed.longitude is not None else None,
            }

        def process_assigned(item):
            tech_list = []
            for t in item.technicians.all():
                t_name = f"{t.first_name} {t.last_name}".strip() or getattr(t, 'username', '') or t.email
                phone = getattr(t, 'mobile_no', None) or getattr(t, 'mobile', '') or ''
                tech_list.append({
                    'id': t.id,
                    'name': t_name,
                    'mobile_no': phone,
                    'email': t.email,
                })
                if t.id not in technician_map:
                    technician_map[t.id] = {
                        'id': t.id,
                        'name': t_name,
                        'mobile_no': phone,
                        'count': 0
                    }
                technician_map[t.id]['count'] += 1

            lead = item.service_engineer
            lead_data = None
            if lead:
                l_name = f"{lead.first_name} {lead.last_name}".strip() or getattr(lead, 'username', '') or lead.email
                phone = getattr(lead, 'mobile_no', None) or getattr(lead, 'mobile', '') or ''
                lead_data = {
                    'id': lead.id,
                    'name': l_name,
                    'mobile_no': phone,
                    'email': lead.email,
                }
                if lead.id not in technician_map:
                    technician_map[lead.id] = {
                        'id': lead.id,
                        'name': l_name,
                        'mobile_no': phone,
                        'count': 0
                    }
            return tech_list, lead_data

        for srv in srv_qs:
            tech_list, lead_data = process_assigned(srv)
            lat = srv.latitude
            lng = srv.longitude
            loc_url = srv.location_url
            if (lat is None or lng is None) and srv.amc_contract:
                lat = srv.amc_contract.latitude
                lng = srv.amc_contract.longitude
                loc_url = loc_url or srv.amc_contract.location_url

            cust_name = getattr(srv.customer, 'name', '') or getattr(srv.customer, 'company_name', 'Customer')
            cust_addr = getattr(srv.customer, 'billing_address', '')
            addr = srv.service_address or (srv.amc_contract.site_address if srv.amc_contract else None) or cust_addr

            sites.append({
                'id': srv.id,
                'work_type': 'single_service',
                'service_number': srv.service_number or f"SRV-{srv.id}",
                'status': srv.status,
                'status_display': srv.get_status_display(),
                'priority': srv.priority,
                'priority_display': srv.get_priority_display(),
                'service_type': srv.service_type,
                'service_type_display': srv.get_service_type_display(),
                'service_date': str(srv.service_date),
                'customer_id': srv.customer_id,
                'customer_name': cust_name,
                'contact_person': srv.contact_person or getattr(srv.customer, 'contact_person', '') or cust_name,
                'contact_phone': srv.contact_phone or getattr(srv.customer, 'contact_number', '') or getattr(srv.customer, 'phone', ''),
                'address': addr or '',
                'pin_code': getattr(srv.customer, 'pin_code', '') or getattr(srv.customer, 'pincode', '') or '',
                'city': getattr(srv.customer, 'city', '') or '',
                'latitude': float(lat) if lat is not None else None,
                'longitude': float(lng) if lng is not None else None,
                'has_coordinates': bool(lat is not None and lng is not None),
                'location_url': loc_url or '',
                'equipment': srv.equipment or '',
                'serial_number': srv.serial_number or '',
                'contract_id': srv.amc_contract.contract_id if srv.amc_contract else None,
                'description': srv.description or '',
                'diagnosis': srv.diagnosis or '',
                'resolution_notes': srv.resolution_notes or '',
                'technicians': tech_list,
                'service_engineer': lead_data,
                'milestones': extract_milestones(srv),
            })

        for vis in vis_qs:
            tech_list, lead_data = process_assigned(vis)
            lat = vis.latitude
            lng = vis.longitude
            loc_url = vis.location_url
            if (lat is None or lng is None) and vis.amc_contract:
                lat = vis.amc_contract.latitude
                lng = vis.amc_contract.longitude
                loc_url = loc_url or vis.amc_contract.location_url

            cust_name = getattr(vis.customer, 'name', '') or getattr(vis.customer, 'company_name', 'Customer')
            cust_addr = getattr(vis.customer, 'billing_address', '')
            addr = vis.visit_address or (vis.amc_contract.site_address if vis.amc_contract else None) or cust_addr

            sites.append({
                'id': vis.id,
                'work_type': 'amc_visit',
                'service_number': vis.visit_number or f"VIS-{vis.id}",
                'visit_index': vis.visit_index,
                'status': vis.status,
                'status_display': vis.get_status_display(),
                'priority': vis.priority,
                'priority_display': vis.get_priority_display(),
                'service_type': vis.visit_type,
                'service_type_display': vis.get_visit_type_display(),
                'service_date': str(vis.visit_date),
                'customer_id': vis.customer_id,
                'customer_name': cust_name,
                'contact_person': vis.contact_person or getattr(vis.customer, 'contact_person', '') or cust_name,
                'contact_phone': vis.contact_phone or getattr(vis.customer, 'contact_number', '') or getattr(vis.customer, 'phone', ''),
                'address': addr or '',
                'pin_code': getattr(vis.customer, 'pin_code', '') or getattr(vis.customer, 'pincode', '') or '',
                'city': getattr(vis.customer, 'city', '') or '',
                'latitude': float(lat) if lat is not None else None,
                'longitude': float(lng) if lng is not None else None,
                'has_coordinates': bool(lat is not None and lng is not None),
                'location_url': loc_url or '',
                'equipment': vis.equipment or '',
                'serial_number': vis.serial_number or '',
                'contract_id': vis.amc_contract.contract_id if vis.amc_contract else None,
                'description': vis.description or '',
                'diagnosis': vis.diagnosis or '',
                'resolution_notes': vis.resolution_notes or '',
                'technicians': tech_list,
                'service_engineer': lead_data,
                'milestones': extract_milestones(vis),
            })

        status_order = {
            ServiceStatus.IN_PROGRESS: 1,
            ServiceStatus.SCHEDULED: 2,
            ServiceStatus.PENDING_PARTS: 3,
            ServiceStatus.COMPLETED: 4,
            ServiceStatus.CANCELLED: 5,
        }
        sites.sort(key=lambda s: (status_order.get(s['status'], 9), s['service_number']))

        total_sites = len(sites)
        pinned_sites = sum(1 for s in sites if s['has_coordinates'])
        scheduled_count = sum(1 for s in sites if s['status'] == ServiceStatus.SCHEDULED)
        in_progress_count = sum(1 for s in sites if s['status'] == ServiceStatus.IN_PROGRESS)
        completed_count = sum(1 for s in sites if s['status'] == ServiceStatus.COMPLETED)
        pending_parts_count = sum(1 for s in sites if s['status'] == ServiceStatus.PENDING_PARTS)

        all_tech_users = []
        if is_admin_or_subadmin(user):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            tech_users_qs = User.objects.filter(
                Q(role__name__icontains='technician') |
                Q(assigned_amc_services__isnull=False) |
                Q(assigned_amc_visits__isnull=False)
            ).filter(is_active=True).distinct().order_by('first_name', 'last_name')

            for tu in tech_users_qs:
                t_name = f"{tu.first_name} {tu.last_name}".strip() or getattr(tu, 'username', '') or tu.email
                all_tech_users.append({
                    'id': tu.id,
                    'name': t_name,
                    'phone': getattr(tu, 'mobile_no', None) or getattr(tu, 'mobile', '') or '',
                    'count_for_day': technician_map.get(tu.id, {}).get('count', 0),
                })

        # Determine active technicians for target_date who have pending/in-progress work
        # RULE 1: If any technician service is not scheduled for that day, his location is not needed.
        # RULE 2: If a technician completes work and has no more scheduled work for that day, his location disappears.
        active_tech_ids = set()

        daily_srv_all = AMCService.objects.filter(
            service_date=target_date
        ).exclude(status__in=[ServiceStatus.COMPLETED, ServiceStatus.CANCELLED]).prefetch_related('technicians')

        for s in daily_srv_all:
            for t in s.technicians.all():
                active_tech_ids.add(t.id)
            if s.service_engineer_id:
                active_tech_ids.add(s.service_engineer_id)

        daily_vis_all = AMCVisit.objects.filter(
            visit_date=target_date
        ).exclude(status__in=[ServiceStatus.COMPLETED, ServiceStatus.CANCELLED]).prefetch_related('technicians')

        for v in daily_vis_all:
            for t in v.technicians.all():
                active_tech_ids.add(t.id)
            if v.service_engineer_id:
                active_tech_ids.add(v.service_engineer_id)

        # Fallback to latest TechnicianActivity GPS if active technician doesn't have live location yet
        for t_id in active_tech_ids:
            has_live = TechnicianLiveLocation.objects.filter(technician_id=t_id, latitude__isnull=False, longitude__isnull=False).exists()
            if not has_live:
                latest_act = TechnicianActivity.objects.filter(
                    technician_id=t_id,
                    latitude__isnull=False,
                    longitude__isnull=False
                ).order_by('-created_at').first()
                if latest_act:
                    TechnicianLiveLocation.objects.update_or_create(
                        technician_id=t_id,
                        defaults={
                            'latitude': latest_act.latitude,
                            'longitude': latest_act.longitude,
                            'accuracy': latest_act.accuracy or 25.0,
                            'status': 'on_duty' if latest_act.action in ['journey_started', 'visit_started'] else 'idle',
                            'last_action': latest_act.action,
                            'current_service_id': latest_act.service_id or latest_act.visit_id,
                            'current_work_type': 'single_service' if latest_act.service_id else ('amc_visit' if latest_act.visit_id else ''),
                        }
                    )

        live_techs = TechnicianLiveLocation.objects.select_related('technician').filter(
            technician_id__in=active_tech_ids
        )
        if is_admin_or_subadmin(user):
            if tech_id:
                live_techs = live_techs.filter(technician_id=tech_id)
            technicians_output = list(technician_map.values())
            active_tech_count = len(active_tech_ids)
        else:
            # When a technician is logged in, ONLY his own location is visible (if active for today)
            live_techs = live_techs.filter(technician=user)
            technicians_output = [t for t in technician_map.values() if t.get('id') == user.id]
            active_tech_count = 1 if user.id in active_tech_ids else 0

        live_technicians_data = TechnicianLiveLocationSerializer(live_techs, many=True).data

        return Response({
            'date': str(target_date),
            'kpis': {
                'total_sites': total_sites,
                'pinned_sites': pinned_sites,
                'missing_pins_count': total_sites - pinned_sites,
                'scheduled_count': scheduled_count,
                'in_progress_count': in_progress_count,
                'completed_count': completed_count,
                'pending_parts_count': pending_parts_count,
                'active_technicians_count': active_tech_count,
            },
            'sites': sites,
            'technicians': technicians_output,
            'all_technicians': all_tech_users,
            'live_technicians': live_technicians_data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Updates latitude, longitude, and location_url for a service or visit directly from the map.
        """
        work_type = request.data.get('work_type')
        item_id = request.data.get('id')
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        loc_url = request.data.get('location_url')
        address = request.data.get('address')

        if not item_id:
            return Response({'error': 'Item ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        target = None
        if work_type in ['single_service', 'service']:
            target = AMCService.objects.filter(pk=item_id).first()
        elif work_type in ['amc_visit', 'visit']:
            target = AMCVisit.objects.filter(pk=item_id).first()
        else:
            target = AMCService.objects.filter(pk=item_id).first() or AMCVisit.objects.filter(pk=item_id).first()

        if not target:
            return Response({'error': 'Service or Visit not found.'}, status=status.HTTP_404_NOT_FOUND)

        if lat is not None:
            target.latitude = lat
        if lng is not None:
            target.longitude = lng
        if loc_url is not None:
            target.location_url = loc_url
        if address:
            if hasattr(target, 'service_address'):
                target.service_address = address
            elif hasattr(target, 'visit_address'):
                target.visit_address = address

        target.save()
        return Response({
            'message': 'Location coordinates updated successfully.',
            'id': target.id,
            'latitude': float(target.latitude) if target.latitude else None,
            'longitude': float(target.longitude) if target.longitude else None,
            'location_url': target.location_url,
        }, status=status.HTTP_200_OK)


class TechnicianLiveLocationUpdateView(APIView):
    """
    Directly updates the logged-in technician's live GPS location on the CRM field map.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        accuracy = request.data.get('accuracy')
        status_val = request.data.get('status', 'on_duty')

        if lat is None or lng is None:
            return Response(
                {'error': 'Latitude and longitude coordinates are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        live_loc, _ = TechnicianLiveLocation.objects.update_or_create(
            technician=user,
            defaults={
                'latitude': lat,
                'longitude': lng,
                'accuracy': accuracy,
                'status': status_val,
                'last_action': 'gps_manual_sync',
            }
        )

        return Response({
            'status': 'success',
            'message': 'Live location updated successfully on CRM Field Map.',
            'latitude': float(live_loc.latitude),
            'longitude': float(live_loc.longitude),
            'accuracy': live_loc.accuracy,
            'updated_at': live_loc.updated_at.isoformat(),
        }, status=status.HTTP_200_OK)


