frappe.templates.navbar = `
      <header class="navbar navbar-expand sticky-top" role="navigation">
          <div class="container">
            <ul class="nav navbar-nav d-none d-sm-flex" id="navbar-breadcrumbs"></ul>
            <!-- Custom Div Start -->
              <div class="input-group search-bar text-muted hidden">
                      <input
                          id="navbar-search"
                          type="text"
                          class="form-control"
                          placeholder="{%= __('Search Here...', [frappe.utils.is_mac() ? '⌘ + G' : 'Ctrl + G']) %}"
                          aria-haspopup="true"
                      >
                      <span class="search-icon">
                          <svg class="icon icon-sm"><use href="#icon-search"></use></svg>
                      </span>
                  </div>
              <!-- Custom Div End -->
            <div class="collapse navbar-collapse justify-content-end">
              <form class="form-inline fill-width justify-content-end" role="search" onsubmit="return false;">
                  {% if (frappe.boot.read_only) { %}
                      <span class="indicator-pill yellow no-indicator-dot read-only-banner" title="{%= __("Your site is undergoing maintenance or being updated.") %}">
                          {%= __("Read Only Mode") %}
                      </span>
                  {% } %}
                  {% if (frappe.boot.user.impersonated_by) { %}
                      <span class="indicator-pill red no-indicator-dot" title="{%= __("You are impersonating as another user.") %}">
                          {%= __("Impersonating {0}", [frappe.boot.user.name]) %}
                      </span>
                  {% } %}

              </form>
              <ul class="navbar-nav">
                  <li class="nav-item dropdown dropdown-notifications dropdown-mobile hidden">
                      <button
                          class="btn-reset nav-link notifications-icon text-muted"
                          data-toggle="dropdown"
                          aria-haspopup="true"
                          aria-expanded="false"
                      >
                          <span class="notifications-seen">
                              <span class="sr-only">{{ __("No new notifications") }}</span>
                              <svg class="es-icon icon-sm" style="stroke:none;"><use href="#es-line-notifications"></use></svg>
                          </span>
                          <span class="notifications-unseen">
                              <span class="sr-only">{{ __("You have unseen notifications") }}</span>
                              <svg class="es-icon icon-sm"><use href="#es-line-notifications-unseen"></use></svg>
                          </span>
                      </button>
                      <div class="dropdown-menu notifications-list dropdown-menu-right" role="menu">
                          <div class="notification-list-header">
                              <div class="header-items"></div>
                              <div class="header-actions"></div>
                          </div>
                          <div class="notification-list-body">
                              <div class="panel-notifications"></div>
                              <div class="panel-events"></div>
                          </div>
                      </div>
                  </li>
                  <li class="nav-item dropdown dropdown-message dropdown-mobile hidden">
                      <button
                          class="btn-reset nav-link notifications-icon text-muted"
                          data-toggle="dropdown"
                          aria-haspopup="true"
                          aria-expanded="true"
                      >
                          <span>
                              <svg class="es-icon icon-sm"><use href="#es-line-chat-alt"></use></svg>
                          </span>
                      </button>
                  </li>
                  <li class="vertical-bar d-none d-sm-block"></li>


                  <li class="nav-item dropdown-theme-toggle dropdown-mobile">

					<button
						class="btn-reset nav-link"
						id="theme-toggle-button"
						onclick="new frappe.ui.ThemeSwitcher().show()"
					>
						<svg width="22px" height="22px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
							<!-- Background Circle -->
							<circle cx="12" cy="12" r="12" fill="white" />
							<!-- SVG Icon -->
							<g id="🔍-Product-Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
								<g id="ic_fluent_dark_theme_24_filled" fill="#212121" fill-rule="nonzero">
									<path d="M12,22 C17.5228475,22 22,17.5228475 22,12 C22,6.4771525 17.5228475,2 12,2 C6.4771525,2 2,6.4771525 2,12 C2,17.5228475 6.4771525,22 12,22 Z M12,20 L12,4 C16.418278,4 20,7.581722 20,12 C20,16.418278 16.418278,20 12,20 Z" id="🎨-Color"></path>
								</g>
							</g>
						</svg>
					</button>


				</li>
                  <li class="nav-item dropdown dropdown-navbar-user dropdown-mobile">
                      <button
                          class="btn-reset nav-link"
                          data-toggle="dropdown"
                          aria-label="{{ __("User Menu") }}"
                      >
                          {{ avatar }}
                      </button>
                      <div class="dropdown-menu dropdown-menu-right" id="toolbar-user" role="menu">
                          {% for item in navbar_settings.settings_dropdown %}
                              {% if (!item.hidden) { %}
                                  {% if (item.route) { %}
                                      <a class="dropdown-item" href="{{ item.route }}">
                                          {%= __(item.item_label) %}
                                      </a>
                                  {% } else if (item.action) { %}
                                      <button class="btn-reset dropdown-item" onclick="return {{ item.action }}">
                                          {%= __(item.item_label) %}
                                      </button>
                                  {% } else { %}
                                      <div class="dropdown-divider"></div>
                                  {% } %}
                              {% } %}
                          {% endfor %}
                      </div>
                  </li>
                  <li class="nav-item dropdown-user-info">
					<div class="user-info d-none d-md-block">
						<!-- First row: Display the current user -->
						<div class="user-name">
							{{ frappe.session.user_fullname }}
						</div>
						<!-- Second row: Display the user's role -->
						<div class="user-role">
						</div>
					</div>
				</li>
              </ul>
            </div>
          </div>
      </header>
    `;
