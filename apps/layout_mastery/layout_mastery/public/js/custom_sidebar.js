frappe.ui.Sidebar = class CustomSidebar extends frappe.ui.Sidebar {
    make_dom() {
        frappe.call({
            method: "layout_mastery.api.get_desk_sidebar_with_items",
            callback: (response) => {
                if (response.message) {
                    const sidebarItems = response.message;
                    this.render_sidebar(sidebarItems);
                }
            }
        });

        // Set the default app before rendering the sidebar
        this.set_default_app();

        // Render the sidebar template
        this.wrapper = $(
            frappe.render_template("sidebar", {
                app_logo_url: frappe.boot.app_data[0].app_logo_url,
                app_title: __(frappe.boot.app_data[0].app_title),
            })
        ).prependTo("body");

        this.$sidebar = this.wrapper.find(".sidebar-items");

        // Show edit sidebar link if the user has access
        if (this.has_access) {
            this.wrapper
                .find(".body-sidebar .edit-sidebar-link")
                .removeClass("hidden")
                .on("click", () => {
                    frappe.quick_edit("Workspace Settings");
                });
        }

        // Initialize app switcher
        this.setup_app_switcher();
    }

    // Render sidebar items recursively
    render_sidebar(items) {
        const renderItems = (items) => {
            let sidebarHtml = '<ul class="nav-list">';
            items.forEach(item => {
                if (item.children && item.children.length) {
                    sidebarHtml += `<li class="nav-item dropdown">
                        <div class="nav-item-controls">
                            <a href="${item.link}" aria-haspopup="true" aria-expanded="false">
                                <i class="${item.icon_class}"></i>
                                <span>${item.title}</span>
                            </a>
                            <button class="custom-sidebar-dropdown-btn">
                                <i class="custom-sidebar-dropdown-icon fa fa-chevron-down"></i>
                            </button>
                        </div>
                        <ul class="dropdown-content" aria-hidden="true">`;

                    sidebarHtml += renderItems(item.children);
                    sidebarHtml += `</ul></li>`;
                } else {
                    sidebarHtml += `<li class="nav-item">
                        <a href="${item.link}">
                            <i class="${item.icon_class}"></i>
                            <span>${item.title}</span>
                        </a>
                    </li>`;
                }
            });
            sidebarHtml += `</ul>`;
            return sidebarHtml;
        };

        let sidebarHtml = `<div class="custom-sidebar">
            <div class="sidebar-logo">
                <img src="${frappe.boot.app_logo_url}" alt="Logo" />
            </div>`;
        sidebarHtml += renderItems(items);
        sidebarHtml += `</div>`;

        this.wrapper = $(sidebarHtml).prependTo("body");
        this.$sidebar = this.wrapper.find(".nav-list");

        this.setup_toggle_button();
        this.setup_dropdowns();
        this.setup_active_link_highlighting();
    }

    setup_toggle_button() {
        const toggleButton = $('<button class="menu-toggle" id="sidebarToggle">' +
            '<i class="fa-solid fa-chevron-right"></i>' +
            '</button>');
        $(".navbar").prepend(toggleButton);

        if ($(window).width() > 900) {
            $('.custom-sidebar').addClass('show');
            $('.main-section').css('margin-left', '250px');
            toggleButton.find('i').removeClass('fa-chevron-right').addClass('fa-chevron-left');
        }

        $(document).on('click', '#sidebarToggle', function () {
            const sidebar = $('.custom-sidebar');
            const mainSection = $('.main-section');

            sidebar.toggleClass('show');

            if (sidebar.hasClass('show')) {
                mainSection.css('margin-left', '250px');
                toggleButton.find('i').removeClass('fa-chevron-right').addClass('fa-chevron-left');
            } else {
                mainSection.css('margin-left', '0');
                toggleButton.find('i').removeClass('fa-chevron-left').addClass('fa-chevron-right');
            }

            if ($(window).width() > 900) {
                mainSection.css('margin-left', sidebar.hasClass('show') ? '250px' : '0');
            } else {
                mainSection.css('margin-left', '0');
            }
        });

        $(window).on('resize', function () {
            if ($(window).width() <= 900) {
                $('.main-section').css('margin-left', '0');
                $('.sidebar').css('width', '0').removeClass('show');
            } else if ($('.sidebar').hasClass('show')) {
                $('.main-section').css('margin-left', '250px');
            }
        });
    }

    setup_dropdowns() {
        $(document).on('click', '.custom-sidebar-dropdown-btn', function () {
            const dropdownContent = $(this).closest('.dropdown').find('.dropdown-content').first();
            const dropdownIcon = $(this).find('.custom-sidebar-dropdown-icon');

            dropdownContent.slideToggle();
            dropdownIcon.toggleClass('rotate');
        });
    }

    setup_active_link_highlighting() {
        setTimeout(() => {
            const navItems = document.querySelectorAll('.custom-sidebar .nav-list a');

            function removeActiveClass() {
                navItems.forEach(item => item.classList.remove('active'));
            }

            function setActiveItemByURL() {
                const currentPath = window.location.pathname;
                navItems.forEach(item => {
                    if (item.getAttribute('href') === currentPath) {
                        item.classList.add('active');
                    }
                });
            }

            navItems.forEach(item => {
                item.addEventListener('click', function () {
                    removeActiveClass();
                    this.classList.add('active');
                });
            });

            setActiveItemByURL();
        }, 1000);
    }
};
