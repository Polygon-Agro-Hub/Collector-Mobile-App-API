const Joi = require('joi');


exports.getAllDailyTargetSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  searchText: Joi.string().allow('').optional(),
});


exports.downloadDailyTargetSchema = Joi.object({
  fromDate: Joi.date().required(),
  toDate: Joi.date().required()
});


exports.transferSchema = Joi.object({
  fromOfficerId: Joi.number().required(),
  toOfficerId: Joi.number().required(),
  varietyId: Joi.number().required(),
  grade: Joi.string().required(),
  amount: Joi.number().min(0).required()
});

exports.managerTransferSchema = Joi.object({
  toOfficerId: Joi.number().required(),
  varietyId: Joi.number().required(),
  grade: Joi.string().required(),
  amount: Joi.number().min(0).required()
});

exports.managerReceiveSchema = Joi.object({
  fromOfficerId: Joi.number().required(),
  varietyId: Joi.number().required(),
  grade: Joi.string().required(),
  amount: Joi.number().min(0).required()
});