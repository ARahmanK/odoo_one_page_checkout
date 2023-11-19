# Copyright 2023, Vauxoo, S.A. de C.V.
# License OPL-1 (https://www.odoo.com/documentation/user/15.0/legal/licenses/licenses.html).

from odoo.tests import SingleTransactionCase, tagged

from . import checkout_data


@tagged("addres")
class TestAddres(SingleTransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.res_user = cls.env["res.users"]
        cls.public_user = cls.env.ref("base.public_user").id

        cls.res_partner = cls.env["res.partner"].create(checkout_data.RES_PARTNER[0])

        checkout_data.CHILD_PARTNER["parent_id"] = cls.res_partner.id
        cls.res_partner_child = cls.env["res.partner"].create(checkout_data.CHILD_PARTNER)

        cls.new_order = cls.create_sale_order(cls, cls.public_user)
        cls.edit_order = cls.create_sale_order(cls, cls.res_partner.id)

    def create_sale_order(self, partner_id):
        return self.env["sale.order"].create(
            {"partner_id": partner_id, "partner_invoice_id": partner_id, "partner_shipping_id": partner_id}
        )

    def test_01_addres_mode(self):
        """Test the possibles ways to edit an address."""
        new_bill = self.res_partner.check_mode(self.new_order, self.public_user, self.public_user)
        new_ship = self.res_partner.check_mode(self.new_order, -1, self.public_user)

        edit_bill = self.res_partner.check_mode(self.edit_order, self.res_partner.id, self.public_user)
        edit_ship = self.res_partner.check_mode(self.edit_order, self.res_partner_child.id, self.public_user)

        modes = (new_bill, new_ship, edit_bill, edit_ship)

        self.assertEqual(modes, checkout_data.MODES)


@tagged("order")
class TestOrder(SingleTransactionCase):
    def setUp(self):
        super().setUp()
        self.res_user = self.env["res.users"]
        self.public_user = self.env.ref("base.public_user").id

        self.res_partner = self.env["res.partner"].create(checkout_data.RES_PARTNER[1])

        self.order = self.env["sale.order"].create(
            {
                "partner_id": self.public_user,
                "partner_invoice_id": self.public_user,
                "partner_shipping_id": self.public_user,
            }
        )

    def test_01_order_partner(self):
        """Test if the order is linked to your partner/partner_shipping."""
        self.res_partner.bind_partner(self.order, checkout_data.MODES[0], self.res_partner.id)

        self.res_partner.bind_partner(self.order, checkout_data.MODES[1], self.res_partner.id)

        self.assertEqual(self.order.partner_id.id, self.res_partner.id)
        self.assertEqual(self.order.partner_shipping_id.id, self.res_partner.id)
