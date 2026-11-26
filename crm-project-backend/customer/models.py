from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class TicketCategory(models.TextChoices):
    BREAKDOWN = 'breakdown', 'Breakdown / Emergency'
    MAINTENANCE = 'maintenance', 'Maintenance Request'
    INSTALLATION = 'installation', 'Installation / Site Query'
    BILLING = 'billing', 'Billing / AMC Query'
    GENERAL = 'general', 'General Support'


class TicketPriority(models.TextChoices):
    LOW = 'low', 'Low'
    MEDIUM = 'medium', 'Medium'
    HIGH = 'high', 'High'
    CRITICAL = 'critical', 'Critical'


class TicketStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    IN_PROGRESS = 'in_progress', 'In Progress'
    RESOLVED = 'resolved', 'Resolved'
    CLOSED = 'closed', 'Closed'


class CustomerTicket(models.Model):
    ticket_number = models.CharField(max_length=30, unique=True, blank=True, null=True, verbose_name="Ticket #")
    customer = models.ForeignKey(
        'lead_management.Customer',
        on_delete=models.CASCADE,
        related_name='tickets',
        verbose_name="Customer",
    )
    site = models.ForeignKey(
        'api.SiteManagement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tickets',
        verbose_name="Site",
    )
    project = models.ForeignKey(
        'lead_management.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tickets',
        verbose_name="Project",
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tickets',
        verbose_name="AMC Contract",
    )
    category = models.CharField(
        max_length=40,
        choices=TicketCategory.choices,
        default=TicketCategory.BREAKDOWN,
        verbose_name="Category",
    )
    priority = models.CharField(
        max_length=20,
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
        verbose_name="Priority",
    )
    subject = models.CharField(max_length=255, verbose_name="Subject")
    description = models.TextField(verbose_name="Description")
    contact_person = models.CharField(max_length=200, blank=True, default='', verbose_name="Contact Person")
    contact_phone = models.CharField(max_length=30, blank=True, default='', verbose_name="Contact Phone")
    attachment = models.FileField(
        upload_to='customer_tickets/%Y/%m/',
        blank=True,
        null=True,
        verbose_name="Attachment",
    )
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_customer_tickets',
        verbose_name="Assigned To",
    )
    resolution_notes = models.TextField(blank=True, default='', verbose_name="Resolution Notes")
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name="Resolved At")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Customer Ticket"
        verbose_name_plural = "Customer Tickets"

    def generate_ticket_number(self):
        import re
        last_num = 0
        for code in CustomerTicket.objects.values_list('ticket_number', flat=True):
            if code:
                digits = re.findall(r'\d+', str(code))
                if digits:
                    last_num = max(last_num, int(digits[-1]))
        new_num = last_num + 1
        candidate = f"TKT-{new_num:03d}"
        while CustomerTicket.objects.filter(ticket_number=candidate).exclude(pk=self.pk).exists():
            new_num += 1
            candidate = f"TKT-{new_num:03d}"
        return candidate

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self.generate_ticket_number()
        if self.status in (TicketStatus.RESOLVED, TicketStatus.CLOSED) and not self.resolved_at:
            self.resolved_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_number or 'TKT'} - {self.subject}"
