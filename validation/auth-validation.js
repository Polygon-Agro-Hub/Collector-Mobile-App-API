const Joi = require('joi');


const loginSchema = Joi.object({
  empId: Joi.string().required().label("Employee ID"),
  password: Joi.string().required().label("Password"),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().label("Refresh Token"),
});

module.exports = {
  loginSchema,
  refreshTokenSchema,
};
