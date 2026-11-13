(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const errorMessage = document.getElementById("login-error");
  const submitButton = document.getElementById("login-submit");
  const description = document.querySelector(".access-card > p");
  const emailField = document.getElementById("login-email-field");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const passwordLabel = document.getElementById("login-password-label");
  let inviteToken = null;

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  function errorMessageFor(error, fallback) {
    return error && typeof error.message === "string" ? error.message : fallback;
  }

  function showInviteForm(token) {
    inviteToken = token;
    description.textContent = "Defina sua senha para ativar a conta administrativa.";
    emailField.hidden = true;
    emailInput.required = false;
    passwordLabel.textContent = "Defina sua senha";
    passwordInput.autocomplete = "new-password";
    submitButton.textContent = "Ativar conta";
  }

  function showLoginForm(email = "") {
    inviteToken = null;
    description.textContent = "Entre com a conta autorizada para acessar o painel administrativo.";
    emailField.hidden = false;
    emailInput.required = true;
    emailInput.value = email;
    passwordLabel.textContent = "Senha";
    passwordInput.value = "";
    passwordInput.autocomplete = "current-password";
    submitButton.textContent = "Entrar";
  }

  function inviteErrorMessage(error) {
    const message = error && typeof error.message === "string" ? error.message : "";
    if (/invite|invitation|token|expired|invalid|already (?:been )?(?:used|accepted|registered|confirmed)/i.test(message)) {
      return "Este convite é inválido, expirou ou já foi utilizado. Solicite um novo convite ao administrador.";
    }
    return errorMessageFor(error, "Não foi possível ativar a conta. Tente novamente ou solicite um novo convite.");
  }

  async function initialize() {
    try {
      const callback = await window.AdminAuth.handleAuthCallback();
      if (callback && callback.type === "invite") {
        if (callback.token) {
          showInviteForm(callback.token);
        } else {
          showError("Este convite é inválido ou expirou. Solicite um novo convite ao administrador.");
        }
        return;
      }

      const user = await window.AdminAuth.getUser();
      if (window.AdminAuth.isAdmin(user)) {
        window.location.replace("index.html");
      } else if (user) {
        await window.AdminAuth.logout();
        showError("Esta conta não está autorizada a acessar o painel.");
      }
    } catch (error) {
      showError(errorMessageFor(
        error,
        "Não foi possível validar o link de acesso. Ele pode ser inválido, expirado ou já utilizado.",
      ));
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    submitButton.disabled = true;

    const formData = new FormData(form);
    try {
      const password = String(formData.get("password") || "");
      const user = inviteToken
        ? await window.AdminAuth.acceptInvite(inviteToken, password)
        : await window.AdminAuth.login(
          String(formData.get("email") || "").trim(),
          password,
        );
      if (!window.AdminAuth.isAdmin(user)) {
        await window.AdminAuth.logout();
        const invitedEmail = user && typeof user.email === "string" ? user.email : "";
        showLoginForm(invitedEmail);
        showError(
          "A conta foi ativada, mas não tem autorização de administrador. Solicite que o administrador revise o convite.",
        );
        return;
      }
      window.location.replace("index.html");
    } catch (error) {
      showError(inviteToken
        ? inviteErrorMessage(error)
        : errorMessageFor(error, "Não foi possível entrar. Verifique suas credenciais e tente novamente."));
    } finally {
      submitButton.disabled = false;
    }
  });

  initialize();
})();
