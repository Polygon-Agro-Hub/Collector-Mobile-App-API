const Joi = require('joi');


const cropDetailsSchema = Joi.object({
  crops: Joi.array().items(
    Joi.object({
      varietyId: Joi.number().required(),
      gradeAprice: Joi.number().optional(),
      gradeAquan: Joi.number().optional(),
      gradeBprice: Joi.number().optional(),
      gradeBquan: Joi.number().optional(),
      gradeCprice: Joi.number().optional(),
      gradeCquan: Joi.number().optional(),
      imageA: Joi.string().optional().allow(null),
      imageB: Joi.string().optional().allow(null),
      imageC: Joi.string().optional().allow(null),
    }).required()
  ).required(),
  farmerId: Joi.number().required(),
  invoiceNumber: Joi.string().required()
});

module.exports = {
  cropDetailsSchema,
};
