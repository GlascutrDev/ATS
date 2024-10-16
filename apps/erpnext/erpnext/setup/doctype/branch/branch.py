# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt


from frappe.model.document import Document


class Branch(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		address: DF.SmallText | None
		branch: DF.Data
		branch_code: DF.Data | None
		branch_head: DF.Link | None
		contact_number: DF.Data | None
		email: DF.Data | None
		parent_organization: DF.Link | None
		status: DF.Literal["Active", "Inactive"]
	# end: auto-generated types

	pass
