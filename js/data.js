(function () {
  "use strict";

  const STORAGE_KEY = "painel-administrativo:data:v1";

  const createInitialState = () => ({
    version: 1,
    products: [],
    categories: [],
    company: { name: "", website: "", email: "", phone: "", address: "", about: "" },
    account: { name: "Administrador", email: "" }
  });

  // A backend adapter can optionally implement getVisitStats({ days }) returning
  // [{ date: "YYYY-MM-DD", visits: 0 }], with days set to 7, 30, or 90.
  window.AdminDataSource = window.AdminDataSource || {
    async load() {
      let saved;
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        throw new Error(`Não foi possível acessar o armazenamento local: ${error.message}`);
      }
      if (saved === null) {
        const initialState = createInitialState();
        await this.save(initialState);
        return initialState;
      }
      let parsed;
      try {
        parsed = JSON.parse(saved);
      } catch (error) {
        throw new Error(`Os dados salvos estão inválidos e não puderam ser lidos: ${error.message}`);
      }
      if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
        throw new Error("O formato dos dados salvos não é compatível com esta versão do painel.");
      }
      const defaults = createInitialState();
      return {
        ...defaults,
        ...parsed,
        products: Array.isArray(parsed.products)
          ? parsed.products
              .filter((product) => !["product-1", "product-2", "product-3"].includes(product.id))
              .map((product) => ["category-1", "category-2", "category-3"].includes(product.categoryId) ? { ...product, categoryId: "" } : product)
          : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories.filter((category) => !["category-1", "category-2", "category-3"].includes(category.id)) : [],
        company: { ...defaults.company, ...(parsed.company || {}) },
        account: { ...defaults.account, ...(parsed.account || {}) }
      };
    },
    async save(nextState) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch (error) {
        throw new Error(`Não foi possível salvar neste dispositivo: ${error.message}`);
      }
    }
  };
})();
