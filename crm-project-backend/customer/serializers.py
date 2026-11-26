from rest_framework import serializers
from django.contrib.auth import get_user_model
from api.models import SiteManagement
from lead_management.models import Customer, Project
from lead_management.serializers import resolve_product_names_list
from amc.models import AMCContract, AMCCycle, AMCService, AMCVisit
from amc.serializers import ServiceAttachmentSerializer, ServiceVisitNoteSerializer
from .models import CustomerTicket

User = get_user_model()


class CustomerStaffBriefSerializer(serializers.ModelSerializer):
    """Read-only summary of assigned technicians / coordinators shown to the customer."""
    full_name = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "mobile_no",
            "profile_photo",
            "role_name",
        ]

    def get_full_name(self, obj):
        name = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return name or obj.email or obj.mobile_no or "Assigned Staff"

    def get_role_name(self, obj):
        if getattr(obj, "role", None):
            return obj.role.name
        if getattr(obj, "is_superuser", False):
            return "Admin"
        return "Staff"


class CustomerSiteReadOnlySerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteManagement
        fields = [
            "id",
            "name",
            "site_shortcut",
            "site_type",
            "capacity_cars",
            "products",
            "address",
            "city",
            "state",
            "pincode",
            "owner_name",
            "owner_contact",
            "status",
        ]


class CustomerProfileReadOnlySerializer(serializers.ModelSerializer):
    customer_status_display = serializers.CharField(source="get_customer_status_display", read_only=True)
    sales_executive_details = CustomerStaffBriefSerializer(source="sales_executive", read_only=True)
    sites = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "customer_code",
            "name",
            "contact_person",
            "designation",
            "contact_number",
            "email",
            "website",
            "industry_category",
            "gst_number",
            "pan_number",
            "msme_number",
            "product_purchased",
            "customer_status",
            "customer_status_display",
            "billing_address",
            "city",
            "state",
            "pin_code",
            "amc_start_date",
            "amc_end_date",
            "sales_executive_details",
            "sites",
            "created_at",
        ]

    def get_sites(self, obj):
        sites = SiteManagement.objects.filter(customer=obj).order_by("-id")
        return CustomerSiteReadOnlySerializer(sites, many=True).data


class CustomerProjectReadOnlySerializer(serializers.ModelSerializer):
    site_details = CustomerSiteReadOnlySerializer(source="site", read_only=True)
    project_executive_details = CustomerStaffBriefSerializer(source="project_executive", read_only=True)
    technicians_details = CustomerStaffBriefSerializer(source="technicians", many=True, read_only=True)
    project_stage_display = serializers.CharField(source="get_project_stage_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    product = serializers.SerializerMethodField()
    has_amc = serializers.SerializerMethodField()
    amc_contract_number = serializers.SerializerMethodField()
    amc_contract_id = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "project_code",
            "site",
            "site_details",
            "product",
            "project_stage",
            "project_stage_display",
            "priority",
            "priority_display",
            "start_date",
            "expected_to_go_live",
            "amc_start_date",
            "amc_end_date",
            "no_of_user",
            "project_value",
            "project_scope_requirements",
            "team_members",
            "project_executive_details",
            "technicians_details",
            "has_amc",
            "amc_contract_number",
            "amc_contract_id",
            "created_at",
            "updated_at",
        ]

    def get_product(self, obj):
        return resolve_product_names_list(obj.product)

    def get_has_amc(self, obj):
        if hasattr(obj, "amc_contracts") and obj.amc_contracts.exists():
            return True
        return bool(obj.amc_start_date and obj.amc_end_date)

    def get_amc_contract_number(self, obj):
        amc = obj.amc_contracts.order_by("-id").first()
        return amc.contract_id if amc else None

    def get_amc_contract_id(self, obj):
        amc = obj.amc_contracts.order_by("-id").first()
        return amc.id if amc else None


class CustomerCycleReadOnlySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_frequency_display = serializers.CharField(source="get_payment_frequency_display", read_only=True)
    service_frequency_display = serializers.CharField(source="get_service_frequency_display", read_only=True)
    visits_count = serializers.SerializerMethodField()

    class Meta:
        model = AMCCycle
        fields = [
            "id",
            "cycle_number",
            "start_date",
            "end_date",
            "annual_value",
            "payment_frequency",
            "payment_frequency_display",
            "service_frequency",
            "service_frequency_display",
            "no_of_visits",
            "visits_count",
            "site_address",
            "status",
            "status_display",
            "remarks",
        ]

    def get_visits_count(self, obj):
        return obj.visits.count()


def _resolve_site_from_obj(obj):
    if getattr(obj, "site", None):
        return obj.site
    if getattr(obj, "amc_contract", None) and getattr(obj.amc_contract, "site", None):
        return obj.amc_contract.site
    if getattr(obj, "project", None) and getattr(obj.project, "site", None):
        return obj.project.site
    return None


class CustomerVisitReadOnlySerializer(serializers.ModelSerializer):
    visit_type_display = serializers.CharField(source="get_visit_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    cycle_number = serializers.IntegerField(source="cycle.cycle_number", read_only=True)
    amc_contract_number = serializers.CharField(source="amc_contract.contract_id", read_only=True)
    project_code = serializers.CharField(source="project.project_code", read_only=True)
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    service_engineer_details = CustomerStaffBriefSerializer(source="service_engineer", read_only=True)
    technicians_details = CustomerStaffBriefSerializer(source="technicians", many=True, read_only=True)
    notes = ServiceVisitNoteSerializer(source="technician_activities", many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    work_type = serializers.SerializerMethodField()
    service_number = serializers.CharField(source="visit_number", read_only=True)
    service_date = serializers.DateField(source="visit_date", read_only=True)
    service_type_display = serializers.CharField(source="get_visit_type_display", read_only=True)
    service_address = serializers.CharField(source="visit_address", read_only=True)

    class Meta:
        model = AMCVisit
        fields = [
            "id",
            "work_type",
            "visit_number",
            "service_number",
            "visit_index",
            "cycle",
            "cycle_number",
            "amc_contract",
            "amc_contract_number",
            "project",
            "project_code",
            "site_details",
            "site_name",
            "site_shortcut",
            "equipment",
            "serial_number",
            "visit_type",
            "visit_type_display",
            "service_type_display",
            "visit_date",
            "service_date",
            "completion_date",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "contact_person",
            "contact_phone",
            "visit_address",
            "service_address",
            "location_url",
            "description",
            "diagnosis",
            "resolution_notes",
            "customer_feedback",
            "service_engineer_details",
            "technicians_details",
            "notes",
            "attachments",
            "created_at",
        ]

    def get_work_type(self, obj):
        return "amc_visit"

    def get_site_details(self, obj):
        site = _resolve_site_from_obj(obj)
        return CustomerSiteReadOnlySerializer(site).data if site else None

    def get_site_name(self, obj):
        site = _resolve_site_from_obj(obj)
        return site.name if site else None

    def get_site_shortcut(self, obj):
        site = _resolve_site_from_obj(obj)
        return site.site_shortcut if site else None


class CustomerAMCReadOnlySerializer(serializers.ModelSerializer):
    site_details = CustomerSiteReadOnlySerializer(source="site", read_only=True)
    project_code = serializers.CharField(source="project.project_code", read_only=True)
    support_coordinator_details = CustomerStaffBriefSerializer(source="support_coordinator", read_only=True)
    amc_type_display = serializers.CharField(source="get_amc_type_display", read_only=True)
    payment_frequency_display = serializers.CharField(source="get_payment_frequency_display", read_only=True)
    service_frequency_display = serializers.CharField(source="get_service_frequency_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    cycles = CustomerCycleReadOnlySerializer(many=True, read_only=True)
    visits = serializers.SerializerMethodField()
    visits_summary = serializers.SerializerMethodField()
    assigned_technicians = serializers.SerializerMethodField()

    class Meta:
        model = AMCContract
        fields = [
            "id",
            "contract_id",
            "project",
            "project_code",
            "site",
            "site_details",
            "product",
            "amc_type",
            "amc_type_display",
            "start_date",
            "end_date",
            "annual_value",
            "payment_frequency",
            "payment_frequency_display",
            "service_frequency",
            "service_frequency_display",
            "no_of_visits",
            "site_address",
            "location_url",
            "scope_of_support",
            "status",
            "status_display",
            "support_coordinator_details",
            "cycles",
            "visits",
            "visits_summary",
            "assigned_technicians",
            "created_at",
            "updated_at",
        ]

    def get_visits(self, obj):
        qs = obj.visits.all().select_related(
            "cycle", "project", "amc_contract", "service_engineer"
        ).prefetch_related("technicians", "attachments", "technician_activities").order_by("visit_date", "visit_index")
        return CustomerVisitReadOnlySerializer(qs, many=True, context=self.context).data

    def get_visits_summary(self, obj):
        visits_qs = obj.visits.all()
        total_records = visits_qs.count()
        completed = visits_qs.filter(status="completed").count()
        in_progress = visits_qs.filter(status="in_progress").count()
        scheduled = visits_qs.filter(status="scheduled").count()
        pending_parts = visits_qs.filter(status="pending_parts").count()
        planned = obj.no_of_visits or total_records
        return {
            "total_planned": planned,
            "total_records": total_records,
            "completed": completed,
            "in_progress": in_progress,
            "scheduled": scheduled,
            "pending_parts": pending_parts,
            "remaining": max(0, max(planned, total_records) - completed),
        }

    def get_assigned_technicians(self, obj):
        tech_map = {}
        for visit in obj.visits.all().select_related("service_engineer").prefetch_related("technicians"):
            if visit.service_engineer:
                tech_map[visit.service_engineer.id] = visit.service_engineer
            for tech in visit.technicians.all():
                tech_map[tech.id] = tech
        if obj.project:
            for tech in obj.project.technicians.all():
                tech_map[tech.id] = tech
        return CustomerStaffBriefSerializer(list(tech_map.values()), many=True).data


class CustomerServiceReadOnlySerializer(serializers.ModelSerializer):
    service_category_display = serializers.CharField(source="get_service_category_display", read_only=True)
    service_type_display = serializers.CharField(source="get_service_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    amc_contract_number = serializers.CharField(source="amc_contract.contract_id", read_only=True)
    project_code = serializers.CharField(source="project.project_code", read_only=True)
    site_details = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    site_shortcut = serializers.SerializerMethodField()
    service_engineer_details = CustomerStaffBriefSerializer(source="service_engineer", read_only=True)
    technicians_details = CustomerStaffBriefSerializer(source="technicians", many=True, read_only=True)
    notes = ServiceVisitNoteSerializer(source="technician_activities", many=True, read_only=True)
    attachments = ServiceAttachmentSerializer(many=True, read_only=True)
    work_type = serializers.SerializerMethodField()

    class Meta:
        model = AMCService
        fields = [
            "id",
            "work_type",
            "service_number",
            "service_category",
            "service_category_display",
            "service_type",
            "service_type_display",
            "service_date",
            "completion_date",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "amc_contract",
            "amc_contract_number",
            "project",
            "project_code",
            "site_details",
            "site_name",
            "site_shortcut",
            "equipment",
            "serial_number",
            "contact_person",
            "contact_phone",
            "service_address",
            "location_url",
            "description",
            "diagnosis",
            "resolution_notes",
            "customer_feedback",
            "service_engineer_details",
            "technicians_details",
            "notes",
            "attachments",
            "created_at",
        ]

    def get_work_type(self, obj):
        return "single_service"

    def get_site_details(self, obj):
        site = _resolve_site_from_obj(obj)
        return CustomerSiteReadOnlySerializer(site).data if site else None

    def get_site_name(self, obj):
        site = _resolve_site_from_obj(obj)
        return site.name if site else None

    def get_site_shortcut(self, obj):
        site = _resolve_site_from_obj(obj)
        return site.site_shortcut if site else None


class CustomerTicketSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    site_details = CustomerSiteReadOnlySerializer(source="site", read_only=True)
    project_code = serializers.CharField(source="project.project_code", read_only=True)
    amc_contract_number = serializers.CharField(source="amc_contract.contract_id", read_only=True)
    assigned_to_details = CustomerStaffBriefSerializer(source="assigned_to", read_only=True)
    attachment_url = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerTicket
        fields = [
            "id",
            "ticket_number",
            "customer",
            "site",
            "site_details",
            "project",
            "project_code",
            "amc_contract",
            "amc_contract_number",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "subject",
            "description",
            "contact_person",
            "contact_phone",
            "attachment",
            "attachment_url",
            "attachment_name",
            "status",
            "status_display",
            "assigned_to",
            "assigned_to_details",
            "resolution_notes",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "ticket_number",
            "customer",
            "status",
            "assigned_to",
            "resolution_notes",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return ""
        import os
        return os.path.basename(obj.attachment.name)

    def validate(self, attrs):
        request = self.context.get("request")
        customer = getattr(getattr(request, "user", None), "customer", None)
        if customer:
            site = attrs.get("site")
            if site and site.customer_id != customer.id:
                raise serializers.ValidationError({"site": "Selected site does not belong to your account."})
            project = attrs.get("project")
            if project and project.customer_id != customer.id:
                raise serializers.ValidationError({"project": "Selected project does not belong to your account."})
            amc = attrs.get("amc_contract")
            if amc and amc.customer_id != customer.id:
                raise serializers.ValidationError({"amc_contract": "Selected AMC contract does not belong to your account."})
        return attrs


class CustomerTicketCompanyBriefSerializer(serializers.ModelSerializer):
    """Customer/company summary attached to tickets for admin/staff operations view."""
    class Meta:
        model = Customer
        fields = [
            "id",
            "customer_code",
            "name",
            "contact_person",
            "contact_number",
            "email",
            "billing_address",
            "city",
            "state",
            "pin_code",
            "customer_status",
        ]


class AdminCustomerTicketSerializer(CustomerTicketSerializer):
    """Full ticket serializer for CRM Admin/Staff with company details and status/assignment editing."""
    customer_details = CustomerTicketCompanyBriefSerializer(source="customer", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_code = serializers.CharField(source="customer.customer_code", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)

    class Meta(CustomerTicketSerializer.Meta):
        fields = CustomerTicketSerializer.Meta.fields + [
            "customer_details",
            "customer_name",
            "customer_code",
            "site_name",
        ]
        read_only_fields = [
            "id",
            "ticket_number",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    def update(self, instance, validated_data):
        from django.utils import timezone
        from .models import TicketStatus

        new_status = validated_data.get("status", instance.status)
        if new_status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
            if not instance.resolved_at:
                instance.resolved_at = timezone.now()
        else:
            instance.resolved_at = None

        return super().update(instance, validated_data)

