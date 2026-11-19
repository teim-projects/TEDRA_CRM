from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from amc.models import AMCService, AMCVisit, ServiceStatus
from amc.serializers import AMCServiceSerializer, AMCVisitSerializer, ServiceAttachmentSerializer
from .models import TechnicianActivity, TechnicianLiveLocation

User = get_user_model()


class TechnicianLiveLocationSerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()
    technician_phone = serializers.SerializerMethodField()

    class Meta:
        model = TechnicianLiveLocation
        fields = [
            'id', 'technician', 'technician_name', 'technician_phone',
            'latitude', 'longitude', 'accuracy', 'status',
            'current_service_id', 'current_work_type', 'last_action', 'updated_at'
        ]

    def get_technician_name(self, obj):
        if not obj.technician:
            return ""
        name = f"{obj.technician.first_name} {obj.technician.last_name}".strip()
        return name or getattr(obj.technician, 'username', '') or obj.technician.email

    def get_technician_phone(self, obj):
        if not obj.technician:
            return ""
        return getattr(obj.technician, 'mobile_no', None) or getattr(obj.technician, 'mobile', '') or ''


class TechnicianActivitySerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = TechnicianActivity
        fields = [
            'id', 'service', 'visit', 'technician', 'technician_name',
            'action', 'action_display', 'notes', 'latitude', 'longitude', 'accuracy',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_technician_name(self, obj):
        if not obj.technician:
            return "System"
        name = f"{obj.technician.first_name} {obj.technician.last_name}".strip()
        return name or getattr(obj.technician, 'username', None) or obj.technician.email


class TechnicianServiceDetailSerializer(serializers.ModelSerializer):
    work_type = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_address = serializers.SerializerMethodField()
    customer_city = serializers.SerializerMethodField()
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    contract_id = serializers.CharField(source='amc_contract.contract_id', read_only=True, default='')
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    service_category_display = serializers.CharField(source='get_service_category_display', read_only=True)
    lead_technician_name = serializers.SerializerMethodField()
    assigned_technicians_list = serializers.SerializerMethodField()
    technicians_details = serializers.SerializerMethodField()
    activities = TechnicianActivitySerializer(source='technician_activities', many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    milestones = serializers.SerializerMethodField()
    issued_inventory = serializers.SerializerMethodField()

    class Meta:
        model = AMCService
        fields = [
            'id',
            'work_type',
            'service_number',
            'service_category',
            'service_category_display',
            'service_type',
            'service_type_display',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'service_date',
            'completion_date',
            'equipment',
            'serial_number',
            'description',
            'diagnosis',
            'resolution_notes',
            'customer_feedback',
            'service_cost',
            'contact_person',
            'contact_phone',
            'service_address',
            'latitude',
            'longitude',
            'location_url',
            'customer',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_address',
            'customer_city',
            'site',
            'site_name',
            'site_shortcut',
            'site_details',
            'amc_contract',
            'contract_id',
            'project',
            'service_engineer',
            'lead_technician_name',
            'technicians',
            'technicians_details',
            'assigned_technicians_list',
            'activities',
            'attachments',
            'milestones',
            'issued_inventory',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'service_number',
            'service_category_display',
            'service_type_display',
            'status_display',
            'priority_display',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_address',
            'customer_city',
            'contract_id',
            'lead_technician_name',
            'technicians_details',
            'assigned_technicians_list',
            'activities',
            'created_at',
            'updated_at',
        ]

    def get_work_type(self, obj):
        return 'single_service'

    def get_site_details(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        if site_obj:
            from api.serializers import SiteSerializers
            return SiteSerializers(site_obj).data
        return None

    def get_site_name(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        return site_obj.name if site_obj else None

    def get_site_shortcut(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        return site_obj.site_shortcut if site_obj else None

    def get_customer_name(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'company_name', None) or getattr(obj.customer, 'name', '')

    def get_customer_phone(self, obj):
        if obj.contact_phone:
            return obj.contact_phone
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'phone', '') or getattr(obj.customer, 'mobile', '')

    def get_customer_email(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'email', '')

    def get_customer_address(self, obj):
        if obj.service_address:
            return obj.service_address
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'address', '') or getattr(obj.customer, 'city', '')

    def get_customer_city(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'city', '')

    def get_lead_technician_name(self, obj):
        if not obj.service_engineer:
            return ""
        name = f"{obj.service_engineer.first_name or ''} {obj.service_engineer.last_name or ''}".strip()
        return name or getattr(obj.service_engineer, 'username', None) or getattr(obj.service_engineer, 'email', '')

    def get_assigned_technicians_list(self, obj):
        users = obj.technicians.all()
        return [
            {
                'id': u.id,
                'name': f"{u.first_name or ''} {u.last_name or ''}".strip() or getattr(u, 'username', None) or u.email,
                'first_name': u.first_name or '',
                'last_name': u.last_name or '',
                'username': getattr(u, 'username', '') or u.email,
                'email': u.email or '',
                'mobile_no': getattr(u, 'mobile_no', None) or getattr(u, 'mobile', '') or '',
                'role': u.role.name if getattr(u, 'role', None) else 'Technician',
            }
            for u in users
        ]

    def get_technicians_details(self, obj):
        return self.get_assigned_technicians_list(obj)

    def get_milestones(self, obj):
        acts = list(obj.technician_activities.all().order_by('created_at'))
        journey = next((a for a in acts if a.action == 'journey_started'), None)
        visit = next((a for a in acts if a.action == 'visit_started'), None)
        completed = next((a for a in acts if a.action == 'job_completed'), None)
        return {
            'journey_started_at': journey.created_at.isoformat() if journey else None,
            'journey_lat': float(journey.latitude) if journey and journey.latitude is not None else None,
            'journey_lng': float(journey.longitude) if journey and journey.longitude is not None else None,
            'journey_accuracy': journey.accuracy if journey else None,
            'journey_technician': (f"{journey.technician.first_name} {journey.technician.last_name}".strip() or getattr(journey.technician, 'username', None) or journey.technician.email) if journey and journey.technician else None,
            'visit_started_at': visit.created_at.isoformat() if visit else None,
            'visit_lat': float(visit.latitude) if visit and visit.latitude is not None else None,
            'visit_lng': float(visit.longitude) if visit and visit.longitude is not None else None,
            'visit_accuracy': visit.accuracy if visit else None,
            'visit_technician': (f"{visit.technician.first_name} {visit.technician.last_name}".strip() or getattr(visit.technician, 'username', None) or visit.technician.email) if visit and visit.technician else None,
            'job_completed_at': completed.created_at.isoformat() if completed else None,
            'job_completed_lat': float(completed.latitude) if completed and completed.latitude is not None else None,
            'job_completed_lng': float(completed.longitude) if completed and completed.longitude is not None else None,
            'job_completed_accuracy': completed.accuracy if completed else None,
            'job_completed_technician': (f"{completed.technician.first_name} {completed.technician.last_name}".strip() or getattr(completed.technician, 'username', None) or completed.technician.email) if completed and completed.technician else None,
        }

    def get_issued_inventory(self, obj):
        try:
            txs = obj.issued_inventory.all().select_related('item', 'technician')
            return [
                {
                    'id': t.id,
                    'item_id': t.item_id,
                    'item_name': t.item.name,
                    'item_code': t.item.item_code,
                    'capacity': t.item.capacity or '',
                    'unit': t.item.unit,
                    'transaction_type': t.transaction_type,
                    'transaction_type_display': t.get_transaction_type_display(),
                    'quantity': str(t.quantity),
                    'technician_name': (f"{t.technician.first_name} {t.technician.last_name}".strip() or getattr(t.technician, 'email', '')) if t.technician else "",
                    'created_at': t.created_at.isoformat() if t.created_at else None,
                    'notes': t.notes or ''
                }
                for t in txs
            ]
        except Exception:
            return []


class TechnicianVisitDetailSerializer(serializers.ModelSerializer):
    work_type = serializers.SerializerMethodField()
    service_number = serializers.CharField(source='visit_number', read_only=True)
    service_category = serializers.SerializerMethodField()
    service_category_display = serializers.SerializerMethodField()
    service_type = serializers.CharField(source='visit_type', read_only=True)
    service_type_display = serializers.CharField(source='get_visit_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    service_date = serializers.DateField(source='visit_date', read_only=True)
    service_address = serializers.CharField(source='visit_address', read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_address = serializers.SerializerMethodField()
    customer_city = serializers.SerializerMethodField()
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    contract_id = serializers.CharField(source='amc_contract.contract_id', read_only=True, default='')
    lead_technician_name = serializers.SerializerMethodField()
    assigned_technicians_list = serializers.SerializerMethodField()
    technicians_details = serializers.SerializerMethodField()
    activities = TechnicianActivitySerializer(source='technician_activities', many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    milestones = serializers.SerializerMethodField()
    issued_inventory = serializers.SerializerMethodField()

    class Meta:
        model = AMCVisit
        fields = [
            'id',
            'work_type',
            'visit_number',
            'visit_index',
            'service_number',
            'service_category',
            'service_category_display',
            'service_type',
            'service_type_display',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'service_date',
            'completion_date',
            'equipment',
            'serial_number',
            'description',
            'diagnosis',
            'resolution_notes',
            'customer_feedback',
            'contact_person',
            'contact_phone',
            'service_address',
            'latitude',
            'longitude',
            'location_url',
            'customer',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_address',
            'customer_city',
            'site_name',
            'site_shortcut',
            'site_details',
            'amc_contract',
            'contract_id',
            'project',
            'service_engineer',
            'lead_technician_name',
            'technicians',
            'technicians_details',
            'assigned_technicians_list',
            'activities',
            'attachments',
            'milestones',
            'issued_inventory',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_work_type(self, obj):
        return 'amc_visit'

    def get_site_details(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        if site_obj:
            from api.serializers import SiteSerializers
            return SiteSerializers(site_obj).data
        return None

    def get_site_name(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        return site_obj.name if site_obj else None

    def get_site_shortcut(self, obj):
        site_obj = getattr(obj, 'site', None)
        if not site_obj and obj.amc_contract and hasattr(obj.amc_contract, 'site'):
            site_obj = obj.amc_contract.site
        if not site_obj and obj.project and hasattr(obj.project, 'site'):
            site_obj = obj.project.site
        return site_obj.site_shortcut if site_obj else None

    def get_service_category(self, obj):
        return 'amc_service'

    def get_service_category_display(self, obj):
        return 'AMC Visit'

    def get_customer_name(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'company_name', None) or getattr(obj.customer, 'name', '')

    def get_customer_phone(self, obj):
        if obj.contact_phone:
            return obj.contact_phone
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'phone', '') or getattr(obj.customer, 'mobile', '')

    def get_customer_email(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'email', '')

    def get_customer_address(self, obj):
        if obj.visit_address:
            return obj.visit_address
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'address', '') or getattr(obj.customer, 'city', '')

    def get_customer_city(self, obj):
        if not obj.customer:
            return ""
        return getattr(obj.customer, 'city', '')

    def get_lead_technician_name(self, obj):
        if not obj.service_engineer:
            return ""
        name = f"{obj.service_engineer.first_name or ''} {obj.service_engineer.last_name or ''}".strip()
        return name or getattr(obj.service_engineer, 'username', None) or getattr(obj.service_engineer, 'email', '')

    def get_assigned_technicians_list(self, obj):
        users = obj.technicians.all()
        return [
            {
                'id': u.id,
                'name': f"{u.first_name or ''} {u.last_name or ''}".strip() or getattr(u, 'username', None) or u.email,
                'first_name': u.first_name or '',
                'last_name': u.last_name or '',
                'username': getattr(u, 'username', '') or u.email,
                'email': u.email or '',
                'mobile_no': getattr(u, 'mobile_no', None) or getattr(u, 'mobile', '') or '',
                'role': u.role.name if getattr(u, 'role', None) else 'Technician',
            }
            for u in users
        ]

    def get_technicians_details(self, obj):
        return self.get_assigned_technicians_list(obj)

    def get_milestones(self, obj):
        acts = list(obj.technician_activities.all().order_by('created_at'))
        journey = next((a for a in acts if a.action == 'journey_started'), None)
        visit = next((a for a in acts if a.action == 'visit_started'), None)
        completed = next((a for a in acts if a.action == 'job_completed'), None)
        return {
            'journey_started_at': journey.created_at.isoformat() if journey else None,
            'journey_lat': float(journey.latitude) if journey and journey.latitude is not None else None,
            'journey_lng': float(journey.longitude) if journey and journey.longitude is not None else None,
            'journey_accuracy': journey.accuracy if journey else None,
            'journey_technician': (f"{journey.technician.first_name} {journey.technician.last_name}".strip() or getattr(journey.technician, 'username', None) or journey.technician.email) if journey and journey.technician else None,
            'visit_started_at': visit.created_at.isoformat() if visit else None,
            'visit_lat': float(visit.latitude) if visit and visit.latitude is not None else None,
            'visit_lng': float(visit.longitude) if visit and visit.longitude is not None else None,
            'visit_accuracy': visit.accuracy if visit else None,
            'visit_technician': (f"{visit.technician.first_name} {visit.technician.last_name}".strip() or getattr(visit.technician, 'username', None) or visit.technician.email) if visit and visit.technician else None,
            'job_completed_at': completed.created_at.isoformat() if completed else None,
            'job_completed_lat': float(completed.latitude) if completed and completed.latitude is not None else None,
            'job_completed_lng': float(completed.longitude) if completed and completed.longitude is not None else None,
            'job_completed_accuracy': completed.accuracy if completed else None,
            'job_completed_technician': (f"{completed.technician.first_name} {completed.technician.last_name}".strip() or getattr(completed.technician, 'username', None) or completed.technician.email) if completed and completed.technician else None,
        }

    def get_issued_inventory(self, obj):
        try:
            txs = obj.issued_inventory.all().select_related('item', 'technician')
            return [
                {
                    'id': t.id,
                    'item_id': t.item_id,
                    'item_name': t.item.name,
                    'item_code': t.item.item_code,
                    'capacity': t.item.capacity or '',
                    'unit': t.item.unit,
                    'transaction_type': t.transaction_type,
                    'transaction_type_display': t.get_transaction_type_display(),
                    'quantity': str(t.quantity),
                    'technician_name': (f"{t.technician.first_name} {t.technician.last_name}".strip() or getattr(t.technician, 'email', '')) if t.technician else "",
                    'created_at': t.created_at.isoformat() if t.created_at else None,
                    'notes': t.notes or ''
                }
                for t in txs
            ]
        except Exception:
            return []

