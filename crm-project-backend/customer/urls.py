from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerLoginView,
    CustomerMeView,
    CustomerDashboardView,
    CustomerProjectReadOnlyViewSet,
    CustomerAMCReadOnlyViewSet,
    CustomerServiceListView,
    CustomerTicketViewSet,
    AdminCustomerTicketViewSet,
)

router = DefaultRouter()
router.register(r'projects', CustomerProjectReadOnlyViewSet, basename='customer-projects')
router.register(r'amcs', CustomerAMCReadOnlyViewSet, basename='customer-amcs')
router.register(r'tickets', CustomerTicketViewSet, basename='customer-tickets')
router.register(r'admin-tickets', AdminCustomerTicketViewSet, basename='admin-customer-tickets')

urlpatterns = [
    path('login/', CustomerLoginView.as_view(), name='customer-login'),
    path('me/', CustomerMeView.as_view(), name='customer-me'),
    path('dashboard/', CustomerDashboardView.as_view(), name='customer-dashboard'),
    path('services/', CustomerServiceListView.as_view(), name='customer-services'),
    path('', include(router.urls)),
]
