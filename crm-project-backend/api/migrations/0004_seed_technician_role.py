from django.db import migrations

def create_technician_role(apps, schema_editor):
    Role = apps.get_model('api', 'Role')
    default_permissions = {
        'dashboard': {'view': True, 'create': False, 'edit': False, 'delete': False},
        'projects': {'view': True, 'create': False, 'edit': True, 'delete': False},
        'amc': {'view': True, 'create': False, 'edit': True, 'delete': False},
        'products': {'view': True, 'create': False, 'edit': False, 'delete': False},
        'customers': {'view': True, 'create': False, 'edit': False, 'delete': False},
        'leads': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'followups': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'quotations': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'terms': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'accounts': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'templates': {'view': False, 'create': False, 'edit': False, 'delete': False},
        'billing': {'view': False, 'create': False, 'edit': False, 'delete': False},
    }
    role, created = Role.objects.get_or_create(
        name='Technician',
        defaults={'permissions': default_permissions}
    )
    if not created and not role.permissions:
        role.permissions = default_permissions
        role.save(update_fields=['permissions'])

def remove_technician_role(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_messagetemplate'),
    ]

    operations = [
        migrations.RunPython(create_technician_role, remove_technician_role),
    ]

