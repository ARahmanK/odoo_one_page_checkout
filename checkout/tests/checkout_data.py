# Copyright 2023, Vauxoo, S.A. de C.V.
# License OPL-1 (https://www.odoo.com/documentation/user/15.0/legal/licenses/licenses.html).

RES_PARTNER = [
    {
        "name": "Manuel Gomez",
        "display_name": "manuel",
        "company_id": 1,
        "street": "Tulipan",
        "zip": 28646,
        "city": "Colima",
        "state_id": 489,
        "country_id": 156,
        "email": "imanie102615241@me.com",
        "phone": "3121512572",
        "signup_type": "signup",
        "team_id": 2,
    },
    {
        "name": "Manuel Gomez",
        "display_name": "manuel",
        "company_id": 1,
        "street": "Tulipan",
        "zip": 28646,
        "city": "Colima",
        "state_id": 489,
        "country_id": 156,
        "email": "imanie102615249@me.com",
        "phone": "3121512572",
        "signup_type": "signup",
        "team_id": 2,
    },
]

CHILD_PARTNER = {
    "name": "Manuel Gomez",
    "display_name": "manuel",
    "company_id": 1,
    "street": "Tulipan",
    "zip": 28646,
    "city": "Colima",
    "state_id": 489,
    "country_id": 156,
    "email": "imanie102615242@me.com",
    "phone": "3121512572",
    "signup_type": "signup",
    "team_id": 2,
}

MODES = (("new", "billing"), ("new", "shipping"), ("edit", "billing"), ("edit", "shipping"))

FORMS = ("checkout.edit_contact_form", "checkout.edit_billing_form")
