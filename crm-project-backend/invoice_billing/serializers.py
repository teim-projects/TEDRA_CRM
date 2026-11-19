from rest_framework import serializers
from decimal import Decimal
from .models import Invoice, InvoiceItem, number_to_indian_words


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'item_name',
            'hsn_sac',
            'quantity',
            'unit',
            'price_per_unit',
            'discount_percent',
            'discount_amount',
            'taxable_amount',
            'gst_rate',
            'gst_amount',
            'cgst_rate',
            'cgst_amount',
            'sgst_rate',
            'sgst_amount',
            'igst_rate',
            'igst_amount',
            'total_amount',
            'sort_order',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    project_code = serializers.SerializerMethodField(read_only=True)
    amc_contract_number = serializers.SerializerMethodField(read_only=True)
    service_number = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'invoice_date',
            'invoice_time',
            'invoice_type',
            'status',

            # Relations
            'project',
            'project_code',
            'amc_contract',
            'amc_contract_number',
            'service',
            'service_number',
            'customer',
            'billing_detail',

            # Company details
            'company_name',
            'company_address',
            'company_phone',
            'company_email',
            'company_gstin',
            'company_state',

            # Bill To
            'bill_to_name',
            'bill_to_address',
            'bill_to_contact',
            'bill_to_gstin',
            'bill_to_state',

            # Ship To
            'ship_to_name',
            'ship_to_address',
            'ship_to_contact',
            'ship_to_gstin',
            'ship_to_state',

            # Meta
            'place_of_supply',
            'po_number',
            'po_date',

            # Bank
            'bank_name',
            'bank_account_no',
            'bank_ifsc',
            'account_holder_name',

            # Financials
            'sub_total',
            'discount_total',
            'taxable_amount',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'round_off',
            'grand_total',
            'received_amount',
            'balance_amount',
            'you_saved',
            'payment_mode',
            'previous_balance',
            'current_balance',
            'amount_in_words',
            'terms_conditions',
            'notes',

            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',

            'items',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_project_code(self, obj):
        if obj.project:
            return obj.project.project_code or f"PRJ-{obj.project.id}"
        return None

    def get_amc_contract_number(self, obj):
        if obj.amc_contract:
            return getattr(obj.amc_contract, 'contract_id', None) or f"AMC-{obj.amc_contract.id}"
        return None

    def get_service_number(self, obj):
        if obj.service:
            return getattr(obj.service, 'service_number', None) or f"SRV-{obj.service.id}"
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username or obj.created_by.email
        return None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and 'created_by' not in validated_data:
            validated_data['created_by'] = request.user

        # Auto-compute amount in words if missing
        if 'grand_total' in validated_data and not validated_data.get('amount_in_words'):
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        invoice = Invoice.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data):
            InvoiceItem.objects.create(invoice=invoice, sort_order=idx + 1, **item_data)

        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        if 'grand_total' in validated_data:
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data):
                InvoiceItem.objects.create(invoice=instance, sort_order=idx + 1, **item_data)

        return instance
