odoo.define("checkout.terms_checkbox", function (require) {
    "use strict";
    const Widget = require("web.Widget");
    require("web.dom_ready");
    const $terms = $("#checkbox_js");
    const $pay_button = $("#checkout_payment_button");
    const termsCheckbox = Widget.extend({
        events: {
            "change input#checkbox_cgv": "_onChange",
        },
        _onChange(ev) {
            $pay_button.prop("disabled", !$(ev.currentTarget).prop("checked"));
        },
    });

    if (!$terms.length) {
        return $.Deferred().reject("Dom Does not contain the terms checkbox #checkbox_cgv");
    }

    $terms.each(function () {
        new termsCheckbox().attachTo(this);
    });

    return termsCheckbox;
});
