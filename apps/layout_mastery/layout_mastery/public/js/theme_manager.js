document.addEventListener('DOMContentLoaded', function () {
	// Default theme is light
	const themeMode = document.documentElement.getAttribute('data-theme');

	// Fetch the active theme from the backend
	frappe.call({
		method: 'layout_mastery.layout_mastery.doctype.theme.theme.get_active_theme',
		callback: function (response) {
			const theme = response.message;
			if (themeMode === 'dark') {
				document.documentElement.style.setProperty('--primary', theme.primary_color_dark);
				document.documentElement.style.setProperty('--secondary', theme.secondary_color_dark);
				document.documentElement.style.setProperty('--btn-border-color', theme.btn_border_color_dark);
				document.documentElement.style.setProperty('--btn-bg-color', theme.btn_bg_color_dark);
				document.documentElement.style.setProperty('--btn-hover-bg-color', theme.btn_hover_bg_color_dark);
				document.documentElement.style.setProperty('--btn-hover-text-color', theme.btn_hover_text_color_dark);
				document.documentElement.style.setProperty('--navbar-height', theme.navbar_height_dark + 'px');
				document.documentElement.style.setProperty('--text-base', theme.text_base_dark + 'px');
				document.documentElement.style.setProperty('--table-head-bg', theme.table_head_bg_dark);
				document.documentElement.style.setProperty('--text-white', theme.text_white_dark);
			}
			else {
				document.documentElement.style.setProperty('--primary', theme.primary_color_light);
				document.documentElement.style.setProperty('--secondary', theme.secondary_color_light);
				document.documentElement.style.setProperty('--btn-border-color', theme.btn_border_color_light);
				document.documentElement.style.setProperty('--btn-bg-color', theme.btn_bg_color_light);
				document.documentElement.style.setProperty('--btn-hover-bg-color', theme.btn_hover_bg_color_light);
				document.documentElement.style.setProperty('--btn-hover-text-color', theme.btn_hover_text_color_light);
				document.documentElement.style.setProperty('--navbar-height', theme.navbar_height_light + 'px');
				document.documentElement.style.setProperty('--text-base', theme.text_base_light + 'px');
				document.documentElement.style.setProperty('--table-head-bg', theme.table_head_bg_light);
				document.documentElement.style.setProperty('--text-white', theme.text_white_light);
			}
		}
	});
});
