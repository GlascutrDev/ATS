import frappe


@frappe.whitelist()
def clear_global_cache():
    frappe.clear_cache()


@frappe.whitelist(allow_guest=True)
def get_desk_sidebar_with_items():
	desk_sidebar = frappe.get_single('Desk Sidebar')
	print(desk_sidebar.menu_items)

	# Create a dictionary to hold all menu items by name for easy access
	menu_dict = {menu_item.name: {
		'title': menu_item.title,
		'link': menu_item.link,
		'icon_class': menu_item.icon,
		'children': [],
		'parent1': menu_item.parent1
	} for menu_item in desk_sidebar.menu_items}

	# Function to build nested structure
	def build_nested_menu(item_name):
		item = menu_dict.get(item_name)
		if not item:
			return None

		# Get children for the current item
		children = [build_nested_menu(child_name) for child_name in menu_dict if
					menu_dict[child_name]['parent1'] == item_name]

		# Assign children to the current item
		item['children'] = [child for child in children if child is not None]
		return item

	# Build the response starting from top-level items (those without a parent)
	response = [build_nested_menu(item_name) for item_name in menu_dict if
				menu_dict[item_name]['parent1'] is None]

	return response
