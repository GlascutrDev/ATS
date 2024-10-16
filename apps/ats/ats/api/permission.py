import frappe


def has_app_permission():
    # Check if the user is logged in (not a 'Guest')
    if frappe.session.user == 'Guest':
        return False  # No permission if the user is not logged in

    # Add your permission logic here
    # For example, allow only users with the role 'Factory Manager'
    if "ATS User" in frappe.get_roles(frappe.session.user):
        return True

    return False
