function notFound(req, res, next) {
  const err = new Error("We couldn't find the page you were looking for.");
  err.status = 404;
  next(err);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed ObjectIds in URLs are just "not found".
  if (err.name === "CastError") {
    err.status = 404;
    err.message = "We couldn't find what you were looking for.";
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);

  const message = status >= 500 && process.env.NODE_ENV === "production"
    ? "Something went wrong on our side. Please try again in a moment."
    : err.message;

  res.status(status).render("error", {
    title: status === 404 ? "Page not found" : "Something went wrong",
    status,
    message,
    signedIn: Boolean(req.session && req.session.userId),
  });
}

module.exports = { notFound, errorHandler };
