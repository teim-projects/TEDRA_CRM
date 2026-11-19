from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AMCContractViewSet, AMCServiceViewSet, AMCVisitViewSet

router = DefaultRouter()
router.register(r'contracts', AMCContractViewSet, basename='amc-contract')
router.register(r'services', AMCServiceViewSet, basename='amc-service')
router.register(r'visits', AMCVisitViewSet, basename='amc-visit')
router.register(r'', AMCContractViewSet, basename='amc')

urlpatterns = router.urls
