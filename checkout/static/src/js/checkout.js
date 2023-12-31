odoo.define("checkout.checkout", (require) => {
    "use strict";

    require("web.dom_ready");
    const publicWidget = require("web.public.widget");
    const paymentFormMixin = require("payment.payment_form_mixin");
    const paymentCheckoutForm = require("payment.checkout_form");
    const core = require("web.core");
    const ajax = require("web.ajax");
    const Dialog = require("web.Dialog");
    const _t = core._t;

    publicWidget.registry.CheckoutPayment = publicWidget.Widget.extend(paymentFormMixin, {
        selector: ".js_checkout",
        events: Object.assign({}, publicWidget.Widget.prototype.events, {
            "change #BillingAddressForm :input": "_onChangeBillingForm",
            "change #shippingAddressForm :input": "_onChangeShippingForm",
            "click .address-column .edit_address": "_onClickEditBillingAddress",
            'change select[name="country_id"]': "_onChangeCountry",
            "click .address-column .js_finish_editing_billing": "_onClickFinishEditingAddress",
            "click .address-column .js_edit_address": "_onClickEditKanbanShipping",
            "click .address-column .add-address": "_onClickAddAddress",
            "click .address-column .js_add_address_cancel": "_onClickCancelAddAddress",
            "click .address-column .js_add_address": "_onClickConfirmAddAddress",
            "click .address-column .js_finish_editing": "_onClickFinishEditingShippingAddress",
            'click .js_change_shipping span a[role="button"]': "_onClickSelectAddress",
            'change #delivery_carrier input[name="delivery_type"]': "_onChangeDeliveryMethod",
            "change .js_instructions": "_onChangeInstructions",
            "click .js_product_row .js_delete_product": "_onClickDeleteProductBinder",
            "change .js_product_row .js_quantity": "_onChangeQty",
            "click #send_same_address": "_onClickSameAddress",
            "click #checkout_payment_button": "_onClickPayNow",
        }),
        init: function () {
            this._super.apply(this, arguments);
            const preventDoubleClick = (handlerMethod) => {
                return _.debounce(handlerMethod, 1000, true);
            };
            this._onClickEditBillingAddress = preventDoubleClick(this._onClickEditBillingAddress);
            this._onClickFinishEditingAddress = preventDoubleClick(this._onClickFinishEditingAddress);
            this._onClickEditKanbanShipping = preventDoubleClick(this._onClickEditKanbanShipping);
            this._onClickAddAddress = preventDoubleClick(this._onClickAddAddress);
            this._onClickCancelAddAddress = preventDoubleClick(this._onClickCancelAddAddress);
            this._onClickConfirmAddAddress = preventDoubleClick(this._onClickConfirmAddAddress);
            this._onClickDeleteProductBinder = preventDoubleClick(this._onClickDeleteProductBinder);
            this._onClickFinishEditingShippingAddress = preventDoubleClick(this._onClickFinishEditingShippingAddress);
            this._onClickSelectAddress = preventDoubleClick(this._onClickSelectAddress);
            this._onClickPayNow = preventDoubleClick(this._onClickPayNow);
        },
        start: function () {
            this._super.apply(this, arguments);
            this.$confButtons = this.$("#checkout_payment_button");
            this.$shippingForm = this.$("#shippingAddressForm");
            this.$billingForm = this.$("#BillingAddressForm");
            this.$extraInfoForm = this.$("#extraInfoForm");
            this.$billingInputs = this.$billingForm.find("input[required]");
            this.$("#payment_method div.float-right").hide();
        },

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        /**
         *
         * @param {Object} form - A form to be validated by this specific set of rules.
         */
        formValidator: function (form) {
            $.validator.setDefaults({
                highlight: function (element) {
                    $(element).closest(".form-group").addClass("has-error");
                },
                unhighlight: function (element) {
                    $(element).closest(".form-group").removeClass("has-error");
                },
                errorElement: "span",
                errorClass: "help-block",
                errorPlacement: function (error, element) {
                    if (element.parent(".input-group").length) {
                        error.insertAfter(element.parent());
                    } else {
                        error.insertAfter(element);
                    }
                },
            });
            // Custom mothod to validate email using a given regular expression.
            $.validator.addMethod(
                "customemail",
                function (value, element) {
                    return /^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(value);
                },
                _t("Please type a valid email address.")
            );
            // Custom mothod to validate phone number using a given regular expression.
            $.validator.addMethod(
                "customdigits",
                function (value, element) {
                    return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(value);
                },
                _t("Only numbers and symbols allowed. Must be 10 digits.")
            );
            // Custom mothod to validate vat using a remote call to one of the controllers of this module.
            // The "remote" feature of the jQuery Validator Plugin didn't work properly so a custom method needed to be added.
            // An already documented explanation can be seen in the following link. Code was also slightly modified:
            // https://stackoverflow.com/questions/7247250/jquery-validation-not-waiting-for-remote-validation-to-return-true-considers-fo
            $.validator.addMethod(
                "customvat",
                function (value, element) {
                    if (this.optional(element)) {
                        return "dependency-mismatch";
                    }

                    let previous = this.previousValue(element);
                    if (!this.settings.messages[element.name]) {
                        this.settings.messages[element.name] = {};
                    }
                    previous.originalMessage = this.settings.messages[element.name].remote;
                    this.settings.messages[element.name].remote = previous.message;

                    let param = "/validators/vat";

                    if (previous.old === value) {
                        return previous.valid;
                    }

                    previous.old = value;
                    let validator = this;
                    this.startRequest(element);
                    let data = {
                            csrf_token: odoo.csrf_token,
                            vat: value,
                            country_id: $('.address-column select[name="country_id"]').val(),
                        },
                        valid = "pending";
                    $.ajax(
                        $.extend(
                            true,
                            {
                                url: param,
                                async: false,
                                mode: "abort",
                                port: "validate" + element.name,
                                dataType: "json",
                                data: data,
                                success: function (response) {
                                    validator.settings.messages[element.name].remote = previous.originalMessage;
                                    valid = response === true || response === "true";
                                    if (valid) {
                                        let submitted = validator.formSubmitted;
                                        validator.prepareElement(element);
                                        validator.formSubmitted = submitted;
                                        validator.successList.push(element);
                                        delete validator.invalid[element.name];
                                        validator.showErrors();
                                    } else {
                                        let errors = {},
                                            message = response || validator.defaultMessage(element, "remote");
                                        errors[element.name] = previous.message = $.isFunction(message)
                                            ? message(value)
                                            : message;
                                        validator.invalid[element.name] = true;
                                        validator.showErrors(errors);
                                    }
                                    previous.valid = valid;
                                    validator.stopRequest(element, valid);
                                },
                            },
                            param
                        )
                    );
                    return valid;
                },
                _t("Invalid VAT format.")
            );
            $.extend($.validator.messages, {
                required: _t("This field is required."),
            });
            $(form).validate({
                rules: {
                    vat: {
                        customvat: true,
                    },
                    phone: {
                        required: true,
                        customdigits: true,
                    },
                    email: {
                        required: true,
                        customemail: true,
                    },
                },
            });
        },
        /**
         * Disable buttons so that they can't be clicked anymore
         * @param {JQuery Object} [element] - The JQuery button that will be disabled
         */
        disableButtons: function (element) {
            $(element).prop("disabled", "disabled").addClass("disabled");
        },
        /**
         * Enable buttons so they can be clicked again
         * @param {JQuery Object} [element] - The JQuery button that will be enabled
         */
        enableButtons: function (element) {
            $(element).prop("disabled", null).removeClass("disabled");
        },
        /**
         * Used to render the kanban cards of the shipping addresses.
         * If the partner_id is passed the shippings will be recomputed.
         * @param csrf_token - The token that belongs to the user's session.
         * @param partner_id - The id that belongs to the user.
         */
        renderKanbanShipping: function (csrf_token, partner_id) {
            var partner_id = partner_id || false;
            let carrier_id = $('#delivery_carrier input[name="delivery_type"]:checked').val();
            $.ajax({
                type: "POST",
                url: "/shop/render_kanban",
                data: {
                    csrf_token: csrf_token,
                },
            }).done((data) => {
                this.$(".shipping_cards").replaceWith(data);
                if (partner_id) {
                    this.updateShippings(parseInt(partner_id, 10), csrf_token);
                    this.updateDelivery(carrier_id);
                }
            });
        },
        /**
         * Intended to avoid repeating code everytime that the delivery method needs to be updated.
         * @param csrf_token - The token that belongs to the user's session.
         * @param partner_id - The id that belongs to the user.
         */
        updateShippings: function (partner_id, csrf_token) {
            $.ajax({
                type: "POST",
                url: "/shop/render_carriers",
                data: {
                    partner_id: partner_id,
                    csrf_token: csrf_token,
                },
                beforeSend: function (xhr) {
                    $("#delivery_carrier ul").hide();
                    $(
                        '<div class="text-center id="loading_spinner"><span class="fa fa-spinner fa-3x fa-spin"/></div>'
                    ).insertAfter("#delivery_carrier ul");
                },
            }).done((data) => {
                this.$("#delivery_carrier").replaceWith(data);
            });
        },
        /**
         * Intended to avoid repeating code everytime that the payment acquirers need to be updated.
         * @param csrf_token - The token that belongs to the user's session.
         * @param partner_id - The id that belongs to the user.
         */
        updatePayment: function (partner_id, csrf_token) {
            $.ajax({
                type: "POST",
                url: "/shop/render_acqs",
                data: {
                    partner_id: partner_id,
                    csrf_token: csrf_token,
                },
            }).done((data) => {
                this.$("#payment_acqs").find("form").replaceWith(data);
                // Needs to reattach widget after template's rendering done via replace.
                $(paymentCheckoutForm.prototype.selector).each((index, element) => {
                    new paymentCheckoutForm(this).attachTo($(element));
                });
                this.$("#payment_method div.float-right").hide();
            });
        },
        /**
         * Used to render the kanban cards of the contact addresses.
         * If the partner_id is passed the shippings will be recomputed.
         * @param carrier_id - The id of the currently selected radio button on the Delivery Method section.
         */
        updateDelivery: function (carrier_id) {
            ajax.jsonRpc("/shop/set_carrier?carrier_id=", "call", {
                carrier_id: carrier_id,
            }).then((data) => {
                this.rerenderConfirmation();
            });
        },
        /**
         * Async method used to update UI with consistent data on the confirmation column.
         * @param recompute - if the method is called from the click event of the
         * delivery methods some extra calcuation must be done in order to re-render.
         */
        rerenderConfirmation: function (recompute) {
            recompute = typeof recompute === "undefined" ? false : recompute;
            let $confirmOrder = this.$("#confirm_order");
            $.ajax({
                type: "POST",
                url: "/shop/rerender_confirmation",
                data: {
                    recompute: recompute,
                    csrf_token: odoo.csrf_token,
                },
                beforeSend: function (xhr) {
                    $("#confirm_order .order-total-qty").replaceWith(
                        '<div class="text-center"><span class="fa fa-spinner fa-2x fa-spin"/></div>'
                    );
                },
            }).done((data) => {
                $confirmOrder.replaceWith(data);
            });
        },
        /**
         * Reloads the page if cart is empty, /shop/payment controller will redirect to /shop
         * @param data - The result obtained after calling a controller to process data.
         */
        validateCartQty: function (data) {
            if (typeof data.cart_quantity === "undefined") {
                location.reload();
            } else {
                this.rerenderConfirmation();
            }
        },
        /**
         * Renders the kanban card of the user's Billing Address.
         * @param csrf_token - The token that belongs to the user's session.
         */
        renderBillingCard: function (csrf_token) {
            $.ajax({
                type: "POST",
                url: "/shop/render_billing",
                data: {
                    csrf_token: csrf_token,
                },
            }).done((data) => {
                this.$(".panel-edit-billing").replaceWith(data);
            });
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Triggers when any value of the Billing Address form changes.
         * Checks that the form has valid data and enables/disables the pay button accordingly.
         * @private
         * @param {KeyboardEvent} ev
         */
        _onChangeBillingForm: function (ev) {
            let $panelBilling = $(ev.currentTarget).parents("form"),
                $emptyReq = this.$billingInputs.not(":filled"),
                $currentShippingAddress = $(".all_shippings").find("div.border-primary"),
                csrf_token = odoo.csrf_token,
                valid = false;
            if (!$emptyReq.length) {
                this.formValidator($panelBilling);
                valid = $panelBilling.valid();
            }
            if (valid) {
                if (!$currentShippingAddress.length) {
                    let formFields = $panelBilling.serialize();
                    $.ajax({
                        type: "POST",
                        url: "/shop/check_address",
                        data: formFields,
                    }).done((data) => {
                        try {
                            let data_obj = $.parseJSON(data);
                            this.$billingForm.find('input[name="partner_id"]').val(data_obj.partner_id);
                        } catch (e) {
                            this.$("#delivery_carrier").replaceWith(data);
                            let cp_id = $("#delivery_carrier").find("#carrier_partner").data("carrier-partner");
                            this.$billingForm.find('input[name="partner_id"]').val(cp_id);
                            this.updatePayment(parseInt(cp_id, 10), csrf_token);
                        }
                    });
                }
                this.enableButtons(this.$confButtons);
            } else {
                this.disableButtons(this.$confButtons);
            }
            this.$billingInputs = this.$billingForm.find("input[required]");
        },
        /**
         * Triggers when any value of the Shipping Address form changes.
         * Checks that the form has valid data.
         * @private
         * @param {KeyboardEvent} ev
         */
        _onChangeShippingForm: function (ev) {
            this.formValidator($(ev.currentTarget).parents("form"));
        },
        /**
         * Triggered when clicking on the pencil icon of the card under the Billing Address section.
         * Takes the data from the card and presents it into a simple form to allow edition.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickEditBillingAddress: function (ev) {
            ev.preventDefault();
            let partner_id = this.$billingForm.find('input[name="partner_id"]').val(),
                csrf_token = odoo.csrf_token;
            this.disableButtons($(ev.currentTarget));
            $.ajax({
                type: "POST",
                url: "/shop/editme",
                data: {
                    partner_id: partner_id,
                    csrf_token: csrf_token,
                },
            }).done((data) => {
                let $kanban = $(ev.currentTarget).parents(".one_kanban");
                $kanban.slideUp();
                $kanban.replaceWith(data);
            });
        },
        /**
         * Triggered when editing the Billing/Shipping Address form and changing the country.
         * Modifies form depending on whether or not the selected country has states/provinces.
         * @private
         * @param {MouseEvent} ev
         */
        _onChangeCountry: function (ev) {
            let country_id = $(ev.currentTarget).val();
            if (country_id) {
                this._changeCountry(country_id);
            }
        },
        _changeCountry: function (country_id) {
            if (country_id) {
                ajax.jsonRpc("/shop/country_infos/" + country_id, "call", {mode: "shipping"}).then((data) => {
                    // Populate states and display
                    let $selectStates = this.$("select[name='state_id']");
                    // Dont reload state at first loading (done in qweb)
                    if ($selectStates.data("init") === 0 || $selectStates.find("option").length === 1) {
                        if (data.states.length) {
                            $selectStates.html("");
                            _.each(data.states, function (x) {
                                let opt = $("<option>").text(x[1]).attr("value", x[0]).attr("data-code", x[2]);
                                $selectStates.append(opt);
                            });
                            $selectStates.parent("div").show();
                        } else {
                            $selectStates.val("").parent("div").hide();
                        }
                        $selectStates.data("init", 0);
                    } else {
                        $selectStates.data("init", 0);
                    }
                    // Manage fields order / visibility
                    if (data.fields) {
                        if ($.inArray("zip", data.fields) > $.inArray("city", data.fields)) {
                            $(".div_zip").before($(".div_city"));
                        } else {
                            $(".div_zip").after($(".div_city"));
                        }
                        let all_fields = ["street", "zip", "city", "country_name"]; // "state_code"];
                        _.each(all_fields, function (field) {
                            $(".checkout_autoformat .div_" + field.split("_")[0]).toggle(
                                $.inArray(field, data.fields) >= 0
                            );
                        });
                    }
                });
            }
        },
        /**
         * Triggered when clicking on the Finish Editing button on the Billing Address section.
         * Wraps up the editing and updates the from data.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickFinishEditingAddress: function (ev) {
            ev.preventDefault();
            let $billingForm = $(ev.currentTarget).parents(".panel-edit-billing").find("form"),
                valid = $billingForm.valid(),
                csrf_token = odoo.csrf_token,
                partner_id = $billingForm.find('input[name="partner_id"]').val();

            if (valid) {
                $.post("/shop/check_address", $billingForm.serialize() + "&xhr=1", (data) => {
                    this.renderKanbanShipping(csrf_token, partner_id);
                    this.renderBillingCard(csrf_token);
                });
            }
        },
        /**
         * Triggered when clicking on the pencil icon of the cards under the Shipping Address section.
         * Takes the data from the card and presents it into a simple form to allow edition.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickEditKanbanShipping: function (ev) {
            let $form = $(ev.currentTarget).parents(".one_kanban").find("form"),
                params = $form.serializeArray();
            this.disableButtons($(ev.currentTarget));
            ev.preventDefault();
            ev.stopPropagation();
            $.ajax({
                type: "POST",
                url: "/shop/editme",
                data: params,
            }).done((data) => {
                let $kanban = $(ev.currentTarget).parents(".one_kanban");
                $kanban.slideUp();
                $kanban.replaceWith(data);
            });
        },
        /**
         * Triggers when clicking the Add an Address button on the Shipping Address section.
         * Displays a new form so that a new shipping address can be added.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickAddAddress: function (ev) {
            ev.preventDefault();
            this.disableButtons($(ev.currentTarget));
            let csrf_token = odoo.csrf_token;
            $.ajax({
                type: "POST",
                url: "/shop/addme",
                data: {
                    csrf_token: csrf_token,
                },
            }).done((data) => {
                let $kanban = $(ev.currentTarget).parents(".one_kanban");
                $kanban.slideUp();
                $kanban.replaceWith(data);
            });
        },
        /**
         * Triggers when clicking the Cancel button on the Shipping Addresses section.
         * Cancels adding a new address to an existing partner.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickCancelAddAddress: function (ev) {
            this.disableButtons($(ev.currentTarget));
            let csrf_token = odoo.csrf_token;
            this.renderKanbanShipping(csrf_token);
        },
        /**
         * Triggers when clicking the Add button on the Shipping Addresses section.
         * Add a new address to an existing partner.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickConfirmAddAddress: function (ev) {
            let $addForm = $(ev.currentTarget).parents(".panel-add").find("form"),
                valid = $addForm.valid(),
                csrf_token = odoo.csrf_token,
                partner_id = $(ev.currentTarget).parents(".panel-add").find('input[name="partner_id"]').val();
            if (valid) {
                this.disableButtons($(ev.currentTarget));
                let parent_id = this.$billingForm.find('input[name="partner_id"]').val();
                $.post("/shop/check_address?" + $addForm.serialize() + "&parent_id=" + parent_id + "&xhr=1").then(
                    (data) => {
                        let json = {};
                        try {
                            json = JSON.parse(data);
                        } catch (error) {
                            console.error(error);
                        }
                        if (!json.error) {
                            return this.renderKanbanShipping(csrf_token, partner_id);
                        }
                        for (const field in json.error) {
                            $shippingForm.find(`[name="${field}"]`).closest(".form-group").addClass(".has-error");
                        }
                        new Dialog(this, {
                            title: "Error",
                            $content: `<div class="alert-danger alert">
                            ${json.error.error_message.join(" ")}
                        </div>`,
                            buttons: [
                                {
                                    text: "Ok",
                                    close: true,
                                },
                            ],
                        }).open();
                    }
                );
            }
        },
        /**
         * Triggers when changing the delivery type on the Delivery Method section.
         * Sets the selected carrier to the order.
         * @private
         * @param {MouseEvent} ev
         */
        _onChangeDeliveryMethod: function (ev) {
            let carrier_id = $(ev.currentTarget).val();
            this.updateDelivery(carrier_id);
        },
        /**
         * Triggers when changing the order's indications text area on Delivery Method section.
         * Adds a note to the order with the text area's value.
         * @private
         * @param {MouseEvent} ev
         */
        _onChangeInstructions: function (ev) {
            let instructions = $(ev.currentTarget).val();
            ajax.jsonRpc("/shop/delivery_instructions", "call", {
                instructions: instructions,
            });
        },
        /**
         * Triggers when clicking the X icon on the Confirm Order section.
         * Deletes products from the shopping cart.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickDeleteProductBinder: function (ev) {
            ev.preventDefault();
            let line_id = parseInt($(ev.currentTarget).data("line-id"), 10),
                product_id = parseInt($(ev.currentTarget).data("product-id"), 10);
            ajax.jsonRpc("/shop/cart/update_json", "call", {
                line_id: line_id,
                product_id: product_id,
                set_qty: 0,
            }).then((data) => {
                this.validateCartQty(data);
            });
        },
        /**
         * Triggers when changing the value of the input related to a product's quantity on the Confirm Order section.
         * Updates cart with the new quantity.
         * @private
         * @param {MouseEvent} ev
         */
        _onChangeQty: function (ev) {
            ev.preventDefault();
            let carrier_id = $('#delivery_carrier input[name="delivery_type"]:checked').val(),
                line_id = parseInt($(ev.currentTarget).data("line-id"), 10),
                product_id = parseInt($(ev.currentTarget).data("product-id"), 10),
                qty = $(ev.currentTarget).val();
            if (qty < 0.1) {
                qty = 0;
            }
            ajax.jsonRpc("/shop/cart/update_json", "call", {
                line_id: line_id,
                product_id: product_id,
                set_qty: qty,
            }).then((data) => {
                this.updateDelivery(carrier_id);
                this.validateCartQty(data);
            });
        },
        /**
         * Triggered when clicking on the Finish Editing button on the Shipping Addresses section.
         * Wraps up the editing of shipping addresses.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickFinishEditingShippingAddress: function (ev) {
            ev.preventDefault();
            let $tempForm = $(ev.currentTarget).parents(".panel-edit").find("form"),
                valid = $tempForm.valid(),
                csrf_token = odoo.csrf_token,
                partner_id = $(ev.currentTarget).parents(".panel-edit").find('input[name="partner_id"]').val();
            if (valid) {
                this.disableButtons($(ev.currentTarget));
                let parent_id = this.$billingForm.find('input[name="partner_id"]').val();
                $.post("/shop/check_address", $tempForm.serialize() + "&parent_id=" + parent_id + "&xhr=1", (data) => {
                    this.renderKanbanShipping(csrf_token, partner_id);
                });
            }
        },
        /**
         * Triggered when clicking on the "select this address" buttons on the shipping addresses section.
         * Used to select between shipping addresses and render the carriers accordingly.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickSelectAddress: function (ev) {
            ev.preventDefault();
            const $currentForm = $(ev.currentTarget).parents(".js_change_shipping").siblings("form");

            let $currentAddress = $(ev.currentTarget).parents(".all_shippings").find("div.border-primary");
            $currentAddress.find(".btn-ship").toggle();
            $currentAddress.removeClass("border-primary");
            $currentAddress.addClass("js_change_shipping");

            let $newAddress = $(ev.currentTarget).parents(".js_change_shipping");
            $newAddress.find("span.btn-ship").toggle();
            $newAddress.removeClass("js_change_shipping");
            $newAddress.addClass("border-primary");

            $.post($currentForm.attr("action"), $currentForm.serialize() + "&xhr=1", (data) => {
                $.ajax({
                    type: "POST",
                    url: "/shop/render_carriers",
                    data: {
                        partner_id: $currentForm.find('input[name="partner_id"]').val(),
                        csrf_token: odoo.csrf_token,
                    },
                    beforeSend: function (xhr) {
                        $("#delivery_carrier ul").hide();
                        $(
                            '<div class="text-center id="loading_spinner"><span class="fa fa-spinner fa-3x fa-spin"/></div>'
                        ).insertAfter("#delivery_carrier ul");
                    },
                }).done((data) => {
                    location.reload();
                });
            });
        },
        /**
         * Triggers when clicking on the "send to same address" checkbox.
         * Hides/display the shipping addresses if the logged in partner has any available.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickSameAddress: function (ev) {
            let valid = this.$billingForm.valid();
            if (!valid) {
                ev.preventDefault();
                return;
            }
            let $toToggle = this.$(".all_shippings");
            let billingFormID = this.$billingForm.find('input[name="partner_id"]').val();
            let $billingShippingInput = this.$(".all_shippings .one_kanban form").find(
                `input[value="${billingFormID}"]`
            );
            if ($(ev.currentTarget).is(":checked")) {
                $.post(
                    $billingShippingInput.parent("form").attr("action"),
                    this.$billingForm.serialize() + "&xhr=1",
                    (data) => {
                        $.ajax({
                            type: "POST",
                            url: "/shop/render_carriers",
                            data: {
                                partner_id: billingFormID,
                                csrf_token: odoo.csrf_token,
                            },
                            beforeSend: function (xhr) {
                                $("#delivery_carrier ul").hide();
                                $(
                                    '<div class="text-center id="loading_spinner"><span class="fa fa-spinner fa-3x fa-spin"/></div>'
                                ).insertAfter("#delivery_carrier ul");
                            },
                        }).done((data) => {
                            $toToggle.slideUp();
                            let $currentAddress = this.$(".all_shippings").find("div.border-primary");
                            $currentAddress.find(".btn-ship").toggle();
                            $currentAddress.removeClass("border-primary");
                            $currentAddress.addClass("js_change_shipping");

                            let $billingShippingKanban = $billingShippingInput
                                .parent("form")
                                .siblings(".js_change_shipping");
                            $billingShippingKanban.find("span.btn-ship").toggle();
                            $billingShippingKanban.removeClass("js_change_shipping");
                            $billingShippingKanban.addClass("border-primary");

                            this.$("#delivery_carrier").replaceWith(data);
                            this.$(".fa-spinner").parent().remove();
                            this.$("#delivery_carrier ul").show();
                        });
                    }
                );
            }
            $(ev.currentTarget).prop("disabled", "disabled").addClass("disabled");
            $toToggle.slideDown();
            this.$billingForm.slideUp();
            let csrf_token = odoo.csrf_token;
            ajax.post("/shop/render_billing", {csrf_token}).then((data) => {
                $(".js_billing_form").replaceWith(data);
                $(ev.currentTarget).prop("disabled", null).removeClass("disabled");
            });
        },
        /**
         * Triggers when clicking on the "pay now" button.
         * Checks if a payment and delivery method have been selected. Raises error if there is one missing.
         * If no errors are displayed, it then checks that the Extra Info section is available or not to run
         * an extra validation and then triggers a click on the hidden payment button to proccess the payment.
         * @private
         * @param {MouseEvent} ev
         */
        _onClickPayNow: function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            let $checkedRadioButtons = this.$('input[type="radio"]:checked');
            if ($checkedRadioButtons.length < 2) {
                this._displayError(
                    _t("No payment option or delivery method selected!"),
                    _t("Please make sure you have selected one for both.")
                );
            } else {
                if (this.$extraInfoForm.length == 0) {
                    this.$('button[name="o_payment_submit_button"]').trigger("click");
                } else {
                    let valid = this.$extraInfoForm.valid();
                    if (valid) {
                        this.$extraInfoForm.find(".s_website_form_send").trigger("click");
                        this.$('button[name="o_payment_submit_button"]').trigger("click");
                    }
                }
            }
        },
    });
    return publicWidget.registry.CheckoutPayment;
});
