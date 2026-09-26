/**
 * Central error formatter. The frontend's axios interceptor
 * (src/api/client.js:24) reads `err.response.data.error` and the login/signup
 * pages render `err.message` directly into the DOM, so every failure must
 * arrive as { error: { code, message } } with a human-readable message and
 * never a stack trace or raw driver output.
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.expected = true;
  }

  static badRequest(message) {
    return new ApiError(400, 'validation_error', message);
  }

  static invalidCredentials(message = 'That email and password combination does not match an account.') {
    return new ApiError(401, 'invalid_credentials', message);
  }

  static unauthorized(message = 'Please log in to continue.') {
    return new ApiError(401, 'unauthorized', message);
  }

  static emailTaken() {
    return new ApiError(409, 'email_taken', 'An account with that email already exists. Try logging in instead.');
  }

  static notFound(message = 'We could not find what you were looking for.') {
    return new ApiError(404, 'not_found', message);
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route matches ${req.method} ${req.originalUrl}.` },
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'server_error';
  let message = 'Something went wrong on our end. Please try again.';

  if (err instanceof ApiError) {
    ({ status, code, message } = err);
  } else if (err?.name === 'ValidationError' && err.errors) {
    // Surface the first schema message so it matches what the user just typed.
    status = 400;
    code = 'validation_error';
    message = Object.values(err.errors)[0]?.message || message;
  } else if (err?.code === 11000) {
    // Duplicate key — in practice an email collision from the unique index.
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    status = 409;
    code = field === 'email' ? 'email_taken' : 'duplicate_key';
    message =
      field === 'email'
        ? ApiError.emailTaken().message
        : `That ${field} is already in use.`;
  } else if (err?.name === 'MongooseServerSelectionError' || err?.name === 'MongoNetworkError') {
    status = 503;
    code = 'database_unavailable';
    message = 'We could not reach the database. Please try again in a moment.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'malformed_json';
    message = 'That request was not valid JSON.';
  } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    status = err.status;
    code = err.code || 'request_error';
    message = err.message || message;
  }

  if (status >= 500) {
    // Log server-side only; the client gets the generic message above.
    console.error('[error]', err);
  }

  res.status(status).json({ error: { code, message } });
}

export default errorHandler;
