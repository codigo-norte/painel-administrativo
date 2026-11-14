(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const errorMessage = document.getElementById("login-error");
  const statusMessage = document.getElementById("login-message");
  const submitButton = document.getElementById("login-submit");
  const forgotPasswordButton = document.getElementById("forgot-password");
  const backToLoginButton = document.getElementById("back-to-login");
  const description = document.querySelector(".access-card > p");
  const emailField = document.getElementById("login-email-field");
  const emailInput = document.getElementById("login-email");
  const passwordField = document.getElementById("login-password-field");
  const passwordInput = document.getElementById("login-password");
  const passwordLabel = document.getElementById("login-password-label");
  const confirmPasswordField = document.getElementById("login-confirm-password-field");
  const confirmPasswordInput = document.getElementById("login-confirm-password");
  let inviteToken = null;
  let mode = "login";

  function showError(message) {
    statusMessage.hidden = true;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  function showStatus(message) {
    errorMessage.hidden = true;
    statusMessage.textContent = message;
    statusMessage.hidden = false;
  }

  function clearMessages() {
    errorMessage.hidden = true;
    statusMessage.hidden = true;
  }

  function errorMessageFor(error, fallback) {
    return error && typeof error.message === "string" ? error.message : fallback;
  }

  function showPasswordForm(type, token = null) {
    mode = type;
    inviteToken = type === "invite" ? token : null;
    description.textContent = type === "invite"
      ? "Defina sua senha para ativar a conta administrativa."
      : "Escolha uma nova senha para recuperar seu acesso.";
    emailField.hidden = true;
    emailInput.required = false;
    passwordField.hidden = false;
    passwordInput.required = true;
    passwordInput.value = "";
    passwordLabel.textContent = type === "invite" ? "Defina sua senha" : "Nova senha";
    passwordInput.autocomplete = "new-password";
    confirmPasswordField.hidden = false;
    confirmPasswordInput.required = true;
    confirmPasswordInput.value = "";
    submitButton.textContent = type === "invite" ? "Ativar conta" : "Salvar nova senha";
    forgotPasswordButton.hidden = true;
    backToLoginButton.hidden = true;
    clearMessages();
  }

  function showLoginForm(email = "") {
    mode = "login";
    inviteToken = null;
    description.textContent = "Entre com a conta autorizada para acessar o painel administrativo.";
    emailField.hidden = false;
    emailInput.required = true;
    emailInput.value = email;
    passwordField.hidden = false;
    passwordInput.required = true;
    passwordLabel.textContent = "Senha";
    passwordInput.value = "";
    passwordInput.autocomplete = "current-password";
    confirmPasswordField.hidden = true;
    confirmPasswordInput.required = false;
    confirmPasswordInput.value = "";
    submitButton.textContent = "Entrar";
    forgotPasswordButton.hidden = false;
    backToLoginButton.hidden = true;
    clearMessages();
  }

  function showRecoveryRequestForm() {
    mode = "request";
    inviteToken = null;
    description.textContent = "Informe seu e-mail de acesso. Enviaremos um link para criar uma nova senha.";
    emailField.hidden = false;
    emailInput.required = true;
    passwordField.hidden = true;
    passwordInput.required = false;
    passwordInput.value = "";
    confirmPasswordField.hidden = true;
    confirmPasswordInput.required = false;
    confirmPasswordInput.value = "";
    submitButton.textContent = "Enviar link de recuperação";
    forgotPasswordButton.hidden = true;
    backToLoginButton.hidden = false;
    clearMessages();
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
          showPasswordForm("invite", callback.token);
        } else {
          showError("Este convite é inválido ou expirou. Solicite um novo convite ao administrador.");
        }
        return;
      }
      if (callback && callback.type === "recovery") {
        showPasswordForm("recovery");
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
      if (mode === "request") {
        await window.AdminAuth.requestPasswordRecovery(String(formData.get("email") || "").trim());
        showStatus("Se houver uma conta autorizada com esse e-mail, você receberá um link para definir uma nova senha.");
        return;
      }

      if (mode === "invite" || mode === "recovery") {
        const confirmation = String(formData.get("confirm-password") || "");
        if (password !== confirmation) {
          showError("As senhas não coincidem. Confira os dois campos.");
          return;
        }
      }

      const user = mode === "invite"
        ? await window.AdminAuth.acceptInvite(inviteToken, password)
        : mode === "recovery"
          ? await window.AdminAuth.updateUser({ password })
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
      showError(mode === "invite"
        ? inviteErrorMessage(error)
        : errorMessageFor(error, mode === "recovery"
          ? "Não foi possível alterar a senha. O link pode ter expirado; solicite outro."
          : "Não foi possível entrar. Verifique suas credenciais e tente novamente."));
    } finally {
      submitButton.disabled = false;
    }
  });

  forgotPasswordButton.addEventListener("click", showRecoveryRequestForm);
  backToLoginButton.addEventListener("click", () => showLoginForm(emailInput.value));

  initialize();
})();
