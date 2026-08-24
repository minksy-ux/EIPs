// Pure helpers for the author profile page (author.html), factored out so
// they can be unit tested with plain Node in addition to running in-browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AuthorProfile = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var HANDLE_RE = /\(@([A-Za-z0-9-]+)\)/g;

  function handlesIn(authorField) {
    var handles = [];
    var match;
    HANDLE_RE.lastIndex = 0;
    while ((match = HANDLE_RE.exec(authorField || '')) !== null) {
      handles.push(match[1].toLowerCase());
    }
    return handles;
  }

  function eipsForHandle(eips, handle) {
    var needle = (handle || '').trim().replace(/^@/, '').toLowerCase();
    if (!needle) return [];
    return (eips || []).filter(function (page) {
      return handlesIn(page && page.author).indexOf(needle) !== -1;
    });
  }

  return { handlesIn: handlesIn, eipsForHandle: eipsForHandle };
});
