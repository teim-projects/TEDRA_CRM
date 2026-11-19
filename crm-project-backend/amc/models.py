from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from lead_management.models import Customer, Project

User = get_user_model()


class AMCType(models.TextChoices):
    COMPREHENSIVE = 'comprehensive', 'Comprehensive'
    NON_COMPREHENSIVE = 'non_comprehensive', 'Non-Comprehensive'


class PaymentFrequency(models.TextChoices):
    ANNUAL = 'annual', 'Annual'
    QUARTERLY = 'quarterly', 'Quarterly'
    MONTHLY = 'monthly', 'Monthly'
    HALF_YEARLY = 'half_yearly', 'Half-Yearly'


class ServiceFrequency(models.TextChoices):
    MONTHLY = 'monthly', 'Monthly'
    BI_MONTHLY = 'bi_monthly', 'Bi-Monthly'
    QUARTERLY = 'quarterly', 'Quarterly'
    HALF_YEARLY = 'half_yearly', 'Half-Yearly'
    ANNUAL = 'annual', 'Annual'
    AS_NEEDED = 'as_needed', 'As Needed / Breakdown Only'
    CUSTOM = 'custom', 'Custom'


class AMCStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    EXPIRING_SOON = 'expiring_soon', 'Expiring Soon'
    EXPIRED = 'expired', 'Expired'
    SCHEDULED = 'scheduled', 'Scheduled'
    RENEWED = 'renewed', 'Renewed'


class AMCContract(models.Model):
    contract_id = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name="Contract ID")
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='amc_contracts',
        verbose_name="Customer"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_contracts',
        verbose_name="Project"
    )
    site = models.ForeignKey(
        'api.SiteManagement',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_contracts',
        verbose_name="Site"
    )
    product = models.CharField(max_length=255, verbose_name="Product")
    amc_type = models.CharField(
        max_length=50,
        choices=AMCType.choices,
        default=AMCType.COMPREHENSIVE,
        verbose_name="AMC Type"
    )
    # Synced header fields from current active cycle
    start_date = models.DateField(blank=True, null=True, verbose_name="Start Date")
    end_date = models.DateField(blank=True, null=True, verbose_name="End Date")
    annual_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0.00,
        verbose_name="Annual Value (₹)"
    )
    payment_frequency = models.CharField(
        max_length=50,
        choices=PaymentFrequency.choices,
        default=PaymentFrequency.QUARTERLY,
        verbose_name="Payment Frequency"
    )
    service_frequency = models.CharField(
        max_length=50,
        choices=ServiceFrequency.choices,
        default=ServiceFrequency.QUARTERLY,
        verbose_name="Service Visit Frequency"
    )
    no_of_visits = models.PositiveIntegerField(
        default=4,
        blank=True,
        null=True,
        verbose_name="Number of Visits"
    )
    site_address = models.TextField(
        blank=True,
        null=True,
        verbose_name="Site Address / Location"
    )
    latitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Latitude"
    )
    longitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Longitude"
    )
    location_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Map / Location Pin URL"
    )
    support_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='coordinated_amcs',
        verbose_name="Support Coordinator"
    )
    scope_of_support = models.TextField(blank=True, null=True, verbose_name="Scope of Support")
    status = models.CharField(
        max_length=50,
        choices=AMCStatus.choices,
        default=AMCStatus.ACTIVE,
        verbose_name="Status"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_contracts_created',
        verbose_name="Created By"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    def generate_contract_id(self):
        import re
        last_num = 0
        for c in AMCContract.objects.all().only('contract_id'):
            if c.contract_id:
                digits = re.findall(r'\d+', str(c.contract_id))
                if digits:
                    val = int(digits[-1])
                    if val > last_num:
                        last_num = val
        new_num = last_num + 1
        candidate = f"AMC-{new_num:03d}"
        while AMCContract.objects.filter(contract_id=candidate).exclude(id=self.id).exists():
            new_num += 1
            candidate = f"AMC-{new_num:03d}"
        return candidate

    def sync_active_cycle_data(self):
        """Auto-evaluates cycle statuses against today's date and syncs active cycle info to contract header."""
        today = timezone.now().date()
        cycles = list(self.cycles.all().order_by('cycle_number'))
        if not cycles:
            return

        for cycle in cycles:
            if cycle.status == AMCStatus.INACTIVE:
                continue

            c_start = cycle.start_date
            c_end = cycle.end_date

            if c_end and c_end < today:
                if cycle.status != AMCStatus.EXPIRED:
                    cycle.status = AMCStatus.EXPIRED
                    cycle.save(update_fields=['status'])
            elif c_start and c_end and c_start <= today <= c_end:
                new_st = AMCStatus.EXPIRING_SOON if (c_end - today).days <= 30 else AMCStatus.ACTIVE
                if cycle.status != new_st:
                    cycle.status = new_st
                    cycle.save(update_fields=['status'])
            elif c_start and c_start > today:
                if cycle.status != AMCStatus.SCHEDULED:
                    cycle.status = AMCStatus.SCHEDULED
                    cycle.save(update_fields=['status'])

        # Pick active/running cycle or fallback to scheduled / latest
        active_cycle = self.cycles.filter(status__in=[AMCStatus.ACTIVE, AMCStatus.EXPIRING_SOON]).order_by('-cycle_number').first()
        if not active_cycle:
            active_cycle = self.cycles.filter(status=AMCStatus.SCHEDULED).order_by('cycle_number').first() or cycles[-1]

        if active_cycle:
            self.start_date = active_cycle.start_date
            self.end_date = active_cycle.end_date
            self.annual_value = active_cycle.annual_value
            self.payment_frequency = active_cycle.payment_frequency
            if hasattr(active_cycle, 'service_frequency') and active_cycle.service_frequency:
                self.service_frequency = active_cycle.service_frequency
            if hasattr(active_cycle, 'no_of_visits') and active_cycle.no_of_visits is not None:
                self.no_of_visits = active_cycle.no_of_visits
            if hasattr(active_cycle, 'site_address') and active_cycle.site_address:
                self.site_address = active_cycle.site_address
            
            # If contract has been renewed with 2 or more cycles, mark status as RENEWED
            if len(cycles) > 1 and active_cycle.status != AMCStatus.INACTIVE:
                self.status = AMCStatus.RENEWED
            else:
                self.status = active_cycle.status

            super().save(update_fields=['start_date', 'end_date', 'annual_value', 'payment_frequency', 'service_frequency', 'no_of_visits', 'site_address', 'status', 'updated_at'])

    def save(self, *args, **kwargs):
        if not self.contract_id:
            self.contract_id = self.generate_contract_id()
        super().save(*args, **kwargs)

    def __str__(self):
        cust_name = getattr(self.customer, 'name', None) or getattr(self.customer, 'company_name', None) or 'No Customer' if self.customer else 'No Customer'
        return f"{self.contract_id or ''} - {cust_name} ({self.product})"

    class Meta:
        ordering = ['-updated_at', '-created_at']
        verbose_name = "AMC Contract"
        verbose_name_plural = "AMC Contracts"


class AMCCycle(models.Model):
    amc_contract = models.ForeignKey(
        AMCContract,
        on_delete=models.CASCADE,
        related_name='cycles',
        verbose_name="AMC Contract"
    )
    cycle_number = models.PositiveIntegerField(default=1, verbose_name="Cycle #")
    start_date = models.DateField(verbose_name="Start Date")
    end_date = models.DateField(verbose_name="End Date")
    annual_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0.00,
        verbose_name="Annual Value (₹)"
    )
    payment_frequency = models.CharField(
        max_length=50,
        choices=PaymentFrequency.choices,
        default=PaymentFrequency.QUARTERLY,
        verbose_name="Payment Frequency"
    )
    service_frequency = models.CharField(
        max_length=50,
        choices=ServiceFrequency.choices,
        default=ServiceFrequency.QUARTERLY,
        verbose_name="Service Visit Frequency"
    )
    no_of_visits = models.PositiveIntegerField(
        default=4,
        blank=True,
        null=True,
        verbose_name="Number of Visits"
    )
    site_address = models.TextField(
        blank=True,
        null=True,
        verbose_name="Site Address / Location"
    )
    latitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Latitude"
    )
    longitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Longitude"
    )
    location_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Map / Location Pin URL"
    )
    status = models.CharField(
        max_length=50,
        choices=AMCStatus.choices,
        default=AMCStatus.ACTIVE,
        verbose_name="Status"
    )
    remarks = models.TextField(blank=True, null=True, verbose_name="Notes / Remarks")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_cycles_created',
        verbose_name="Created By"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        ordering = ['-cycle_number']
        verbose_name = "AMC Cycle"
        verbose_name_plural = "AMC Cycles"

    def __str__(self):
        return f"{self.amc_contract.contract_id or 'AMC'} - Cycle #{self.cycle_number} ({self.status})"


class ServiceType(models.TextChoices):
    ROUTINE_MAINTENANCE = 'routine_maintenance', 'Routine Maintenance'
    BREAKDOWN = 'breakdown', 'Breakdown / Emergency'
    FILTER_REPLACEMENT = 'filter_replacement', 'Filter / Membrane Replacement'
    WATER_TESTING = 'water_testing', 'Water Quality Testing'
    SYSTEM_AUDIT = 'system_audit', 'System Audit & Inspection'
    INSTALLATION_CHECK = 'installation_check', 'Installation Check'


class ServiceStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    PENDING_PARTS = 'pending_parts', 'Pending Parts'
    CANCELLED = 'cancelled', 'Cancelled'


class ServicePriority(models.TextChoices):
    CRITICAL = 'critical', 'Critical'
    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'


class ServiceCategory(models.TextChoices):
    SINGLE_SERVICE = 'single_service', 'Single Service'
    AMC_SERVICE = 'amc_service', 'AMC Service'


class AMCService(models.Model):
    service_number = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name="Service #")
    service_category = models.CharField(
        max_length=50,
        choices=ServiceCategory.choices,
        default=ServiceCategory.SINGLE_SERVICE,
        verbose_name="Service Category"
    )
    contact_person = models.CharField(max_length=255, blank=True, null=True, verbose_name="Contact Person")
    contact_phone = models.CharField(max_length=50, blank=True, null=True, verbose_name="Contact Phone")
    service_address = models.TextField(blank=True, null=True, verbose_name="Service / Site Address")
    latitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Latitude"
    )
    longitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Longitude"
    )
    location_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Map / Location Pin URL"
    )
    amc_contract = models.ForeignKey(
        AMCContract,
        on_delete=models.CASCADE,
        related_name='services',
        blank=True,
        null=True,
        verbose_name="AMC Contract"
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='amc_services',
        verbose_name="Customer"
    )
    site = models.ForeignKey(
        'api.SiteManagement',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_services',
        verbose_name="Site / Parking Facility"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_services',
        verbose_name="Project"
    )
    equipment = models.CharField(max_length=255, blank=True, null=True, verbose_name="Equipment / Machine Name")
    serial_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="Serial Number")
    service_type = models.CharField(
        max_length=50,
        choices=ServiceType.choices,
        default=ServiceType.ROUTINE_MAINTENANCE,
        verbose_name="Service Type"
    )
    service_date = models.DateField(default=timezone.now, verbose_name="Scheduled Service Date")
    completion_date = models.DateField(blank=True, null=True, verbose_name="Completion Date")
    status = models.CharField(
        max_length=50,
        choices=ServiceStatus.choices,
        default=ServiceStatus.SCHEDULED,
        verbose_name="Status"
    )
    priority = models.CharField(
        max_length=50,
        choices=ServicePriority.choices,
        default=ServicePriority.MEDIUM,
        verbose_name="Priority"
    )
    technicians = models.ManyToManyField(
        User,
        blank=True,
        related_name='assigned_amc_services',
        db_table='amc_service_technician',
        verbose_name="Assigned Technicians"
    )
    service_engineer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='lead_amc_services',
        verbose_name="Service Engineer / In-Charge"
    )
    service_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        verbose_name="Service Cost (₹)"
    )
    description = models.TextField(blank=True, null=True, verbose_name="Description / Issues Reported")
    diagnosis = models.TextField(blank=True, null=True, verbose_name="Diagnosis / Inspection Finding")
    resolution_notes = models.TextField(blank=True, null=True, verbose_name="Resolution Notes / Work Done")
    customer_feedback = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        choices=[
            ('excellent', 'Excellent'),
            ('good', 'Good'),
            ('satisfactory', 'Satisfactory'),
            ('unsatisfactory', 'Unsatisfactory')
        ],
        verbose_name="Customer Rating"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_services_created',
        verbose_name="Created By"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    def generate_service_number(self):
        import re
        last_num = 0
        for s in AMCService.objects.all().only('service_number'):
            if s.service_number:
                digits = re.findall(r'\d+', str(s.service_number))
                if digits:
                    val = int(digits[-1])
                    if val > last_num:
                        last_num = val
        new_num = last_num + 1
        candidate = f"SRV-{new_num:03d}"
        while AMCService.objects.filter(service_number=candidate).exclude(id=self.id).exists():
            new_num += 1
            candidate = f"SRV-{new_num:03d}"
        return candidate

    def save(self, *args, **kwargs):
        if not self.service_number:
            self.service_number = self.generate_service_number()
        super().save(*args, **kwargs)

    def __str__(self):
        cust_name = getattr(self.customer, 'company_name', None) or getattr(self.customer, 'name', 'No Customer')
        return f"{self.service_number or 'SRV'} - {cust_name} ({self.get_service_type_display()})"

    class Meta:
        db_table = 'amc_service'
        ordering = ['-service_date', '-created_at']
        verbose_name = "Single Service"
        verbose_name_plural = "Single Services"


Service = AMCService


class AMCVisit(models.Model):
    visit_number = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name="Visit #")
    amc_contract = models.ForeignKey(
        AMCContract,
        on_delete=models.CASCADE,
        related_name='visits',
        verbose_name="AMC Contract"
    )
    cycle = models.ForeignKey(
        AMCCycle,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='visits',
        verbose_name="AMC Cycle"
    )
    visit_index = models.PositiveIntegerField(default=1, verbose_name="Visit # (Sequence)")
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='amc_visits',
        verbose_name="Customer"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_visits',
        verbose_name="Project"
    )
    equipment = models.CharField(max_length=255, blank=True, null=True, verbose_name="Equipment / Machine Name")
    serial_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="Serial Number")
    visit_type = models.CharField(
        max_length=50,
        choices=ServiceType.choices,
        default=ServiceType.ROUTINE_MAINTENANCE,
        verbose_name="Visit Type"
    )
    visit_date = models.DateField(default=timezone.now, verbose_name="Scheduled Visit Date")
    completion_date = models.DateField(blank=True, null=True, verbose_name="Completion Date")
    status = models.CharField(
        max_length=50,
        choices=ServiceStatus.choices,
        default=ServiceStatus.SCHEDULED,
        verbose_name="Status"
    )
    priority = models.CharField(
        max_length=50,
        choices=ServicePriority.choices,
        default=ServicePriority.MEDIUM,
        verbose_name="Priority"
    )
    technicians = models.ManyToManyField(
        User,
        blank=True,
        related_name='assigned_amc_visits',
        verbose_name="Assigned Technicians"
    )
    service_engineer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='lead_amc_visits',
        verbose_name="Service Engineer / In-Charge"
    )
    contact_person = models.CharField(max_length=255, blank=True, null=True, verbose_name="Contact Person")
    contact_phone = models.CharField(max_length=50, blank=True, null=True, verbose_name="Contact Phone")
    visit_address = models.TextField(blank=True, null=True, verbose_name="Visit / Site Address")
    latitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Latitude"
    )
    longitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name="Longitude"
    )
    location_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Map / Location Pin URL"
    )
    description = models.TextField(blank=True, null=True, verbose_name="Description / Scope of Work")
    diagnosis = models.TextField(blank=True, null=True, verbose_name="Diagnosis / Inspection Finding")
    resolution_notes = models.TextField(blank=True, null=True, verbose_name="Resolution Notes / Work Done")
    customer_feedback = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        choices=[
            ('excellent', 'Excellent'),
            ('good', 'Good'),
            ('satisfactory', 'Satisfactory'),
            ('unsatisfactory', 'Unsatisfactory')
        ],
        verbose_name="Customer Rating"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='amc_visits_created',
        verbose_name="Created By"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    def generate_visit_number(self):
        import re
        if self.amc_contract:
            amc_ref = getattr(self.amc_contract, 'contract_id', '') or f"AMC-{self.amc_contract.id}"
            digits = re.findall(r'\d+', str(amc_ref))
            amc_num = int(digits[-1]) if digits else self.amc_contract.id
            cycle_num = getattr(self.cycle, 'cycle_number', 1) if self.cycle else 1
            renewal_str = f"-R{cycle_num - 1}" if cycle_num > 1 else ""

            v_idx = self.visit_index
            if not v_idx or v_idx <= 0:
                existing_in_cycle = AMCVisit.objects.filter(amc_contract=self.amc_contract, cycle=self.cycle).count()
                v_idx = existing_in_cycle + 1
                self.visit_index = v_idx

            candidate = f"VIS-{amc_num}{renewal_str}-{v_idx:03d}"
            idx = v_idx
            while AMCVisit.objects.filter(visit_number=candidate).exclude(id=self.id).exists():
                idx += 1
                candidate = f"VIS-{amc_num}{renewal_str}-{idx:03d}"
            return candidate

        # Fallback if no AMC contract linked
        last_vis = AMCVisit.objects.order_by('-id').first()
        new_num = 1
        if last_vis and last_vis.visit_number:
            digits = re.findall(r'\d+', str(last_vis.visit_number))
            if digits:
                new_num = int(digits[-1]) + 1
        return f"VIS-{new_num:03d}"

    def save(self, *args, **kwargs):
        if not self.visit_number:
            self.visit_number = self.generate_visit_number()
        super().save(*args, **kwargs)

    def __str__(self):
        cust_name = getattr(self.customer, 'company_name', None) or getattr(self.customer, 'name', 'No Customer')
        return f"{self.visit_number or 'VIS'} - {cust_name} (Visit #{self.visit_index})"

    class Meta:
        ordering = ['visit_date', 'visit_index', '-created_at']
        verbose_name = "AMC Visit"
        verbose_name_plural = "AMC Visits"


class ServiceAttachment(models.Model):
    STAGE_CHOICES = [
        ('before', 'Before / Breakdown Photo'),
        ('after', 'After / Completion Photo'),
        ('document', 'Report / PDF Document'),
        ('other', 'General Attachment'),
    ]

    service = models.ForeignKey(
        AMCService,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        verbose_name="Service"
    )
    visit = models.ForeignKey(
        AMCVisit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
        verbose_name="AMC Visit"
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_attachments',
        verbose_name="Uploaded By"
    )
    file = models.FileField(
        upload_to='service_attachments/%Y/%m/',
        verbose_name="File"
    )
    file_type = models.CharField(max_length=50, default='image', verbose_name="File Type")
    stage = models.CharField(max_length=50, choices=STAGE_CHOICES, default='other', verbose_name="Stage")
    title = models.CharField(max_length=255, blank=True, null=True, verbose_name="Title / Caption")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Uploaded At")

    class Meta:
        db_table = 'service_attachments'
        ordering = ['-created_at']
        verbose_name = "Service Attachment"
        verbose_name_plural = "Service Attachments"

    def __str__(self):
        target = self.service.service_number if self.service else (self.visit.visit_number if self.visit else "Task")
        return f"{self.get_stage_display()} - {self.title or self.file.name} for {target}"
