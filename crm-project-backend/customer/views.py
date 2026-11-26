from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets, filters
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from api.models import SiteManagement
from lead_management.models import Customer, CustomerStatus, Project
from amc.models import AMCContract, AMCService, AMCVisit, ServiceStatus

from .authentication import CustomerJWTAuthentication
from .models import CustomerTicket, TicketStatus
from .serializers import (
    AdminCustomerTicketSerializer,
    CustomerAMCReadOnlySerializer,
    CustomerProfileReadOnlySerializer,
    CustomerProjectReadOnlySerializer,
    CustomerServiceReadOnlySerializer,
    CustomerSiteReadOnlySerializer,
    CustomerTicketSerializer,
    CustomerVisitReadOnlySerializer,
)


def _find_matching_customers_by_email(email_input):
    """Look up Customer records strictly by registered email ID (case-insensitive)."""
    cleaned = str(email_input or "").strip().lower()
    if not cleaned or "@" not in cleaned:
        return Customer.objects.none()

    return Customer.objects.filter(email__iexact=cleaned).order_by("-id")


def _build_customer_me_payload(customer, request=None):
    full_name = customer.contact_person or customer.name or "Customer"
    return {
        "id": customer.id,
        "customer_id": customer.id,
        "customer_code": customer.customer_code,
        "name": customer.name,
        "contact_person": customer.contact_person or "",
        "email": customer.email or "",
        "first_name": full_name,
        "last_name": "",
        "full_name": full_name,
        "mobile_no": customer.contact_number or "",
        "is_superuser": False,
        "is_staff": False,
        "is_customer": True,
        "user_type": "customer",
        "role": {"id": 0, "name": "customer", "permissions": {}},
        "customer_profile": CustomerProfileReadOnlySerializer(
            customer, context={"request": request}
        ).data,
    }


class CustomerLoginView(APIView):
    """
    Authenticates a Customer using their Email ID and hashed password,
    issuing JWT tokens scoped with user_type='customer'.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email_input = (
            request.data.get("email")
            or request.data.get("email_or_mobile")
            or ""
        ).strip()
        password = request.data.get("password") or ""

        if not email_input or not password:
            return Response(
                {"error": "Both email ID and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "@" not in email_input:
            return Response(
                {"error": "Customer login ID must be your registered email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        candidates = list(_find_matching_customers_by_email(email_input))
        if not candidates:
            return Response(
                {"error": "Invalid customer email ID or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        authenticated_customer = None
        for cust in candidates:
            if cust.password and cust.check_password(password):
                authenticated_customer = cust
                break

        if not authenticated_customer:
            return Response(
                {"error": "Invalid customer email ID or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if authenticated_customer.customer_status == CustomerStatus.INACTIVE:
            return Response(
                {"error": "This customer account is currently inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken()
        refresh["user_type"] = "customer"
        refresh["customer_id"] = authenticated_customer.id
        refresh["customer_code"] = authenticated_customer.customer_code or ""
        refresh["email"] = authenticated_customer.email or ""

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user_type": "customer",
                "user": _build_customer_me_payload(authenticated_customer, request=request),
            },
            status=status.HTTP_200_OK,
        )


class CustomerMeView(APIView):
    """Returns read-only profile details for the authenticated customer."""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_build_customer_me_payload(request.user.customer, request=request))


class CustomerDashboardView(APIView):
    """
    Read-only dashboard summary scoped strictly to the authenticated customer:
    Projects, AMC Contracts & Visit schedules, Services, and Sites.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customer = request.user.customer
        today = timezone.localdate()

        sites_qs = SiteManagement.objects.filter(customer=customer).order_by("-id")
        projects_qs = (
            Project.objects.filter(customer=customer)
            .select_related("site", "project_executive")
            .prefetch_related("technicians", "amc_contracts")
            .order_by("-created_at")
        )
        amcs_qs = (
            AMCContract.objects.filter(customer=customer)
            .select_related("site", "project", "support_coordinator")
            .prefetch_related(
                "cycles",
                "visits__technicians",
                "visits__service_engineer",
                "visits__attachments",
                "visits__technician_activities",
                "project__technicians",
            )
            .order_by("-created_at")
        )
        services_qs = (
            AMCService.objects.filter(customer=customer)
            .select_related("site", "amc_contract", "project", "service_engineer")
            .prefetch_related("technicians", "attachments", "technician_activities")
            .order_by("-service_date", "-created_at")
        )
        visits_qs = (
            AMCVisit.objects.filter(customer=customer)
            .select_related("cycle", "amc_contract", "project", "service_engineer")
            .prefetch_related("technicians", "attachments", "technician_activities")
            .order_by("visit_date", "visit_index")
        )

        # Upcoming scheduled work (both AMC visits and single services)
        upcoming_services = CustomerServiceReadOnlySerializer(
            services_qs.exclude(status__in=[ServiceStatus.COMPLETED, ServiceStatus.CANCELLED]),
            many=True,
            context={"request": request},
        ).data
        upcoming_visits = CustomerVisitReadOnlySerializer(
            visits_qs.exclude(status__in=[ServiceStatus.COMPLETED, ServiceStatus.CANCELLED]),
            many=True,
            context={"request": request},
        ).data
        upcoming_schedule = sorted(
            list(upcoming_services) + list(upcoming_visits),
            key=lambda x: str(x.get("service_date") or x.get("visit_date") or "9999-12-31"),
        )

        completed_services_count = (
            services_qs.filter(status=ServiceStatus.COMPLETED).count()
            + visits_qs.filter(status=ServiceStatus.COMPLETED).count()
        )
        total_services_count = services_qs.count() + visits_qs.count()
        active_amcs_count = amcs_qs.filter(
            status__in=["active", "expiring_soon", "renewed"]
        ).count()

        total_amc_visits_planned = sum((a.no_of_visits or 0) for a in amcs_qs)
        total_amc_visits_completed = visits_qs.filter(status=ServiceStatus.COMPLETED).count()

        return Response(
            {
                "customer": CustomerProfileReadOnlySerializer(
                    customer, context={"request": request}
                ).data,
                "kpis": {
                    "total_sites": sites_qs.count(),
                    "total_projects": projects_qs.count(),
                    "active_projects": projects_qs.exclude(project_stage="handover").count(),
                    "total_amcs": amcs_qs.count(),
                    "active_amcs": active_amcs_count,
                    "total_amc_visits_planned": total_amc_visits_planned,
                    "total_amc_visits_records": visits_qs.count(),
                    "total_amc_visits_completed": total_amc_visits_completed,
                    "total_services": services_qs.count(),
                    "completed_services": services_qs.filter(status=ServiceStatus.COMPLETED).count(),
                    "upcoming_services_count": len(upcoming_services),
                    "total_tickets": CustomerTicket.objects.filter(customer=customer).count(),
                    "open_tickets": CustomerTicket.objects.filter(
                        customer=customer, status__in=[TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
                    ).count(),
                    "total_schedule_count": len(upcoming_schedule),
                    "today": str(today),
                },
                "sites": CustomerSiteReadOnlySerializer(sites_qs, many=True).data,
                "projects": CustomerProjectReadOnlySerializer(
                    projects_qs, many=True, context={"request": request}
                ).data,
                "amcs": CustomerAMCReadOnlySerializer(
                    amcs_qs, many=True, context={"request": request}
                ).data,
                "services": CustomerServiceReadOnlySerializer(
                    services_qs, many=True, context={"request": request}
                ).data,
                "upcoming_schedule": upcoming_schedule,
            }
        )


class CustomerProjectReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Strictly read-only endpoints for the customer's projects."""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerProjectReadOnlySerializer
    http_method_names = ["get", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        return (
            Project.objects.filter(customer=self.request.user.customer)
            .select_related("site", "project_executive")
            .prefetch_related("technicians", "amc_contracts")
            .order_by("-created_at")
        )


class CustomerAMCReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    """Strictly read-only endpoints for the customer's AMC contracts & visit schedules."""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerAMCReadOnlySerializer
    http_method_names = ["get", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        return (
            AMCContract.objects.filter(customer=self.request.user.customer)
            .select_related("site", "project", "support_coordinator")
            .prefetch_related(
                "cycles",
                "visits__technicians",
                "visits__service_engineer",
                "visits__attachments",
                "visits__technician_activities",
                "project__technicians",
            )
            .order_by("-created_at")
        )


class CustomerServiceListView(APIView):
    """
    Strictly read-only list of all single services and AMC visits
    for the authenticated customer, with technician details, schedules, notes & attachments.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        customer = request.user.customer
        work_type_filter = request.query_params.get("work_type", "single_service")
        status_filter = request.query_params.get("status", "all")

        services_qs = (
            AMCService.objects.filter(customer=customer)
            .select_related("site", "amc_contract", "project", "service_engineer")
            .prefetch_related("technicians", "attachments", "technician_activities")
            .order_by("-service_date", "-created_at")
        )
        visits_qs = (
            AMCVisit.objects.filter(customer=customer)
            .select_related("cycle", "amc_contract", "project", "service_engineer")
            .prefetch_related("technicians", "attachments", "technician_activities")
            .order_by("visit_date", "visit_index")
        )

        if status_filter and status_filter != "all":
            services_qs = services_qs.filter(status=status_filter)
            visits_qs = visits_qs.filter(status=status_filter)

        combined = []
        if work_type_filter in ("all", "single_service"):
            combined.extend(
                CustomerServiceReadOnlySerializer(
                    services_qs, many=True, context={"request": request}
                ).data
            )
        if work_type_filter in ("all", "amc_visit"):
            combined.extend(
                CustomerVisitReadOnlySerializer(
                    visits_qs, many=True, context={"request": request}
                ).data
            )

        combined.sort(
            key=lambda x: str(x.get("service_date") or x.get("visit_date") or x.get("created_at") or ""),
            reverse=True,
        )

        return Response(
            {
                "count": len(combined),
                "results": combined,
            }
        )


class CustomerTicketViewSet(viewsets.ModelViewSet):
    """
    Allows an authenticated Customer to list/view their own tickets and raise new tickets.
    Customers cannot edit or delete existing tickets.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerTicketSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        return (
            CustomerTicket.objects.filter(customer=self.request.user.customer)
            .select_related("site", "project", "amc_contract", "assigned_to")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        customer = self.request.user.customer
        contact_person = (
            serializer.validated_data.get("contact_person")
            or customer.contact_person
            or customer.name
            or ""
        )
        contact_phone = (
            serializer.validated_data.get("contact_phone")
            or customer.contact_number
            or ""
        )
        serializer.save(
            customer=customer,
            status=TicketStatus.OPEN,
            contact_person=contact_person,
            contact_phone=contact_phone,
        )


class AdminCustomerTicketViewSet(viewsets.ModelViewSet):
    """
    Admin / Staff CRM endpoint for viewing all customer-raised tickets,
    assigning staff/technicians, updating status (Open / In Progress / Resolved / Closed),
    and recording resolution notes.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AdminCustomerTicketSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "priority", "category", "customer", "site", "assigned_to"]
    search_fields = [
        "ticket_number",
        "subject",
        "description",
        "customer__name",
        "customer__customer_code",
        "site__name",
        "site__site_shortcut",
        "contact_person",
        "contact_phone",
    ]
    ordering_fields = ["created_at", "updated_at", "priority", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        if getattr(self.request.user, "is_customer", False):
            raise PermissionDenied("Staff credentials required.")
        return (
            CustomerTicket.objects.all()
            .select_related("customer", "site", "project", "amc_contract", "assigned_to")
            .order_by("-created_at")
        )

