const Joi = require('joi');


const loginSchema = Joi.object({
  empId: Joi.string().required().label("Employee ID"),
  password: Joi.string().required().label("Password"),
});

module.exports = {
  loginSchema,
};
