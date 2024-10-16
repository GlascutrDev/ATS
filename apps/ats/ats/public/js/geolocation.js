function getDoctypeName() {
    const currentUrl = window.location.href;
    const url = new URL(currentUrl);
    const segments = url.pathname.split('/');
    const doctypeName = decodeURIComponent(segments[segments.length - 2]);
    return doctypeName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

const doctypeName = getDoctypeName();

frappe.ui.form.on(doctypeName, {
    refresh(frm) {
        const location = frm.doc.map_location;

        if (location) {
            // Parse the GeoJSON data
            const locationData = JSON.parse(location);
            const coordinates = locationData.features[0].geometry.coordinates;
            const [longitude, latitude] = coordinates; // Destructure coordinates

            // Create a GeoJSON point feature
            const pointFeature = {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Point",
                    "coordinates": [longitude, latitude]
                }
            };

            frm.doc.map_location = JSON.stringify({
                "type": "FeatureCollection",
                "features": [pointFeature]
            });
            frm.refresh_field('map_location');
        }
    },
    share_location(frm) {
        const location = frm.doc.map_location;

        if (location) {
            const locationData = JSON.parse(location);
            const coordinates = locationData.features[0].geometry.coordinates;
            const [longitude, latitude] = coordinates; // Destructure coordinates

            // Build the map URL
            if (latitude && longitude) {
                const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

                // Check if the device is mobile
                const isMobileDevice = () => {
                    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
                };

                // Create a modal for sharing options
                const modal = new frappe.ui.Dialog({
                    title: __('Share Location'),
                    fields: []
                });

                // Create buttons for WhatsApp and Copy Link
                const whatsappButton = `<button class="btn btn-default" style="background-color: #25D366; color: white; width: 100%; margin-bottom: 10px;">
                    <i class="fa fa-whatsapp" style="margin-right: 5px;"></i> Share via WhatsApp
                </button>`;

                const copyButton = `<button class="btn btn-default" style="background-color: #007bff; color: white; width: 100%;">
                    <i class="fa fa-copy" style="margin-right: 5px;"></i> Copy Link
                </button>`;

                // Append buttons to modal body
                modal.$body.append(whatsappButton);
                modal.$body.append(copyButton);

                // WhatsApp button click event
                modal.$body.find('button').first().on('click', function () {
                    const whatsappUrl = isMobileDevice()
                        ? `whatsapp://send?text=Check%20out%20this%20location:%20${mapUrl}`
                        : `https://web.whatsapp.com/send?text=Check%20out%20this%20location:%20${mapUrl}`;
                    window.open(whatsappUrl, '_blank');
                });

                // Copy Link button click event
                modal.$body.find('button').last().on('click', function () {
                    navigator.clipboard.writeText(mapUrl)
                        .then(() => frappe.msgprint(__('Link copied to clipboard!')))
                        .catch(err => {
                            frappe.msgprint(__('Failed to copy link.'));
                            console.error('Error copying text: ', err);
                        });
                });

                modal.show();
            }
        } else {
            frappe.msgprint(__('No location data available to share.'));
        }
    }
});
