import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
} from "@netlify/identity";

window.AdminAuth = {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  isAdmin(user) {
    return Boolean(user && Array.isArray(user.roles) && user.roles.includes("admin"));
  }
};
