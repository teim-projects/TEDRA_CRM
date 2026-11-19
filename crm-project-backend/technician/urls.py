from django.urls import path
from .views import (
    TechnicianDashboardView,
    TechnicianTodaysWorkListView,
    TechnicianWorkDeskListView,
    TechnicianCompletedWorkListView,
    TechnicianServiceDetailView,
    TechnicianServiceActionViewSet,
    TechnicianDailyFieldMapView,
    TechnicianLiveLocationUpdateView,
)

urlpatterns = [
    path('dashboard/', TechnicianDashboardView.as_view(), name='technician-dashboard'),
    path('live-location/update/', TechnicianLiveLocationUpdateView.as_view(), name='technician-live-location-update'),
    path('todays-work/', TechnicianTodaysWorkListView.as_view(), name='technician-todays-work'),
    path('work-desk/', TechnicianWorkDeskListView.as_view(), name='technician-work-desk'),
    path('completed-work/', TechnicianCompletedWorkListView.as_view(), name='technician-completed-work'),
    path('field-map/', TechnicianDailyFieldMapView.as_view(), name='technician-field-map'),
    path('services/<int:pk>/', TechnicianServiceDetailView.as_view(), name='technician-service-detail'),
    path('services/<int:pk>/start-journey/', TechnicianServiceActionViewSet.as_view({'post': 'start_journey'}), name='technician-start-journey'),
    path('services/<int:pk>/start-visit/', TechnicianServiceActionViewSet.as_view({'post': 'start_visit'}), name='technician-start-visit'),
    path('services/<int:pk>/complete-visit/', TechnicianServiceActionViewSet.as_view({'post': 'complete_visit'}), name='technician-complete-visit'),
    path('services/<int:pk>/add-note/', TechnicianServiceActionViewSet.as_view({'post': 'add_note'}), name='technician-add-note'),
]

