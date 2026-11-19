from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Q
from api.permissions import is_admin_or_subadmin
from .models import AMCContract, AMCStatus, AMCCycle, AMCService, AMCVisit, ServiceCategory, ServiceStatus, ServiceAttachment
from .serializers import (
    AMCContractSerializer,
    AMCServiceSerializer,
    AMCVisitSerializer,
    generate_amc_visits_for_contract,
    ServiceAttachmentSerializer,
)
from technician.models import TechnicianActivity
from technician.serializers import TechnicianActivitySerializer


class AMCContractViewSet(viewsets.ModelViewSet):
    serializer_class = AMCContractSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, OrderingFilter]
    filterset_fields = ['customer', 'project', 'site', 'support_coordinator', 'status', 'amc_type', 'payment_frequency']
    search_fields = ['contract_id', 'customer__company_name', 'customer__name', 'product', 'project__project_code', 'site__name', 'site__site_shortcut']
    ordering_fields = ['created_at', 'start_date', 'end_date', 'annual_value', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = AMCContract.objects.all().order_by('-updated_at', '-created_at')
        if not is_admin_or_subadmin(user):
            qs = qs.filter(
                Q(support_coordinator=user) |
                Q(created_by=user) |
                Q(customer__sales_executive=user) |
                Q(customer__lead__assigned_executive=user) |
                Q(customer__lead__created_by=user)
            )
        # Synchronize cycle dates and active statuses for fetched contracts
        for amc in qs[:50]:
            amc.sync_active_cycle_data()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {'created_by': user}
        if not is_admin_or_subadmin(user) and not serializer.validated_data.get('support_coordinator'):
            kwargs['support_coordinator'] = user

        prod_val = serializer.validated_data.get('product')
        if prod_val and str(prod_val).strip().isdigit():
            from product_management.models import Product
            p_obj = Product.objects.filter(id=int(str(prod_val).strip())).first()
            if p_obj:
                serializer.validated_data['product'] = p_obj.name

        serializer.save(**kwargs)

    def perform_update(self, serializer):
        prod_val = serializer.validated_data.get('product')
        if prod_val and str(prod_val).strip().isdigit():
            from product_management.models import Product
            p_obj = Product.objects.filter(id=int(str(prod_val).strip())).first()
            if p_obj:
                serializer.validated_data['product'] = p_obj.name
        serializer.save()

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        amc = self.get_object()
        if amc.status == AMCStatus.INACTIVE:
            amc.status = AMCStatus.ACTIVE
            for c in amc.cycles.all():
                if c.status == AMCStatus.INACTIVE:
                    c.status = AMCStatus.ACTIVE
                    c.save(update_fields=['status'])
        else:
            amc.status = AMCStatus.INACTIVE
            for c in amc.cycles.all():
                c.status = AMCStatus.INACTIVE
                c.save(update_fields=['status'])
        amc.save()
        amc.sync_active_cycle_data()
        serializer = self.get_serializer(amc)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='renew')
    def renew_contract(self, request, pk=None):
        amc = self.get_object()
        new_start_date = request.data.get("new_start_date")
        new_end_date = request.data.get("new_end_date")
        new_annual_value = request.data.get("new_annual_value", amc.annual_value)
        payment_frequency = request.data.get("payment_frequency", amc.payment_frequency)
        service_frequency = request.data.get("service_frequency", amc.service_frequency or "quarterly")
        no_of_visits = request.data.get("no_of_visits", amc.no_of_visits if amc.no_of_visits is not None else 4)
        site_address = request.data.get("site_address", amc.site_address or "")
        remarks = request.data.get("remarks", "")

        if not new_start_date or not new_end_date:
            return Response(
                {"error": "Both new_start_date and new_end_date are required for renewal."},
                status=status.HTTP_400_BAD_REQUEST
            )

        start_date_obj = parse_date(str(new_start_date)) if isinstance(new_start_date, str) else new_start_date
        end_date_obj = parse_date(str(new_end_date)) if isinstance(new_end_date, str) else new_end_date

        if not start_date_obj or not end_date_obj:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        today = timezone.now().date()
        if start_date_obj > today:
            cycle_status = AMCStatus.SCHEDULED
        elif (end_date_obj - today).days <= 30 and end_date_obj >= today:
            cycle_status = AMCStatus.EXPIRING_SOON
        elif end_date_obj < today:
            cycle_status = AMCStatus.EXPIRED
        else:
            cycle_status = AMCStatus.ACTIVE

        with transaction.atomic():
            last_cycle = amc.cycles.order_by('-cycle_number').first()
            next_cycle_num = (last_cycle.cycle_number + 1) if last_cycle else 1

            new_cycle = AMCCycle.objects.create(
                amc_contract=amc,
                cycle_number=next_cycle_num,
                start_date=start_date_obj,
                end_date=end_date_obj,
                annual_value=new_annual_value,
                payment_frequency=payment_frequency,
                service_frequency=service_frequency,
                no_of_visits=no_of_visits,
                site_address=site_address,
                status=cycle_status,
                remarks=remarks,
                created_by=request.user if request.user.is_authenticated else None
            )

            amc.sync_active_cycle_data()
            generate_amc_visits_for_contract(amc, cycle=new_cycle, user=request.user)

            support_coordinator_id = request.data.get("support_coordinator")
            if support_coordinator_id:
                try:
                    amc.support_coordinator_id = support_coordinator_id
                    amc.save(update_fields=['support_coordinator'])
                except Exception:
                    pass

            if amc.project:
                amc.project.amc_start_date = start_date_obj
                amc.project.amc_end_date = end_date_obj
                amc.project.save(update_fields=['amc_start_date', 'amc_end_date'])

        serializer = self.get_serializer(amc)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AMCServiceViewSet(viewsets.ModelViewSet):
    serializer_class = AMCServiceSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, OrderingFilter]
    filterset_fields = ['customer', 'project', 'site', 'service_type', 'status', 'priority', 'service_engineer']
    search_fields = ['service_number', 'customer__company_name', 'customer__name', 'site__name', 'site__site_shortcut', 'description', 'resolution_notes']
    ordering_fields = ['service_date', 'created_at', 'status', 'priority', 'service_cost']

    def get_queryset(self):
        user = self.request.user
        qs = AMCService.objects.filter(service_category=ServiceCategory.SINGLE_SERVICE).order_by('-service_date', '-created_at')
        if not is_admin_or_subadmin(user):
            qs = qs.filter(
                Q(service_engineer=user) |
                Q(technicians=user) |
                Q(created_by=user) |
                Q(customer__sales_executive=user)
            ).distinct()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {'created_by': user, 'service_category': ServiceCategory.SINGLE_SERVICE}
        if not is_admin_or_subadmin(user) and not serializer.validated_data.get('service_engineer'):
            kwargs['service_engineer'] = user
        serializer.save(**kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status in [ServiceStatus.IN_PROGRESS, 'in_progress']:
            req_date_str = request.data.get('service_date')
            scheduled_date = parse_date(req_date_str) if req_date_str else instance.service_date
            if scheduled_date and scheduled_date > timezone.localdate():
                return Response(
                    {'error': f"Cannot start service before scheduled date ({scheduled_date.strftime('%d-%m-%Y')})."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if new_status in [ServiceStatus.COMPLETED, 'completed']:
            req_date_str = request.data.get('service_date')
            scheduled_date = parse_date(req_date_str) if req_date_str else instance.service_date
            if scheduled_date and scheduled_date > timezone.localdate():
                return Response(
                    {'error': f"Cannot complete service before scheduled date ({scheduled_date.strftime('%d-%m-%Y')})."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if instance.status != ServiceStatus.IN_PROGRESS and instance.status != ServiceStatus.COMPLETED:
                return Response(
                    {'error': "Service must be started (In Progress) before it can be marked as completed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().update(request, *args, partial=partial, **kwargs)

    @action(detail=True, methods=['post'], url_path='allocate-technicians')
    def allocate_technicians(self, request, pk=None):
        service = self.get_object()
        technician_ids = request.data.get('technician_ids') or request.data.get('technicians', [])
        service.technicians.set(technician_ids)
        serializer = self.get_serializer(service)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='notes')
    def notes(self, request, pk=None):
        service = self.get_object()
        if request.method == 'GET':
            qs = service.technician_activities.all().order_by('-created_at')
            return Response(TechnicianActivitySerializer(qs, many=True).data, status=status.HTTP_200_OK)

        notes_content = request.data.get('notes', '').strip()
        if not notes_content:
            return Response({'error': 'Notes content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
        action_type = request.data.get('action') or request.data.get('note_type', 'general_note')
        user = request.user if request.user.is_authenticated else None
        activity = TechnicianActivity.objects.create(
            service=service,
            technician=user,
            action=action_type,
            notes=notes_content
        )
        return Response(TechnicianActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='attachments', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def attachments(self, request, pk=None):
        service = self.get_object()
        if request.method == 'GET':
            qs = service.attachments.all().order_by('-created_at')
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
                service=service,
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


class AMCVisitViewSet(viewsets.ModelViewSet):
    serializer_class = AMCVisitSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, OrderingFilter]
    filterset_fields = ['customer', 'amc_contract', 'cycle', 'project', 'visit_type', 'status', 'priority', 'service_engineer']
    search_fields = ['visit_number', 'customer__company_name', 'customer__name', 'description', 'resolution_notes']
    ordering_fields = ['visit_date', 'visit_index', 'created_at', 'status', 'priority']

    def get_queryset(self):
        user = self.request.user
        qs = AMCVisit.objects.all().order_by('visit_date', 'visit_index', '-created_at')
        if not is_admin_or_subadmin(user):
            qs = qs.filter(
                Q(service_engineer=user) |
                Q(technicians=user) |
                Q(created_by=user) |
                Q(customer__sales_executive=user) |
                Q(amc_contract__support_coordinator=user)
            ).distinct()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {'created_by': user}
        if not is_admin_or_subadmin(user) and not serializer.validated_data.get('service_engineer'):
            kwargs['service_engineer'] = user
        serializer.save(**kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status in [ServiceStatus.IN_PROGRESS, 'in_progress']:
            req_date_str = request.data.get('visit_date') or request.data.get('service_date')
            scheduled_date = parse_date(req_date_str) if req_date_str else (instance.visit_date or instance.service_date)
            if scheduled_date and scheduled_date > timezone.localdate():
                return Response(
                    {'error': f"Cannot start visit before scheduled date ({scheduled_date.strftime('%d-%m-%Y')})."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if new_status in [ServiceStatus.COMPLETED, 'completed']:
            req_date_str = request.data.get('visit_date') or request.data.get('service_date')
            scheduled_date = parse_date(req_date_str) if req_date_str else (instance.visit_date or instance.service_date)
            if scheduled_date and scheduled_date > timezone.localdate():
                return Response(
                    {'error': f"Cannot complete visit before scheduled date ({scheduled_date.strftime('%d-%m-%Y')})."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if instance.status != ServiceStatus.IN_PROGRESS and instance.status != ServiceStatus.COMPLETED:
                return Response(
                    {'error': "Visit must be started (In Progress) before it can be marked as completed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().update(request, *args, partial=partial, **kwargs)

    @action(detail=True, methods=['post'], url_path='allocate-technicians')
    def allocate_technicians(self, request, pk=None):
        visit = self.get_object()
        technician_ids = request.data.get('technician_ids') or request.data.get('technicians', [])
        visit.technicians.set(technician_ids)
        serializer = self.get_serializer(visit)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        visit = self.get_object()
        new_date = request.data.get('visit_date') or request.data.get('service_date')
        if not new_date:
            return Response({'error': 'visit_date is required'}, status=status.HTTP_400_BAD_REQUEST)
        visit.visit_date = parse_date(str(new_date)) if isinstance(new_date, str) else new_date
        if 'description' in request.data:
            visit.description = request.data['description']
        visit.save()
        serializer = self.get_serializer(visit)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='notes')
    def notes(self, request, pk=None):
        visit = self.get_object()
        if request.method == 'GET':
            qs = visit.technician_activities.all().order_by('-created_at')
            return Response(TechnicianActivitySerializer(qs, many=True).data, status=status.HTTP_200_OK)

        notes_content = request.data.get('notes', '').strip()
        if not notes_content:
            return Response({'error': 'Notes content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
        action_type = request.data.get('action') or request.data.get('note_type', 'general_note')
        user = request.user if request.user.is_authenticated else None
        activity = TechnicianActivity.objects.create(
            visit=visit,
            technician=user,
            action=action_type,
            notes=notes_content
        )
        return Response(TechnicianActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='attachments', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def attachments(self, request, pk=None):
        visit = self.get_object()
        if request.method == 'GET':
            qs = visit.attachments.all().order_by('-created_at')
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
                visit=visit,
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
