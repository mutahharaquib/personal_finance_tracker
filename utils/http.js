// Where to send the user after a form post: the `_back` field the form carried
// (only same-site paths), else the fallback.
function backTo(req, fallback) {
  const back = req.body && req.body._back;
  return typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : fallback;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function notFoundError(what = "That item") {
  const err = new Error(`${what} doesn't exist or was already deleted.`);
  err.status = 404;
  return err;
}

module.exports = { backTo, escapeRegex, notFoundError };
