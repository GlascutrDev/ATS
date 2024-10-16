app_name = "layout_mastery"
app_title = "Layout Mastery"
app_publisher = "Tariqul Islam"
app_description = "Layout MAstery"
app_email = "tariqul@glascutr.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "layout_mastery",
		"logo": "/assets/layout_mastery/logo.png",
		"title": "Layout Mastery",
		"route": "/layout_mastery",
		# "has_permission": "layout_mastery.api.permission.has_app_permission"
	}
]

# Includes in <head>
# ------------------
app_include_css = [
	"/assets/layout_mastery/css/styles.css",
	"/assets/layout_mastery/css/fontawesome.min.css"
]
app_include_js = [
	"/assets/layout_mastery/js/main.js",
	"/assets/layout_mastery/js/custom_sidebar.js",
	"/assets/layout_mastery/js/custom_listview.js",
	"/assets/layout_mastery/js/custom_navbar.js",
	"/assets/layout_mastery/js/theme_manager.js"
]

override_whitelisted_methods = {
	"GET": {
		"layout_mastery.clear_global_cache": "layout_mastery.api.clear_global_cache",
		"layout_mastery.get_desk_sidebar_with_items": "layout_mastery.api.get_desk_sidebar_with_items"
	}
}

# include js, css files in header of desk.html
# app_include_css = "/assets/layout_mastery/css/layout_mastery.css"
# app_include_js = "/assets/layout_mastery/js/layout_mastery.js"

# include js, css files in header of web template
# web_include_css = "/assets/layout_mastery/css/layout_mastery.css"
# web_include_js = "/assets/layout_mastery/js/layout_mastery.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "layout_mastery/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "layout_mastery/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "layout_mastery.utils.jinja_methods",
# 	"filters": "layout_mastery.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "layout_mastery.install.before_install"
# after_install = "layout_mastery.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "layout_mastery.uninstall.before_uninstall"
# after_uninstall = "layout_mastery.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "layout_mastery.utils.before_app_install"
# after_app_install = "layout_mastery.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "layout_mastery.utils.before_app_uninstall"
# after_app_uninstall = "layout_mastery.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "layout_mastery.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"layout_mastery.tasks.all"
# 	],
# 	"daily": [
# 		"layout_mastery.tasks.daily"
# 	],
# 	"hourly": [
# 		"layout_mastery.tasks.hourly"
# 	],
# 	"weekly": [
# 		"layout_mastery.tasks.weekly"
# 	],
# 	"monthly": [
# 		"layout_mastery.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "layout_mastery.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "layout_mastery.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "layout_mastery.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["layout_mastery.utils.before_request"]
# after_request = ["layout_mastery.utils.after_request"]

# Job Events
# ----------
# before_job = ["layout_mastery.utils.before_job"]
# after_job = ["layout_mastery.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"layout_mastery.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }
