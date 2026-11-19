from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from .models import Vendor, InventoryItem, PurchaseOrder, PurchaseOrderItem, GRN, GRNItem, StockTransaction


def get_user_display_name(user):
    if not user:
        return ""
    full = ""
    if hasattr(user, 'get_full_name') and callable(user.get_full_name):
        try:
            full = user.get_full_name()
        except Exception:
            pass
    if not full:
        full = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return full or getattr(user, 'email', None) or getattr(user, 'mobile_no', None) or str(user)


class VendorSerializer(serializers.ModelSerializer):
    po_count = serializers.SerializerMethodField()
    grn_count = serializers.SerializerMethodField()

    def get_po_count(self, obj):
        return obj.purchase_orders.count()

    def get_grn_count(self, obj):
        return obj.grns.count()

    class Meta:
        model = Vendor
        fields = '__all__'


class InventoryItemSerializer(serializers.ModelSerializer):
    total_stock = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    stock_status = serializers.CharField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = InventoryItem
        fields = '__all__'


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    item_details = InventoryItemSerializer(source='item', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    unit = serializers.CharField(source='item.unit', read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'


class PurchaseOrderSerializer(serializers.ModelSerializer):
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    items_data = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return get_user_display_name(obj.created_by)
        return "System"

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items_data', None)
        if items_data is None:
            items_data = self.initial_data.get('items_data') or self.initial_data.get('items') or []
        po = PurchaseOrder.objects.create(**validated_data)

        subtotal = Decimal('0.00')
        for it in items_data:
            item_id = it.get('item') or it.get('item_id')
            qty = Decimal(str(it.get('quantity', 1)))
            price = Decimal(str(it.get('unit_price', 0)))
            tax = Decimal(str(it.get('tax_percent', 18)))
            total = (qty * price)

            PurchaseOrderItem.objects.create(
                purchase_order=po,
                item_id=item_id,
                quantity=qty,
                unit_price=price,
                tax_percent=tax,
                total_price=total
            )
            subtotal += total

        po.subtotal = subtotal
        po.tax_amount = (subtotal * Decimal('0.18')).quantize(Decimal('0.01'))
        po.total_amount = po.subtotal + po.tax_amount
        po.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
        return po

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items_data', None)
        if items_data is None and ('items' in self.initial_data or 'items_data' in self.initial_data):
            items_data = self.initial_data.get('items_data') or self.initial_data.get('items') or []
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            subtotal = Decimal('0.00')
            for it in items_data:
                item_id = it.get('item') or it.get('item_id')
                qty = Decimal(str(it.get('quantity', 1)))
                price = Decimal(str(it.get('unit_price', 0)))
                tax = Decimal(str(it.get('tax_percent', 18)))
                total = (qty * price)

                PurchaseOrderItem.objects.create(
                    purchase_order=instance,
                    item_id=item_id,
                    quantity=qty,
                    unit_price=price,
                    tax_percent=tax,
                    total_price=total
                )
                subtotal += total

            instance.subtotal = subtotal
            instance.tax_amount = (subtotal * Decimal('0.18')).quantize(Decimal('0.01'))
            instance.total_amount = instance.subtotal + instance.tax_amount
            instance.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

        return instance


class GRNItemSerializer(serializers.ModelSerializer):
    item_details = InventoryItemSerializer(source='item', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    unit = serializers.CharField(source='item.unit', read_only=True)

    class Meta:
        model = GRNItem
        fields = '__all__'


class GRNSerializer(serializers.ModelSerializer):
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    items = GRNItemSerializer(many=True, read_only=True)
    items_data = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return get_user_display_name(obj.created_by)
        return "System"

    class Meta:
        model = GRN
        fields = '__all__'

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items_data', None)
        if items_data is None:
            items_data = self.initial_data.get('items_data') or self.initial_data.get('items') or []
        user = self.context.get('request').user if self.context.get('request') else None
        if user and not user.is_anonymous:
            validated_data['created_by'] = user

        grn = GRN.objects.create(**validated_data)

        for it in items_data:
            item_id = it.get('item') or it.get('item_id')
            po_item_id = it.get('po_item') or it.get('po_item_id')
            ordered_qty = Decimal(str(it.get('ordered_quantity', 0)))
            rec_qty = Decimal(str(it.get('received_quantity', 0)))
            acc_qty = Decimal(str(it.get('accepted_quantity', rec_qty)))
            rej_qty = Decimal(str(it.get('rejected_quantity', 0)))
            price = Decimal(str(it.get('unit_price', 0)))
            remarks = it.get('remarks', '')

            grn_item = GRNItem.objects.create(
                grn=grn,
                item_id=item_id,
                po_item_id=po_item_id,
                ordered_quantity=ordered_qty,
                received_quantity=rec_qty,
                accepted_quantity=acc_qty,
                rejected_quantity=rej_qty,
                unit_price=price,
                remarks=remarks
            )

            # Automatically update InventoryItem stock on GRN creation
            inv_item = InventoryItem.objects.select_for_update().get(id=item_id)
            prev_stock = inv_item.available_stock
            new_stock = prev_stock + acc_qty
            inv_item.available_stock = new_stock
            inv_item.save(update_fields=['available_stock', 'updated_at'])

            # Record stock movement transaction
            StockTransaction.objects.create(
                item=inv_item,
                transaction_type='GRN',
                quantity=acc_qty,
                previous_available=prev_stock,
                new_available=new_stock,
                unit_price=price,
                reference_number=grn.grn_number,
                notes=f"Received via GRN #{grn.grn_number}. Inv/Challan: {grn.invoice_number or grn.challan_number or 'N/A'}",
                created_by=user if user and not user.is_anonymous else None
            )

            # Update PO item received quantity if linked
            if po_item_id:
                try:
                    po_item = PurchaseOrderItem.objects.get(id=po_item_id)
                    po_item.received_quantity += acc_qty
                    po_item.save(update_fields=['received_quantity'])
                except PurchaseOrderItem.DoesNotExist:
                    pass

        # Update PO status if linked
        if grn.purchase_order:
            po = grn.purchase_order
            po_items = po.items.all()
            all_received = all(p.received_quantity >= p.quantity for p in po_items) if po_items.exists() else False
            any_received = any(p.received_quantity > 0 for p in po_items) if po_items.exists() else False

            if all_received:
                po.status = 'RECEIVED'
            elif any_received:
                po.status = 'PARTIALLY_RECEIVED'
            po.save(update_fields=['status'])

        return grn


class StockTransactionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    item_capacity = serializers.CharField(source='item.capacity', read_only=True, default='')
    item_category = serializers.CharField(source='item.category', read_only=True, default='')
    unit = serializers.CharField(source='item.unit', read_only=True)
    available_stock = serializers.DecimalField(source='item.available_stock', max_digits=12, decimal_places=2, read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    technician_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    technician_mobile = serializers.SerializerMethodField()
    service_number = serializers.CharField(source='service.service_number', read_only=True, default='')
    visit_number = serializers.CharField(source='visit.visit_number', read_only=True, default='')
    project_code = serializers.CharField(source='project.project_code', read_only=True, default='')
    project_id = serializers.PrimaryKeyRelatedField(source='project', read_only=True)
    target_info = serializers.SerializerMethodField()
    issued_quantity = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return get_user_display_name(obj.created_by)
        return "System"

    def get_technician_name(self, obj):
        if obj.technician:
            return get_user_display_name(obj.technician)
        return ""

    def get_technician_mobile(self, obj):
        if obj.technician:
            return getattr(obj.technician, 'mobile_no', '') or getattr(obj.technician, 'phone', '') or ''
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return get_user_display_name(obj.approved_by)
        return ""

    def get_issued_quantity(self, obj):
        """Calculates total quantity of this item originally issued to the service, visit, or technician"""
        if obj.transaction_type != 'RETURN_STOCK':
            return None

        from django.db.models import Sum

        # 1. Target Service match
        if obj.service_id:
            qs = StockTransaction.objects.filter(
                service_id=obj.service_id,
                item_id=obj.item_id,
                transaction_type='ISSUE_STOCK'
            ).exclude(status='REJECTED')
            total = qs.aggregate(total=Sum('quantity'))['total']
            if total is not None:
                return float(total)

        # 2. Target AMC Visit match
        if obj.visit_id:
            qs = StockTransaction.objects.filter(
                visit_id=obj.visit_id,
                item_id=obj.item_id,
                transaction_type='ISSUE_STOCK'
            ).exclude(status='REJECTED')
            total = qs.aggregate(total=Sum('quantity'))['total']
            if total is not None:
                return float(total)

        # 3. Target Project match
        if obj.project_id:
            qs = StockTransaction.objects.filter(
                project_id=obj.project_id,
                item_id=obj.item_id,
                transaction_type='ISSUE_STOCK'
            ).exclude(status='REJECTED')
            total = qs.aggregate(total=Sum('quantity'))['total']
            if total is not None:
                return float(total)

        # 4. Match by reference number (e.g. ISSUE-TX-42 or job reference)
        if obj.reference_number:
            if str(obj.reference_number).startswith('ISSUE-TX-'):
                try:
                    tx_id = int(str(obj.reference_number).replace('ISSUE-TX-', ''))
                    issue_tx = StockTransaction.objects.filter(id=tx_id, transaction_type='ISSUE_STOCK').first()
                    if issue_tx:
                        return float(issue_tx.quantity)
                except (ValueError, TypeError):
                    pass

            qs = StockTransaction.objects.filter(
                reference_number=obj.reference_number,
                item_id=obj.item_id,
                transaction_type='ISSUE_STOCK'
            ).exclude(status='REJECTED')
            total = qs.aggregate(total=Sum('quantity'))['total']
            if total is not None:
                return float(total)

        # 4. Check if notes has [Issue Ref: #id] or Issue #id
        if obj.notes:
            import re
            m = re.search(r'Issue\s*(?:Ref:)?\s*#(\d+)', obj.notes)
            if m:
                try:
                    tx_id = int(m.group(1))
                    issue_tx = StockTransaction.objects.filter(id=tx_id, transaction_type='ISSUE_STOCK').first()
                    if issue_tx:
                        return float(issue_tx.quantity)
                except (ValueError, TypeError):
                    pass

        # 5. Fallback: technician match for this item
        if obj.technician_id:
            qs = StockTransaction.objects.filter(
                technician_id=obj.technician_id,
                item_id=obj.item_id,
                transaction_type='ISSUE_STOCK'
            ).exclude(status='REJECTED')
            total = qs.aggregate(total=Sum('quantity'))['total']
            if total is not None:
                return float(total)

        return None

    def get_target_info(self, obj):
        if obj.service:
            cust = getattr(obj.service.customer, 'company_name', None) or getattr(obj.service.customer, 'name', '') if obj.service.customer else ""
            return {
                'type': 'SERVICE',
                'id': obj.service.id,
                'number': obj.service.service_number,
                'customer': cust,
                'title': getattr(obj.service, 'description', '') or getattr(obj.service, 'title', '')
            }
        elif obj.visit:
            cust = ""
            customer_obj = obj.visit.customer or (obj.visit.amc_contract.customer if obj.visit.amc_contract else None)
            if customer_obj:
                cust = getattr(customer_obj, 'company_name', None) or getattr(customer_obj, 'name', '')
            return {
                'type': 'AMC_VISIT',
                'id': obj.visit.id,
                'number': obj.visit.visit_number,
                'customer': cust,
                'title': getattr(obj.visit, 'description', '') or getattr(obj.visit, 'purpose', 'Routine AMC Visit')
            }
        elif obj.project:
            cust = ""
            if obj.project.customer:
                cust = getattr(obj.project.customer, 'company_name', None) or getattr(obj.project.customer, 'name', '')
            return {
                'type': 'PROJECT',
                'id': obj.project.id,
                'number': obj.project.project_code or f"PRJ-{obj.project.id}",
                'customer': cust,
                'title': getattr(obj.project, 'project_scope_requirements', '') or f"Project {obj.project.project_code or obj.project.id}"
            }
        return None

    class Meta:
        model = StockTransaction
        fields = '__all__'

