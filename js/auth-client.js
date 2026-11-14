import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
} from "@netlify/identity";

window.AdminAuth = {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
  isAdmin(user) {
    return Boolean(user && Array.isArray(user.roles) && user.roles.includes("admin"));
  }
};
