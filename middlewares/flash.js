// One-shot messages and form input that survive a single redirect.
function flash(req, res, next) {
  res.locals.flash = req.session.flash || [];
  res.locals.old = req.session.old || {};
  delete req.session.flash;
  delete req.session.old;

  req.flash = (type, message) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };

  // Remember submitted fields (never passwords) so a failed form can be refilled.
  req.keepInput = (fields) => {
    const old = {};
    for (const key of Object.keys(fields)) {
      if (!/password|_csrf/i.test(key)) old[key] = fields[key];
    }
    req.session.old = old;
  };

  next();
}

module.exports = flash;
