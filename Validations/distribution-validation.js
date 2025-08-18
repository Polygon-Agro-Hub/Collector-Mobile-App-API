const Joi = require('joi');

// Fixed validation schema for replace order package
exports.replaceOrderPackageSchema = Joi.object({
    orderPackageId: Joi.number().integer().positive().required(),
    productType: Joi.number().integer().min(1).required(),
    replaceId: Joi.number().integer().positive().required(),
    originalItemId: Joi.number().integer().positive().required(), // Added this missing field
    productId: Joi.number().integer().positive().allow(null),
    qty: Joi.string().required(),
    price: Joi.number().positive().required(),
    status: Joi.string().valid('Pending', 'Approved', 'Rejected').default('Pending')
});