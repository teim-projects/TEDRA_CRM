from .base import *
import os

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Parse CSRF_TRUSTED_ORIGINS properly from env
CSRF_TRUSTED_ORIGINS = os.getenv(
    "CSRF_TRUSTED_ORIGINS",
    "https://norafashion.tech,https://www.norafashion.tech,http://norafashion.tech,http://www.norafashion.tech,http://91.99.119.240,https://91.99.119.240,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
).split(",")

# For local dev, default port to 3307 (XAMPP custom port) unless specified in env
if not os.getenv("DB_PORT"):
    DATABASES["default"]["PORT"] = "3307"
