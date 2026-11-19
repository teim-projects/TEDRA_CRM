from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VendorViewSet,
    InventoryItemViewSet,
    PurchaseOrderViewSet,
    GRNViewSet,
    StockTransactionViewSet
)

router = DefaultRouter()
router.register(r'vendors', VendorViewSet, basename='inventory-vendor')
router.register(r'items', InventoryItemViewSet, basename='inventory-item')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='inventory-po')
router.register(r'grn', GRNViewSet, basename='inventory-grn')
router.register(r'transactions', StockTransactionViewSet, basename='inventory-transaction')

urlpatterns = [
    path('', include(router.urls)),
]

