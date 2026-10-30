const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/responseHandler');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lovekaro_default_jwt_secret');

      req.user = { id: decoded.id };
      return next();
    } catch (error) {
      return sendError(res, 'Not authorized, token failed or expired', 401);
    }
  }

  if (!token) {
    return sendError(res, 'Not authorized, no token provided', 401);
  }
};

module.exports = { protect };
