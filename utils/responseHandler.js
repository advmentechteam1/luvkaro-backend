// Standardized API response helpers for Web & Mobile App (v1)
const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200, meta = null) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    meta: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    },
  });
};

const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errors && { errors }),
    meta: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    },
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
