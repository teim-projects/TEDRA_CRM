from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from lead_management.models import Customer, CustomerStatus


class CustomerPrincipal:
    """
    Lightweight authenticated principal wrapping a Customer record
    for read-only Customer Portal API endpoints.
    """
    is_authenticated = True
    is_active = True
    is_anonymous = False
    is_superuser = False
    is_staff = False
    is_customer = True

    def __init__(self, customer):
        self.customer = customer
        self.id = customer.id
        self.pk = customer.id
        self.email = customer.email or ""
        self.mobile_no = customer.contact_number or ""
        self.customer_code = customer.customer_code or ""
        self.name = customer.name or ""

    def __str__(self):
        return f"CustomerPrincipal({self.customer_code or self.id} - {self.name})"


class CustomerJWTAuthentication(JWTAuthentication):
    """
    Authenticates SimpleJWT access tokens issued for Customer Portal sessions
    (where token['user_type'] == 'customer').
    """

    def get_user(self, validated_token):
        if validated_token.get("user_type") != "customer":
            raise AuthenticationFailed("Customer portal token required.", code="invalid_token_type")

        customer_id = validated_token.get("customer_id")
        if not customer_id:
            raise AuthenticationFailed("Token contained no customer identification.", code="token_no_customer")

        customer = Customer.objects.filter(id=customer_id).first()
        if not customer:
            raise AuthenticationFailed("Customer account not found.", code="customer_not_found")

        if customer.customer_status == CustomerStatus.INACTIVE:
            raise AuthenticationFailed("Customer account is inactive.", code="customer_inactive")

        return CustomerPrincipal(customer)
