from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from lead_management.serializers import CustomerSerializer, ProjectSerializer
from api.serializers import CustomUserDetailsSerializer, SiteSerializers
from technician.models import TechnicianActivity


class ServiceVisitNoteSerializer(serializers.ModelSerializer):
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
from .models import AMCContract, AMCCycle, AMCStatus, AMCService, AMCVisit, ServiceStatus, ServicePriority, ServiceAttachment


class ServiceAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)

    class Meta:
        model = ServiceAttachment
        fields = [
            'id', 'service', 'visit', 'uploaded_by', 'uploaded_by_name',
            'file', 'file_url', 'file_name', 'file_type', 'stage', 'stage_display', 'title',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return "Technician"
        name = f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return name or getattr(obj.uploaded_by, 'username', '') or obj.uploaded_by.email

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

    def get_file_name(self, obj):
        if not obj.file:
            return ""
        import os
        return os.path.basename(obj.file.name)

User = get_user_model()


class AMCCycleSerializer(serializers.ModelSerializer):
    created_by_details = CustomUserDetailsSerializer(source="created_by", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_frequency_display = serializers.CharField(source="get_payment_frequency_display", read_only=True)
    service_frequency_display = serializers.CharField(source="get_service_frequency_display", read_only=True)
    visits_count = serializers.SerializerMethodField()

    def get_visits_count(self, obj):
        return obj.visits.count()

    class Meta:
        model = AMCCycle
        fields = "__all__"


def _resolve_amc_product_name(val):
    if not val:
        return ""
    val_str = str(val).strip()
    if val_str.isdigit():
        from product_management.models import Product
        p_obj = Product.objects.filter(id=int(val_str)).first()
        return p_obj.name if p_obj else ""
    if val_str.lower() in ("product", "null", "undefined", "none"):
        return ""
    return val_str


def generate_amc_visits_for_contract(amc, cycle=None, user=None):
    from datetime import timedelta
    import re

    cycle_obj = cycle or amc.cycles.order_by('-cycle_number').first()
    start_date = getattr(cycle_obj, 'start_date', None) or amc.start_date
    end_date = getattr(cycle_obj, 'end_date', None) or amc.end_date
    no_of_visits = getattr(cycle_obj, 'no_of_visits', None) or amc.no_of_visits or 4

    if not start_date or not end_date or no_of_visits <= 0:
        return []

    existing_cycle_visits = amc.visits.filter(cycle=cycle_obj) if cycle_obj else amc.visits.none()
    existing_count = existing_cycle_visits.count()
    if existing_count >= no_of_visits:
        return list(existing_cycle_visits)

    # Extract numeric portion of AMC (e.g. "AMC-001" -> 1)
    amc_ref = getattr(amc, 'contract_id', '') or f"AMC-{amc.id}"
    digits = re.findall(r'\d+', str(amc_ref))
    amc_num = int(digits[-1]) if digits else amc.id

    cycle_num = getattr(cycle_obj, 'cycle_number', 1) if cycle_obj else 1
    renewal_str = f"-R{cycle_num - 1}" if cycle_num > 1 else ""

    total_days = max(30, (end_date - start_date).days)
    interval_days = max(1, round(total_days / no_of_visits))

    new_visits = []
    for i in range(existing_count, no_of_visits):
        v_idx = i + 1
        v_date = start_date + timedelta(days=v_idx * interval_days)
        if v_date > end_date:
            v_date = end_date

        candidate = f"VIS-{amc_num}{renewal_str}-{v_idx:03d}"
        suffix_idx = v_idx
        while AMCVisit.objects.filter(visit_number=candidate).exists():
            suffix_idx += 1
            candidate = f"VIS-{amc_num}{renewal_str}-{suffix_idx:03d}"
        visit_num = candidate

        site_addr = getattr(cycle_obj, 'site_address', None) or amc.site_address or ""
        resolved_site = getattr(amc, 'site', None) or (getattr(amc.project, 'site', None) if amc.project else None)

        v = AMCVisit(
            visit_number=visit_num,
            amc_contract=amc,
            cycle=cycle_obj,
            site=resolved_site,
            visit_index=v_idx,
            customer=amc.customer,
            project=amc.project,
            equipment=amc.product,
            visit_date=v_date,
            visit_address=site_addr,
            latitude=getattr(cycle_obj, 'latitude', None) or getattr(amc, 'latitude', None),
            longitude=getattr(cycle_obj, 'longitude', None) or getattr(amc, 'longitude', None),
            location_url=getattr(cycle_obj, 'location_url', None) or getattr(amc, 'location_url', None),
            contact_person=getattr(amc.customer, 'contact_person', '') or '',
            contact_phone=getattr(amc.customer, 'contact_number', '') or getattr(amc.customer, 'mobile_number', '') or '',
            status=ServiceStatus.SCHEDULED,
            priority=ServicePriority.MEDIUM,
            description=f"Preventive Maintenance Visit #{v_idx:02d} under AMC {amc.contract_id or ''}",
            created_by=user or amc.created_by
        )
        v.save()
        new_visits.append(v)
    return new_visits


class AMCContractSerializer(serializers.ModelSerializer):
    customer_details = CustomerSerializer(source="customer", read_only=True)
    project_details = ProjectSerializer(source="project", read_only=True)
    support_coordinator_details = CustomUserDetailsSerializer(
        source="support_coordinator",
        read_only=True
    )
    created_by_details = CustomUserDetailsSerializer(
        source="created_by",
        read_only=True
    )
    cycles = AMCCycleSerializer(many=True, read_only=True)
    amc_type_display = serializers.CharField(source="get_amc_type_display", read_only=True)
    payment_frequency_display = serializers.CharField(source="get_payment_frequency_display", read_only=True)
    service_frequency_display = serializers.CharField(source="get_service_frequency_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    site_details = serializers.SerializerMethodField()

    def get_site_details(self, obj):
        if not obj.site:
            return None
        return {
            "id": obj.site.id,
            "name": obj.site.name,
            "site_shortcut": obj.site.site_shortcut,
            "address": obj.site.address,
            "city": obj.site.city,
            "state": obj.site.state,
            "pincode": obj.site.pincode,
            "owner_name": obj.site.owner_name,
            "owner_contact": obj.site.owner_contact,
            "site_type": obj.site.site_type,
            "amount": float(obj.site.amount) if obj.site.amount is not None else None,
        }

    class Meta:
        model = AMCContract
        fields = "__all__"
        read_only_fields = ('id', 'contract_id', 'created_at', 'updated_at')

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        if user and "created_by" not in validated_data:
            validated_data["created_by"] = user

        if "product" in validated_data:
            validated_data["product"] = _resolve_amc_product_name(validated_data["product"])

        start_date = validated_data.get("start_date")
        end_date = validated_data.get("end_date")
        annual_value = validated_data.get("annual_value", 0.00)
        payment_frequency = validated_data.get("payment_frequency", "quarterly")
        service_frequency = validated_data.get("service_frequency", "quarterly")
        no_of_visits = validated_data.get("no_of_visits", 4)
        site_address = validated_data.get("site_address", "")

        amc = AMCContract.objects.create(**validated_data)

        # Create initial Cycle #1
        if start_date and end_date:
            today = timezone.now().date()
            if start_date > today:
                st = AMCStatus.SCHEDULED
            elif (end_date - today).days <= 30 and end_date >= today:
                st = AMCStatus.EXPIRING_SOON
            elif end_date < today:
                st = AMCStatus.EXPIRED
            else:
                st = AMCStatus.ACTIVE

            cycle = AMCCycle.objects.create(
                amc_contract=amc,
                cycle_number=1,
                start_date=start_date,
                end_date=end_date,
                annual_value=annual_value,
                payment_frequency=payment_frequency,
                service_frequency=service_frequency,
                no_of_visits=no_of_visits,
                site_address=site_address,
                status=st,
                remarks="Initial Contract Cycle",
                created_by=user
            )
            amc.sync_active_cycle_data()
            generate_amc_visits_for_contract(amc, cycle=cycle, user=user)

        if amc.project:
            p = amc.project
            changed = False
            if start_date and not p.amc_start_date:
                p.amc_start_date = start_date
                changed = True
            if end_date and not p.amc_end_date:
                p.amc_end_date = end_date
                changed = True
            if changed:
                p.save(update_fields=['amc_start_date', 'amc_end_date'])

        return amc

    @transaction.atomic
    def update(self, instance, validated_data):
        if "product" in validated_data:
            validated_data["product"] = _resolve_amc_product_name(validated_data["product"])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update active cycle if dates/annual value changed on header
        active_cycle = instance.cycles.filter(status__in=[AMCStatus.ACTIVE, AMCStatus.EXPIRING_SOON, AMCStatus.SCHEDULED]).order_by('-cycle_number').first()
        if active_cycle:
            if "start_date" in validated_data and validated_data["start_date"]:
                active_cycle.start_date = validated_data["start_date"]
            if "end_date" in validated_data and validated_data["end_date"]:
                active_cycle.end_date = validated_data["end_date"]
            if "annual_value" in validated_data:
                active_cycle.annual_value = validated_data["annual_value"]
            if "payment_frequency" in validated_data:
                active_cycle.payment_frequency = validated_data["payment_frequency"]
            if "service_frequency" in validated_data:
                active_cycle.service_frequency = validated_data["service_frequency"]
            if "no_of_visits" in validated_data:
                active_cycle.no_of_visits = validated_data["no_of_visits"]
            if "site_address" in validated_data:
                active_cycle.site_address = validated_data["site_address"]
            active_cycle.save()

        instance.sync_active_cycle_data()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.product:
            data["product"] = _resolve_amc_product_name(instance.product)
        return data


class AMCServiceSerializer(serializers.ModelSerializer):
    customer_details = CustomerSerializer(source="customer", read_only=True)
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    amc_contract_details = AMCContractSerializer(source="amc_contract", read_only=True)
    project_details = ProjectSerializer(source="project", read_only=True)
    service_engineer_details = CustomUserDetailsSerializer(source="service_engineer", read_only=True)
    created_by_details = CustomUserDetailsSerializer(source="created_by", read_only=True)
    technicians_details = CustomUserDetailsSerializer(source="technicians", many=True, read_only=True)
    service_category_display = serializers.CharField(source="get_service_category_display", read_only=True)
    service_type_display = serializers.CharField(source="get_service_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    notes = ServiceVisitNoteSerializer(source='technician_activities', many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    issued_inventory = serializers.SerializerMethodField()

    def _resolve_site(self, obj):
        if getattr(obj, 'site', None):
            return obj.site
        if getattr(obj, 'amc_contract', None) and getattr(obj.amc_contract, 'site', None):
            return obj.amc_contract.site
        if getattr(obj, 'project', None) and getattr(obj.project, 'site', None):
            return obj.project.site
        return None

    def get_site_details(self, obj):
        site = self._resolve_site(obj)
        if site:
            from api.serializers import SiteSerializers
            return SiteSerializers(site).data
        return None

    def get_site_name(self, obj):
        site = self._resolve_site(obj)
        return site.name if site else None

    def get_site_shortcut(self, obj):
        site = self._resolve_site(obj)
        return site.site_shortcut if site else None

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

    class Meta:
        model = AMCService
        fields = "__all__"
        read_only_fields = ('id', 'service_number', 'created_at', 'updated_at')

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        if user and "created_by" not in validated_data:
            validated_data["created_by"] = user
        if not validated_data.get("site"):
            if validated_data.get("amc_contract") and getattr(validated_data["amc_contract"], "site", None):
                validated_data["site"] = validated_data["amc_contract"].site
            elif validated_data.get("project") and getattr(validated_data["project"], "site", None):
                validated_data["site"] = validated_data["project"].site
        technicians_data = validated_data.pop('technicians', None)
        service = AMCService.objects.create(**validated_data)
        if technicians_data is not None:
            service.technicians.set(technicians_data)
        return service

    @transaction.atomic
    def update(self, instance, validated_data):
        technicians_data = validated_data.pop('technicians', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if technicians_data is not None:
            instance.technicians.set(technicians_data)
        return instance


class AMCVisitSerializer(serializers.ModelSerializer):
    customer_details = CustomerSerializer(source="customer", read_only=True)
    amc_contract_details = AMCContractSerializer(source="amc_contract", read_only=True)
    project_details = ProjectSerializer(source="project", read_only=True)
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    service_engineer_details = CustomUserDetailsSerializer(source="service_engineer", read_only=True)
    created_by_details = CustomUserDetailsSerializer(source="created_by", read_only=True)
    technicians_details = CustomUserDetailsSerializer(source="technicians", many=True, read_only=True)
    visit_type_display = serializers.CharField(source="get_visit_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    cycle_number = serializers.IntegerField(source="cycle.cycle_number", read_only=True)
    notes = ServiceVisitNoteSerializer(source='technician_activities', many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    issued_inventory = serializers.SerializerMethodField()

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

    class Meta:
        model = AMCVisit
        fields = "__all__"
        read_only_fields = ('id', 'visit_number', 'created_at', 'updated_at')

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        if user and "created_by" not in validated_data:
            validated_data["created_by"] = user
        if not validated_data.get("site"):
            if validated_data.get("amc_contract") and getattr(validated_data["amc_contract"], "site", None):
                validated_data["site"] = validated_data["amc_contract"].site
            elif validated_data.get("project") and getattr(validated_data["project"], "site", None):
                validated_data["site"] = validated_data["project"].site
        technicians_data = validated_data.pop('technicians', None)
        visit = AMCVisit.objects.create(**validated_data)
        if technicians_data is not None:
            visit.technicians.set(technicians_data)
        return visit

    @transaction.atomic
    def update(self, instance, validated_data):
        technicians_data = validated_data.pop('technicians', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if technicians_data is not None:
            instance.technicians.set(technicians_data)
        return instance
