from django.db import models
from django.conf import settings
from amc.models import AMCService, AMCVisit


class TechnicianActivity(models.Model):
    ACTION_CHOICES = [
        ('journey_started', 'Journey Started / Navigating'),
        ('visit_started', 'Visit Started / On Site'),
        ('diagnosis_recorded', 'Diagnosis Recorded'),
        ('parts_requested', 'Parts Requested'),
        ('job_completed', 'Job Completed'),
        ('customer_signoff', 'Customer Sign-off'),
        ('general_note', 'General Note'),
    ]

    service = models.ForeignKey(
        AMCService,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='technician_activities',
        verbose_name="Service"
    )
    visit = models.ForeignKey(
        AMCVisit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='technician_activities',
        verbose_name="AMC Visit"
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='technician_activities',
        verbose_name="Technician"
    )
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        default='general_note',
        verbose_name="Action"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Notes / Description")
    latitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        null=True,
        blank=True,
        verbose_name="GPS Latitude"
    )
    longitude = models.DecimalField(
        max_digits=12,
        decimal_places=8,
        null=True,
        blank=True,
        verbose_name="GPS Longitude"
    )
    accuracy = models.FloatField(null=True, blank=True, verbose_name="GPS Accuracy (m)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Timestamp")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    class Meta:
        db_table = 'service_visit_notes'
        ordering = ['-created_at']
        verbose_name = "Service & Visit Note"
        verbose_name_plural = "Service & Visit Notes"

    def __str__(self):
        target = self.service.service_number if self.service else (self.visit.visit_number if self.visit else "Task")
        author = self.technician or "System"
        return f"{author} - {self.get_action_display()} on {target}"


class TechnicianLiveLocation(models.Model):
    technician = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_location',
        verbose_name="Technician"
    )
    latitude = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True, verbose_name="Latitude")
    longitude = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True, verbose_name="Longitude")
    accuracy = models.FloatField(null=True, blank=True, verbose_name="Accuracy (m)")
    status = models.CharField(max_length=50, default='idle', verbose_name="Status")  # idle, en_route, on_site, completed
    current_service_id = models.IntegerField(null=True, blank=True, verbose_name="Current Service/Visit ID")
    current_work_type = models.CharField(max_length=50, null=True, blank=True, verbose_name="Current Work Type")
    last_action = models.CharField(max_length=100, null=True, blank=True, verbose_name="Last Action")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Last Updated")

    class Meta:
        db_table = 'technician_live_location'
        verbose_name = "Technician Live Location"
        verbose_name_plural = "Technician Live Locations"

    def __str__(self):
        name = f"{self.technician.first_name} {self.technician.last_name}".strip() or getattr(self.technician, 'username', '')
        return f"{name} ({self.status}) - {self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else 'No time'}"


