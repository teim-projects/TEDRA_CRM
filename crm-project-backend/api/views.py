from django.db.models import Q
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework.response import Response
from rest_framework import status
from google.oauth2 import id_token  # type: ignore
from google.auth.transport import requests  # type: ignore
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView 
from rest_framework import viewsets
from .serializers import PasswordResetRequestSerializer, PasswordResetConfirmSerializer
import os
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication 
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import CustomUser, Role, BranchManagement, SiteManagement, MessageTemplate
from .serializers import AddStaffSerializer, RoleSerializer, BranchSerializers, SiteSerializers, MessageTemplateSerializer
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from .permissions import IsAdminOrSubAdmin ,StaffObjectPermission
from .pagination import StaffPagination
from rest_framework.decorators import action
User = get_user_model()

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    # callback_url = "http://127.0.0.1:8000/accounts/google/login/callback/"
    callback_url = os.getenv('GOOGLE_CALLBACK_URL')

    def post(self, request, *args, **kwargs):
        """
        Verify Google token → get/create user → issue JWT tokens.
        """
        token = request.data.get("access_token")
        if not token:
            return Response({"error": "Missing access_token"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # ✅ Verify token with Google
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                os.getenv('GOOGLE_CLIENT_ID')
                # "129181997839-0rlmm080229tetuka9c0i83la4r4lhdt.apps.googleusercontent.com"
            )

            email = idinfo.get("email")
            name = idinfo.get("name", "")
            picture = idinfo.get("picture", "")

            # ✅ Get or create user
            user, created = User.objects.get_or_create(email=email)
            if created:
                user.is_active = True
                if hasattr(user, "full_name"):
                    user.full_name = name
                if hasattr(user, "profile_photo") and picture:
                    user.profile_photo = picture
                user.save()

            # ✅ Generate JWT tokens for this user
            refresh = RefreshToken.for_user(user)
            data = {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "email": user.email,
                "name": name,
                "message": "Google login successful"
            }

            return Response(data, status=status.HTTP_200_OK)

        except ValueError as ve:
            return Response({"error": "Invalid Google token", "details": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# Custom password reset and set password 

class PasswordResetRequestView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password reset email sent."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


# Role section
class RoleViewSet(viewsets.ModelViewSet):
    """
    CRUD for Role model.
    Only accessible to admin/subadmin or superuser.
    Technician is a fixed system role along with admin.
    """
    serializer_class = RoleSerializer
    authentication_classes = [JWTAuthentication]   
    permission_classes = [IsAuthenticated, IsAdminOrSubAdmin]
    pagination_class = None

    def get_queryset(self):
        # Ensure default Technician role always exists
        Role.objects.get_or_create(name='Technician')
        return Role.objects.all().order_by('id')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.name.strip().lower() in ['admin', 'technician']:
            return Response(
                {"detail": f"The '{instance.name}' role is a fixed system role and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.name.strip().lower() in ['admin', 'technician']:
            new_name = request.data.get('name')
            if new_name and new_name.strip().lower() != instance.name.lower():
                return Response(
                    {"detail": f"The '{instance.name}' role is a fixed system role and its name cannot be changed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().update(request, *args, **kwargs)


# Add Staff section

class StaffViewSet(viewsets.ModelViewSet):
    serializer_class = AddStaffSerializer
    permission_classes = [IsAuthenticated, IsAdminOrSubAdmin, StaffObjectPermission]
    authentication_classes = [JWTAuthentication]  
    pagination_class = StaffPagination 
    filter_backends = [DjangoFilterBackend , filters.SearchFilter]
    search_fields = ['^first_name', '=email', 'mobile_no','role__name']
    filterset_fields = ['role']

    def get_queryset(self):
        return CustomUser.objects.filter(is_staff=True)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'], url_path='all' , permission_classes=[IsAuthenticated])
    def all_staff(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)



from rest_framework.views import APIView

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        role_data = None

        if user.role:
            role_data = {
                "id": user.role.id,
                "name": user.role.name,
                "permissions": user.role.permissions or {}
            }
        elif user.is_superuser:
            role_data = {"id": 1, "name": "admin", "permissions": {}}
        else:
            role_data = {"id": 0, "name": "staff", "permissions": {}}

        return Response({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "mobile_no": user.mobile_no,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
            "role": role_data
        })


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password") or request.data.get("new_password1")

        if not new_password or len(new_password) < 6:
            return Response({"error": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        if old_password:
            if not user.check_password(old_password):
                return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)




# --------------------------------------------------------------------------------
# Branch Management Viewsets
# --------------------------------------------------------------------------------

class BranchManagementViewSet(viewsets.ModelViewSet):
    queryset = BranchManagement.objects.all()
    serializer_class = BranchSerializers
    authentication_classes = [JWTAuthentication]   
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = [
        'name', '=email', 'primary_contact',
        'city', 'state',
    ]
    filterset_fields = ['city', 'state']


# --------------------------------------------------------------------------------
# Site Management Viewsets
# --------------------------------------------------------------------------------

class SiteManagementViewSet(viewsets.ModelViewSet):
    queryset = SiteManagement.objects.all().order_by('-id')
    serializer_class = SiteSerializers
    authentication_classes = [JWTAuthentication]   
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'name', 'pincode', 'owner_contact', 'owner_name',
        'city', 'state', 'site_shortcut', 'site_type',
        'customer__name', 'customer__customer_code',
        'lead__company_name'
    ]

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer')
        lead_id = self.request.query_params.get('lead')

        customer_lead_ids = []
        if customer_id:
            try:
                from lead_management.models import Customer
                c_lead = Customer.objects.filter(id=customer_id).values_list('lead_id', flat=True).first()
                if c_lead:
                    customer_lead_ids.append(c_lead)
            except Exception:
                pass

        if customer_id and lead_id:
            q_cond = (
                Q(customer_id=customer_id) |
                Q(lead_id=lead_id) |
                Q(lead__converted_to_customer_id=customer_id) |
                Q(lead__converted_customer_records__id=customer_id)
            )
            if customer_lead_ids:
                q_cond |= Q(lead_id__in=customer_lead_ids)
            qs = qs.filter(q_cond)
        elif customer_id:
            q_cond = (
                Q(customer_id=customer_id) |
                Q(lead__converted_to_customer_id=customer_id) |
                Q(lead__converted_customer_records__id=customer_id)
            )
            if customer_lead_ids:
                q_cond |= Q(lead_id__in=customer_lead_ids)
            qs = qs.filter(q_cond)
        elif lead_id:
            qs = qs.filter(
                Q(lead_id=lead_id) |
                Q(customer__lead_id=lead_id) |
                Q(customer__converted_from_lead__id=lead_id)
            )
        return qs.distinct()

    def perform_create(self, serializer):
        instance = serializer.save()
        self._sync_customer_products(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._sync_customer_products(instance)

    def _sync_customer_products(self, site):
        try:
            customer = site.customer
            if not customer and site.lead:
                from lead_management.models import Customer
                customer = Customer.objects.filter(lead=site.lead).first()
            if customer and site.products and isinstance(site.products, list):
                existing_purchased = customer.product_purchased or []
                existing_names = set()
                for p in existing_purchased:
                    if isinstance(p, dict):
                        existing_names.add(str(p.get('product') or p.get('name') or '').strip().lower())
                    elif isinstance(p, str):
                        existing_names.add(p.strip().lower())
                
                updated = False
                for prod in site.products:
                    prod_str = str(prod).strip()
                    if prod_str and prod_str.lower() not in existing_names:
                        existing_purchased.append({'product': prod_str})
                        existing_names.add(prod_str.lower())
                        updated = True
                
                if updated:
                    customer.product_purchased = existing_purchased
                    customer.save(update_fields=['product_purchased'])
        except Exception:
            pass

    @action(detail=True, methods=['post'], url_path='convert-to-project')
    def convert_to_project(self, request, pk=None):
        from django.db import transaction
        from django.utils import timezone
        from lead_management.models import Project, Customer
        from lead_management.serializers import ProjectSerializer
        from product_management.models import Product

        site = self.get_object()

        # 1. Resolve customer
        customer = site.customer
        if not customer and site.lead:
            customer = getattr(site.lead, 'converted_to_customer', None)
            if not customer and hasattr(site.lead, 'customer'):
                customer = site.lead.customer
            if not customer:
                customer = Customer.objects.filter(lead=site.lead).first()

        if not customer:
            return Response(
                {"error": "This site is not associated with any customer yet. Please ensure the lead is converted to a customer first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Check if project already exists for this site
        existing_project = Project.objects.filter(site=site).first()
        if existing_project:
            return Response({
                "message": f"Project already exists for this site ({existing_project.project_code})",
                "project_id": existing_project.id,
                "project_code": existing_project.project_code,
                "project": ProjectSerializer(existing_project, context={'request': request}).data,
                "already_exists": True
            }, status=status.HTTP_200_OK)

        # 3. Resolve product names
        def resolve_prod_name(raw_name):
            if not raw_name:
                return ""
            s_name = str(raw_name).strip()
            if s_name.isdigit():
                p_obj = Product.objects.filter(id=int(s_name)).first()
                if p_obj:
                    return p_obj.name
            return s_name

        products_data = site.products or []
        resolved_products = []
        if isinstance(products_data, list):
            for item in products_data:
                p_str = item if isinstance(item, str) else (item.get('name') or item.get('product') if isinstance(item, dict) else str(item))
                resolved = resolve_prod_name(p_str)
                if resolved and resolved not in resolved_products:
                    resolved_products.append(resolved)

        # 4. Resolve sales/project executive
        executive = customer.sales_executive
        if not executive and site.lead and site.lead.assigned_executive:
            executive = site.lead.assigned_executive

        # 5. Project value
        project_val = site.amount or 0.00

        # 6. Scope
        loc_str = ", ".join(filter(None, [site.address, site.city, site.state, str(site.pincode) if site.pincode else None]))
        scope = f"Deployment & installation for site: {site.name} ({site.site_shortcut}). Location: {loc_str}. Capacity: {site.capacity_cars or 0} cars."

        # 7. Create project
        project_data = {
            "customer": customer.id,
            "site": site.id,
            "product": resolved_products,
            "project_executive": executive.id if executive else None,
            "project_value": float(project_val) if project_val else 0.0,
            "project_scope_requirements": scope,
            "start_date": timezone.now().date(),
            "amc_start_date": site.amc_start_date,
            "amc_end_date": site.amc_end_date,
            "project_stage": "order_confirmed",
            "priority": "medium",
        }

        with transaction.atomic():
            serializer = ProjectSerializer(data=project_data, context={'request': request})
            if serializer.is_valid():
                project = serializer.save()
                return Response({
                    "message": f"Site '{site.name}' successfully converted to Project {project.project_code}!",
                    "project_id": project.id,
                    "project_code": project.project_code,
                    "project": serializer.data,
                    "already_exists": False
                }, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --------------------------------------------------------------------------------
# Message Template ViewSet & Send Email View
# --------------------------------------------------------------------------------

class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['channel', 'category', 'is_active']
    search_fields = ['name', 'subject', 'body']
    ordering_fields = ['created_at', 'name', 'category']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)


class SendEmailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, *args, **kwargs):
        to_email = request.data.get('to_email')
        cc_email = request.data.get('cc_email') or request.data.get('cc')
        subject = (request.data.get('subject') or '').strip()
        # Accept both 'body' and 'message' parameter
        message = (request.data.get('body') or request.data.get('message') or '').strip()
        html_message = request.data.get('html_message', None)
        category = request.data.get('category')
        record_id = request.data.get('record_id') or request.data.get('quotation_id')
        attach_quotation_pdf = str(request.data.get('attach_quotation_pdf', '')).lower() in ['true', '1', 'yes']

        if not to_email:
            return Response({"error": "Recipient email ('to_email') is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not subject:
            return Response({"error": "Subject is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not message and not html_message:
            return Response({"error": "Message body is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Parse recipient list
        recipients = [e.strip() for e in str(to_email).split(',') if e.strip()]
        if not recipients:
            return Response({"error": "Invalid recipient email address."}, status=status.HTTP_400_BAD_REQUEST)

        # Parse CC list
        cc_recipients = []
        if cc_email:
            if isinstance(cc_email, list):
                raw_cc = cc_email
            else:
                raw_cc = str(cc_email).split(',')
            cc_recipients = [e.strip() for e in raw_cc if e.strip()]

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'test@example.com')

        try:
            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=from_email,
                to=recipients,
                cc=cc_recipients if cc_recipients else None
            )
            if html_message:
                email_msg.attach_alternative(html_message, "text/html")

            # Handle optional Quotation PDF attachment
            if attach_quotation_pdf and record_id:
                try:
                    from quotation.models import Quotation
                    from quotation.utils.pdf_generator import generate_quotation_pdf
                    quotation = Quotation.objects.filter(id=record_id).first()
                    if quotation:
                        active_version = quotation.versions.filter(is_active=True).first() or quotation.versions.first()
                        if active_version:
                            pdf_bytes = generate_quotation_pdf(quotation, active_version)
                            filename = f"Quotation_{quotation.quotation_no or quotation.id}.pdf"
                            email_msg.attach(filename, pdf_bytes, 'application/pdf')
                except Exception as pdf_err:
                    import logging
                    logging.getLogger(__name__).warning(f"Could not attach quotation PDF: {pdf_err}")

            # Handle attached documents uploaded by user
            uploaded_files = []
            for key in ['documents', 'document', 'files', 'attachment']:
                if hasattr(request, 'FILES') and key in request.FILES:
                    uploaded_files.extend(request.FILES.getlist(key))

            for uploaded_file in uploaded_files:
                content_type = uploaded_file.content_type or 'application/octet-stream'
                email_msg.attach(uploaded_file.name, uploaded_file.read(), content_type)

            email_msg.send(fail_silently=False)
            resp_message = f"Email successfully sent to {', '.join(recipients)}"
            if cc_recipients:
                resp_message += f" (CC: {', '.join(cc_recipients)})"
            return Response({
                "status": "success",
                "success": True,
                "message": resp_message,
                "to": recipients,
                "cc": cc_recipients,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "error",
                "success": False,
                "error": f"Failed to send email: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    