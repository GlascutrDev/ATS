# Copyright (c) 2024, Tariqul Islam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Theme(Document):
	def validate(self):
		self.validate_default_theme()

	def validate_default_theme(self):
		if self.is_default:
			# Uncheck 'is_default' for all other themes
			other_themes = frappe.get_all('Theme', filters={'name': ['!=', self.name]})
			for theme in other_themes:
				frappe.db.set_value('Theme', theme.name, 'is_default', 0)


@frappe.whitelist()
def get_active_theme():
	# Fetch the default theme
	theme = frappe.get_all('Theme', filters={'is_default': 1}, fields=["*"], limit=1)

	if theme:
		return theme[0]
	else:
		return None
