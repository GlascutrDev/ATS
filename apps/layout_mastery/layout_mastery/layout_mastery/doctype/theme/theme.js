// Copyright (c) 2024, Tariqul Islam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Theme", {
	after_save: function (frm) {
		// Call the server-side whitelisted method to clear global cache
		frappe.call({
			method: 'layout_mastery.api.clear_global_cache',
			callback: function () {
				frappe.show_alert({message: __("Global Cache Cleared"), indicator: 'green'});
				setTimeout(function () {
					location.reload();
				}, 1000);
			}
		});
	}
});
