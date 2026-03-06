const Joi = require('joi');

exports.driverWithVehicleSchema = Joi.object({

  firstNameEnglish: Joi.string().required(),
  firstNameSinhala: Joi.string().required(),
  firstNameTamil: Joi.string().required(),
  lastNameEnglish: Joi.string().required(),
  lastNameSinhala: Joi.string().required(),
  lastNameTamil: Joi.string().required(),

  nic: Joi.string().required().max(13),
  email: Joi.string().required(),
  phoneCode01: Joi.string().required(),
  phoneNumber01: Joi.string().required(),
  phoneCode02: Joi.string(),
  phoneNumber02: Joi.string().allow('').optional(),

  empId: Joi.string().required(),
  empType: Joi.string().required(),
  jobRole: Joi.string(),

  houseNumber: Joi.string().required(),
  streetName: Joi.string().required(),
  city: Joi.string().required(),
  district: Joi.string().required(),
  province: Joi.string().required(),
  country: Joi.string().required(),


  languages: Joi.string(),
  preferredLanguages: Joi.string(),


  accHolderName: Joi.string().required(),
  accNumber: Joi.string().required(),
  bankName: Joi.string().required(),
  branchName: Joi.string().required(),

  licNo: Joi.string().required(),
  insNo: Joi.string().required(),
  insExpDate: Joi.date().required(),
  vType: Joi.string().required(),
  vCapacity: Joi.string().required(),
  vRegNo: Joi.string().required(),

  profileImage: Joi.string().allow('', null),
  licFrontImg: Joi.string().allow('', null),
  licBackImg: Joi.string().allow('', null),
  insFrontImg: Joi.string().allow('', null),
  insBackImg: Joi.string().allow('', null),
  vehFrontImg: Joi.string().allow('', null),
  vehBackImg: Joi.string().allow('', null),
  vehSideImgA: Joi.string().allow('', null),
  vehSideImgB: Joi.string().allow('', null)
});