from rest_framework import serializers
from .models import Product, Category

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'is_active', 'product_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    price_with_gst = serializers.DecimalField(
        source='get_price_with_gst', 
        read_only=True, 
        max_digits=12, 
        decimal_places=2
    )
    product_code = serializers.CharField(
        max_length=50, 
        required=False, 
        allow_blank=True
    )
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'product_code', 'category', 'category_name',
            'unit_price', 'hsn_sac_code', 'capacity_lph', 'status', 'description',
            'product_image_url', 'gst_type', 'gst_percentage',
            'material', 'width', 'length', 'thickness', 'density',
            'description_size', 'uom', 'weight', 'net_weight', 'cutting_length',
            'is_active', 'is_service', 'extra_attributes',
            'price_with_gst', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        # If extra_attributes was passed, sync any missing top-level spec fields from extra_attributes
        extra = ret.get('extra_attributes') or {}
        if isinstance(extra, dict):
            spec_fields = [
                'material', 'width', 'length', 'thickness', 'density',
                'description_size', 'uom', 'weight', 'net_weight', 'cutting_length'
            ]
            for field in spec_fields:
                if not ret.get(field) and field in extra and extra[field] is not None:
                    ret[field] = str(extra[field])
        return ret

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Populate extra_attributes with spec fields for backward compatibility
        extra = ret.get('extra_attributes') or {}
        if not isinstance(extra, dict):
            extra = {}
        spec_fields = [
            'material', 'width', 'length', 'thickness', 'density',
            'description_size', 'uom', 'weight', 'net_weight', 'cutting_length'
        ]
        for field in spec_fields:
            val = getattr(instance, field, None)
            if val and field not in extra:
                extra[field] = val
        ret['extra_attributes'] = extra
        return ret
    
    def validate_product_code(self, value):
        if value and value.strip():
            val = value.strip()
            qs = Product.objects.filter(product_code__iexact=val)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError(f"Product code '{val}' is already in use.")
            return val
        return ""

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative")
        return value