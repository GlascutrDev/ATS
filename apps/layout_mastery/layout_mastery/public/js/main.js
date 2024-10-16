frappe.ui.form.on('Desk Sidebar', {
    after_save: function(frm) {
        // Call the server-side whitelisted method to clear global cache
        frappe.call({
            method: 'layout_mastery.api.clear_global_cache',
            callback: function() {
                frappe.show_alert({message: __("Global Cache Cleared"), indicator: 'green'});
                setTimeout(function() {
                    location.reload();
                }, 1000);
            }
        });
    }
});
