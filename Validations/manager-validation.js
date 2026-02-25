const Joi = require("joi");

exports.createCollectionOfficerSchema = Joi.object({
  firstNameEnglish: Joi.string().required().trim().max(100).messages({
    "string.empty": "First name in English is required",
    "any.required": "First name in English is required",
  }),
  lastNameEnglish: Joi.string().required().trim().max(100).messages({
    "string.empty": "Last name in English is required",
    "any.required": "Last name in English is required",
  }),

  firstNameSinhala: Joi.string().allow(null, "").trim().max(100),
  lastNameSinhala: Joi.string().allow(null, "").trim().max(100),
  firstNameTamil: Joi.string().allow(null, "").trim().max(100),
  lastNameTamil: Joi.string().allow(null, "").trim().max(100),

  userId: Joi.string().required().trim().max(50).messages({
    "string.empty": "User ID is required",
    "any.required": "User ID is required",
  }),
  jobRole: Joi.string().required().trim().max(100).messages({
    "string.empty": "Job role is required",
    "any.required": "Job role is required",
  }),
  empType: Joi.string().required().trim().max(50).messages({
    "string.empty": "Employment type is required",
    "any.required": "Employment type is required",
  }),

  nicNumber: Joi.string().required().trim().max(20).messages({
    "string.empty": "NIC number is required",
    "any.required": "NIC number is required",
  }),
  email: Joi.string().required().email().trim().max(100).messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),

  phoneCode1: Joi.string().required().trim().max(10).messages({
    "string.empty": "Phone code is required",
    "any.required": "Phone code is required",
  }),
  phoneNumber1: Joi.string()
    .required()
    .trim()
    .max(20)
    .pattern(/^[0-9]+$/)
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number should contain only digits",
      "any.required": "Phone number is required",
    }),
  phoneCode2: Joi.string().allow(null, "").trim().max(10),
  phoneNumber2: Joi.string()
    .allow(null, "")
    .trim()
    .max(20)
    .pattern(/^[0-9]+$/),

  houseNumber: Joi.string().required().trim().max(50).messages({
    "string.empty": "House number is required",
    "any.required": "House number is required",
  }),
  streetName: Joi.string().required().trim().max(100).messages({
    "string.empty": "Street name is required",
    "any.required": "Street name is required",
  }),
  city: Joi.string().required().trim().max(100).messages({
    "string.empty": "City is required",
    "any.required": "City is required",
  }),
  district: Joi.string().required().trim().max(100).messages({
    "string.empty": "District is required",
    "any.required": "District is required",
  }),
  province: Joi.string().required().trim().max(100).messages({
    "string.empty": "Province is required",
    "any.required": "Province is required",
  }),
  country: Joi.string().required().trim().max(100).messages({
    "string.empty": "Country is required",
    "any.required": "Country is required",
  }),

  languages: Joi.string().required().trim().max(200).messages({
    "string.empty": "Languages are required",
    "any.required": "Languages are required",
  }),

  accountHolderName: Joi.string().allow(null, "").trim().max(100),
  accountNumber: Joi.string().allow(null, "").trim().max(50),
  bankName: Joi.string().allow(null, "").trim().max(100),
  branchName: Joi.string().allow(null, "").trim().max(100),

  profileImage: Joi.string().allow(null, "").max(5000000),
});
