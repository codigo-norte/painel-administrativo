(function () {
  "use strict";

  const endpoint = (resource) => `/.netlify/functions/${resource}`;

  async function request(resource, options = {}) {
    let response;
    try {
      response = await window.fetch(endpoint(resource), {
        method: options.method || "GET",
        headers: options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {},
        credentials: "same-origin",
        body: options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined
      });
    } catch {
      throw new Error("Não foi possível conectar às funções do Netlify. Verifique a conexão e tente novamente.");
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("A API retornou uma resposta inválida.");
    }
    if (!response.ok) {
      throw new Error(payload && payload.error && payload.error.message
        ? payload.error.message
        : `A requisição falhou (HTTP ${response.status}).`);
    }
    return payload.data;
  }

  window.AdminDataSource = {
    async load() {
      const [products, categories, company, account] = await Promise.all([
        request("products?view=admin"),
        request("categories?view=admin"),
        request("company"),
        request("account")
      ]);
      if (!Array.isArray(products) || !Array.isArray(categories) || !company || !account) {
        throw new Error("A API retornou dados incompatíveis com o painel.");
      }
      return { version: 1, products, categories, company, account };
    },

    saveProduct(product, isNew) {
      return request("products", {
        method: isNew ? "POST" : "PUT",
        body: product
      });
    },

    deleteProduct(id) {
      return request(`products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    saveCategory(category, isNew) {
      return request("categories", {
        method: isNew ? "POST" : "PUT",
        body: category
      });
    },

    deleteCategory(id) {
      return request(`categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    getVisitStats({ days }) {
      return request(`visits?days=${encodeURIComponent(days)}`);
    },

    getImages() {
      return request("images");
    },

    uploadImage(file) {
      const body = new FormData();
      body.set("image", file);
      return request("images", { method: "POST", body });
    },

    deleteImage(id) {
      return request(`images?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    saveCompany(company) {
      return request("company", { method: "PUT", body: company });
    },

    saveAccount(account) {
      return request("account", { method: "PUT", body: account });
    }
  };
})();
