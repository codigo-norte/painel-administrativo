(function () {
  "use strict";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const currency = (value) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);

  const heading = (title, description, action = "") => `
    <div class="page-heading">
      <div><h1>${title}</h1><p>${description}</p></div>
      ${action ? `<div class="heading-actions">${action}</div>` : ""}
    </div>`;

  const emptyState = (icon, title, description, action = "") => `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h3>${title}</h3>
      <p>${description}</p>
      ${action}
    </div>`;

  function visitChart(points = [], days = 30) {
    const width = 640;
    const height = 220;
    const margin = { top: 16, right: 16, bottom: 38, left: 52 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxVisits = Math.max(0, ...points.map((point) => point.visits));
    const rawStep = maxVisits > 0 ? maxVisits / 4 : 0;
    const magnitude = rawStep > 0 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1;
    const normalizedStep = rawStep / magnitude;
    const stepMultiplier = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10;
    const axisMax = rawStep > 0 ? stepMultiplier * magnitude : 0;
    const scaleMax = axisMax > 0 ? axisMax * 4 : 1;
    const chartLength = points.length || days;
    const x = (index) => margin.left + (chartLength <= 1 ? plotWidth / 2 : (index / (chartLength - 1)) * plotWidth);
    const y = (value) => margin.top + plotHeight - (value / scaleMax) * plotHeight;
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = axisMax * (4 - index);
      const gridY = margin.top + (plotHeight / 4) * index;
      const axisLabel = points.length || index === 4
        ? `<text x="${margin.left - 9}" y="${gridY + 4}" text-anchor="end" class="chart-axis-label">${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}</text>`
        : "";
      return `<g><line x1="${margin.left}" y1="${gridY}" x2="${width - margin.right}" y2="${gridY}" class="chart-grid-line"/>${axisLabel}</g>`;
    }).join("");
    const labels = Array.from(new Set([0, Math.floor((chartLength - 1) / 2), chartLength - 1])).map((index) => {
          const date = points.length
            ? new Date(`${points[index].date}T12:00:00`)
            : new Date(new Date().setHours(12, 0, 0, 0) - (chartLength - 1 - index) * 86400000);
          const label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
          return `<text x="${x(index)}" y="${height - 11}" text-anchor="middle" class="chart-axis-label">${label}</text>`;
        }).join("")
    const linePath = points.length
      ? points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.visits)}`).join(" ")
      : `M ${x(0)} ${y(0)} L ${x(chartLength - 1)} ${y(0)}`;
    const areaPath = points.length > 1
      ? `${linePath} L ${x(points.length - 1)} ${margin.top + plotHeight} L ${x(0)} ${margin.top + plotHeight} Z`
      : "";
    const circles = points.map((point, index) => {
      const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${point.date}T12:00:00`));
      const visits = new Intl.NumberFormat("pt-BR").format(point.visits);
      return `<circle cx="${x(index)}" cy="${y(point.visits)}" r="3.5" class="chart-point"><title>${escapeHtml(date)}: ${visits} acessos</title></circle>`;
    }).join("");
    const total = points.reduce((sum, point) => sum + point.visits, 0);
    const summary = points.length
      ? `<span class="chart-total">${new Intl.NumberFormat("pt-BR").format(total)} acessos</span>`
      : `<span class="chart-total muted" id="visit-summary">Aguardando dados de acesso</span>`;
    const visual = `<svg class="visit-chart-svg${points.length ? "" : " is-empty"}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="visit-chart-title visit-chart-description" preserveAspectRatio="none">
        <title id="visit-chart-title">Acessos ao site no período selecionado</title>
        <desc id="visit-chart-description">${points.length ? `${new Intl.NumberFormat("pt-BR").format(total)} acessos distribuídos em ${points.length} dias.` : "Gráfico sem dados de acesso, com a linha de referência no zero."}</desc>
        ${grid}${areaPath ? `<path d="${areaPath}" class="chart-area"/>` : ""}<path d="${linePath}" class="chart-line"/>${circles}${labels}
      </svg>`;
    return `<div class="visit-chart-wrap">${summary}${visual}</div>`;
  }

  function overview(state) {
    const activeProducts = state.products.filter((item) => item.status === "active").length;
    let websiteUrl = "";
    try {
      const candidate = new URL(state.company.website);
      if (candidate.protocol === "https:" || candidate.protocol === "http:") {
        websiteUrl = candidate.href;
      }
    } catch {
      websiteUrl = "";
    }
    const recent = [...state.products].slice(0, 3);
    const recentRows = recent.length
      ? `<table class="recent-table"><tbody>${recent.map((product) => `
          <tr>
            <td><span class="recent-name">${escapeHtml(product.name)}</span><br><span class="muted">${escapeHtml(state.categories.find((category) => category.id === product.categoryId)?.name || "Sem categoria")}</span></td>
            <td class="money">${currency(product.price)}</td>
            <td><span class="status-pill ${product.status === "active" ? "" : "inactive"}">${product.status === "active" ? "Ativo" : "Inativo"}</span></td>
            <td><button class="icon-action" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}" aria-label="Editar ${escapeHtml(product.name)}">✎</button></td>
            <td><button class="icon-action danger" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}" aria-label="Excluir ${escapeHtml(product.name)}">×</button></td>
          </tr>`).join("")}</tbody></table>`
      : emptyState("◇", "Adicione seu próximo produto", "Os produtos e serviços cadastrados serão exibidos aqui.", '<button class="button button-small" type="button" data-action="new-product">＋ Adicionar produto</button>');

    return `
      ${heading("Visão Geral", "Acompanhe e atualize as principais informações do seu site.")}
      <div class="stats-grid">
        <article class="panel stat-card"><div class="stat-icon">◇</div><div class="stat-copy"><strong>${state.products.length}</strong><span>Produtos e serviços</span><small>${activeProducts} ativos</small></div></article>
        <article class="panel stat-card"><div class="stat-icon violet">▦</div><div class="stat-copy"><strong>${state.categories.length}</strong><span>Categorias</span><small>Organização do catálogo</small></div></article>
        <article class="panel stat-card"><div class="stat-icon green">▧</div><div class="stat-copy"><strong>0</strong><span>Imagens</span><small>Gerenciamento desativado nesta versão</small></div></article>
        <article class="panel stat-card"><div class="stat-icon amber">◷</div><div class="stat-copy"><strong>Local</strong><span>Armazenamento</span><small>Salvo neste dispositivo</small></div></article>
      </div>
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-header">
            <div><h2>▥ &nbsp;Acessos nos últimos <span id="visit-period-title">30</span> dias</h2><p>Estatísticas de visitação</p></div>
            <label class="chart-period-label"><span class="sr-only">Período do gráfico de acessos</span><select id="visit-period" class="select-control"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
          </div>
          <div id="visit-chart">${visitChart([], 30)}</div>
          <div class="chart-error" id="visit-chart-error" role="status" hidden></div>
        </section>
        <section class="panel site-status">
          <div class="site-status-content">
            <h2><svg class="site-status-rocket" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 4.1c2.2-1.6 4.8-1.8 6.1-1.8 0 1.4-.2 4-1.8 6.2l-4.1 5.2-5.3-5.3 5.1-4.3Z" fill="currentColor"/><path d="m9.2 8.3-4.5.8-2.2 2.2 5.5 1.1m5.7 2.2-.8 4.5-2.2 2.2-1.1-5.5M7.1 15.1c-1.7.2-2.7 1.5-3 3.8 2.3-.3 3.6-1.3 3.8-3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><circle cx="16.3" cy="7.5" r="1.5" fill="#fff"/></svg>Seu site, do seu jeito</h2>
            <p>Atualize as informações da empresa e mantenha seu catálogo organizado.</p>
            ${websiteUrl
              ? `<a class="button" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Seu site <span aria-hidden="true">↗</span></a>`
              : '<button class="button" type="button" data-route="company">Seu site</button>'}
          </div>
          <svg class="site-status-laptop" viewBox="0 0 250 170" role="img" aria-label="Ilustração de um site aberto em um notebook">
            <defs>
              <linearGradient id="laptop-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#eaf5fb"/></linearGradient>
              <linearGradient id="laptop-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#70899a"/><stop offset="1" stop-color="#435f72"/></linearGradient>
            </defs>
            <ellipse cx="136" cy="151" rx="98" ry="8" fill="#a9c5d5" opacity=".45"/>
            <path d="M79 24a7 7 0 0 1 7-7h112a7 7 0 0 1 7 7v83H79V24Z" fill="#18374a"/>
            <rect x="86" y="24" width="112" height="73" rx="3" fill="url(#laptop-screen)"/>
            <rect x="93" y="31" width="35" height="8" rx="2" fill="#d8eaf4"/>
            <rect x="93" y="45" width="41" height="35" rx="4" fill="#d7ecf8"/>
            <path d="m98 72 9-11 6 6 5-4 9 10H98Z" fill="#8bbfe0"/>
            <circle cx="105" cy="53" r="4" fill="#fff"/>
            <rect x="140" y="47" width="48" height="5" rx="2.5" fill="#8bb6ce"/>
            <rect x="140" y="58" width="39" height="4" rx="2" fill="#c1d9e7"/>
            <rect x="140" y="68" width="43" height="4" rx="2" fill="#c1d9e7"/>
            <rect x="140" y="79" width="27" height="10" rx="3" fill="#087eae"/>
            <path d="M68 107h147l16 30c1 3-2 6-7 6H49c-5 0-8-3-7-6l18-26c2-3 4-4 8-4Z" fill="url(#laptop-base)"/>
            <path d="M73 113h137l11 22H59l14-22Z" fill="#d8e6ed"/>
            <path d="M112 139h58l-5 4h-49l-4-4Z" fill="#91a9b7"/>
            <path d="m220 36 4-9m7 13 8-5m-8 13 9 1" fill="none" stroke="#087eae" stroke-linecap="round" stroke-width="2.5"/>
          </svg>
        </section>
      </div>
      <div class="dashboard-bottom">
        <section class="panel">
          <div class="panel-header"><h2>◇ &nbsp;Produtos recentes</h2><a class="text-link" href="#products" data-route="products">Ver todos →</a></div>
          ${recentRows}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>✦ &nbsp;Atalhos rápidos</h2></div>
          <div class="quick-grid">
            <button class="quick-action" type="button" data-action="new-product"><span>＋</span>Adicionar produto</button>
            <button class="quick-action" type="button" data-route="categories"><span>▦</span>Cadastrar categoria</button>
            <button class="quick-action" type="button" data-route="images"><span>▧</span>Imagens</button>
            <button class="quick-action" type="button" data-route="company"><span>▤</span>Editar informações</button>
          </div>
        </section>
      </div>`;
  }

  function productTable(products, state, isFiltered = false) {
    if (!products.length) {
      const title = isFiltered ? "Nenhum produto encontrado" : "Adicione seu próximo produto";
      const description = isFiltered ? "Tente mudar a busca ou os filtros." : "Seus produtos e serviços cadastrados aparecerão aqui.";
      return emptyState("◇", title, description, '<button class="button button-small" type="button" data-action="new-product">＋ Adicionar produto</button>');
    }
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Produto ou serviço</th><th>Categoria</th><th>Preço</th><th>Status</th><th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody>${products.map((product) => `<tr>
        <td><span class="table-primary">${escapeHtml(product.name)}</span>${product.description ? `<span class="table-subtitle">${escapeHtml(product.description)}</span>` : ""}</td>
        <td>${escapeHtml(state.categories.find((category) => category.id === product.categoryId)?.name || "Sem categoria")}</td>
        <td class="money">${currency(product.price)}</td>
        <td><span class="status-pill ${product.status === "active" ? "" : "inactive"}">${product.status === "active" ? "Ativo" : "Inativo"}</span></td>
        <td><div class="table-actions">
          <button class="icon-action" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}" aria-label="Editar ${escapeHtml(product.name)}">✎</button>
          <button class="icon-action danger" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}" aria-label="Excluir ${escapeHtml(product.name)}">×</button>
        </div></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function productsPage(state, filters) {
    const query = (filters.search || "").trim().toLocaleLowerCase("pt-BR");
    const status = filters.status || "all";
    const visibleProducts = state.products.filter((product) => {
      const category = state.categories.find((item) => item.id === product.categoryId);
      const matchesSearch = `${product.name} ${category ? category.name : ""} ${product.description}`.toLocaleLowerCase("pt-BR").includes(query);
      return matchesSearch && (status === "all" || product.status === status);
    });
    const action = state.products.length
      ? '<button class="button" type="button" data-action="new-product">＋ Novo produto</button>'
      : "";
    const toolbar = state.products.length
      ? `<div class="toolbar">
            <label class="search-wrap"><span class="search-symbol" aria-hidden="true">⌕</span><span class="sr-only">Buscar produtos</span><input class="search-input" id="product-search" type="search" placeholder="Buscar produto ou categoria..." value="${escapeHtml(filters.search || "")}"></label>
            <label><span class="sr-only">Filtrar por status</span><select class="select-control" id="product-status"><option value="all" ${status === "all" ? "selected" : ""}>Todos os status</option><option value="active" ${status === "active" ? "selected" : ""}>Ativos</option><option value="inactive" ${status === "inactive" ? "selected" : ""}>Inativos</option></select></label>
          </div>`
      : "";
    return `${heading("Produtos e Serviços", "Cadastre e mantenha atualizado o catálogo exibido no seu site.", action)}
      <section class="panel">
        <div class="panel-header"><div><h2>Catálogo</h2><p>${state.products.length} ${state.products.length === 1 ? "item cadastrado" : "itens cadastrados"}</p></div></div>
        <div class="panel-body">
          ${toolbar}
          <div id="product-table">${productTable(visibleProducts, state, Boolean(query) || status !== "all")}</div>
        </div>
      </section>`;
  }

  function categoriesPage(state) {
    const action = state.categories.length
      ? '<button class="button" type="button" data-action="new-category">＋ Nova categoria</button>'
      : "";
    const rows = state.categories.map((category) => {
      const count = state.products.filter((product) => product.categoryId === category.id).length;
      return `<tr>
        <td><span class="table-primary">${escapeHtml(category.name)}</span>${category.description ? `<span class="table-subtitle">${escapeHtml(category.description)}</span>` : ""}</td>
        <td>${count} ${count === 1 ? "produto" : "produtos"}</td>
        <td><div class="table-actions">
          <button class="icon-action" type="button" data-action="edit-category" data-id="${escapeHtml(category.id)}" aria-label="Editar ${escapeHtml(category.name)}">✎</button>
          <button class="icon-action danger" type="button" data-action="delete-category" data-id="${escapeHtml(category.id)}" aria-label="Excluir ${escapeHtml(category.name)}">×</button>
        </div></td>
      </tr>`;
    }).join("");
    const content = rows
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Categoria</th><th>Produtos vinculados</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyState("▦", "Adicione sua próxima categoria", "As categorias que você criar aparecerão aqui para organizar seus produtos.", '<button class="button button-small" type="button" data-action="new-category">＋ Adicionar categoria</button>');
    return `${heading("Categorias", "Organize os produtos e serviços por grupos.", action)}
      <section class="panel"><div class="panel-header"><div><h2>Suas categorias</h2><p>As categorias podem ser vinculadas ao cadastrar um produto.</p></div></div>${content}</section>`;
  }

  function companyPage(state) {
    const company = state.company;
    return `${heading("Informações da Empresa", "Essas informações poderão ser exibidas nas páginas públicas do seu site.")}
      <section class="panel">
        <div class="panel-header"><div><h2>Dados da empresa</h2><p>Edite os dados e salve para manter as alterações neste dispositivo.</p></div></div>
        <div class="panel-body">
          <form data-form="company">
            <div class="form-grid">
              <div class="form-field"><label for="company-name">Nome da empresa *</label><input id="company-name" name="name" required maxlength="100" value="${escapeHtml(company.name)}" placeholder="Ex.: Minha Empresa"></div>
              <div class="form-field"><label for="company-site">Endereço do site</label><input id="company-site" name="website" type="url" maxlength="200" value="${escapeHtml(company.website)}" placeholder="https://www.exemplo.com.br"></div>
              <div class="form-field"><label for="company-email">E-mail de contato</label><input id="company-email" name="email" type="email" maxlength="150" value="${escapeHtml(company.email)}" placeholder="contato@empresa.com.br"></div>
              <div class="form-field"><label for="company-phone">Telefone</label><input id="company-phone" name="phone" type="tel" maxlength="30" value="${escapeHtml(company.phone)}" placeholder="(00) 00000-0000"></div>
              <div class="form-field form-field-full"><label for="company-address">Endereço</label><input id="company-address" name="address" maxlength="180" value="${escapeHtml(company.address)}" placeholder="Rua, número, cidade e estado"></div>
              <div class="form-field form-field-full"><label for="company-about">Sobre a empresa</label><textarea id="company-about" name="about" maxlength="1000" placeholder="Conte um pouco sobre a empresa...">${escapeHtml(company.about)}</textarea><span class="field-hint">Até 1.000 caracteres.</span></div>
            </div>
            <div class="form-actions"><button class="button" type="submit">Salvar informações</button></div>
          </form>
        </div>
      </section>`;
  }

  function accountPage(state) {
    const account = state.account;
    const initial = escapeHtml((account.name.trim()[0] || "A").toLocaleUpperCase("pt-BR"));
    return `${heading("Minha Conta", "Atualize os dados de identificação deste perfil local.")}
      <section class="panel">
        <div class="panel-header"><div><h2>Perfil</h2><p>As alterações são salvas apenas neste navegador.</p></div></div>
        <div class="panel-body">
          <div class="account-profile"><div class="avatar-large" aria-hidden="true">${initial}</div><div><strong>${escapeHtml(account.name || "Administrador")}</strong><span>${escapeHtml(account.email || "E-mail não informado")}</span></div></div>
          <form data-form="account">
            <div class="form-grid">
              <div class="form-field"><label for="account-name">Nome *</label><input id="account-name" name="name" required maxlength="80" value="${escapeHtml(account.name)}" placeholder="Seu nome"></div>
              <div class="form-field"><label for="account-email">E-mail</label><input id="account-email" name="email" type="email" maxlength="150" value="${escapeHtml(account.email)}" placeholder="seu@email.com"></div>
            </div>
            <div class="form-actions"><button class="button" type="submit">Salvar perfil</button></div>
          </form>
          <hr class="divider">
          <div class="notice-card"><strong>Acesso e segurança</strong><br>O login e a troca de senha ainda não estão disponíveis nesta tela. Configure a autenticação e a proteção de sessão antes de disponibilizar o painel.</div>
        </div>
      </section>`;
  }

  function imagesPage() {
    return `${heading("Imagens", "O gerenciamento de imagens não faz parte desta primeira versão.")}
      <section class="panel">${emptyState("▧", "Sem imagens por enquanto", "Como combinado, o painel não inclui envio nem armazenamento de imagens.")}</section>`;
  }

  window.AdminPages = {
    render(page, state, filters = {}) {
      switch (page) {
        case "products": return productsPage(state, filters);
        case "categories": return categoriesPage(state);
        case "images": return imagesPage();
        case "company": return companyPage(state);
        case "account": return accountPage(state);
        default: return overview(state);
      }
    },
    renderProductTable(products, state, isFiltered) {
      return productTable(products, state, isFiltered);
    },
    renderVisitChart(points, days = 30) {
      return visitChart(points, days);
    },
    escapeHtml,
    currency
  };
})();
