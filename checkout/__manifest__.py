# Copyright 2023 Vauxoo (https://www.vauxoo.com) <info@vauxoo.com>
# License OPL-1 (https://www.odoo.com/documentation/user/15.0/legal/licenses/licenses.html).

{
    "name": "One Page Checkout",
    "summary": "One Page Checkout",
    "author": "Vauxoo",
    "website": "http://www.vauxoo.com",
    "license": "OPL-1",
    "category": "website",
    "version": "15.0.0.0.0",
    "depends": ["website_sale_delivery", "base_vat"],
    "test": [],
    "data": [
        "data/image_assets.xml",
        "views/checkout.xml",
    ],
    "_demo": [
        "demo/res_user_demo.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "/checkout/static/src/lib/jquery.validate.min.js",
            "/checkout/static/src/js/checkout.js",
            "/checkout/static/src/js/checkout_terms.js",
            "checkout/static/src/less/main.scss",
        ],
    },
    "installable": True,
    "auto_install": False,
    "application": True,
    "live_test_url": "https://www.vauxoo.com/r/checkout_150",
    "price": 99,
    "currency": "EUR",
    "images": ["static/description/main_screen.jpeg"],
}
