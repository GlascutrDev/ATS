frappe.provide("frappe.views");

class BulkOperations {
	constructor({doctype}) {
		if (!doctype) frappe.throw(__("Doctype required"));
		this.doctype = doctype;
	}

	print(docs) {
		const print_settings = frappe.model.get_doc(":Print Settings", "Print Settings");
		const allow_print_for_draft = cint(print_settings.allow_print_for_draft);
		const is_submittable = frappe.model.is_submittable(this.doctype);
		const allow_print_for_cancelled = cint(print_settings.allow_print_for_cancelled);
		const letterheads = this.get_letterhead_options();
		const MAX_PRINT_LIMIT = 500;
		const BACKGROUND_PRINT_THRESHOLD = 25;

		const valid_docs = docs
			.filter((doc) => {
				return (
					!is_submittable ||
					doc.docstatus === 1 ||
					(allow_print_for_cancelled && doc.docstatus == 2) ||
					(allow_print_for_draft && doc.docstatus == 0) ||
					frappe.user.has_role("Administrator")
				);
			})
			.map((doc) => doc.name);

		const invalid_docs = docs.filter((doc) => !valid_docs.includes(doc.name));

		if (invalid_docs.length > 0) {
			frappe.msgprint(__("You selected Draft or Cancelled documents"));
			return;
		}

		if (valid_docs.length === 0) {
			frappe.msgprint(__("Select atleast 1 record for printing"));
			return;
		}

		if (valid_docs.length > MAX_PRINT_LIMIT) {
			frappe.msgprint(
				__("You can only print upto {0} documents at a time", [MAX_PRINT_LIMIT])
			);
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: __("Print Documents"),
			fields: [
				{
					fieldtype: "Select",
					label: __("Letter Head"),
					fieldname: "letter_sel",
					options: letterheads,
					default: letterheads[0],
				},
				{
					fieldtype: "Select",
					label: __("Print Format"),
					fieldname: "print_sel",
					options: frappe.meta.get_print_formats(this.doctype),
					default: frappe.get_meta(this.doctype).default_print_format,
				},
				{
					fieldtype: "Select",
					label: __("Page Size"),
					fieldname: "page_size",
					options: frappe.meta.get_print_sizes(),
					default: print_settings.pdf_page_size,
				},
				{
					fieldtype: "Float",
					label: __("Page Height (in mm)"),
					fieldname: "page_height",
					depends_on: 'eval:doc.page_size == "Custom"',
					default: print_settings.pdf_page_height,
				},
				{
					fieldtype: "Float",
					label: __("Page Width (in mm)"),
					fieldname: "page_width",
					depends_on: 'eval:doc.page_size == "Custom"',
					default: print_settings.pdf_page_width,
				},
				{
					fieldtype: "Check",
					label: __("Background Print (required for >25 documents)"),
					fieldname: "background_print",
					default: valid_docs.length > BACKGROUND_PRINT_THRESHOLD,
					read_only: valid_docs.length > BACKGROUND_PRINT_THRESHOLD,
				},
			],
		});

		dialog.set_primary_action(__("Print"), (args) => {
			if (!args) return;
			const default_print_format = frappe.get_meta(this.doctype).default_print_format;
			const with_letterhead = args.letter_sel == __("No Letterhead") ? 0 : 1;
			const print_format = args.print_sel ? args.print_sel : default_print_format;
			const json_string = JSON.stringify(valid_docs);
			const letterhead = args.letter_sel;

			let pdf_options;
			if (args.page_size === "Custom") {
				if (args.page_height === 0 || args.page_width === 0) {
					frappe.throw(__("Page height and width cannot be zero"));
				}
				pdf_options = JSON.stringify({
					"page-height": args.page_height,
					"page-width": args.page_width,
				});
			} else {
				pdf_options = JSON.stringify({"page-size": args.page_size});
			}

			if (args.background_print) {
				frappe
					.call("frappe.utils.print_format.download_multi_pdf_async", {
						doctype: this.doctype,
						name: json_string,
						format: print_format,
						no_letterhead: with_letterhead ? "0" : "1",
						letterhead: letterhead,
						options: pdf_options,
					})
					.then((response) => {
						let task_id = response.message.task_id;
						frappe.realtime.task_subscribe(task_id);
						frappe.realtime.on(`task_complete:${task_id}`, (data) => {
							frappe.msgprint({
								title: __("Bulk PDF Export"),
								message: __("Your PDF is ready for download"),
								primary_action: {
									label: __("Download PDF"),
									client_action: "window.open",
									args: data.file_url,
								},
							});
							frappe.realtime.task_unsubscribe(task_id);
							frappe.realtime.off(`task_complete:${task_id}`);
						});
					});
			} else {
				const w = window.open(
					"/api/method/frappe.utils.print_format.download_multi_pdf?" +
					"doctype=" +
					encodeURIComponent(this.doctype) +
					"&name=" +
					encodeURIComponent(json_string) +
					"&format=" +
					encodeURIComponent(print_format) +
					"&no_letterhead=" +
					(with_letterhead ? "0" : "1") +
					"&letterhead=" +
					encodeURIComponent(letterhead) +
					"&options=" +
					encodeURIComponent(pdf_options)
				);

				if (!w) {
					frappe.msgprint(__("Please enable pop-ups"));
				}
			}
			dialog.hide();
		});
		dialog.show();
	}

	get_letterhead_options() {
		const letterhead_options = [__("No Letterhead")];
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Letter Head",
				fields: ["name", "is_default"],
				filters: {disabled: 0},
				limit_page_length: 0,
			},
			async: false,
			callback(r) {
				if (r.message) {
					r.message.forEach((letterhead) => {
						if (letterhead.is_default) {
							letterhead_options.unshift(letterhead.name);
						} else {
							letterhead_options.push(letterhead.name);
						}
					});
				}
			},
		});
		return letterhead_options;
	}

	delete(docnames, done = null) {
		frappe
			.call({
				method: "frappe.desk.reportview.delete_items",
				freeze: true,
				freeze_message:
					docnames.length <= 10
						? __("Deleting {0} records...", [docnames.length])
						: null,
				args: {
					items: docnames,
					doctype: this.doctype,
				},
			})
			.then((r) => {
				let failed = r.message;
				if (!failed) failed = [];

				if (failed.length && !r._server_messages) {
					frappe.throw(
						__("Cannot delete {0}", [failed.map((f) => f.bold()).join(", ")])
					);
				}
				if (failed.length < docnames.length) {
					frappe.utils.play_sound("delete");
					if (done) done();
				}
			});
	}

	assign(docnames, done) {
		if (docnames.length > 0) {
			const assign_to = new frappe.ui.form.AssignToDialog({
				obj: this,
				method: "frappe.desk.form.assign_to.add_multiple",
				doctype: this.doctype,
				docname: docnames,
				bulk_assign: true,
				re_assign: true,
				callback: done,
			});
			assign_to.dialog.clear();
			assign_to.dialog.show();
		} else {
			frappe.msgprint(__("Select records for assignment"));
		}
	}

	clear_assignment(docnames, done) {
		if (docnames.length > 0) {
			frappe
				.call({
					method: "frappe.desk.form.assign_to.remove_multiple",
					args: {
						doctype: this.doctype,
						names: docnames,
						ignore_permissions: true,
					},
					freeze: true,
					freeze_message: "Removing assignments...",
				})
				.then(() => {
					done();
				});
		} else {
			frappe.msgprint(__("Select records for removing assignment"));
		}
	}

	apply_assignment_rule(docnames, done) {
		if (docnames.length > 0) {
			frappe
				.call("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", {
					doctype: this.doctype,
					docnames: docnames,
				})
				.then(() => done());
		}
	}

	submit_or_cancel(docnames, action = "submit", done = null) {
		action = action.toLowerCase();
		const task_id = Math.random().toString(36).slice(-5);
		frappe.realtime.task_subscribe(task_id);
		return frappe
			.xcall("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", {
				doctype: this.doctype,
				action: action,
				docnames: docnames,
				task_id: task_id,
			})
			.then((failed_docnames) => {
				if (failed_docnames?.length) {
					const comma_separated_records = frappe.utils.comma_and(failed_docnames);
					switch (action) {
						case "submit":
							frappe.throw(__("Cannot submit {0}.", [comma_separated_records]));
							break;
						case "cancel":
							frappe.throw(__("Cannot cancel {0}.", [comma_separated_records]));
							break;
						default:
							frappe.throw(__("Cannot {0} {1}.", [action, comma_separated_records]));
					}
				}
				if (failed_docnames?.length < docnames.length) {
					frappe.utils.play_sound(action);
					if (done) done();
				}
			})
			.finally(() => {
				frappe.realtime.task_unsubscribe(task_id);
			});
	}

	edit(docnames, field_mappings, done) {
		let field_options = Object.keys(field_mappings).sort(function (a, b) {
			return __(cstr(field_mappings[a].label)).localeCompare(
				cstr(__(field_mappings[b].label))
			);
		});
		const status_regex = /status/i;

		const default_field = field_options.find((value) => status_regex.test(value));

		const dialog = new frappe.ui.Dialog({
			title: __("Bulk Edit"),
			fields: [
				{
					fieldtype: "Select",
					options: field_options,
					default: default_field,
					label: __("Field"),
					fieldname: "field",
					reqd: 1,
					onchange: () => {
						set_value_field(dialog);
					},
				},
				{
					fieldtype: "Data",
					label: __("Value"),
					fieldname: "value",
					onchange() {
						show_help_text();
					},
				},
			],
			primary_action: ({value}) => {
				const fieldname = field_mappings[dialog.get_value("field")].fieldname;
				dialog.disable_primary_action();
				frappe
					.call({
						method: "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
						args: {
							doctype: this.doctype,
							freeze: true,
							docnames: docnames,
							action: "update",
							data: {
								[fieldname]: value || null,
							},
						},
					})
					.then((r) => {
						let failed = r.message || [];

						if (failed.length && !r._server_messages) {
							dialog.enable_primary_action();
							frappe.throw(
								__("Cannot update {0}", [
									failed.map((f) => (f.bold ? f.bold() : f)).join(", "),
								])
							);
						}
						done();
						dialog.hide();
						frappe.show_alert(__("Updated successfully"));
					});
			},
			primary_action_label: __("Update {0} records", [docnames.length]),
		});

		if (default_field) set_value_field(dialog); // to set `Value` df based on default `Field`
		show_help_text();

		function set_value_field(dialogObj) {
			const new_df = Object.assign({}, field_mappings[dialogObj.get_value("field")]);
			/* if the field label has status in it and
			if it has select fieldtype with no default value then
			set a default value from the available option. */
			if (
				new_df.label.match(status_regex) &&
				new_df.fieldtype === "Select" &&
				!new_df.default
			) {
				let options = [];
				if (typeof new_df.options === "string") {
					options = new_df.options.split("\n");
				}
				//set second option as default if first option is an empty string
				new_df.default = options[0] || options[1];
			}
			new_df.label = __("Value");
			new_df.onchange = show_help_text;

			delete new_df.depends_on;
			dialogObj.replace_field("value", new_df);
			show_help_text();
		}

		function show_help_text() {
			let value = dialog.get_value("value");
			if (value == null || value === "") {
				dialog.set_df_property(
					"value",
					"description",
					__("You have not entered a value. The field will be set to empty.")
				);
			} else {
				dialog.set_df_property("value", "description", "");
			}
		}

		dialog.refresh();
		dialog.show();
	}

	add_tags(docnames, done) {
		const dialog = new frappe.ui.Dialog({
			title: __("Add Tags"),
			fields: [
				{
					fieldtype: "MultiSelectPills",
					fieldname: "tags",
					label: __("Tags"),
					reqd: true,
					get_data: function (txt) {
						return frappe.db.get_link_options("Tag", txt);
					},
				},
			],
			primary_action_label: __("Add"),
			primary_action: () => {
				let args = dialog.get_values();
				if (args && args.tags) {
					dialog.set_message("Adding Tags...");

					frappe.call({
						method: "frappe.desk.doctype.tag.tag.add_tags",
						args: {
							tags: args.tags,
							dt: this.doctype,
							docs: docnames,
						},
						callback: () => {
							dialog.hide();
							done();
						},
					});
				}
			},
		});
		dialog.show();
	}

	export(doctype, docnames) {
		frappe.require("data_import_tools.bundle.js", () => {
			const data_exporter = new frappe.data_import.DataExporter(
				doctype,
				"Insert New Records"
			);
			data_exporter.dialog.set_value("export_records", "by_filter");
			data_exporter.filter_group.add_filters_to_filter_group([
				[doctype, "name", "in", docnames, false],
			]);
		});
	}
}

class ListSettings {
	constructor({listview, doctype, meta, settings}) {
		if (!doctype) {
			frappe.throw("DocType required");
		}

		this.listview = listview;
		this.doctype = doctype;
		this.meta = meta;
		this.settings = settings;
		this.dialog = null;
		this.fields =
			this.settings && this.settings.fields ? JSON.parse(this.settings.fields) : [];
		this.subject_field = null;

		frappe.model.with_doctype("List View Settings", () => {
			this.make();
			this.get_listview_fields(meta);
			this.setup_fields();
			this.setup_remove_fields();
			this.add_new_fields();
			this.show_dialog();
		});
	}

	make() {
		let me = this;

		let list_view_settings = frappe.get_meta("List View Settings");

		me.dialog = new frappe.ui.Dialog({
			title: __("{0} Settings", [__(me.doctype)]),
			fields: list_view_settings.fields,
		});
		me.dialog.set_values(me.settings);
		me.dialog.set_primary_action(__("Save"), () => {
			let values = me.dialog.get_values();

			frappe.show_alert({
				message: __("Saving"),
				indicator: "green",
			});

			frappe.call({
				method: "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings",
				args: {
					doctype: me.doctype,
					listview_settings: values,
					removed_listview_fields: me.removed_fields || [],
				},
				callback: function (r) {
					me.listview.refresh_columns(r.message.meta, r.message.listview_settings);
					me.dialog.hide();
				},
			});
		});

		me.dialog.fields_dict["total_fields"].df.onchange = () => me.refresh();
	}

	refresh() {
		let me = this;

		me.setup_fields();
		me.add_new_fields();
		me.setup_remove_fields();
	}

	show_dialog() {
		let me = this;

		if (!this.settings.fields) {
			me.update_fields();
		}

		if (!me.dialog.get_value("total_fields")) {
			let field_count = me.fields.length;

			if (field_count < 4) {
				field_count = 4;
			} else if (field_count > 10) {
				field_count = 10;
			}

			me.dialog.set_value("total_fields", field_count);
		}

		me.dialog.show();
	}

	setup_fields() {
		function is_status_field(field) {
			return field.fieldname === "status_field";
		}

		let me = this;

		let fields_html = me.dialog.get_field("fields_html");
		let wrapper = fields_html.$wrapper[0];
		let fields = ``;
		let total_fields = me.dialog.get_values().total_fields || me.settings.total_fields;

		for (let idx in me.fields) {
			if (idx == parseInt(total_fields)) {
				break;
			}
			let is_sortable = idx == 0 ? `` : `sortable`;
			let show_sortable_handle = idx == 0 ? `hide` : ``;
			let can_remove = idx == 0 || is_status_field(me.fields[idx]) ? `hide` : ``;

			fields += `
				<div class="control-input flex align-center form-control fields_order ${is_sortable}"
					style="display: block; margin-bottom: 5px;" data-fieldname="${me.fields[idx].fieldname}"
					data-label="${me.fields[idx].label}" data-type="${me.fields[idx].type}">

					<div class="row">
						<div class="col-1">
							${frappe.utils.icon("drag", "xs", "", "", "sortable-handle " + show_sortable_handle)}
						</div>
						<div class="col-10" style="padding-left:0px;">
							${__(me.fields[idx].label, null, me.doctype)}
						</div>
						<div class="col-1 ${can_remove}">
							<a class="text-muted remove-field" data-fieldname="${me.fields[idx].fieldname}">
								${frappe.utils.icon("delete", "xs")}
							</a>
						</div>
					</div>
				</div>`;
		}

		fields_html.html(`
			<div class="form-group">
				<div class="clearfix">
					<label class="control-label" style="padding-right: 0px;">${__("Fields")}</label>
				</div>
				<div class="control-input-wrapper">
				${fields}
				</div>
				<p class="help-box small text-extra-muted">
					<a class="add-new-fields text-muted">
						${__("+ Add / Remove Fields")}
					</a>
				</p>
			</div>
		`);

		new Sortable(wrapper.getElementsByClassName("control-input-wrapper")[0], {
			handle: ".sortable-handle",
			draggable: ".sortable",
			onUpdate: () => {
				me.update_fields();
				me.refresh();
			},
		});
	}

	add_new_fields() {
		let me = this;

		let fields_html = me.dialog.get_field("fields_html");
		let add_new_fields = fields_html.$wrapper[0].getElementsByClassName("add-new-fields")[0];
		add_new_fields.onclick = () => me.column_selector();
	}

	setup_remove_fields() {
		let me = this;

		let fields_html = me.dialog.get_field("fields_html");
		let remove_fields = fields_html.$wrapper[0].getElementsByClassName("remove-field");

		for (let idx = 0; idx < remove_fields.length; idx++) {
			remove_fields.item(idx).onclick = () =>
				me.remove_fields(remove_fields.item(idx).getAttribute("data-fieldname"));
		}
	}

	remove_fields(fieldname) {
		let me = this;
		let existing_fields = me.fields.map((f) => f.fieldname);

		for (let idx in me.fields) {
			let field = me.fields[idx];

			if (field.fieldname == fieldname) {
				me.fields.splice(idx, 1);
				break;
			}
		}
		me.set_removed_fields(
			me.get_removed_listview_fields(
				me.fields.map((f) => f.fieldname),
				existing_fields
			)
		);
		me.refresh();
		me.update_fields();
	}

	update_fields() {
		let me = this;

		let fields_html = me.dialog.get_field("fields_html");
		let wrapper = fields_html.$wrapper[0];

		let fields_order = wrapper.getElementsByClassName("fields_order");
		me.fields = [];

		for (let idx = 0; idx < fields_order.length; idx++) {
			me.fields.push({
				fieldname: fields_order.item(idx).getAttribute("data-fieldname"),
				label: __(fields_order.item(idx).getAttribute("data-label")),
			});
		}

		me.dialog.set_value("fields", JSON.stringify(me.fields));
		me.dialog.get_value("fields");
	}

	column_selector() {
		let me = this;

		let d = new frappe.ui.Dialog({
			title: __("{0} Fields", [__(me.doctype)]),
			fields: [
				{
					label: __("Reset Fields"),
					fieldtype: "Button",
					fieldname: "reset_fields",
					click: () => me.reset_listview_fields(d),
				},
				{
					label: __("Select Fields"),
					fieldtype: "MultiCheck",
					fieldname: "fields",
					options: me.get_doctype_fields(
						me.meta,
						me.fields.map((f) => f.fieldname)
					),
					columns: 2,
				},
			],
		});
		d.set_primary_action(__("Save"), () => {
			let values = d.get_values().fields;

			me.set_removed_fields(
				me.get_removed_listview_fields(
					values,
					me.fields.map((f) => f.fieldname)
				)
			);

			me.fields = [];
			me.set_subject_field(me.meta);
			me.set_status_field();

			for (let idx in values) {
				let value = values[idx];

				if (me.fields.length === parseInt(me.dialog.get_values().total_fields)) {
					break;
				} else if (value != me.subject_field.fieldname) {
					let field = frappe.meta.get_docfield(me.doctype, value);
					if (field) {
						me.fields.push({
							label: __(field.label, null, me.doctype),
							fieldname: field.fieldname,
						});
					}
				}
			}

			me.refresh();
			me.dialog.set_value("fields", JSON.stringify(me.fields));
			d.hide();
		});
		d.show();
	}

	reset_listview_fields(dialog) {
		let me = this;

		frappe
			.xcall(
				"frappe.desk.doctype.list_view_settings.list_view_settings.get_default_listview_fields",
				{
					doctype: me.doctype,
				}
			)
			.then((fields) => {
				let field = dialog.get_field("fields");
				field.df.options = me.get_doctype_fields(me.meta, fields);
				dialog.refresh();
			});
	}

	get_listview_fields(meta) {
		let me = this;

		if (!me.settings.fields) {
			me.set_list_view_fields(meta);
		} else {
			me.fields = JSON.parse(this.settings.fields);
		}

		me.fields.uniqBy((f) => f.fieldname);
	}

	set_list_view_fields(meta) {
		let me = this;

		me.set_subject_field(meta);
		me.set_status_field();

		meta.fields.forEach((field) => {
			if (
				field.in_list_view &&
				!frappe.model.no_value_type.includes(field.fieldtype) &&
				me.subject_field.fieldname != field.fieldname
			) {
				me.fields.push({
					label: __(field.label, null, me.doctype),
					fieldname: field.fieldname,
				});
			}
		});
	}

	set_subject_field(meta) {
		let me = this;

		me.subject_field = {
			label: __("ID"),
			fieldname: "name",
		};

		if (meta.title_field) {
			let field = frappe.meta.get_docfield(me.doctype, meta.title_field.trim());

			me.subject_field = {
				label: __(field.label, null, me.doctype),
				fieldname: field.fieldname,
			};
		}

		me.fields.push(me.subject_field);
	}

	set_status_field() {
		let me = this;

		if (frappe.has_indicator(me.doctype)) {
			me.fields.push({
				type: "Status",
				label: __("Status"),
				fieldname: "status_field",
			});
		}
	}

	get_doctype_fields(meta, fields) {
		let multiselect_fields = [];

		meta.fields.forEach((field) => {
			if (!frappe.model.no_value_type.includes(field.fieldtype)) {
				multiselect_fields.push({
					label: __(field.label, null, field.doctype),
					value: field.fieldname,
					checked: fields.includes(field.fieldname),
				});
			}
		});

		return multiselect_fields;
	}

	get_removed_listview_fields(new_fields, existing_fields) {
		let me = this;
		let removed_fields = [];

		if (frappe.has_indicator(me.doctype)) {
			new_fields.push("status_field");
		}

		existing_fields.forEach((column) => {
			if (!new_fields.includes(column)) {
				removed_fields.push(column);
			}
		});

		return removed_fields;
	}

	set_removed_fields(fields) {
		let me = this;

		if (me.removed_fields) {
			me.removed_fields = me.removed_fields.concat(fields);
		} else {
			me.removed_fields = fields;
		}
	}
}

frappe.views.ListView = class ListView extends frappe.views.BaseList {
	static load_last_view() {
		const route = frappe.get_route();
		const doctype = route[1];

		if (route.length === 2) {
			const user_settings = frappe.get_user_settings(doctype);
			const last_view = user_settings.last_view;
			frappe.set_route(
				"list",
				frappe.router.doctype_layout || doctype,
				frappe.views.is_valid(last_view) ? last_view.toLowerCase() : "list"
			);
			return true;
		}
		return false;
	}

	constructor(opts) {
		// console.log(frappe.workspace_map)
		super(opts);
		this.show();
		this.debounced_refresh = frappe.utils.debounce(
			this.process_document_refreshes.bind(this),
			2000
		);
		this.count_upper_bound = 1001;
		this._element_factory = new ElementFactory(this.doctype);
		this.add_custom_button();
	}

	has_permissions() {
		return frappe.perm.has_perm(this.doctype, 0, "read");
	}

	show() {
		this.parent.disable_scroll_to_top = true;
		super.show();
	}

	check_permissions() {
		if (!this.has_permissions()) {
			frappe.set_route("");
			frappe.throw(__("Not permitted to view {0}", [this.doctype]));
		}
	}

	show_skeleton() {
		this.$list_skeleton = this.parent.page.container.find(".list-skeleton");
		if (!this.$list_skeleton.length) {
			this.$list_skeleton = $(`
				<div class="row list-skeleton">
					<div class="col-lg-2">
						<div class="list-skeleton-box"></div>
					</div>
					<div class="col">
						<div class="list-skeleton-box"></div>
					</div>
				</div>
			`);
			this.parent.page.container.find(".page-content").append(this.$list_skeleton);
		}
		this.parent.page.container.find(".layout-main").hide();
		this.$list_skeleton.show();
	}

	hide_skeleton() {
		this.$list_skeleton && this.$list_skeleton.hide();
		this.parent.page.container.find(".layout-main").show();
	}

	get view_name() {
		return "List";
	}

	get view_user_settings() {
		return this.user_settings[this.view_name] || {};
	}

	setup_defaults() {
		super.setup_defaults();

		this.view = "List";
		// initialize with saved order by
		this.sort_by = this.view_user_settings.sort_by || this.sort_by || "creation";
		this.sort_order = this.view_user_settings.sort_order || this.sort_order || "desc";

		// build menu items
		this.menu_items = this.menu_items.concat(this.get_menu_items());

		// set filters from view_user_settings or list_settings
		if (Array.isArray(this.view_user_settings.filters)) {
			// Priority 1: view_user_settings
			const saved_filters = this.view_user_settings.filters;
			this.filters = this.validate_filters(saved_filters);
		} else {
			// Priority 2: filters in listview_settings
			this.filters = (this.settings.filters || []).map((f) => {
				if (f.length === 3) {
					f = [this.doctype, f[0], f[1], f[2]];
				}
				return f;
			});
		}

		this.patch_refresh_and_load_lib();
		return this.get_list_view_settings();
	}

	on_sort_change(sort_by, sort_order) {
		this.sort_by = sort_by;
		this.sort_order = sort_order;
		super.on_sort_change();
	}

	validate_filters(filters) {
		let valid_fields = this.meta.fields.map((df) => df.fieldname);
		valid_fields = valid_fields.concat(frappe.model.std_fields_list);
		return filters.filter((f) => valid_fields.includes(f[1])).uniqBy((f) => f[1]);
	}

	setup_page() {
		this.parent.list_view = this;
		super.setup_page();
	}

	setup_page_head() {
		super.setup_page_head();
		this.set_primary_action();
		this.set_actions_menu_items();
	}

	set_actions_menu_items() {
		this.actions_menu_items = this.get_actions_menu_items();
		this.workflow_action_menu_items = this.get_workflow_action_menu_items();
		this.workflow_action_items = {};

		const actions = this.actions_menu_items.concat(this.workflow_action_menu_items);
		actions.forEach((item) => {
			const $item = this.page.add_actions_menu_item(item.label, item.action, item.standard);
			if (item.class) {
				$item.addClass(item.class);
			}
			if (item.is_workflow_action && $item) {
				// can be used to dynamically show or hide action
				this.workflow_action_items[item.name] = $item;
			}
		});
	}

	show_restricted_list_indicator_if_applicable() {
		const match_rules_list = frappe.perm.get_match_rules(this.doctype);
		if (match_rules_list.length) {
			this.restricted_list = $(
				`<button class="btn btn-xs restricted-button flex align-center">
					${frappe.utils.icon("restriction", "xs")}
				</button>`
			)
				.click(() => this.show_restrictions(match_rules_list))
				.appendTo(this.page.page_form);
		}
	}

	show_restrictions(match_rules_list = []) {
		frappe.msgprint(
			frappe.render_template("list_view_permission_restrictions", {
				condition_list: match_rules_list,
			}),
			__("Restrictions", null, "Title of message showing restrictions in list view")
		);
	}

	get_fields() {
		return super
			.get_fields()
			.concat(
				Object.entries(this.link_field_title_fields || {}).map(
					(entry) => entry.join(".") + " as " + entry.join("_")
				)
			);
	}

	async set_fields() {
		this.link_field_title_fields = {};
		let fields = [].concat(
			frappe.model.std_fields_list,
			this.get_fields_in_list_view(),
			[this.meta.title_field, this.meta.image_field],
			this.settings.add_fields || [],
			this.meta.track_seen ? "_seen" : null,
			this.sort_by,
			"enabled",
			"disabled",
			"color"
		);

		await Promise.all(
			fields.map((f) => {
				return new Promise((resolve) => {
					const df =
						typeof f === "string" ? frappe.meta.get_docfield(this.doctype, f) : f;
					if (
						df &&
						df.fieldtype == "Link" &&
						frappe.boot.link_title_doctypes.includes(df.options)
					) {
						frappe.model.with_doctype(df.options, () => {
							const meta = frappe.get_meta(df.options);
							if (meta.show_title_field_in_link) {
								this.link_field_title_fields[
									typeof f === "string" ? f : f.fieldname
									] = meta.title_field;
							}

							this._add_field(f);
							resolve();
						});
					} else {
						this._add_field(f);
						resolve();
					}
				});
			})
		);

		this.fields.forEach((f) => {
			const df = frappe.meta.get_docfield(f[1], f[0]);
			if (df && df.fieldtype === "Currency" && df.options && !df.options.includes(":")) {
				this._add_field(df.options);
			}
		});
	}

	patch_refresh_and_load_lib() {
		// throttle refresh for 1s
		this.refresh = this.refresh.bind(this);
		this.refresh = frappe.utils.throttle(this.refresh, 1000);
		this.load_lib = new Promise((resolve) => {
			if (this.required_libs) {
				frappe.require(this.required_libs, resolve);
			} else {
				resolve();
			}
		});
		// call refresh every 5 minutes
		const interval = 5 * 60 * 1000;
		setInterval(() => {
			// don't call if route is different
			if (frappe.get_route_str() === this.page_name) {
				this.refresh();
			}
		}, interval);
	}

	set_primary_action() {
		if (this.can_create && !frappe.boot.read_only) {
			const doctype_name = __(frappe.router.doctype_layout) || __(this.doctype);
			this.page.set_primary_action(
				__("Add {0}", [doctype_name], "Primary action in list view"),
				() => {
					if (this.settings.primary_action) {
						this.settings.primary_action();
					} else {
						this.make_new_doc();
					}
				},
				"add"
			);
		} else {
			this.page.clear_primary_action();
		}
	}

	make_new_doc() {
		const doctype = this.doctype;
		const options = {};
		this.filter_area.get().forEach((f) => {
			if (f[2] === "=" && frappe.model.is_non_std_field(f[1])) {
				options[f[1]] = f[3];
			}
		});
		frappe.new_doc(doctype, options);
	}

	setup_view() {
		this.setup_columns();
		this.render_header();
		this.render_skeleton();
		this.setup_events();
		this.settings.onload && this.settings.onload(this);
		this.show_restricted_list_indicator_if_applicable();
	}

	refresh_columns(meta, list_view_settings) {
		this.meta = meta;
		this.list_view_settings = list_view_settings;

		this.setup_columns();
		this.refresh(true);
	}

	refresh(refresh_header = false) {
		return super.refresh().then(() => {
			this.render_header(refresh_header);
			this.render_count();
			this.update_checkbox();
			this.update_url_with_filters();
			this.setup_realtime_updates();
			this.apply_styles_basedon_dropdown();
		});
	}

	update_checkbox(target) {
		if (!this.$checkbox_actions) return;

		let $check_all_checkbox = this.$checkbox_actions.find(".list-check-all");

		if ($check_all_checkbox.prop("checked") && target && !target.prop("checked")) {
			$check_all_checkbox.prop("checked", false);
		}

		$check_all_checkbox.prop("checked", this.$checks.length === this.data.length);
	}

	setup_freeze_area() {
		this.$freeze = $(
			`<div class="freeze flex justify-center align-center text-muted">
				${__("Loading")}...
			</div>`
		).hide();
		this.$result.append(this.$freeze);
	}

	setup_columns() {
		// setup columns for list view
		this.columns = [];

		const get_df = frappe.meta.get_docfield.bind(null, this.doctype);

		// 1st column: title_field or name
		if (this.meta.title_field) {
			this.columns.push({
				type: "Subject",
				df: get_df(this.meta.title_field),
			});
		} else {
			this.columns.push({
				type: "Subject",
				df: {
					label: __("ID"),
					fieldname: "name",
				},
			});
		}

		// 3rd column: Status indicator
		if (frappe.has_indicator(this.doctype)) {
			// indicator
			this.columns.push({
				type: "Status",
			});
		}

		const fields_in_list_view = this.get_fields_in_list_view();
		// Add rest from in_list_view docfields
		this.columns = this.columns.concat(
			fields_in_list_view
				.filter((df) => {
					if (frappe.has_indicator(this.doctype) && df.fieldname === "status") {
						return false;
					}
					if (!df.in_list_view || df.is_virtual) {
						return false;
					}
					return df.fieldname !== this.meta.title_field;
				})
				.map((df) => ({
					type: "Field",
					df,
				}))
		);

		if (this.list_view_settings.fields) {
			this.columns = this.reorder_listview_fields();
		}

		// limit max to 8 columns if no total_fields is set in List View Settings
		// Screen with low density no of columns 4
		// Screen with medium density no of columns 6
		// Screen with high density no of columns 8
		let total_fields = 6;

		if (window.innerWidth <= 1366) {
			total_fields = 4;
		} else if (window.innerWidth >= 1920) {
			total_fields = 10;
		}

		this.columns = this.columns.slice(0, this.list_view_settings.total_fields || total_fields);

		// 2nd column: tag - normally hidden doesn't count towards total_fields
		this.columns.splice(1, 0, {
			type: "Tag",
		});

		if (
			!this.settings.hide_name_column &&
			this.meta.title_field &&
			this.meta.title_field !== "name"
		) {
			this.columns.push({
				type: "Field",
				df: {
					label: __("ID"),
					fieldname: "name",
				},
			});
		}
	}

	reorder_listview_fields() {
		let fields_order = [];
		let fields = JSON.parse(this.list_view_settings.fields);

		// title field is fixed
		fields_order.push(this.columns[0]);
		this.columns.splice(0, 1);

		for (let fld in fields) {
			for (let col in this.columns) {
				let field = fields[fld];
				let column = this.columns[col];

				if (column.type == "Status" && field.fieldname == "status_field") {
					fields_order.push(column);
					break;
				} else if (column.type == "Field" && field.fieldname === column.df.fieldname) {
					fields_order.push(column);
					break;
				}
			}
		}

		return fields_order;
	}

	get_documentation_link() {
		if (this.meta.documentation) {
			return `<a href="${this.meta.documentation}" target="blank" class="meta-description small text-muted">Need Help?</a>`;
		}
		return "";
	}

	get_no_result_message() {
		let help_link = this.get_documentation_link();
		let filters = this.filter_area && this.filter_area.get();

		let has_filters_set = filters && filters.length;
		let no_result_message = has_filters_set
			? __("No {0} found with matching filters. Clear filters to see all {0}.", [
				__(this.doctype),
			])
			: this.meta.description
				? __(this.meta.description)
				: __("You haven't created a {0} yet", [__(this.doctype)]);

		let new_button_label = has_filters_set
			? __("Create a new {0}", [__(this.doctype)], "Create a new document from list view")
			: __(
				"Create your first {0}",
				[__(this.doctype)],
				"Create a new document from list view"
			);
		let empty_state_image =
			this.settings.empty_state_image ||
			"/assets/frappe/images/ui-states/list-empty-state.svg";

		const new_button = this.can_create
			? `<p><button class="btn btn-default btn-sm btn-new-doc hidden-xs">
				${new_button_label}
			</button> <button class="btn btn-primary btn-new-doc visible-xs">
				${__("Create New", null, "Create a new document from list view")}
			</button></p>`
			: "";

		return `<div class="msg-box no-border">
			<div>
				<img src="${empty_state_image}" alt="Generic Empty State" class="null-state">
			</div>
			<p>${no_result_message}</p>
			${new_button}
			${help_link}
		</div>`;
	}

	freeze() {
		if (this.list_view_settings && !this.list_view_settings.disable_count) {
			this.get_count_element().html(
				`<span>${__("Refreshing", null, "Document count in list view")}...</span>`
			);
		}
	}

	get_args() {
		const args = super.get_args();

		if (this.list_view_settings && !this.list_view_settings.disable_comment_count) {
			args.with_comment_count = 1;
		} else {
			args.with_comment_count = 0;
		}

		return args;
	}

	before_refresh() {
		if (frappe.route_options && this.filter_area) {
			this.filters = this.parse_filters_from_route_options();
			frappe.route_options = null;

			if (this.filters.length > 0) {
				return this.filter_area
					.clear(false)
					.then(() => this.filter_area.set(this.filters));
			}
		}

		return Promise.resolve();
	}

	parse_filters_from_settings() {
		return (this.settings.filters || []).map((f) => {
			if (f.length === 3) {
				f = [this.doctype, f[0], f[1], f[2]];
			}
			return f;
		});
	}

	toggle_result_area() {
		super.toggle_result_area();
		this.toggle_actions_menu_button(
			this.$result.find(".list-row-checkbox:checked").length > 0
		);
	}

	toggle_actions_menu_button(toggle) {
		if (toggle) {
			this.page.show_actions_menu();
			this.page.clear_primary_action();
		} else {
			this.page.hide_actions_menu();
			this.set_primary_action();
		}
	}

	render_header(refresh_header = false) {
		if (refresh_header) {
			this.$result.find(".list-row-head").remove();
		}
		if (this.$result.find(".list-row-head").length === 0) {
			// append header once
			this.$result.prepend(this.get_header_html());

			if (this.filter_area.filter_list.get_filter_value("_liked_by")) {
				// if there is a liked fitler, then add liked
				this.$result.find(".list-liked-by-me").addClass("liked");
			}
		}
	}

	render_skeleton() {
		const $row = this.get_list_row_html_skeleton(
			'<div><input type="checkbox" class="render-list-checkbox"/></div>'
		);
		this.$result.append($row);
	}

	before_render() {
		this.settings.before_render && this.settings.before_render();
		frappe.model.user_settings.save(this.doctype, "last_view", this.view_name);
		this.save_view_user_settings({
			filters: this.filter_area && this.filter_area.get(),
			sort_by: this.sort_selector && this.sort_selector.sort_by,
			sort_order: this.sort_selector && this.sort_selector.sort_order,
		});
	}

	after_render() {
		this.$no_result.html(this.get_no_result_message());
		this.setup_new_doc_event();
	}

	render() {
		this.render_list();
		this.set_rows_as_checked();
	}

	render_list() {
		// clear rows
		this.$result.find(".list-row-container").remove();
		this.render_header();

		if (this.data.length > 0) {
			// append rows
			let idx = 0;
			for (let doc of this.data) {
				doc._idx = idx++;
				this.$result.append(this.get_list_row_html(doc));
			}
		}
	}

	render_count() {
		if (this.list_view_settings.disable_count) return;

		let me = this;
		let $count = this.get_count_element();
		this.get_count_str().then((count) => {
			$count.html(`<span>${count}</span>`);
			if (this.count_upper_bound && this.count_upper_bound == this.total_count) {
				$count.attr(
					"title",
					__(
						"The count shown is an estimated count. Click here to see the accurate count."
					)
				);
				$count.tooltip({delay: {show: 600, hide: 100}, trigger: "hover"});
				$count.on("click", () => {
					me.count_upper_bound = 0;
					$count.off("click");
					$count.tooltip("disable");
					me.freeze();
					me.render_count();
				});
			}
		});
	}

	get_count_element() {
		return this.$result.find(".list-count");
	}

	get_header_html() {
		if (!this.columns) {
			return;
		}

		const subject_field = this.columns[0].df;
		let subject_html = `
			<span class="level-item select-like">
				<input class="list-header-checkbox list-check-all" type="checkbox" title="${__("Select All")}">
			</span>
			<span class="level-item" data-sort-by="${subject_field.fieldname}"
				title="${__("Click to sort by {0}", [subject_field.label])}">
				${__(subject_field.label)}
			</span>
		`;
		const $columns = this.columns
			.map((col) => {
				let classes = [
					"list-row-col ellipsis",
					col.type == "Subject" ? "list-subject level" : "hidden-xs",
					col.type == "Tag" ? "tag-col hide" : "",
					frappe.model.is_numeric_field(col.df) ? "text-right" : "",
				].join(" ");

				let html = "";
				if (col.type === "Subject") {
					html = subject_html;
				} else {
					const fieldname = col.df?.fieldname;
					const label = __(col.df?.label || col.type, null, col.df?.parent);
					const title = __("Click to sort by {0}", [label]);
					const attrs = fieldname ? `data-sort-by="${fieldname}" title="${title}"` : "";
					html = `<span ${attrs}>${label}</span>`;
				}

				return `<div class="${classes}">${html}</div>
			`;
			})
			.join("");

		const right_html = `
			<span class="level-item hidden-xs">
				<span title="${__("Action")}">
					${__("Action")}
				</span>
			</span>
		`;

		return this.get_header_html_skeleton($columns, right_html);
	}

	get_header_html_skeleton(left = "", right = "") {
		return `
		<div class="list-row-container">
			<header class="level list-row-head text-muted">
				<div class="level-left list-header-subject">
					${left}
				</div>
				<div class="level-left checkbox-actions">
					<div class="level list-subject">
						<span class="level-item select-like">
							<input class="list-header-checkbox list-check-all" type="checkbox" title="${__("Select All")}">
						</span>
						<span class="level-item list-header-meta"></span>
					</div>
				</div>
				<div class="level-right">
					${right}
				</div>
			</header>
		</div>
		`;
	}

	get_left_html(doc) {
		return this.columns.map((col) => this.get_column_html(col, doc)).join("");
	}

	get_right_html(doc) {
		return this.get_meta_html(doc);
	}

	get_list_row_html(doc) {
		return this.get_list_row_html_skeleton(this.get_left_html(doc), this.get_right_html(doc));
	}

	get_list_row_html_skeleton(left = "", right = "") {
		return `
			<div class="list-row-container" tabindex="1">
				<div class="level list-row">
					<div class="level-left ellipsis">
						${left}
					</div>
					<div class="level-right text-muted ellipsis">
						${right}
					</div>
				</div>
			</div>
		`;
	}

	get_column_html(col, doc) {
		if (col.type === "Status" || col.df?.options == "Workflow State") {
			let show_workflow_state = col.df?.options == "Workflow State";
			return `
				<div class="list-row-col hidden-xs ellipsis">
					${this.get_indicator_html(doc, show_workflow_state)}
				</div>
			`;
		}

		if (col.type === "Tag") {
			const tags_display_class = !this.tags_shown ? "hide" : "";
			let tags_html = doc._user_tags
				? this.get_tags_html(doc._user_tags, 2, true)
				: '<div class="tags-empty">-</div>';
			return `
				<div class="list-row-col tag-col ${tags_display_class} hidden-xs ellipsis">
					${tags_html}
				</div>
			`;
		}

		const df = col.df || {};
		const label = df.label;
		const fieldname = df.fieldname;
		const link_title_fieldname = this.link_field_title_fields[fieldname];
		const value = doc[fieldname] || "";
		let value_display = link_title_fieldname
			? doc[fieldname + "_" + link_title_fieldname] || value
			: value;

		let translated_doctypes = frappe.boot?.translated_doctypes || [];
		if (translated_doctypes.includes(df.options)) {
			value_display = __(value_display);
		}

		const format = () => {
			if (df.fieldtype === "Percent") {
				return `<div class="progress" style="margin: 0px;">
						<div class="progress-bar progress-bar-success" role="progressbar"
							aria-valuenow="${value}"
							aria-valuemin="0" aria-valuemax="100" style="width: ${Math.round(value)}%;">
						</div>
					</div>`;
			} else {
				return frappe.format(value, df, null, doc);
			}
		};

		const field_html = () => {
			let html;
			let _value;
			let strip_html_required =
				df.fieldtype == "Text Editor" ||
				(df.fetch_from && ["Text", "Small Text"].includes(df.fieldtype));

			if (strip_html_required) {
				_value = strip_html(value_display);
			} else {
				_value =
					typeof value_display === "string"
						? frappe.utils.escape_html(value_display)
						: value_display;
			}

			if (df.fieldtype === "Rating") {
				let out_of_ratings = df.options || 5;
				_value = _value * out_of_ratings;
			}

			if (df.fieldtype === "Image") {
				html = df.options
					? `<img src="${doc[df.options]}"
					style="max-height: 30px; max-width: 100%;">`
					: `<div class="missing-image small">
						${frappe.utils.icon("restriction")}
					</div>`;
			} else if (df.fieldtype === "Select") {
				html = `<span class="filterable indicator-pill ${frappe.utils.guess_colour(
					_value
				)} ellipsis"
					data-filter="${fieldname},=,${value}">
					<span class="ellipsis"> ${__(_value)} </span>
				</span>`;
			} else if (df.fieldtype === "Link") {
				html = `<a class="filterable ellipsis"
					data-filter="${fieldname},=,${value}">
					${_value}
				</a>`;
			} else if (frappe.model.html_fieldtypes.includes(df.fieldtype)) {
				html = `<span class="ellipsis">
					${_value}
				</span>`;
			} else {
				html = `<a class="filterable ellipsis"
					data-filter="${fieldname},=,${frappe.utils.escape_html(value)}">
					${format()}
				</a>`;
			}

			return `<span class="ellipsis"
				title="${__(label)}: ${frappe.utils.escape_html(_value)}">
				${html}
			</span>`;
		};

		const class_map = {
			Subject: "list-subject level",
			Field: "hidden-xs",
		};
		const css_class = [
			"list-row-col ellipsis",
			class_map[col.type],
			frappe.model.is_numeric_field(df) ? "text-right" : "",
		].join(" ");

		let column_html;
		if (
			this.settings.formatters &&
			this.settings.formatters[fieldname] &&
			col.type !== "Subject"
		) {
			column_html = this.settings.formatters[fieldname](value, df, doc);
		} else {
			column_html = {
				Subject: this.get_subject_element(doc, value_display).innerHTML,
				Field: field_html(),
			}[col.type];
		}

		return `
			<div class="${css_class}">
				${column_html}
			</div>
		`;
	}

	get_tags_html(user_tags, limit, colored = false) {
		let get_tag_html = (tag) => {
			let color = "",
				style = "";
			if (tag) {
				if (colored) {
					color = frappe.get_palette(tag);
					style = `background-color: var(${color[0]}); color: var(${color[1]})`;
				}

				return `<div class="tag-pill ellipsis" title="${tag}" style="${style}">${tag}</div>`;
			}
		};
		return user_tags
			.split(",")
			.slice(1, limit + 1)
			.map(get_tag_html)
			.join("");
	}

	get_meta_html(doc) {
		let html = "";
		let settings_button = "";
		let button_section = "";
		const dropdown_button = this.generate_dropdown_html(doc);

		if (this.settings.button && this.settings.button.show(doc)) {
			settings_button = `
				<span class="list-actions">
					<button class="btn btn-action btn-default btn-xs"
						data-name="${doc.name}" data-idx="${doc._idx}"
						title="${this.settings.button.get_description(doc)}">
						${this.settings.button.get_label(doc)}
					</button>
				</span>
			`;
		}

		button_section = settings_button + dropdown_button;
		const modified = comment_when(doc.modified, true);

		let assigned_to = ``;

		let assigned_users = doc._assign ? JSON.parse(doc._assign) : [];
		if (assigned_users.length) {
			assigned_to = `<div class="list-assignments d-flex align-items-center">
					${frappe.avatar_group(assigned_users, 3, {filterable: true})[0].outerHTML}
				</div>`;
		}

		let comment_count = null;
		if (this.list_view_settings && !this.list_view_settings.disable_comment_count) {
			comment_count = `<span class="comment-count d-flex align-items-center">
				${frappe.utils.icon("es-line-chat-alt")}
				${doc._comment_count > 99 ? "99+" : doc._comment_count || 0}
			</span>`;
		}

		html += `
			<div class="level-item list-row-activity hidden-xs">
				<a href="${this.get_form_link(doc)}">
					<i class="fa-solid fa-pen-to-square"></i>
				</a>
				<a href="#" onclick="delete_document('${this.doctype}', '${doc.name}')">
					<i class="fa-solid fa-trash-can"></i>
				</a>
				<a href="${this.get_form_link(doc)}">
					<i class="fa-solid fa-server"></i>
				</a>
			</div>
		`;

		return html;
	}

	generate_dropdown_html(doc) {
		let dropdown_button = "";
		if (this.settings.dropdown_button) {
			let button_actions = "";
			this.settings.dropdown_button.buttons.forEach((button, index) => {
				if (!button.show || button.show(doc)) {
					let description = button.get_description ? button.get_description(doc) : "";
					button_actions += `
						<a class="dropdown-item" href="#" onclick="return false;" data-idx="${doc._idx}" button-idx="${index}" title="${description}">
							${button.get_label}
						</a>
					`;
				}
			});

			if (button_actions) {
				dropdown_button = `
				<div class="inner-group-button mr-2" data-name="${doc.name}" data-label="${
					this.settings.dropdown_button.get_label
				}">
					<button type="button" class="btn btn-xs btn-default ellipsis" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
						${this.settings.dropdown_button.get_label}
						${frappe.utils.icon("select", "xs")}
					</button>
					<div role="menu" class="dropdown-menu">${button_actions}</div>
				</div>
				`;
			}
		}
		return dropdown_button;
	}

	apply_styles_basedon_dropdown() {
		if ($(".list-actions").length > 0 && $(".inner-group-button").length > 0) {
			$(".list-row .level-left, .list-row-head .level-left").css({
				flex: "2",
				"min-width": "72%",
			});
		}
	}

	get_count_str() {
		let current_count = this.data.length;
		let count_without_children = this.data.uniqBy((d) => d.name).length;

		return frappe.db
			.count(this.doctype, {
				filters: this.get_filters_for_args(),
				limit: this.count_upper_bound,
			})
			.then((total_count) => {
				this.total_count = total_count || current_count;
				this.count_without_children =
					count_without_children !== current_count ? count_without_children : undefined;

				let count_str;
				if (this.total_count === this.count_upper_bound) {
					count_str = `${format_number(this.total_count - 1, null, 0)}+`;
				} else {
					count_str = format_number(this.total_count, null, 0);
				}

				let str = __("{0} of {1}", [format_number(current_count, null, 0), count_str]);
				if (this.count_without_children) {
					str = __("{0} of {1} ({2} rows with children)", [
						count_without_children,
						count_str,
						current_count,
					]);
				}
				return str;
			});
	}

	get_form_link(doc) {
		if (this.settings.get_form_link) {
			return this.settings.get_form_link(doc);
		}

		return `/app/${encodeURIComponent(
			frappe.router.slug(frappe.router.doctype_layout || this.doctype)
		)}/${encodeURIComponent(cstr(doc.name))}`;
	}

	get_seen_class(doc) {
		const seen_by = doc._seen ? JSON.parse(doc._seen) : [];
		return seen_by.includes(frappe.session.user) ? "" : "bold";
	}

	get_like_html(doc) {
		const liked_by = doc._liked_by ? JSON.parse(doc._liked_by) : [];
		const is_liked = liked_by.includes(frappe.session.user);
		const title = liked_by.map((u) => frappe.user_info(u).fullname).join(", ");

		const div = document.createElement("div");
		div.appendChild(
			this._element_factory.get_like_element(doc.name, is_liked, liked_by, title)
		);

		return div.innerHTML;
	}

	get_subject_element(doc, title) {
		const ef = this._element_factory;
		const div = document.createElement("div");
		const checkboxspan = ef.get_checkboxspan_element();

		const ellipsisSpan = document.createElement("span");
		const seen = this.get_seen_class(doc);
		if (seen) {
			ellipsisSpan.classList.add("level-item", seen, "ellipsis");
		}
		div.appendChild(checkboxspan).appendChild(ef.get_checkbox_element(doc.name));
		div.appendChild(ellipsisSpan).appendChild(
			ef.get_link_element(
				doc.name,
				this.get_form_link(doc),
				this.get_subject_text(doc, title)
			)
		);

		return div;
	}

	get_subject_text(doc, title) {
		const subject_field = this.columns[0].df;
		let value = title || doc[subject_field.fieldname];
		if (this.settings.formatters && this.settings.formatters[subject_field.fieldname]) {
			let formatter = this.settings.formatters[subject_field.fieldname];
			value = formatter(value, subject_field, doc);
		}

		if (!value) {
			value = doc.name;
		}

		if (frappe.model.html_fieldtypes.includes(subject_field.fieldtype)) {
			// NOTE: this is very slow, so only do it for HTML fields
			return frappe.utils.html2text(value);
		} else {
			return value;
		}
	}

	get_indicator_html(doc, show_workflow_state) {
		const indicator = frappe.get_indicator(doc, this.doctype, show_workflow_state);
		// sequence is important
		const docstatus_description = [
			__("Document is in draft state"),
			__("Document has been submitted"),
			__("Document has been cancelled"),
		];
		const title = docstatus_description[doc.docstatus || 0];
		if (indicator) {
			return `<span class="indicator-pill ${
				indicator[1]
			} filterable no-indicator-dot ellipsis"
				data-filter='${indicator[2]}' title='${title}'>
				<span class="ellipsis"> ${__(indicator[0])}</span>
			</span>`;
		}
		return "";
	}

	get_indicator_dot(doc) {
		const indicator = frappe.get_indicator(doc, this.doctype);
		if (!indicator) return "";
		return `<span class='indicator ${indicator[1]}' title='${__(indicator[0])}'></span>`;
	}

	get_image_url(doc) {
		let url = doc.image ? doc.image : doc[this.meta.image_field];
		// absolute url for mobile
		if (window.cordova && !frappe.utils.is_url(url)) {
			url = frappe.base_url + url;
		}
		return url || null;
	}

	setup_events() {
		this.setup_filterable();
		this.setup_sort_by();
		this.setup_list_click();
		this.setup_drag_click();
		this.setup_tag_event();
		this.setup_new_doc_event();
		this.setup_check_events();
		this.setup_like();
		this.setup_realtime_updates();
		this.setup_action_handler();
		this.setup_keyboard_navigation();
	}

	setup_keyboard_navigation() {
		let focus_first_row = () => {
			this.$result.find(".list-row-container:first").focus();
		};
		let focus_next = () => {
			$(document.activeElement).next().focus();
		};
		let focus_prev = () => {
			$(document.activeElement).prev().focus();
		};
		let list_row_focused = () => {
			return $(document.activeElement).is(".list-row-container");
		};
		let check_row = ($row) => {
			let $input = $row.find("input[type=checkbox]");
			$input.click();
		};
		let get_list_row_if_focused = () =>
			list_row_focused() ? $(document.activeElement) : null;

		let is_current_page = () => this.page.wrapper.is(":visible");
		let is_input_focused = () => $(document.activeElement).is("input");

		let handle_navigation = (direction) => {
			if (!is_current_page() || is_input_focused()) return false;

			let $list_row = get_list_row_if_focused();
			if ($list_row) {
				direction === "down" ? focus_next() : focus_prev();
			} else {
				focus_first_row();
			}
		};

		frappe.ui.keys.add_shortcut({
			shortcut: "down",
			action: () => handle_navigation("down"),
			description: __("Navigate list down", null, "Description of a list view shortcut"),
			page: this.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "up",
			action: () => handle_navigation("up"),
			description: __("Navigate list up", null, "Description of a list view shortcut"),
			page: this.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "shift+down",
			action: () => {
				if (!is_current_page() || is_input_focused()) return false;
				let $list_row = get_list_row_if_focused();
				check_row($list_row);
				focus_next();
			},
			description: __(
				"Select multiple list items",
				null,
				"Description of a list view shortcut"
			),
			page: this.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "shift+up",
			action: () => {
				if (!is_current_page() || is_input_focused()) return false;
				let $list_row = get_list_row_if_focused();
				check_row($list_row);
				focus_prev();
			},
			description: __(
				"Select multiple list items",
				null,
				"Description of a list view shortcut"
			),
			page: this.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "enter",
			action: () => {
				let $list_row = get_list_row_if_focused();
				if ($list_row) {
					$list_row.find("a[data-name]")[0].click();
					return true;
				}
				return false;
			},
			description: __("Open list item", null, "Description of a list view shortcut"),
			page: this.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "space",
			action: () => {
				let $list_row = get_list_row_if_focused();
				if ($list_row) {
					check_row($list_row);
					return true;
				}
				return false;
			},
			description: __("Select list item", null, "Description of a list view shortcut"),
			page: this.page,
		});
	}

	setup_filterable() {
		// filterable events
		this.$result.on("click", ".filterable", (e) => {
			if (e.metaKey || e.ctrlKey) return;
			e.stopPropagation();
			const $this = $(e.currentTarget);
			const filters = $this.attr("data-filter").split("|");
			const filters_to_apply = filters.map((f) => {
				f = f.split(",");
				if (f[2] === "Today") {
					f[2] = frappe.datetime.get_today();
				} else if (f[2] == "User") {
					f[2] = frappe.session.user;
				}
				this.filter_area.remove(f[0]);
				return [this.doctype, f[0], f[1], f.slice(2).join(",")];
			});
			this.filter_area.add(filters_to_apply);
		});
	}

	setup_sort_by() {
		this.$result.on("click", "[data-sort-by]", (e) => {
			const sort_by = e.currentTarget.getAttribute("data-sort-by");
			if (!sort_by) return;
			let sort_order = "asc"; // always start with asc
			if (this.sort_by === sort_by) {
				// unless it's the same field, then toggle
				sort_order = this.sort_order === "asc" ? "desc" : "asc";
			}
			this.sort_selector.set_value(sort_by, sort_order);
			this.on_sort_change(sort_by, sort_order);
		});
	}

	setup_list_click() {
		this.$result.on("click", ".level-left, .image-view-header, .file-header", (e) => {
			const $target = $(e.target);
			// tick checkbox if Ctrl/Meta key is pressed
			if ((e.ctrlKey || e.metaKey) && !$target.is("a")) {
				const $list_row = $(e.currentTarget);
				const $check = $list_row.find(".list-row-checkbox");
				$check.prop("checked", !$check.prop("checked"));
				e.preventDefault();
				this.on_row_checked();
				return;
			}

			if ($target.is("[data-toggle='dropdown']")) return true;

			// don't open form when checkbox, like, filterable are clicked
			if (
				$target.hasClass("filterable") ||
				$target.hasClass("select-like") ||
				$target.hasClass("file-select") ||
				$target.hasClass("list-row-like") ||
				$target.is(":checkbox")
			) {
				e.stopPropagation();
				return;
			}

			// link, let the event be handled via set_route
			if ($target.is("a")) return;

			// clicked on the row, open form
			const $row = $(e.currentTarget);
			const link = $row.find(".list-subject a").get(0);
			if (link) {
				frappe.set_route(link.pathname);
				return false;
			}
		});
	}

	setup_drag_click() {
		/*
			Click on the check box in the list view and
			drag through the rows to select.

			Do it again to unselect.

			If the first click is on checked checkbox, then it will unselect rows on drag,
			else if it is unchecked checkbox, it will select rows on drag.
		*/
		this.dragClick = false;
		this.$result.on("mousedown", ".list-row-checkbox", (e) => {
			e.stopPropagation?.();
			e.preventDefault?.();
			this.dragClick = true;
			this.check = !e.target.checked;
		});
		$(document).on("mouseup", () => {
			this.dragClick = false;
		});
		this.$result.on("mousemove", ".level.list-row", (e) => {
			if (this.dragClick) {
				this.check_row_on_drag(e, this.check);
			}
		});
	}

	check_row_on_drag(event, check = true) {
		$(event.target).find(".list-row-checkbox").prop("checked", check);
		this.on_row_checked();
	}

	setup_action_handler() {
		this.$result.on("click", ".btn-action", (e) => {
			const $button = $(e.currentTarget);
			const doc = this.data[$button.attr("data-idx")];
			this.settings.button.action(doc);
			e.stopPropagation();
			return false;
		});

		this.$result.on("click", ".inner-group-button .dropdown-item", (e) => {
			const $button = $(e.currentTarget);
			const doc = this.data[$button.attr("data-idx")];
			const btn_idx = parseInt($button.attr("button-idx"), 10);
			const button = this.settings.dropdown_button.buttons[btn_idx];

			if (button && button.action) {
				button.action(doc);
			}

			e.stopPropagation();
			return false;
		});
	}

	setup_check_events() {
		this.$result.on("change", "input[type=checkbox]", (e) => {
			const $target = $(e.currentTarget);

			if ($target.is(".list-header-subject .list-check-all")) {
				const $check = this.$result.find(".checkbox-actions .list-check-all");
				$check.prop("checked", $target.prop("checked"));
				$check.trigger("change");
			} else if ($target.is(".checkbox-actions .list-check-all")) {
				const $check = this.$result.find(".list-header-subject .list-check-all");
				$check.prop("checked", $target.prop("checked"));

				this.$result.find(".list-row-checkbox").prop("checked", $target.prop("checked"));
			} else if ($target.attr("data-parent")) {
				this.$result
					.find(`.${$target.attr("data-parent")}`)
					.find(".list-row-checkbox")
					.prop("checked", $target.prop("checked"));
			}

			this.on_row_checked();
		});

		this.$result.on("click", ".list-row-checkbox", (e) => {
			const $target = $(e.currentTarget);

			// shift select checkboxes
			if (e.shiftKey && this.$checkbox_cursor && !$target.is(this.$checkbox_cursor)) {
				const name_1 = decodeURIComponent(this.$checkbox_cursor.data().name);
				const name_2 = decodeURIComponent($target.data().name);
				const index_1 = this.data.findIndex((d) => d.name === name_1);
				const index_2 = this.data.findIndex((d) => d.name === name_2);
				let [min_index, max_index] = [index_1, index_2];

				if (min_index > max_index) {
					[min_index, max_index] = [max_index, min_index];
				}

				let docnames = this.data.slice(min_index + 1, max_index).map((d) => d.name);
				const selector = docnames
					.map((name) => `.list-row-checkbox[data-name="${encodeURIComponent(name)}"]`)
					.join(",");
				this.$result.find(selector).prop("checked", true);
			}

			this.$checkbox_cursor = $target;

			this.update_checkbox($target);
		});

		let me = this;
		this.page.actions_btn_group.on("show.bs.dropdown", () => {
			me.toggle_workflow_actions();
		});
	}

	setup_like() {
		this.$result.on("click", ".like-action", (e) => {
			const $this = $(e.currentTarget);
			const {doctype, name} = $this.data();
			frappe.ui.toggle_like($this, doctype, name);

			return false;
		});

		this.$result.on("click", ".list-liked-by-me", (e) => {
			const $this = $(e.currentTarget);
			$this.toggleClass("liked");

			if ($this.hasClass("liked")) {
				this.filter_area.add(
					this.doctype,
					"_liked_by",
					"like",
					"%" + frappe.session.user + "%"
				);
			} else {
				this.filter_area.remove("_liked_by");
			}
		});
	}

	setup_new_doc_event() {
		this.$no_result.find(".btn-new-doc").click(() => {
			if (this.settings.primary_action) {
				this.settings.primary_action();
			} else {
				this.make_new_doc();
			}
		});
	}

	setup_tag_event() {
		this.tags_shown = false;
		this.list_sidebar &&
		this.list_sidebar.parent.on("click", ".list-tag-preview", () => {
			this.tags_shown = !this.tags_shown;
			this.toggle_tags();
		});
	}

	setup_realtime_updates() {
		this.pending_document_refreshes = [];

		if (this.list_view_settings?.disable_auto_refresh || this.realtime_events_setup) {
			return;
		}
		frappe.realtime.doctype_subscribe(this.doctype);
		frappe.realtime.off("list_update");
		frappe.realtime.on("list_update", (data) => {
			if (data?.doctype !== this.doctype) {
				return;
			}

			// if some bulk operation is happening by selecting list items, don't refresh
			if (this.$checks && this.$checks.length) {
				return;
			}

			if (this.avoid_realtime_update()) {
				return;
			}

			this.pending_document_refreshes.push(data);
			this.debounced_refresh();
		});
		this.realtime_events_setup = true;
	}

	disable_realtime_updates() {
		frappe.realtime.doctype_unsubscribe(this.doctype);
		this.realtime_events_setup = false;
	}

	process_document_refreshes() {
		if (!this.pending_document_refreshes.length) return;

		const route = frappe.get_route() || [];
		if (!cur_list || route[0] != "List" || cur_list.doctype != route[1]) {
			// wait till user is back on list view before refreshing
			this.pending_document_refreshes = [];
			this.disable_realtime_updates();
			return;
		}

		const names = this.pending_document_refreshes.map((d) => d.name);
		this.pending_document_refreshes = this.pending_document_refreshes.filter(
			(d) => names.indexOf(d.name) === -1
		);

		if (!names.length) return;

		// filters to get only the doc with this name
		const call_args = this.get_call_args();
		call_args.args.filters.push([this.doctype, "name", "in", names]);
		call_args.args.start = 0;

		frappe.call(call_args).then(({message}) => {
			if (!message) return;
			const data = frappe.utils.dict(message.keys, message.values);

			if (!(data && data.length)) {
				// this doc was changed and should not be visible
				// in the listview according to filters applied
				// let's remove it manually
				this.data = this.data.filter((d) => !names.includes(d.name));
				for (let name of names) {
					this.$result
						.find(`.list-row-checkbox[data-name='${name.replace(/'/g, "\\'")}']`)
						.closest(".list-row-container")
						.remove();
				}
				return;
			}

			data.forEach((datum) => {
				const index = this.data.findIndex((doc) => doc.name === datum.name);

				if (index === -1) {
					// append new data
					this.data.push(datum);
				} else {
					// update this data in place
					this.data[index] = datum;
				}
			});

			this.data.sort((a, b) => {
				const a_value = a[this.sort_by] || "";
				const b_value = b[this.sort_by] || "";

				let return_value = 0;
				if (a_value > b_value) {
					return_value = 1;
				}

				if (b_value > a_value) {
					return_value = -1;
				}

				if (this.sort_order === "desc") {
					return_value = -return_value;
				}
				return return_value;
			});
			if (this.$checks && this.$checks.length) {
				this.set_rows_as_checked();
			}
			this.toggle_result_area();
			this.render_list();
		});
	}

	avoid_realtime_update() {
		if (this.filter_area?.is_being_edited()) {
			return true;
		}
		// this is set when a bulk operation is called from a list view which might update the list view
		// this is to avoid the list view from refreshing a lot of times
		// the list view is updated once after the bulk operation is complete
		if (this.disable_list_update) {
			return true;
		}
		return false;
	}

	set_rows_as_checked() {
		if (!this.$checks || !this.$checks.length) {
			return;
		}

		$.each(this.$checks, (i, el) => {
			let docname = $(el).attr("data-name");
			this.$result.find(`.list-row-checkbox[data-name='${docname}']`).prop("checked", true);
		});
		this.on_row_checked();
	}

	on_row_checked() {
		this.$list_head_subject =
			this.$list_head_subject || this.$result.find("header .list-header-subject");
		this.$checkbox_actions =
			this.$checkbox_actions || this.$result.find("header .checkbox-actions");

		this.$checks = this.$result.find(".list-row-checkbox:checked");

		this.$list_head_subject.toggle(this.$checks.length === 0);
		this.$checkbox_actions.toggle(this.$checks.length > 0);

		if (this.$checks.length === 0) {
			this.$list_head_subject.find(".list-check-all").prop("checked", false);
		} else {
			this.$checkbox_actions
				.find(".list-header-meta")
				.html(__("{0} items selected", [this.$checks.length]));
			this.$checkbox_actions.show();
			this.$list_head_subject.hide();
		}
		this.update_checkbox();
		this.toggle_actions_menu_button(this.$checks.length > 0);
	}

	toggle_tags() {
		this.$result.find(".tag-col").toggleClass("hide");
		const preview_label = this.tags_shown ? __("Hide Tags") : __("Show Tags");
		this.list_sidebar.parent.find(".list-tag-preview").text(preview_label);
	}

	get_checked_items(only_docnames) {
		const docnames = Array.from(this.$checks || []).map((check) =>
			cstr(unescape($(check).data().name))
		);

		if (only_docnames) return docnames;

		return this.data.filter((d) => docnames.includes(d.name));
	}

	clear_checked_items() {
		this.$checks && this.$checks.prop("checked", false);
		this.on_row_checked();
	}

	save_view_user_settings(obj) {
		return frappe.model.user_settings.save(this.doctype, this.view_name, obj);
	}

	on_update() {
	}

	update_url_with_filters() {
		if (frappe.get_route_str() == this.page_name && !this.report_name) {
			// only update URL if the route still matches current page.
			// do not update if current list is a "saved report".
			window.history.replaceState(null, null, this.get_url_with_filters());
		}
	}

	get_url_with_filters() {
		let search_params = this.get_search_params();

		let full_url = window.location.href.replace(window.location.search, "");
		if (search_params.size) {
			full_url += "?" + search_params.toString();
		}
		return full_url;
	}

	get_search_params() {
		let search_params = new URLSearchParams();

		this.get_filters_for_args().forEach((filter) => {
			if (filter[2] === "=") {
				search_params.append(filter[1], filter[3]);
			} else {
				search_params.append(filter[1], JSON.stringify([filter[2], filter[3]]));
			}
		});
		return search_params;
	}

	get_menu_items() {
		const doctype = this.doctype;
		const items = [];


		if (frappe.user_roles.includes("System Manager")) {
			items.push({
				label: __("User Permissions", null, "Button in list view menu"),
				action: () =>
					frappe.set_route("list", "user-permission", {
						allow: doctype,
					}),
				standard: true,
			});
		}

		if (frappe.user_roles.includes("System Manager")) {
			items.push({
				label: __("Role Permissions Manager", null, "Button in list view menu"),
				action: () =>
					frappe.set_route("permission-manager", {
						doctype,
					}),
				standard: true,
			});
		}

		if (
			frappe.model.can_create("Custom Field") &&
			frappe.model.can_create("Property Setter")
		) {
			items.push({
				label: __("Customize", null, "Button in list view menu"),
				action: () => {
					if (!this.meta) return;
					if (this.meta.custom) {
						frappe.set_route("form", "doctype", doctype);
					} else if (!this.meta.custom) {
						frappe.set_route("form", "customize-form", {
							doc_type: doctype,
						});
					}
				},
				standard: true,
				shortcut: "Ctrl+Y",
			});
		}

		items.push({
			label: __("Toggle Sidebar", null, "Button in list view menu"),
			action: () => this.toggle_side_bar(),
			condition: () => !this.hide_sidebar,
			standard: true,
			shortcut: "Ctrl+K",
		});

		if (frappe.user.has_role("System Manager") && frappe.boot.developer_mode) {
			// edit doctype
			items.push({
				label: __("Edit DocType", null, "Button in list view menu"),
				action: () => frappe.set_route("form", "doctype", doctype),
				standard: true,
			});
		}

		if (frappe.user.has_role("System Manager")) {
			if (this.get_view_settings) {
				items.push(this.get_view_settings());
			}
		}

		return items;
	}

	get_view_settings() {
		return {
			label: __("List Settings", null, "Button in list view menu"),
			action: () => this.show_list_settings(),
			standard: true,
		};
	}

	show_list_settings() {
		frappe.model.with_doctype(this.doctype, () => {
			new ListSettings({
				listview: this,
				doctype: this.doctype,
				settings: this.list_view_settings,
				meta: frappe.get_meta(this.doctype),
			});
		});
	}

	get_workflow_action_menu_items() {
		const workflow_actions = [];
		const me = this;

		if (frappe.model.has_workflow(this.doctype)) {
			const actions = frappe.workflow.get_all_transition_actions(this.doctype);
			actions.forEach((action) => {
				workflow_actions.push({
					label: __(action),
					name: action,
					action: () => {
						me.disable_list_update = true;
						frappe
							.xcall("frappe.model.workflow.bulk_workflow_approval", {
								docnames: this.get_checked_items(true),
								doctype: this.doctype,
								action: action,
							})
							.finally(() => {
								me.disable_list_update = false;
							});
					},
					is_workflow_action: true,
				});
			});
		}
		return workflow_actions;
	}

	toggle_workflow_actions() {
		if (!frappe.model.has_workflow(this.doctype)) return;

		Object.keys(this.workflow_action_items).forEach((key) => {
			this.workflow_action_items[key].addClass("disabled");
		});
		const checked_items = this.get_checked_items();

		frappe
			.xcall("frappe.model.workflow.get_common_transition_actions", {
				docs: checked_items,
				doctype: this.doctype,
			})
			.then((actions) => {
				Object.keys(this.workflow_action_items).forEach((key) => {
					this.workflow_action_items[key].removeClass("disabled");
					this.workflow_action_items[key].toggle(actions.includes(key));
				});
			});
	}

	get_actions_menu_items() {
		const doctype = this.doctype;
		const actions_menu_items = [];
		const bulk_operations = new BulkOperations({doctype: this.doctype});

		const is_field_editable = (field_doc) => {
			return (
				field_doc.fieldname &&
				frappe.model.is_value_type(field_doc) &&
				field_doc.fieldtype !== "Read Only" &&
				!field_doc.hidden &&
				!field_doc.read_only &&
				!field_doc.is_virtual
			);
		};

		const has_editable_fields = (doctype) => {
			return frappe.meta
				.get_docfields(doctype)
				.some((field_doc) => is_field_editable(field_doc));
		};

		const has_submit_permission = (doctype) => {
			return frappe.perm.has_perm(doctype, 0, "submit");
		};

		// utility
		const bulk_assignment = () => {
			return {
				label: __("Assign To", null, "Button in list view actions menu"),
				action: () => {
					this.disable_list_update = true;
					bulk_operations.assign(this.get_checked_items(true), () => {
						this.disable_list_update = false;
						this.clear_checked_items();
						this.refresh();
					});
				},
				standard: true,
			};
		};

		const bulk_assignment_clear = () => {
			return {
				label: __("Clear Assignment", null, "Button in list view actions menu"),
				action: () => {
					frappe.confirm(
						__("Are you sure you want to clear the assignments?"),
						() => {
							this.disable_list_update = true;
							bulk_operations.clear_assignment(this.get_checked_items(true), () => {
								this.disable_list_update = false;
								this.clear_checked_items();
								this.refresh();
							});
						},
						() => {
							this.clear_checked_items();
							this.refresh();
						}
					);
				},
				standard: true,
			};
		};

		const bulk_assignment_rule = () => {
			return {
				label: __("Apply Assignment Rule", null, "Button in list view actions menu"),
				action: () => {
					this.disable_list_update = true;
					bulk_operations.apply_assignment_rule(this.get_checked_items(true), () => {
						this.disable_list_update = false;
						this.clear_checked_items();
						this.refresh();
					});
				},
				standard: true,
			};
		};

		const bulk_add_tags = () => {
			return {
				label: __("Add Tags", null, "Button in list view actions menu"),
				action: () => {
					this.disable_list_update = true;
					bulk_operations.add_tags(this.get_checked_items(true), () => {
						this.disable_list_update = false;
						this.clear_checked_items();
						this.refresh();
					});
				},
				standard: true,
			};
		};

		const bulk_printing = () => {
			return {
				label: __("Print", null, "Button in list view actions menu"),
				action: () => bulk_operations.print(this.get_checked_items()),
				standard: true,
			};
		};

		const bulk_delete = () => {
			return {
				label: __("Delete", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true).map((docname) =>
						docname.toString()
					);
					let message = __(
						"Delete {0} item permanently?",
						[docnames.length],
						"Title of confirmation dialog"
					);
					if (docnames.length > 1) {
						message = __(
							"Delete {0} items permanently?",
							[docnames.length],
							"Title of confirmation dialog"
						);
					}
					frappe.confirm(message, () => {
						this.disable_list_update = true;
						bulk_operations.delete(docnames, () => {
							this.disable_list_update = false;
							this.clear_checked_items();
							this.refresh();
						});
					});
				},
				standard: true,
			};
		};

		const bulk_cancel = () => {
			return {
				label: __("Cancel", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true);
					if (docnames.length > 0) {
						frappe.confirm(
							__(
								"Cancel {0} documents?",
								[docnames.length],
								"Title of confirmation dialog"
							),
							() => {
								this.disable_list_update = true;
								bulk_operations.submit_or_cancel(docnames, "cancel", () => {
									this.disable_list_update = false;
									this.clear_checked_items();
									this.refresh();
								});
							}
						);
					}
				},
				standard: true,
			};
		};

		const bulk_submit = () => {
			return {
				label: __("Submit", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true);
					if (docnames.length > 0) {
						frappe.confirm(
							__(
								"Submit {0} documents?",
								[docnames.length],
								"Title of confirmation dialog"
							),
							() => {
								this.disable_list_update = true;
								bulk_operations.submit_or_cancel(docnames, "submit", () => {
									this.disable_list_update = false;
									this.clear_checked_items();
									this.refresh();
								});
							}
						);
					}
				},
				standard: true,
			};
		};

		const bulk_edit = () => {
			return {
				label: __("Edit", null, "Button in list view actions menu"),
				action: () => {
					let field_mappings = {};

					frappe.meta.get_docfields(doctype).forEach((field_doc) => {
						if (is_field_editable(field_doc)) {
							field_mappings[field_doc.label] = Object.assign({}, field_doc);
						}
					});

					this.disable_list_update = true;
					bulk_operations.edit(this.get_checked_items(true), field_mappings, () => {
						this.disable_list_update = false;
						this.refresh();
					});
				},
				standard: true,
			};
		};

		const bulk_export = () => {
			return {
				label: __("Export", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true);

					bulk_operations.export(doctype, docnames);
				},
				standard: true,
			};
		};

		// bulk edit
		if (has_editable_fields(doctype) && !frappe.model.has_workflow(doctype)) {
			actions_menu_items.push(bulk_edit());
		}

		actions_menu_items.push(bulk_export());

		// bulk assignment
		actions_menu_items.push(bulk_assignment());

		actions_menu_items.push(bulk_assignment_clear());

		actions_menu_items.push(bulk_assignment_rule());

		actions_menu_items.push(bulk_add_tags());

		// bulk printing
		if (frappe.model.can_print(doctype)) {
			actions_menu_items.push(bulk_printing());
		}

		// bulk submit
		if (
			frappe.model.is_submittable(doctype) &&
			has_submit_permission(doctype) &&
			!frappe.model.has_workflow(doctype)
		) {
			actions_menu_items.push(bulk_submit());
		}

		// bulk cancel
		if (frappe.model.can_cancel(doctype) && !frappe.model.has_workflow(doctype)) {
			actions_menu_items.push(bulk_cancel());
		}

		// bulk delete
		if (frappe.model.can_delete(doctype) && !frappe.model.has_workflow(doctype)) {
			actions_menu_items.push(bulk_delete());
		}

		return actions_menu_items;
	}

	parse_filters_from_route_options() {
		const filters = [];

		let params = new URLSearchParams(window.location.search);
		if (!params.toString() && frappe.route_options) {
			params = new Map(Object.entries(frappe.route_options));
		}

		params.forEach((value, field) => {
			let doctype = null;

			let value_array;
			if ($.isArray(value) && value[0].startsWith("[") && value[0].endsWith("]")) {
				value_array = [];
				for (var i = 0; i < value.length; i++) {
					value_array.push(JSON.parse(value[i]));
				}
			} else if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
				value = JSON.parse(value);
			}

			// if `Child DocType.fieldname`
			if (field.includes(".")) {
				doctype = field.split(".")[0];
				field = field.split(".")[1];
			}

			// find the table in which the key exists
			// for example the filter could be {"item_code": "X"}
			// where item_code is in the child table.

			// we can search all tables for mapping the doctype
			if (!doctype) {
				doctype = frappe.meta.get_doctype_for_field(this.doctype, field);
			}

			if (doctype) {
				if (value_array) {
					for (var j = 0; j < value_array.length; j++) {
						if ($.isArray(value_array[j])) {
							filters.push([doctype, field, value_array[j][0], value_array[j][1]]);
						} else {
							filters.push([doctype, field, "=", value_array[j]]);
						}
					}
				} else if ($.isArray(value)) {
					filters.push([doctype, field, value[0], value[1]]);
				} else {
					filters.push([doctype, field, "=", value]);
				}
			}
		});

		return filters;
	}

	add_custom_button() {
		if (this.parent.page && this.parent.page.page_actions) {
			let buttonContainer = $('<div class="button-container container"></div>');
			let importButton = $(`<button class="outline-btn-black-border" title="Import data"><i class="octicon octicon-cloud-upload"></i></button>`);
			let exportButton = $(`<button class="outline-btn-black-border" title="Export data"><i class="octicon octicon-cloud-download"></i></button>`);
			let printButton = $(`<button class="outline-btn-black-border" title="Print data"><i class="octicon octicon-book"></i></button>`);

			buttonContainer.append(importButton);
			buttonContainer.append(exportButton);
			buttonContainer.append(printButton);

			let pageActions = this.parent.page.page_actions;

			function addButtonContainer() {
				if (window.matchMedia("(max-width: 1000px)").matches) {
					$('.page-head').after(buttonContainer);
				} else {
					pageActions.prepend(buttonContainer);
				}
			}

			addButtonContainer();
			$(window).resize(addButtonContainer);

			const bulk_operations = new BulkOperations({doctype: this.doctype});

			importButton.on('click', () => {
				frappe.set_route("list", "data-import", {
					reference_doctype: this.doctype,
				});
			});

			exportButton.on('click', () => {
				bulk_operations.export(this.doctype, this.get_checked_items(true));
			});

			printButton.on('click', () => {
				bulk_operations.print(this.get_checked_items(), this.doctype)
			});
		}
	}
};

frappe.get_list_view = (doctype) => {
	let route = `List/${doctype}/List`;
	return frappe.views.list_view[route];
};

class ElementFactory {
	/* Pre-create templates for HTML Elements on initialization and provide them
	via the get_xxx_element methods. */
	constructor(doctype) {
		this.templates = {
			checkbox: this.create_checkbox_element(doctype),
			checkboxspan: this.create_checkboxspan_element(),
			link: this.create_link_element(doctype),
			like: this.create_like_element(doctype),
		};
	}

	create_checkbox_element(doctype) {
		const checkbox = document.createElement("input");
		checkbox.classList.add("list-row-checkbox");
		checkbox.type = "checkbox";
		checkbox.dataset.doctype = doctype;
		return checkbox;
	}

	create_link_element(doctype) {
		const link = document.createElement("a");
		link.classList.add("ellipsis");
		link.dataset.doctype = doctype;

		return link;
	}

	create_checkboxspan_element() {
		const checkboxspan = document.createElement("span");
		checkboxspan.classList.add("level-item", "select-like");

		return checkboxspan;
	}

	create_like_element(doctype) {
		const like = document.createElement("span");
		like.classList.add("like-action");
		like.innerHTML = frappe.utils.icon("es-solid-heart", "sm", "like-icon");
		like.dataset.doctype = doctype;

		return like;
	}

	get_checkbox_element(name) {
		const checkbox = this.templates.checkbox.cloneNode(true);
		checkbox.dataset.name = name;
		return checkbox;
	}

	get_checkboxspan_element() {
		return this.templates.checkboxspan.cloneNode(true);
	}

	get_link_element(name, href, text) {
		const link = this.templates.link.cloneNode(true);
		link.dataset.name = name;
		link.href = href;
		link.title = text;
		link.textContent = text;

		return link;
	}

	get_like_element(name, liked, liked_by, title) {
		const like = this.templates.like.cloneNode(true);
		like.dataset.name = name;

		const heart_classes = liked ? ["liked-by", "liked"] : ["not-liked"];
		like.classList.add(...heart_classes);

		like.setAttribute("data-liked-by", liked_by || "[]");
		like.setAttribute("title", title);

		return like;
	}
}

function delete_document(doctype, doc_name) {
		console.log(doctype)
		console.log(doc_name)
		frappe.confirm(
			__('Are you sure you want to delete this document?'),
			function () {
				frappe.call({
					method: 'frappe.client.delete',
					args: {
						doctype: doctype,
						name: doc_name
					},
					callback: function (r) {
						if (!r.exc) {
							frappe.show_alert({
								message: __('Document deleted'),
								indicator: 'green'
							});
							frappe.views.ListView.prototype.refresh();  // refresh the list view
						} else {
							frappe.show_alert({
								message: __('Error deleting document'),
								indicator: 'red'
							});
						}
					}
				});
			}
		);
	}
