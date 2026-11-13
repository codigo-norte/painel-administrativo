(function () {
  "use strict";

  const script = document.currentScript;
  if (!script || !script.src) return;

  const endpoint = new URL("/.netlify/functions/visits", script.src);
  window.fetch(endpoint, { method: "POST", keepalive: true })
    .then((response) => {
      if (!response.ok) console.warn("Não foi possível registrar o acesso ao site.", response.status);
    })
    .catch((error) => console.warn("Não foi possível registrar o acesso ao site.", error));
})();
