/**
 * JRG Agency — Leads CRM & Sales Pipeline Controller
 * Lead management, automated quotes, and WhatsApp outreach
 * https://jrgagency.eus
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Constantes y Definiciones Operativas
  const STAGES = [
    "INBOX / LEADS",
    "CALIFICACIÓN",
    "PROPUESTA ENVIADA",
    "EN DESARROLLO / SPRINT",
    "CERRADO GANADO",
    "EN ESPERA / SEGUIMIENTO"
  ];

  const CATEGORIAS = [
    "Restauración / Hostelería",
    "PYME / Empresa",
    "Comercio / Autónomo"
  ];

  const CANALES = [
    "WhatsApp",
    "Formulario Web",
    "Google Business Local",
    "Referido"
  ];

  const UBICACIONES = [
    "Gipuzkoa (Local)",
    "España (Nacional)",
    "Internacional"
  ];

  // Tarifas Oficiales JRG Agency
  const PRICING = {
    web: 460,                    // Pago único
    chatbot_setup: 530,          // Pago único
    chatbot_monthly: 25,         // MRR recurrente mensual
    automation_min: 900,         // Rango min
    automation_max: 1400,        // Rango max
    automation_default: 1150     // Valor medio recomendado
  };

  // Cálculo de totales de un lead
  function calculatePricing(lead) {
    let upfront = 0;
    let mrr = 0;
    const services = [];

    if (lead.service_web) {
      upfront += PRICING.web;
      services.push("Web 460€");
    }
    if (lead.service_chatbot) {
      upfront += PRICING.chatbot_setup;
      mrr += PRICING.chatbot_monthly;
      services.push("Chatbot 530€ (+25€/m)");
    }
    if (lead.service_automation) {
      const autoPrice = Number(lead.automation_price) || PRICING.automation_default;
      upfront += autoPrice;
      services.push(`Auto ${autoPrice}€`);
    }

    return { upfront, mrr, services };
  }

  // 2. Carga y Normalización del Estado Persistente
  const rawLeads = window.GOIERRI_LEADS || [];
  let savedState = {};

  try {
    const storedV3 = localStorage.getItem("jrg_crm_state_v3");
    if (storedV3) {
      savedState = JSON.parse(storedV3);
    } else {
      // Migración desde v2
      const storedV2 = localStorage.getItem("jrg_crm_state_v2");
      if (storedV2) {
        const oldState = JSON.parse(storedV2);
        Object.keys(oldState).forEach((id) => {
          const old = oldState[id];
          const srv = old.servicio_principal || "";
          savedState[id] = {
            status: old.status || "INBOX / LEADS",
            categoria_negocio: old.categoria_negocio,
            canal_entrada: old.canal_entrada,
            ubicacion: old.ubicacion,
            notes: old.notes || "",
            service_web: srv.includes("Web") || srv.includes("Pack"),
            service_chatbot: srv.includes("Chatbot") || srv.includes("Pack"),
            service_automation: srv.includes("Auto") || srv.includes("Pack"),
            automation_price: PRICING.automation_default
          };
        });
      }
    }
  } catch (e) {
    console.error("Error al cargar localStorage:", e);
  }

  // 3. Inicializar y Clasificar Leads
  let leads = rawLeads.map((item) => {
    const saved = savedState[item.id] || {};

    // A. Categoría de Negocio
    let defaultCat = "Comercio / Autónomo";
    const secLower = (item.sector || "").toLowerCase();
    const catLower = (item.categoria || "").toLowerCase();
    const nomLower = (item.nombre || "").toLowerCase();
    const fullText = `${secLower} ${catLower} ${nomLower}`;

    if (
      fullText.includes("hostel") ||
      fullText.includes("restauran") ||
      fullText.includes("bar") ||
      fullText.includes("taberna") ||
      fullText.includes("café") ||
      fullText.includes("alimentac") ||
      fullText.includes("panader") ||
      fullText.includes("pasteler") ||
      fullText.includes("carnicer") ||
      fullText.includes("pescader") ||
      fullText.includes("asador") ||
      fullText.includes("sidrer")
    ) {
      defaultCat = "Restauración / Hostelería";
    } else if (
      fullText.includes("industria") ||
      fullText.includes("fabricac") ||
      fullText.includes("construcc") ||
      fullText.includes("taller") ||
      fullText.includes("mecanic") ||
      fullText.includes("inmobiliari") ||
      fullText.includes("asesor") ||
      fullText.includes("profesional") ||
      fullText.includes("servicios") ||
      fullText.includes("transporte") ||
      fullText.includes("poligono")
    ) {
      defaultCat = "PYME / Empresa";
    }

    // B. Servicios Asignados por Defecto si no hay estado previo
    let sWeb = false;
    let sChatbot = false;
    let sAuto = false;
    let autoPrice = PRICING.automation_default;

    if (saved.service_web !== undefined) {
      sWeb = Boolean(saved.service_web);
      sChatbot = Boolean(saved.service_chatbot);
      sAuto = Boolean(saved.service_automation);
      autoPrice = Number(saved.automation_price) || PRICING.automation_default;
    } else {
      if (defaultCat === "Restauración / Hostelería") {
        sChatbot = true;
      } else if (defaultCat === "PYME / Empresa") {
        sAuto = true;
      } else {
        sWeb = true;
      }
    }

    // Asegurar que al menos un servicio está activo
    if (!sWeb && !sChatbot && !sAuto) {
      sWeb = true;
    }

    const leadObj = {
      ...item,
      categoria_negocio: saved.categoria_negocio || defaultCat,
      canal_entrada: saved.canal_entrada || (item.gmaps_url || (item.reviews && item.reviews !== "0") ? "Google Business Local" : "WhatsApp"),
      ubicacion: saved.ubicacion || "Gipuzkoa (Local)",
      crm_status: (STAGES.includes(saved.status) ? saved.status : "INBOX / LEADS"),
      notes: saved.notes || "",
      service_web: sWeb,
      service_chatbot: sChatbot,
      service_automation: sAuto,
      automation_price: autoPrice
    };

    const { upfront, mrr } = calculatePricing(leadObj);
    leadObj.presupuesto_estimado = upfront;
    leadObj.mrr_estimado = mrr;

    return leadObj;
  });

  // Variables de Estado de UI
  let currentTab = "dashboard";
  let currentPage = 1;
  let pageSize = 25;
  let sortColumn = "presupuesto_estimado";
  let sortAsc = false;
  let selectedLead = null;

  // 4. Elementos del DOM
  const navItems = document.querySelectorAll(".nav-item");
  const viewDashboard = document.getElementById("viewDashboard");
  const viewKanban = document.getElementById("viewKanban");
  const viewTable = document.getElementById("viewTable");
  const viewScripts = document.getElementById("viewScripts");

  const searchInput = document.getElementById("searchInput");
  const filterCategoria = document.getElementById("filterCategoria");
  const filterServicio = document.getElementById("filterServicio");
  const filterCanal = document.getElementById("filterCanal");
  const filterUbicacion = document.getElementById("filterUbicacion");
  const filterMunicipio = document.getElementById("filterMunicipio");
  const filterStatus = document.getElementById("filterStatus");

  const tableBody = document.getElementById("tableBody");
  const tableStats = document.getElementById("tableStats");
  const paginationInfo = document.getElementById("paginationInfo");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");

  // Modal y controles
  const modalOverlay = document.getElementById("modalOverlay");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalId = document.getElementById("modalId");
  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const modalBadges = document.getElementById("modalBadges");
  const modalLocationBadge = document.getElementById("modalLocationBadge");
  const modalCategoriaSelect = document.getElementById("modalCategoriaSelect");
  const modalCanalSelect = document.getElementById("modalCanalSelect");
  const modalUbicacionSelect = document.getElementById("modalUbicacionSelect");
  const modalStatusSelect = document.getElementById("modalStatusSelect");

  const modalCheckWeb = document.getElementById("modalCheckWeb");
  const modalCheckChatbot = document.getElementById("modalCheckChatbot");
  const modalCheckAuto = document.getElementById("modalCheckAuto");
  const modalAutoPriceLabel = document.getElementById("modalAutoPriceLabel");
  const modalAutoSliderWrap = document.getElementById("modalAutoSliderWrap");
  const modalAutoSliderVal = document.getElementById("modalAutoSliderVal");
  const modalAutoRange = document.getElementById("modalAutoRange");
  const modalSummaryUpfront = document.getElementById("modalSummaryUpfront");
  const modalSummaryMRR = document.getElementById("modalSummaryMRR");

  const modalServiceDesc = document.getElementById("modalServiceDesc");
  const modalPitch = document.getElementById("modalPitch");
  const modalNotes = document.getElementById("modalNotes");
  const modalCallBtn = document.getElementById("modalCallBtn");
  const modalWhatsappBtn = document.getElementById("modalWhatsappBtn");
  const modalMarkPropuestaBtn = document.getElementById("modalMarkPropuestaBtn");
  const modalMapsBtn = document.getElementById("modalMapsBtn");
  const modalCopyPitchBtn = document.getElementById("modalCopyPitchBtn");
  const modalCopyEuPitchBtn = document.getElementById("modalCopyEuPitchBtn");

  const toast = document.getElementById("toast");

  // Elementos de Autenticación
  const authScreen = document.getElementById("authScreen");
  const authForm = document.getElementById("authForm");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authError = document.getElementById("authError");
  const logoutBtn = document.getElementById("logoutBtn");

  // Formato Moneda EUR
  function formatEUR(val) {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(val || 0);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Poblar Select de Municipios
  function populateMunicipios() {
    const municipios = [...new Set(leads.map((l) => l.municipio))].filter(Boolean).sort();
    filterMunicipio.innerHTML = '<option value="">Todos los Municipios</option>';
    municipios.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      filterMunicipio.appendChild(opt);
    });
  }

  // Guardar Estado Permanente
  function saveState() {
    const stateToSave = {};
    leads.forEach((l) => {
      stateToSave[l.id] = {
        status: l.crm_status,
        categoria_negocio: l.categoria_negocio,
        canal_entrada: l.canal_entrada,
        ubicacion: l.ubicacion,
        service_web: l.service_web,
        service_chatbot: l.service_chatbot,
        service_automation: l.service_automation,
        automation_price: l.automation_price,
        notes: l.notes
      };
    });
    try {
      localStorage.setItem("jrg_crm_state_v3", JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Error guardando state:", e);
    }
  }

  // Filtrado Centralizado
  function getFilteredLeads() {
    const q = searchInput.value.toLowerCase().trim();
    const selCat = filterCategoria.value;
    const selSrv = filterServicio.value;
    const selCan = filterCanal.value;
    const selUbi = filterUbicacion.value;
    const selMun = filterMunicipio.value;
    const selStat = filterStatus.value;

    return leads.filter((l) => {
      if (selCat && l.categoria_negocio !== selCat) return false;
      if (selCan && l.canal_entrada !== selCan) return false;
      if (selUbi && l.ubicacion !== selUbi) return false;
      if (selMun && l.municipio !== selMun) return false;
      if (selStat && l.crm_status !== selStat) return false;

      // Filtro de Servicio
      if (selSrv) {
        if (selSrv === "web" && !l.service_web) return false;
        if (selSrv === "chatbot" && !l.service_chatbot) return false;
        if (selSrv === "automation" && !l.service_automation) return false;
      }

      if (q) {
        const text = `${l.id} ${l.nombre} ${l.municipio} ${l.sector} ${l.direccion} ${l.telefono} ${l.categoria_negocio}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  // Ordenación de Leads
  function getSortedLeads(list) {
    return [...list].sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  // Actualizar badges e iconos de servicios de un lead
  function getServiceBadgesHtml(lead) {
    const badges = [];
    if (lead.service_web) {
      badges.push('<span class="pill pill-srv-web" title="Desarrollo Web (460 €)">🌐 Web (460€)</span>');
    }
    if (lead.service_chatbot) {
      badges.push('<span class="pill pill-srv-chatbot" title="Chatbot IA (530 € + 25 €/mes)">🤖 Chatbot (530€ + 25€/m)</span>');
    }
    if (lead.service_automation) {
      badges.push(`<span class="pill pill-srv-auto" title="Automatizaciones IA (${formatEUR(lead.automation_price || PRICING.automation_default)})">⚡ Auto (${formatEUR(lead.automation_price || PRICING.automation_default)})</span>`);
    }
    return badges.join(" ");
  }

  // ==========================================================================
  // RENDER: DASHBOARD BENTO METRICS
  // ==========================================================================
  function renderDashboard() {
    const filtered = getFilteredLeads();

    // 1. Pipeline Total Value (Pago Único)
    const totalUpfront = filtered.reduce((acc, l) => acc + (l.presupuesto_estimado || 0), 0);
    document.getElementById("kpiPipelineValue").textContent = formatEUR(totalUpfront);

    // 2. MRR (Mensualidad Recurrente de Chatbots)
    const totalMRR = filtered.reduce((acc, l) => acc + (l.mrr_estimado || 0), 0);
    const mrrEl = document.getElementById("kpiMRRValue");
    if (mrrEl) {
      mrrEl.textContent = `+${formatEUR(totalMRR)}/mes`;
    }

    // 3. Total Leads
    document.getElementById("kpiTotalLeads").textContent = filtered.length;

    // 4. Cierres y Sprint
    const ganadosSprint = filtered.filter((l) =>
      ["CERRADO GANADO", "EN DESARROLLO / SPRINT"].includes(l.crm_status)
    ).length;
    document.getElementById("kpiGanadosSprint").textContent = ganadosSprint;

    // 5. Desglose de Servicios
    const countWeb = filtered.filter((l) => l.service_web).length;
    const countChatbot = filtered.filter((l) => l.service_chatbot).length;
    const countAuto = filtered.filter((l) => l.service_automation).length;

    document.getElementById("metricCountWeb3D").textContent = `${countWeb} leads (460 €)`;
    document.getElementById("metricCountChatbot").textContent = `${countChatbot} leads (530 € + 25 €/m)`;
    document.getElementById("metricCountAuto").textContent = `${countAuto} leads (900€ - 1.400€)`;

    const maxCount = filtered.length || 1;
    document.getElementById("barFillWeb3D").style.width = `${Math.min(100, Math.round((countWeb / maxCount) * 100))}%`;
    document.getElementById("barFillChatbot").style.width = `${Math.min(100, Math.round((countChatbot / maxCount) * 100))}%`;
    document.getElementById("barFillAuto").style.width = `${Math.min(100, Math.round((countAuto / maxCount) * 100))}%`;

    // 6. Canales de Entrada
    document.getElementById("channelCountWa").textContent = filtered.filter((l) => l.canal_entrada === "WhatsApp").length;
    document.getElementById("channelCountGmaps").textContent = filtered.filter((l) => l.canal_entrada === "Google Business Local").length;
    document.getElementById("channelCountWeb").textContent = filtered.filter((l) => l.canal_entrada === "Formulario Web").length;
    document.getElementById("channelCountRef").textContent = filtered.filter((l) => l.canal_entrada === "Referido").length;

    // 7. Funnel por fases
    document.getElementById("stageCountInbox").textContent = filtered.filter((l) => l.crm_status === "INBOX / LEADS").length;
    document.getElementById("stageCountCalif").textContent = filtered.filter((l) => l.crm_status === "CALIFICACIÓN").length;
    document.getElementById("stageCountPropuesta").textContent = filtered.filter((l) => l.crm_status === "PROPUESTA ENVIADA").length;
    document.getElementById("stageCountSprint").textContent = filtered.filter((l) => l.crm_status === "EN DESARROLLO / SPRINT").length;
    document.getElementById("stageCountGanado").textContent = filtered.filter((l) => l.crm_status === "CERRADO GANADO").length;
    document.getElementById("stageCountEspera").textContent = filtered.filter((l) => l.crm_status === "EN ESPERA / SEGUIMIENTO").length;
  }

  // ==========================================================================
  // RENDER: PIPELINE KANBAN (6 FASES)
  // ==========================================================================
  function renderKanban() {
    const filtered = getFilteredLeads();

    const columnConfig = [
      { id: "Inbox", status: "INBOX / LEADS" },
      { id: "Calif", status: "CALIFICACIÓN" },
      { id: "Propuesta", status: "PROPUESTA ENVIADA" },
      { id: "Sprint", status: "EN DESARROLLO / SPRINT" },
      { id: "Ganado", status: "CERRADO GANADO" },
      { id: "Espera", status: "EN ESPERA / SEGUIMIENTO" }
    ];

    columnConfig.forEach((col) => {
      const container = document.getElementById(`kanbanCol${col.id}`);
      const countEl = document.getElementById(`countCol${col.id}`);
      const budgetEl = document.getElementById(`budgetCol${col.id}`);

      const stageLeads = filtered.filter((l) => l.crm_status === col.status);
      const stageBudget = stageLeads.reduce((acc, l) => acc + (l.presupuesto_estimado || 0), 0);
      const stageMRR = stageLeads.reduce((acc, l) => acc + (l.mrr_estimado || 0), 0);

      countEl.textContent = stageLeads.length;
      budgetEl.textContent = stageMRR > 0 
        ? `${formatEUR(stageBudget)} (+${formatEUR(stageMRR)}/m)` 
        : formatEUR(stageBudget);

      container.innerHTML = "";

      if (stageLeads.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px 10px; color: var(--text-dim); font-size: 11px;">Sin registros en esta fase</div>`;
        return;
      }

      stageLeads.forEach((lead) => {
        const card = document.createElement("div");
        card.className = "kanban-card";

        const catClass = getCategoryPillClass(lead.categoria_negocio);
        const badgesHtml = getServiceBadgesHtml(lead);

        const amountStr = lead.mrr_estimado > 0 
          ? `${formatEUR(lead.presupuesto_estimado)} <span style="color: #38bdf8; font-size: 10px;">(+${lead.mrr_estimado}€/m)</span>` 
          : formatEUR(lead.presupuesto_estimado);

        card.innerHTML = `
          <div class="card-top-row">
            <span class="card-title" title="${escapeHtml(lead.nombre)}">${escapeHtml(lead.nombre)}</span>
            <span class="card-budget">${amountStr}</span>
          </div>

          <div class="card-pills-row" style="flex-wrap: wrap; gap: 4px;">
            <span class="pill ${catClass}">${getCategoryIcon(lead.categoria_negocio)} ${escapeHtml(lead.categoria_negocio.split('/')[0].trim())}</span>
            ${badgesHtml}
          </div>

          <div class="card-location-row">
            <span>📍 ${escapeHtml(lead.municipio)}</span>
            <a href="#" class="card-wa-btn" data-action="whatsapp" data-id="${lead.id}" title="Contactar por WhatsApp">
              <span>💬</span> WhatsApp
            </a>
          </div>
        `;

        card.addEventListener("click", (e) => {
          if (e.target.closest('[data-action="whatsapp"]')) {
            e.stopPropagation();
            openWhatsApp(lead);
            return;
          }
          openModal(lead);
        });

        container.appendChild(card);
      });
    });
  }

  // ==========================================================================
  // RENDER: TABLA DENSA
  // ==========================================================================
  function renderTable() {
    const filtered = getFilteredLeads();
    const sorted = getSortedLeads(filtered);

    tableStats.textContent = `Mostrando ${filtered.length} de ${leads.length} leads registrados`;

    const totalPages = Math.ceil(sorted.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageData = sorted.slice(startIdx, endIdx);

    paginationInfo.textContent = `Página ${currentPage} de ${totalPages} (${filtered.length} registros)`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-dim);">No se encontraron leads con los filtros actuales.</td></tr>`;
      return;
    }

    pageData.forEach((lead) => {
      const tr = document.createElement("tr");

      const catClass = getCategoryPillClass(lead.categoria_negocio);
      const badgesHtml = getServiceBadgesHtml(lead);
      const statusClass = getStatusBadgeClass(lead.crm_status);

      const amountFormatted = lead.mrr_estimado > 0 
        ? `${formatEUR(lead.presupuesto_estimado)} <span style="color: #38bdf8; font-size: 10px;">(+${lead.mrr_estimado}€/m)</span>` 
        : formatEUR(lead.presupuesto_estimado);

      tr.innerHTML = `
        <td class="lead-id">${escapeHtml(lead.id)}</td>
        <td>
          <div class="lead-name-cell">
            <span class="lead-main-name">${escapeHtml(lead.nombre)}</span>
            <span class="lead-sub-info">${escapeHtml(lead.municipio)} • ${escapeHtml(lead.sector || "Comercio")}</span>
          </div>
        </td>
        <td><span class="pill ${catClass}">${escapeHtml(lead.categoria_negocio.split('/')[0].trim())}</span></td>
        <td><div style="display: flex; gap: 4px; flex-wrap: wrap;">${badgesHtml}</div></td>
        <td><span class="pill pill-channel">${escapeHtml(lead.canal_entrada)}</span></td>
        <td class="mono-amount">${amountFormatted}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(lead.crm_status)}</span></td>
        <td>
          <div class="table-actions-cell">
            <button class="table-action-btn wa" data-action="whatsapp" data-id="${lead.id}" title="Enviar mensaje por WhatsApp">
              💬
            </button>
            <button class="table-action-btn edit" data-action="edit" data-id="${lead.id}" title="Abrir ficha completa">
              ⚙️
            </button>
          </div>
        </td>
      `;

      tr.addEventListener("click", (e) => {
        if (e.target.closest('[data-action="whatsapp"]')) {
          e.stopPropagation();
          openWhatsApp(lead);
          return;
        }
        openModal(lead);
      });

      tableBody.appendChild(tr);
    });
  }

  // ==========================================================================
  // MODAL: FICHA DEL CLIENTE & CONFIGURADOR DE PROPUESTA
  // ==========================================================================
  function openModal(lead) {
    selectedLead = lead;

    modalId.textContent = lead.id;
    modalTitle.textContent = lead.nombre;
    modalSubtitle.textContent = `${lead.sector || "Negocio"} • ${lead.municipio} (Gipuzkoa)`;
    modalLocationBadge.textContent = lead.ubicacion;

    modalCategoriaSelect.value = lead.categoria_negocio;
    modalCanalSelect.value = lead.canal_entrada;
    modalUbicacionSelect.value = lead.ubicacion;
    modalStatusSelect.value = lead.crm_status;

    // Servicios checkboxes & sliders
    modalCheckWeb.checked = Boolean(lead.service_web);
    modalCheckChatbot.checked = Boolean(lead.service_chatbot);
    modalCheckAuto.checked = Boolean(lead.service_automation);

    modalAutoRange.value = lead.automation_price || PRICING.automation_default;
    modalAutoSliderVal.textContent = formatEUR(modalAutoRange.value);
    modalAutoPriceLabel.textContent = formatEUR(modalAutoRange.value);
    modalAutoSliderWrap.style.display = lead.service_automation ? "block" : "none";

    // Actualizar badges del header del modal
    updateModalSummaryAndBadges();

    modalNotes.value = lead.notes || "";
    modalCallBtn.href = `tel:${lead.telefono || ""}`;
    modalWhatsappBtn.onclick = () => openWhatsApp(lead);
    modalMapsBtn.href = lead.gmaps_url || `https://www.google.com/maps/search/${encodeURIComponent(lead.nombre + " " + (lead.direccion || "") + " " + lead.municipio)}`;

    modalOverlay.style.display = "flex";
  }

  function closeModal() {
    modalOverlay.style.display = "none";
    selectedLead = null;
  }

  // Recalcular y actualizar UI del Modal
  function updateModalSummaryAndBadges() {
    if (!selectedLead) return;

    selectedLead.service_web = modalCheckWeb.checked;
    selectedLead.service_chatbot = modalCheckChatbot.checked;
    selectedLead.service_automation = modalCheckAuto.checked;
    selectedLead.automation_price = Number(modalAutoRange.value) || PRICING.automation_default;

    const { upfront, mrr } = calculatePricing(selectedLead);
    selectedLead.presupuesto_estimado = upfront;
    selectedLead.mrr_estimado = mrr;

    modalSummaryUpfront.textContent = formatEUR(upfront);
    modalSummaryMRR.textContent = mrr > 0 ? `+${formatEUR(mrr)}/mes` : "0 €/mes";

    modalAutoSliderVal.textContent = formatEUR(selectedLead.automation_price);
    modalAutoPriceLabel.textContent = formatEUR(selectedLead.automation_price);
    modalAutoSliderWrap.style.display = selectedLead.service_automation ? "block" : "none";

    // Actualizar Badges superiores
    const catClass = getCategoryPillClass(selectedLead.categoria_negocio);
    const badgesHtml = getServiceBadgesHtml(selectedLead);
    const amountStr = mrr > 0 ? `${formatEUR(upfront)} (+${mrr}€/m)` : formatEUR(upfront);

    modalBadges.innerHTML = `
      <span class="pill ${catClass}">${getCategoryIcon(selectedLead.categoria_negocio)} ${escapeHtml(selectedLead.categoria_negocio)}</span>
      ${badgesHtml}
      <span class="pill pill-channel">Canal: ${escapeHtml(selectedLead.canal_entrada)}</span>
      <span class="mono-amount" style="margin-left: 6px;">${amountStr}</span>
    `;

    // Actualizar Pitch personalizado
    updatePitchContent();
  }

  // Generador dinámico de propuesta y pitch
  function updatePitchContent() {
    if (!selectedLead) return;

    const items = [];
    if (selectedLead.service_web) {
      items.push("Desarrollo Web corporativo de alta conversión (460 € pago único)");
    }
    if (selectedLead.service_chatbot) {
      items.push("Chatbot Inteligente 24/7 para WhatsApp (530 € alta + 25 €/mes de mantenimiento)");
    }
    if (selectedLead.service_automation) {
      items.push(`Automatización de procesos comerciales (${formatEUR(selectedLead.automation_price || PRICING.automation_default)})`);
    }

    const servicesText = items.length > 0 ? items.join(" + ") : "Optimización comercial integral";
    modalServiceDesc.textContent = `Propuesta técnica: ${servicesText}`;

    const totalStr = selectedLead.mrr_estimado > 0 
      ? `${formatEUR(selectedLead.presupuesto_estimado)} de pago único y ${selectedLead.mrr_estimado} €/mes de soporte`
      : `${formatEUR(selectedLead.presupuesto_estimado)} de pago único`;

    modalPitch.textContent = `"Kaixo ${selectedLead.nombre}! Os escribo desde JRG Agency (https://jrgagency.eus). Analizando empresas en ${selectedLead.municipio}, os hemos preparado una solución para ${servicesText}. El presupuesto cerrado es de ${totalStr}. ¿Os paso una demo de 1 minuto sin compromiso?"`;
  }

  // Guardado reactivo en el Modal
  function handleModalFieldChange() {
    if (!selectedLead) return;

    selectedLead.categoria_negocio = modalCategoriaSelect.value;
    selectedLead.canal_entrada = modalCanalSelect.value;
    selectedLead.ubicacion = modalUbicacionSelect.value;
    selectedLead.crm_status = modalStatusSelect.value;
    selectedLead.notes = modalNotes.value;

    updateModalSummaryAndBadges();
    saveState();
    refreshAllViews();
  }

  // Evento especial: Marcar "Propuesta Enviada" directamente
  if (modalMarkPropuestaBtn) {
    modalMarkPropuestaBtn.addEventListener("click", () => {
      if (!selectedLead) return;

      selectedLead.crm_status = "PROPUESTA ENVIADA";
      modalStatusSelect.value = "PROPUESTA ENVIADA";

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      const logEntry = `[${dateStr}] Propuesta enviada: Presupuesto ${formatEUR(selectedLead.presupuesto_estimado)}${selectedLead.mrr_estimado > 0 ? ` (+${selectedLead.mrr_estimado}€/m)` : ""}.\n`;
      
      if (!modalNotes.value.includes(`[${dateStr}] Propuesta enviada`)) {
        modalNotes.value = logEntry + (modalNotes.value ? "\n" + modalNotes.value : "");
        selectedLead.notes = modalNotes.value;
      }

      saveState();
      refreshAllViews();
      showToast(`Estado actualizado a "PROPUESTA ENVIADA" para ${selectedLead.nombre}`);
      openWhatsApp(selectedLead);
    });
  }

  // Listeners del modal
  [modalCheckWeb, modalCheckChatbot, modalCheckAuto].forEach((chk) => {
    chk.addEventListener("change", () => {
      // Si se desmarcan todos, mantener al menos uno
      if (!modalCheckWeb.checked && !modalCheckChatbot.checked && !modalCheckAuto.checked) {
        chk.checked = true;
      }
      handleModalFieldChange();
    });
  });

  modalAutoRange.addEventListener("input", () => {
    updateModalSummaryAndBadges();
  });

  modalAutoRange.addEventListener("change", () => {
    handleModalFieldChange();
  });

  [
    modalCategoriaSelect,
    modalCanalSelect,
    modalUbicacionSelect,
    modalStatusSelect
  ].forEach((el) => el.addEventListener("change", handleModalFieldChange));

  modalNotes.addEventListener("input", () => {
    if (selectedLead) {
      selectedLead.notes = modalNotes.value;
      saveState();
    }
  });

  modalCloseBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Copiar Pitch
  modalCopyPitchBtn.addEventListener("click", () => {
    if (!selectedLead) return;
    const { upfront, mrr } = calculatePricing(selectedLead);
    const totalText = mrr > 0 ? `${formatEUR(upfront)} y ${mrr} €/mes de soporte` : `${formatEUR(upfront)}`;

    const text = `Kaixo ${selectedLead.nombre}! Os escribo desde JRG Agency (https://jrgagency.eus). Analizando empresas en ${selectedLead.municipio}, os hemos preparado una propuesta especializada para vuestro negocio con presupuesto cerrado de ${totalText}. ¿Te parecería bien ver un vídeo o demo de 1 minuto sin compromiso? ¡Mila esker!`;
    navigator.clipboard.writeText(text);
    showToast("Pitch copiado al portapapeles.");
  });

  modalCopyEuPitchBtn.addEventListener("click", () => {
    if (!selectedLead) return;
    const { upfront, mrr } = calculatePricing(selectedLead);
    const totalText = mrr > 0 ? `${formatEUR(upfront)} eta ${mrr} €/hileko mantentzea` : `${formatEUR(upfront)}`;

    const text = `Kaixo ${selectedLead.nombre}! JRG Agency-tik (https://jrgagency.eus) idazten dizuegu. ${selectedLead.municipio} inguruko enpresak aztertzen aritu gara eta zure negoziorako proposamen pertsonalizatu bat prestatu dugu: aurrekontu itxia ${totalText}. Minutu bateko bideo-demo bat ikusteko prest egongo zinateke inolako konpromisorik gabe? Mila esker!`;
    navigator.clipboard.writeText(text);
    showToast("Euskarazko pitch-a arbelera kopiatu da.");
  });

  // ==========================================================================
  // WHATSAPP OUTREACH BUILDER
  // ==========================================================================
  function openWhatsApp(lead) {
    const phone = (lead.telefono || "").replace(/\s+/g, "");
    if (!phone) {
      showToast("Este lead no cuenta con número de teléfono registrado.");
      return;
    }
    const formattedPhone = phone.startsWith("34") ? phone : `34${phone}`;

    const { upfront, mrr } = calculatePricing(lead);

    const serviciosList = [];
    if (lead.service_web) {
      serviciosList.push("• Desarrollo Web corporativo de alto rendimiento y captación (460 € pago único)");
    }
    if (lead.service_chatbot) {
      serviciosList.push("• Asistente / Chatbot IA para atención 24/7 en WhatsApp (530 € alta + 25 €/mes de mantenimiento)");
    }
    if (lead.service_automation) {
      serviciosList.push(`• Automatización de procesos comerciales y tareas repetitivas (${formatEUR(lead.automation_price || PRICING.automation_default)})`);
    }

    const serviciosTexto = serviciosList.length > 0 
      ? serviciosList.join("\n") 
      : "• Digitalización y optimización de captación comercial";

    const totalTexto = mrr > 0 
      ? `${formatEUR(upfront)} de pago único + ${mrr} €/mes de cuota de soporte` 
      : `${formatEUR(upfront)} de pago único`;

    const msg = `Kaixo ${lead.nombre}! Os escribo de parte de JRG Agency (https://jrgagency.eus).\n\nHemos estado analizando negocios en ${lead.municipio} y os hemos preparado una propuesta especializada para vuestro flujo comercial:\n\n${serviciosTexto}\n\nPresupuesto cerrado: ${totalTexto}.\n\n¿Te parecería bien que te pase un enlace de demostración de 1 minuto para ver cómo funciona en vuestro caso sin compromiso? Mila esker!`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  // ==========================================================================
  // CLASES Y HELPERS DE UI
  // ==========================================================================
  function getCategoryPillClass(cat) {
    if (cat === "Restauración / Hostelería") return "pill-cat-restauracion";
    if (cat === "PYME / Empresa") return "pill-cat-pyme";
    return "pill-cat-comercio";
  }

  function getCategoryIcon(cat) {
    if (cat === "Restauración / Hostelería") return "🍽️";
    if (cat === "PYME / Empresa") return "🏢";
    return "🛍️";
  }

  function getStatusBadgeClass(st) {
    if (st === "INBOX / LEADS") return "status-inbox";
    if (st === "CALIFICACIÓN") return "status-calif";
    if (st === "PROPUESTA ENVIADA") return "status-propuesta";
    if (st === "EN DESARROLLO / SPRINT") return "status-sprint";
    if (st === "CERRADO GANADO") return "status-ganado";
    return "status-espera";
  }

  // ==========================================================================
  // NAVEGACIÓN ENTRE VISTAS
  // ==========================================================================
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (!tab) return;

      navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");

      viewDashboard.style.display = tab === "dashboard" ? "flex" : "none";
      viewKanban.style.display = tab === "kanban" ? "flex" : "none";
      viewTable.style.display = tab === "table" ? "flex" : "none";
      viewScripts.style.display = tab === "scripts" ? "flex" : "none";

      currentTab = tab;
      if (tab === "dashboard") renderDashboard();
      if (tab === "kanban") renderKanban();
      if (tab === "table") renderTable();
    });
  });

  // Filtros reactivos
  [
    searchInput,
    filterCategoria,
    filterServicio,
    filterCanal,
    filterUbicacion,
    filterMunicipio,
    filterStatus
  ].forEach((el) => {
    el.addEventListener("input", () => {
      currentPage = 1;
      refreshAllViews();
    });
  });

  // Paginación Tabla
  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    currentPage++;
    renderTable();
  });

  // Ordenación Tabla
  document.querySelectorAll(".crm-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = false;
      }
      renderTable();
    });
  });

  // Copia en Playbook de Pitches
  document.querySelectorAll("[data-copy-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.copyTarget;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.textContent.trim());
        showToast("Plantilla copiada al portapapeles.");
      }
    });
  });

  // Exportar CSV
  exportCsvBtn.addEventListener("click", () => {
    const filtered = getFilteredLeads();
    if (filtered.length === 0) {
      showToast("No hay registros para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Nombre",
      "Municipio",
      "Sector",
      "Telefono",
      "Categoria",
      "Desarrollo_Web",
      "Chatbot_IA",
      "Automatizacion_IA",
      "Presupuesto_Pago_Unico",
      "Cuota_Mensual_MRR",
      "Fase_Pipeline",
      "Canal_Entrada",
      "Notas"
    ];

    const rows = filtered.map((l) => [
      `"${l.id}"`,
      `"${(l.nombre || "").replace(/"/g, '""')}"`,
      `"${(l.municipio || "").replace(/"/g, '""')}"`,
      `"${(l.sector || "").replace(/"/g, '""')}"`,
      `"${(l.telefono || "").replace(/"/g, '""')}"`,
      `"${(l.categoria_negocio || "").replace(/"/g, '""')}"`,
      l.service_web ? "SI" : "NO",
      l.service_chatbot ? "SI" : "NO",
      l.service_automation ? "SI" : "NO",
      l.presupuesto_estimado || 0,
      l.mrr_estimado || 0,
      `"${l.crm_status}"`,
      `"${l.canal_entrada}"`,
      `"${(l.notes || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_jrg_agency_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportados ${filtered.length} leads en formato CSV.`);
  });

  // Refrescar vistas activas
  function refreshAllViews() {
    renderDashboard();
    if (currentTab === "kanban") renderKanban();
    if (currentTab === "table") renderTable();

    // Actualizar badges del sidebar
    const totalCount = leads.length;
    const bKanban = document.getElementById("badgeTotalKanban");
    const bTable = document.getElementById("badgeTotalTable");
    if (bKanban) bKanban.textContent = totalCount;
    if (bTable) bTable.textContent = totalCount;
  }

  // ==========================================================================
  // SISTEMA DE CONTROL DE ACCESO (CLOSER AUTH GATEWAY)
  // ==========================================================================
  const AUTH_CREDENTIALS = {
    username: "salman_jrg",
    password: "JrgAgencyCloserSalman"
  };

  function checkAuth() {
    const isLogged = sessionStorage.getItem("jrg_auth_session") === "true";
    if (isLogged) {
      if (authScreen) authScreen.style.display = "none";
    } else {
      if (authScreen) {
        authScreen.style.display = "flex";
        setTimeout(() => {
          if (authUsername) authUsername.focus();
        }, 120);
      }
    }
  }

  function handleLogin(e) {
    if (e) e.preventDefault();
    const u = (authUsername.value || "").trim();
    const p = (authPassword.value || "").trim();

    if (u === AUTH_CREDENTIALS.username && p === AUTH_CREDENTIALS.password) {
      sessionStorage.setItem("jrg_auth_session", "true");
      sessionStorage.setItem("jrg_auth_user", u);
      if (authError) authError.style.display = "none";
      if (authScreen) authScreen.style.display = "none";
      showToast(`Acceso concedido — Bienvenido ${u}`);
      refreshAllViews();
    } else {
      if (authError) authError.style.display = "block";
      if (authPassword) {
        authPassword.value = "";
        authPassword.focus();
      }
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("jrg_auth_session");
    sessionStorage.removeItem("jrg_auth_user");
    if (authPassword) authPassword.value = "";
    if (authError) authError.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";
    if (authUsername) authUsername.focus();
    showToast("Sesión cerrada.");
  }

  if (authForm) authForm.addEventListener("submit", handleLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  // Inicialización
  checkAuth();
  populateMunicipios();
  refreshAllViews();
});

