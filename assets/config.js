(() => {
  const configuredOrigin = window.TEACHTRACK_API_ORIGIN;
  const localOrigin = 'http://localhost:4000';
  const origin = typeof configuredOrigin === 'string' && configuredOrigin.trim()
    ? configuredOrigin.trim()
    : localOrigin;

  window.TEACHTRACK_API_ORIGIN = origin.replace(/\/+$/, '');

  if (document.currentScript?.dataset.loadSocket === 'true') {
    document.write('<script src="' + window.TEACHTRACK_API_ORIGIN + '/socket.io/socket.io.js"><\/script>');
  }
})();
