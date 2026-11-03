(function () {
  "use strict";

  const pageTitles = {
    overview: ["Visão Geral", "Aqui está um resumo do seu site."],
    products: ["Produtos e Serviços", "Gerencie o catálogo do seu site."],
    categories: ["Categorias", "Organize produtos e serviços."],
    images: ["Imagens", "Gerenciamento de imagens."],
    company: ["Informações da Empresa", "Gerencie os dados públicos da empresa."],
    account: ["Minha Conta", "Atualize os dados do seu perfil."]
  };
  const validPages = new Set(Object.keys(pageTitles));

  const dataSource = window.AdminDataSource;
  const pageContent = document.getElementById("page-content");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const storageError = document.getElementById("storage-error");
  const sidebar = document.getElementById("sidebar");
  const sidebarScrim = document.getElementById("sidebar-scrim");
  const menuToggle = document.getElementById("menu-toggle");
  let state;
  let currentPage = "overview";
  let filters = { search: "", status: "all" };
  let visitRequestId = 0;

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.setAttribute("role", isError ? "alert" : "status");
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarScrim.classList.remove("visible");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  function setPage(page, updateHash) {
    currentPage = validPages.has(page) ? page : "overview";
    if (updateHash && window.location.hash !== `#${currentPage}`) {
      window.location.hash = currentPage;
      return;
    }
    const [title, subtitle] = pageTitles[currentPage];
    document.title = `${title} | Painel administrativo`;
    document.getElementById("page-subtitle").textContent = subtitle;
    document.getElementById("greeting").textContent = `Olá, ${state.account.name || "Administrador"}!`;
    document.getElementById("account-shortcut").textContent = (state.account.name.trim()[0] || "A").toLocaleUpperCase("pt-BR");
    document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
      const active = link.dataset.page === currentPage;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    pageContent.innerHTML = window.AdminPages.render(currentPage, state, filters);
    if (currentPage === "overview") {
      refreshVisitStats();
    }
  }

  function normalizeVisitStats(points, days) {
    if (!Array.isArray(points)) {
      throw new Error("A resposta de acessos precisa ser uma lista de registros diários.");
    }
    const normalized = points.map((point) => {
      if (!point || typeof point.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)) {
        throw new Error("Cada registro de acesso precisa ter uma data no formato AAAA-MM-DD.");
      }
      const date = new Date(`${point.date}T12:00:00`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== point.date) {
        throw new Error(`Data inválida recebida nas métricas: ${point.date}.`);
      }
      if (!Number.isInteger(point.visits) || point.visits < 0) {
        throw new Error(`O número de acessos de ${point.date} precisa ser um inteiro igual ou maior que zero.`);
      }
      return { date: point.date, visits: point.visits };
    }).sort((a, b) => a.date.localeCompare(b.date));
    if (new Set(normalized.map((point) => point.date)).size !== normalized.length) {
      throw new Error("A resposta de acessos contém mais de um registro para o mesmo dia.");
    }
    return normalized.slice(-days);
  }

  async function refreshVisitStats() {
    const chart = document.getElementById("visit-chart");
    const period = document.getElementById("visit-period");
    const errorElement = document.getElementById("visit-chart-error");
    if (!chart || !period || !errorElement) return;
    const days = Number(period.value);
    const requestId = ++visitRequestId;
    document.getElementById("visit-period-title").textContent = String(days);
    errorElement.hidden = true;
    errorElement.textContent = "";
    if (typeof dataSource.getVisitStats !== "function") {
      chart.innerHTML = window.AdminPages.renderVisitChart([], days);
      return;
    }
    chart.setAttribute("aria-busy", "true");
    try {
      const points = await dataSource.getVisitStats({ days });
      if (requestId !== visitRequestId || currentPage !== "overview") return;
      chart.innerHTML = window.AdminPages.renderVisitChart(normalizeVisitStats(points, days), days);
    } catch (error) {
      if (requestId !== visitRequestId || currentPage !== "overview") return;
      chart.innerHTML = window.AdminPages.renderVisitChart([], days);
      errorElement.innerHTML = `${window.AdminPages.escapeHtml(error.message || "Não foi possível carregar as métricas.")} <button class="text-link" type="button" data-action="retry-visit-stats">Tentar novamente</button>`;
      errorElement.hidden = false;
    } finally {
      if (requestId === visitRequestId) chart.removeAttribute("aria-busy");
    }
  }

  async function commit(nextState, successMessage) {
    try {
      await dataSource.save(nextState);
    } catch (error) {
      showToast(error.message, true);
      return false;
    }
    state = nextState;
    renderCurrentPage();
    showToast(successMessage);
    return true;
  }

  function renderCurrentPage() {
    setPage(currentPage, false);
  }

  function nextId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function showModal(title, description, body, focusSelector) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="backdrop-close">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header class="modal-header">
            <div><h2 id="modal-title">${window.AdminPages.escapeHtml(title)}</h2><p>${window.AdminPages.escapeHtml(description)}</p></div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="Fechar">×</button>
          </header>
          <div class="modal-content">${body}</div>
        </section>
      </div>`;
    document.body.classList.add("modal-open");
    const focusTarget = modalRoot.querySelector(focusSelector || "input, select, button");
    if (focusTarget) focusTarget.focus();
  }

  function openProductModal(product = null) {
    const editing = Boolean(product);
    const categoryOptions = state.categories.map((category) => `
      <option value="${window.AdminPages.escapeHtml(category.id)}" ${product && product.categoryId === category.id ? "selected" : ""}>${window.AdminPages.escapeHtml(category.name)}</option>`
    ).join("");
    const form = `
      <form data-form="product" data-id="${product ? window.AdminPages.escapeHtml(product.id) : ""}">
        <div class="form-grid">
          <div class="form-field form-field-full"><label for="product-name">Nome *</label><input id="product-name" name="name" required maxlength="100" value="${window.AdminPages.escapeHtml(product ? product.name : "")}" placeholder="Ex.: Furadeira de Impacto"></div>
          <div class="form-field"><label for="product-category">Categoria</label><select id="product-category" name="categoryId"><option value="">Sem categoria</option>${categoryOptions}</select>${state.categories.length ? "" : '<span class="field-hint">Cadastre categorias na seção correspondente.</span>'}</div>
          <div class="form-field"><label for="product-price">Preço (R$) *</label><input id="product-price" name="price" type="number" min="0" max="999999999" step="0.01" required value="${product ? window.AdminPages.escapeHtml(product.price) : ""}" placeholder="0,00"></div>
          <div class="form-field"><label for="product-status">Status</label><select id="product-status" name="status"><option value="active" ${!product || product.status === "active" ? "selected" : ""}>Ativo</option><option value="inactive" ${product && product.status === "inactive" ? "selected" : ""}>Inativo</option></select></div>
          <div class="form-field form-field-full"><label for="product-description">Descrição</label><textarea id="product-description" name="description" maxlength="500" placeholder="Descreva o produto ou serviço...">${window.AdminPages.escapeHtml(product ? product.description : "")}</textarea><span class="field-hint">Até 500 caracteres.</span></div>
        </div>
        <div class="form-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancelar</button><button class="button" type="submit">${editing ? "Salvar alterações" : "Cadastrar produto"}</button></div>
      </form>`;
    showModal(editing ? "Editar produto ou serviço" : "Novo produto ou serviço", "Preencha os dados que serão usados no catálogo.", form, "#product-name");
  }

  function openCategoryModal(category = null) {
    const editing = Boolean(category);
    const form = `
      <form data-form="category" data-id="${category ? window.AdminPages.escapeHtml(category.id) : ""}">
        <div class="form-grid">
          <div class="form-field form-field-full"><label for="category-name">Nome *</label><input id="category-name" name="name" required maxlength="80" value="${window.AdminPages.escapeHtml(category ? category.name : "")}" placeholder="Ex.: Ferramentas"></div>
          <div class="form-field form-field-full"><label for="category-description">Descrição</label><textarea id="category-description" name="description" maxlength="300" placeholder="Descreva esta categoria...">${window.AdminPages.escapeHtml(category ? category.description : "")}</textarea></div>
        </div>
        <div class="form-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancelar</button><button class="button" type="submit">${editing ? "Salvar alterações" : "Criar categoria"}</button></div>
      </form>`;
    showModal(editing ? "Editar categoria" : "Nova categoria", "Use um nome simples para facilitar a organização do catálogo.", form, "#category-name");
  }

  function uniqueName(items, name, currentId) {
    const normalized = name.trim().toLocaleLowerCase("pt-BR");
    return items.some((item) => item.id !== currentId && item.name.trim().toLocaleLowerCase("pt-BR") === normalized);
  }

  async function handleProductSubmit(form) {
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const price = Number(values.get("price"));
    const categoryId = String(values.get("categoryId") || "");
    const id = form.dataset.id;
    if (!name || !Number.isFinite(price) || price < 0) {
      showToast("Informe um nome e um preço válido para o produto.", true);
      return;
    }
    if (categoryId && !state.categories.some((category) => category.id === categoryId)) {
      showToast("A categoria selecionada não existe mais. Atualize o formulário.", true);
      return;
    }
    const item = {
      id: id || nextId("product"),
      name,
      categoryId,
      price,
      description: String(values.get("description") || "").trim(),
      status: values.get("status") === "inactive" ? "inactive" : "active"
    };
    const nextProducts = id
      ? state.products.map((product) => product.id === id ? item : product)
      : [item, ...state.products];
    if (id && !state.products.some((product) => product.id === id)) {
      showToast("Este produto não foi encontrado. Atualize a página e tente novamente.", true);
      return;
    }
    if (await commit({ ...state, products: nextProducts }, id ? "Produto atualizado." : "Produto cadastrado.")) closeModal();
  }

  async function handleCategorySubmit(form) {
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const id = form.dataset.id;
    if (!name) {
      showToast("Informe o nome da categoria.", true);
      return;
    }
    if (uniqueName(state.categories, name, id)) {
      showToast("Já existe uma categoria com esse nome.", true);
      return;
    }
    const category = { id: id || nextId("category"), name, description: String(values.get("description") || "").trim() };
    const nextCategories = id
      ? state.categories.map((item) => item.id === id ? category : item)
      : [...state.categories, category];
    if (id && !state.categories.some((item) => item.id === id)) {
      showToast("Esta categoria não foi encontrada. Atualize a página e tente novamente.", true);
      return;
    }
    if (await commit({ ...state, categories: nextCategories }, id ? "Categoria atualizada." : "Categoria criada.")) closeModal();
  }

  async function handleCompanySubmit(form) {
    const values = new FormData(form);
    const company = {
      name: String(values.get("name") || "").trim(),
      website: String(values.get("website") || "").trim(),
      email: String(values.get("email") || "").trim(),
      phone: String(values.get("phone") || "").trim(),
      address: String(values.get("address") || "").trim(),
      about: String(values.get("about") || "").trim()
    };
    await commit({ ...state, company }, "Informações da empresa salvas.");
  }

  async function handleAccountSubmit(form) {
    const values = new FormData(form);
    const account = {
      name: String(values.get("name") || "").trim(),
      email: String(values.get("email") || "").trim()
    };
    if (!account.name) {
      showToast("Informe o nome do perfil.", true);
      return;
    }
    await commit({ ...state, account }, "Perfil atualizado.");
  }

  function updateProductResults() {
    const query = filters.search.trim().toLocaleLowerCase("pt-BR");
    const products = state.products.filter((product) => {
      const category = state.categories.find((item) => item.id === product.categoryId);
      const searchable = `${product.name} ${category ? category.name : ""} ${product.description}`.toLocaleLowerCase("pt-BR");
      return searchable.includes(query) && (filters.status === "all" || product.status === filters.status);
    });
    document.getElementById("product-table").innerHTML = window.AdminPages.renderProductTable(products, state, Boolean(query) || filters.status !== "all");
  }

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const actionElement = target.closest("[data-action]");
    const routeElement = target.closest("[data-route]");
    if (routeElement) {
      event.preventDefault();
      setPage(routeElement.dataset.route, true);
      closeSidebar();
      return;
    }
    if (!actionElement) return;
    const { action, id } = actionElement.dataset;
    if (action === "close-modal") closeModal();
    if (action === "backdrop-close" && target === actionElement) closeModal();
    if (action === "new-product") openProductModal();
    if (action === "new-category") openCategoryModal();
    if (action === "retry-visit-stats") refreshVisitStats();
    if (action === "edit-product") {
      const product = state.products.find((item) => item.id === id);
      if (product) openProductModal(product);
      else showToast("Produto não encontrado.", true);
    }
    if (action === "edit-category") {
      const category = state.categories.find((item) => item.id === id);
      if (category) openCategoryModal(category);
      else showToast("Categoria não encontrada.", true);
    }
    if (action === "delete-product") {
      const product = state.products.find((item) => item.id === id);
      if (!product) return showToast("Produto não encontrado.", true);
      if (window.confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) {
        await commit({ ...state, products: state.products.filter((item) => item.id !== id) }, "Produto excluído.");
      }
    }
    if (action === "delete-category") {
      const category = state.categories.find((item) => item.id === id);
      if (!category) return showToast("Categoria não encontrada.", true);
      const hasProducts = state.products.some((product) => product.categoryId === id);
      if (hasProducts) return showToast("Não é possível excluir: remova ou reclassifique os produtos desta categoria primeiro.", true);
      if (window.confirm(`Excluir a categoria "${category.name}"?`)) {
        await commit({ ...state, categories: state.categories.filter((item) => item.id !== id) }, "Categoria excluída.");
      }
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "product") await handleProductSubmit(form);
    if (form.dataset.form === "category") await handleCategorySubmit(form);
    if (form.dataset.form === "company") await handleCompanySubmit(form);
    if (form.dataset.form === "account") await handleAccountSubmit(form);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "product-search") return;
    filters.search = event.target.value;
    updateProductResults();
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "visit-period") {
      refreshVisitStats();
      return;
    }
    if (event.target.id !== "product-status") return;
    filters.status = event.target.value;
    updateProductResults();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalRoot.firstElementChild) closeModal();
  });

  window.addEventListener("hashchange", () => {
    setPage(window.location.hash.slice(1), false);
    closeSidebar();
  });

  menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    sidebarScrim.classList.toggle("visible", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
  sidebarScrim.addEventListener("click", closeSidebar);
  document.getElementById("account-shortcut").addEventListener("click", () => setPage("account", true));

  async function initialize() {
    try {
      state = await dataSource.load();
    } catch (error) {
      storageError.hidden = false;
      storageError.textContent = `${error.message} O painel não iniciou para evitar substituir seus dados.`;
      pageContent.innerHTML = `<section class="panel"><div class="empty-state"><div class="empty-icon" aria-hidden="true">!</div><h3>Não foi possível abrir o painel</h3><p>Corrija o acesso ao armazenamento local e recarregue a página. Seus dados não foram alterados.</p></div></section>`;
      return;
    }
    setPage(window.location.hash.slice(1) || "overview", false);
  }
  initialize();
})();
