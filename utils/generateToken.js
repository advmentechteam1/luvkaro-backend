const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'lovekaro_default_jwt_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

module.exports = generateToken;
