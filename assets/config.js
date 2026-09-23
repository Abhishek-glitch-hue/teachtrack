(() => {
  const configuredOrigin = window.TEACHTRACK_API_ORIGIN;
  const localOrigin = 'https://teachtrack-1lp2.onrender.com';
  const origin = typeof configuredOrigin === 'string' && configuredOrigin.trim()
    ? configuredOrigin.trim()
    : localOrigin;

  window.TEACHTRACK_API_ORIGIN = origin.replace(/\/+$/, '');

  if (document.currentScript?.dataset.loadSocket === 'true') {
    document.write('<script src="' + window.TEACHTRACK_API_ORIGIN + '/socket.io/socket.io.js"><\/script>');
  }
})();
