from .base import *
import os

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

ALLOWED_HOSTS = [
    "norafashion.tech",
    "www.norafashion.tech",
    "91.99.119.240",
    "localhost",
    "127.0.0.1",
]

env_allowed = os.getenv("ALLOWED_HOSTS")
if env_allowed:
    for h in env_allowed.split(","):
        h = h.strip()
        if h and h not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(h)

CSRF_TRUSTED_ORIGINS = [
    "https://norafashion.tech",
    "https://www.norafashion.tech",
    "http://norafashion.tech",
    "http://www.norafashion.tech",
    "http://91.99.119.240",
    "https://91.99.119.240",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

env_csrf = os.getenv("CSRF_TRUSTED_ORIGINS")
if env_csrf:
    for origin in env_csrf.split(","):
        origin = origin.strip()
        if origin and origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(origin)

CORS_ALLOWED_ORIGINS = [
    "https://norafashion.tech",
    "https://www.norafashion.tech",
    "http://norafashion.tech",
    "http://www.norafashion.tech",
    "http://91.99.119.240",
    "https://91.99.119.240",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

env_cors = os.getenv("CORS_ALLOWED_ORIGINS")
if env_cors:
    for origin in env_cors.split(","):
        origin = origin.strip()
        if origin and origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(origin)

CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "False").lower() == "true"
CORS_ALLOW_CREDENTIALS = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.getenv("DB_NAME", "ds_aqua"),
        "USER": os.getenv("DB_USER", "root"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": os.getenv("DB_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# When running behind Nginx reverse proxy with Gunicorn
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "False").lower() == "true"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "False").lower() == "true"
