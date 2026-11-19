from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class CustomUserManager(BaseUserManager):
    def _resolve_role(self, role):
        """
        Accepts None, Role instance, role name (str) or pk (int/str).
        Returns a Role instance or None.
        """
        if role is None:
            return None

        # If already a Role instance
        from .models import Role  # local import to avoid circular issues at import time
        if isinstance(role, Role):
            return role

        # If passed a string, treat it as name
        if isinstance(role, str):
            # try numeric pk first
            if role.isdigit():
                try:
                    return Role.objects.get(pk=int(role))
                except Role.DoesNotExist:
                    pass
            # fallback: get_or_create by name
            role_obj, _ = Role.objects.get_or_create(name=role)
            return role_obj

        # If passed an int (pk)
        if isinstance(role, int):
            return Role.objects.get(pk=role)

        # otherwise error
        raise ValueError("Invalid role value")

    def create_user(self, email=None, mobile_no=None, password=None, role=None, **extra_fields):
        if not email and not mobile_no:
            raise ValueError("User must have either an email or mobile number")

        user_data = {}
        if email:
            email = self.normalize_email(email)
            user_data['email'] = email

        if mobile_no:
            user_data['mobile_no'] = mobile_no

        # boolean flags can be passed via extra_fields (is_staff, is_superuser, is_active)
        # Remove role from extra_fields so we handle it separately
        extra_role = role if role is not None else extra_fields.pop('role', None)

        user = self.model(**user_data, **extra_fields)
        if password:
            user.set_password(password)
        else:
            # If explicitly no password provided, set unusable password
            user.set_unusable_password()

        # Resolve and assign role
        role_obj = self._resolve_role(extra_role)
        user.role = role_obj

        user.save(using=self._db)
        return user

    def create_superuser(self, email=None, mobile_no=None, password=None, **extra_fields):
        """
        Note: Django's `createsuperuser` management command will call this.
        Make sure USERNAME_FIELD handling aligns with your admin/createsuperuser usage.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        # allow passing role as string or Role instance in extra_fields
        role = extra_fields.pop("role", "admin")  # default to "admin" if not passed

        return self.create_user(email=email, mobile_no=mobile_no, password=password, role=role, **extra_fields)


# Custome Roles 
class Role(models.Model):
    name = models.CharField(max_length=200, unique=True)
    permissions = models.JSONField(default=dict, blank=True, null=True)

    def __str__(self):
        return self.name 
    

# Custom user model 
class CustomUser(AbstractBaseUser, PermissionsMixin):
    username = None
    email = models.EmailField(unique=True, blank=True, null=True)
    mobile_no = models.CharField(max_length=15, unique=True, blank=True, null=True )
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    profile_photo = models.ImageField(upload_to='profiles/', blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['mobile_no']

    def get_full_name(self):
        full = f"{self.first_name or ''} {self.last_name or ''}".strip()
        return full or self.email or self.mobile_no or "User"

    def get_short_name(self):
        return self.first_name or self.email or "User"

    def __str__(self):
        identity = self.email if self.email else (self.mobile_no or "Anonymous")
        role_name = self.role.name if self.role else "NoRole"
        return f"{identity} - {role_name}"



# --------------------------------------------------------------------------------
# Branch Management model
# --------------------------------------------------------------------------------

class BranchManagement(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    secondary_email = models.EmailField(blank=True, null=True)
    primary_contact = models.CharField(max_length=20)
    secondary_contact = models.CharField(max_length=20,null=True, blank=True)
    address = models.TextField()
    city = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    state_code = models.CharField(max_length=20)
    gst_no = models.CharField(max_length=255, null=True, blank=True)
    company_pan = models.CharField(max_length=20, null=True, blank=True)
    msme_number = models.CharField(max_length=50, null=True, blank=True)
    is_head_office = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name}-{self.city}"
    

# --------------------------------------------------------------------------------
# Site Management model
# --------------------------------------------------------------------------------

class SiteManagement(models.Model):
    customer = models.ForeignKey(
        'lead_management.Customer',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sites',
        verbose_name="Customer"
    )
    lead = models.ForeignKey(
        'lead_management.lead_management',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sites',
        verbose_name="Lead"
    )
    name = models.CharField(max_length=255, verbose_name="Site Name")
    site_shortcut = models.CharField(max_length=50, blank=True, unique=True)
    address = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=255, blank=True, default='')
    state = models.CharField(max_length=255, blank=True, default='')
    pincode = models.IntegerField(null=True, blank=True)
    owner_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Site In-Charge / Contact Person")
    owner_contact = models.CharField(max_length=20, blank=True, null=True, verbose_name="Contact Phone")
    site_type = models.CharField(max_length=100, blank=True, default='', verbose_name="Site / Parking Type")
    capacity_cars = models.IntegerField(null=True, blank=True, default=0, verbose_name="Car Capacity")
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00, blank=True, null=True, verbose_name="Site Amount / Contract Value")
    products = models.JSONField(blank=True, null=True, default=list, verbose_name="Products Selected")
    has_amc = models.BooleanField(default=False, verbose_name="Has AMC")
    amc_start_date = models.DateField(null=True, blank=True, verbose_name="AMC Start Date")
    amc_end_date = models.DateField(null=True, blank=True, verbose_name="AMC End Date")
    amc_product_dates = models.JSONField(blank=True, null=True, default=dict, verbose_name="AMC Product Dates")
    status = models.CharField(max_length=50, default='Active', verbose_name="Status")
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def generate_unique_shortcut(self):
        name_part = (self.name[:3] if self.name else "").upper()
        city_part = (self.city[:3] if self.city else "").upper()

        base = f"{name_part}-{city_part}"
        shortcut = f"{base}-{self.pk}"

        counter = 1
        while SiteManagement.objects.filter(site_shortcut=shortcut).exclude(pk=self.pk).exists():
            counter += 1
            shortcut = f"{base}-{self.pk}-{counter}"

        return shortcut

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        # First save to get PK
        super().save(*args, **kwargs)

        if is_new and not self.site_shortcut:
            self.site_shortcut = self.generate_unique_shortcut()
            super().save(update_fields=["site_shortcut"])

    def __str__(self):
        return f"{self.name} ({self.site_shortcut})"


# --------------------------------------------------------------------------------
# Message Template Model (Email & WhatsApp)
# --------------------------------------------------------------------------------

class MessageTemplate(models.Model):
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('whatsapp', 'WhatsApp'),
    ]

    CATEGORY_CHOICES = [
        ('lead', 'Leads / Enquiries'),
        ('customer', 'Customers'),
        ('followup', 'Follow-up Management'),
        ('quotation', 'Quotations'),
        ('project', 'Projects'),
        ('amc', 'AMC Contracts'),
    ]

    name = models.CharField(max_length=255)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='email')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='lead')
    subject = models.CharField(max_length=255, blank=True, null=True, help_text="Email Subject line with optional placeholders")
    body = models.TextField(help_text="Message body with optional placeholders like {customer_name}")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_templates')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_channel_display()} - {self.get_category_display()}] {self.name}"
