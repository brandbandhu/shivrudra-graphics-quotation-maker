(function () {
  const STORAGE_KEYS = {
    settings: "shivrudra-settings",
    quotations: "shivrudra-quotations",
    invoices: "shivrudra-invoices",
    drafts: "shivrudra-drafts",
    clients: "shivrudra-clients",
    counters: "shivrudra-counters"
  };

  const state = {
    config: null,
    currentStep: 1,
    role: "Sales",
    pricingMaster: [],
    settings: {},
    quote: null,
    quotePricing: null,
    draftCache: [],
    quotations: [],
    invoices: [],
    clients: [],
    lastSavedQuote: null,
    lastSavedInvoice: null,
    syncStatus: {
      mode: "local",
      label: "Local mode",
      tone: "warning"
    }
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    state.config = buildConfig();
    cacheDom();
    loadStoredState();
    populateStaticOptions();
    bindEvents();
    applySettingsToForm();
    resetQuote();
    refreshPricingMaster();
    renderRole();
    renderAll();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    toast("Quotation maker ready", "Working in local mode. Add the Apps Script URL later if you want Google Sheets sync.", "success");
  }

  function buildConfig() {
    const base = window.SHIVRUDRA_CONFIG || {};
    const savedSettings = readStorage(STORAGE_KEYS.settings, {});
    return {
      ...base,
      company: { ...(base.company || {}), ...(savedSettings.company || {}) },
      defaults: { ...(base.defaults || {}), ...(savedSettings.defaults || {}) },
      appsScriptUrl: savedSettings.appsScriptUrl || base.appsScriptUrl || ""
    };
  }

  function cacheDom() {
    const byId = (id) => document.getElementById(id);
    [
      "quotationForm",
      "stepper",
      "progressFill",
      "progressLabel",
      "presetSelect",
      "draftSelect",
      "prevStepButton",
      "nextStepButton",
      "quickSaveButton",
      "saveDraftButton",
      "generateQuoteButton",
      "convertInvoiceButton",
      "downloadQuotationButton",
      "downloadInvoiceButton",
      "shareWhatsappButton",
      "newQuoteButton",
      "duplicateCurrentButton",
      "recordTypeFilter",
      "recordSearch",
      "recordsTableBody",
      "syncBadge",
      "syncBadgeText",
      "companyMetaLine",
      "recentClients",
      "breakdownList",
      "quoteValidityChip",
      "discountWarning",
      "clientNameOptions",
      "clientMobileOptions",
      "openSettingsButton",
      "closeSettingsButton",
      "cancelSettingsButton",
      "refreshPricingButton",
      "settingsDialog",
      "settingsForm",
      "settingsAppsScriptUrl",
      "settingsAddress",
      "settingsPhone",
      "settingsCompanyEmail",
      "settingsCompanyGst",
      "settingsPreparedBy",
      "settingsValidityDays",
      "toastStack"
    ].forEach((id) => {
      els[id] = byId(id);
    });
  }

  function bindEvents() {
    els.quotationForm.addEventListener("input", handleFormChange);
    els.quotationForm.addEventListener("change", handleFormChange);

    document.querySelectorAll(".role-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.role = button.dataset.role;
        renderRole();
        renderAll();
      });
    });

    if (els.prevStepButton) {
      els.prevStepButton.addEventListener("click", () => goToStep(state.currentStep - 1));
    }

    if (els.nextStepButton) {
      els.nextStepButton.addEventListener("click", () => {
        if (validateCurrentStep()) {
          goToStep(state.currentStep + 1);
        }
      });
    }

    document.querySelectorAll(".step-item").forEach((item) => {
      item.addEventListener("click", () => {
        const target = Number(item.dataset.step);
        if (target <= state.currentStep || validateCurrentStep()) {
          goToStep(target);
        }
      });
    });

    els.presetSelect.addEventListener("change", handlePresetSelection);
    els.draftSelect.addEventListener("change", handleDraftSelection);

    if (els.quickSaveButton) {
      els.quickSaveButton.addEventListener("click", saveDraft);
    }
    els.saveDraftButton.addEventListener("click", saveDraft);
    els.generateQuoteButton.addEventListener("click", () => {
      generateQuotation();
    });
    els.convertInvoiceButton.addEventListener("click", convertToInvoice);
    els.downloadQuotationButton.addEventListener("click", downloadLatestQuotation);
    els.downloadInvoiceButton.addEventListener("click", downloadLatestInvoice);
    els.shareWhatsappButton.addEventListener("click", shareOnWhatsapp);
    els.newQuoteButton.addEventListener("click", resetQuote);
    els.duplicateCurrentButton.addEventListener("click", duplicateCurrentQuote);
    els.recordTypeFilter.addEventListener("change", renderRecords);
    els.recordSearch.addEventListener("input", renderRecords);

    els.openSettingsButton.addEventListener("click", openSettingsDialog);
    els.closeSettingsButton.addEventListener("click", closeSettingsDialog);
    els.cancelSettingsButton.addEventListener("click", closeSettingsDialog);
    els.refreshPricingButton.addEventListener("click", async () => {
      await refreshPricingMaster(true);
    });

    els.settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveSettings();
      closeSettingsDialog();
      await refreshPricingMaster(true);
      renderAll();
    });

    ["clientName", "mobileNumber"].forEach((id) => {
      document.getElementById(id).addEventListener("blur", tryAutofillClient);
    });
  }

  function loadStoredState() {
    state.quotations = readStorage(STORAGE_KEYS.quotations, []);
    state.invoices = readStorage(STORAGE_KEYS.invoices, []);
    state.draftCache = readStorage(STORAGE_KEYS.drafts, []);
    state.clients = readStorage(STORAGE_KEYS.clients, []);
    state.settings = readStorage(STORAGE_KEYS.settings, {});
  }

  function populateStaticOptions() {
    fillSelectOptions(document.getElementById("industry"), state.config.options.industries);
    fillSelectOptions(document.getElementById("quality"), state.config.options.qualities);
    fillSelectOptions(document.getElementById("printingType"), state.config.options.printingTypes);
    fillSelectOptions(document.getElementById("colorType"), state.config.options.colorTypes);
    fillSelectOptions(document.getElementById("installationRequired"), state.config.options.installationOptions);
    fillSelectOptions(document.getElementById("deliveryType"), state.config.options.deliveryTypes);
    fillSelectOptions(document.getElementById("urgency"), state.config.options.urgencyOptions);
    fillSelectOptions(document.getElementById("followUpStatus"), state.config.options.followUpStatuses);

    const categories = [...new Set(state.config.catalog.map((item) => item.category))];
    fillSelectOptions(document.getElementById("category"), categories);

    els.presetSelect.innerHTML = '<option value="">Choose a preset</option>';
    state.config.presets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.name;
      els.presetSelect.appendChild(option);
    });
  }

  function applySettingsToForm() {
    document.getElementById("preparedBy").value = state.config.defaults.preparedBy || "Sales Desk";
    document.getElementById("gstRate").value = String(state.config.defaults.gstRate || 18);

    els.settingsAppsScriptUrl.value = state.config.appsScriptUrl || "";
    els.settingsAddress.value = state.config.company.address || "";
    els.settingsPhone.value = state.config.company.phone || "";
    els.settingsCompanyEmail.value = state.config.company.email || "";
    els.settingsCompanyGst.value = state.config.company.gstNumber || "";
    els.settingsPreparedBy.value = state.config.defaults.preparedBy || "";
    els.settingsValidityDays.value = String(state.config.defaults.quotationValidityDays || 7);
    const companyMeta = [
      state.config.company.address,
      state.config.company.phone,
      state.config.company.email
    ].filter(Boolean);
    els.companyMetaLine.textContent = companyMeta.join(" | ") || "Print, signage, and branding quotations in one screen.";
  }

  async function refreshPricingMaster(announce) {
    const url = getAppsScriptUrl();
    const fallbackPricing = state.config.pricingMaster.slice();

    if (!url) {
      state.pricingMaster = fallbackPricing;
      setSyncStatus("local", "Local mode", "warning");
      if (announce) {
        toast("Local pricing active", "No Apps Script URL is configured, so pricing and records are running locally.", "warning");
      }
      renderAll();
      return;
    }

    try {
      const bootstrap = await apiGet("bootstrap");
      state.pricingMaster = Array.isArray(bootstrap.pricingMaster) && bootstrap.pricingMaster.length
        ? bootstrap.pricingMaster
        : fallbackPricing;
      if (Array.isArray(bootstrap.quotations) && bootstrap.quotations.length) {
        mergeIncomingRecords(bootstrap.quotations, "quotations");
      }
      if (Array.isArray(bootstrap.invoices) && bootstrap.invoices.length) {
        mergeIncomingRecords(bootstrap.invoices, "invoices");
      }
      if (Array.isArray(bootstrap.clients) && bootstrap.clients.length) {
        mergeIncomingClients(bootstrap.clients);
      }
      setSyncStatus("synced", "Google Sheets connected", "success");
      if (announce) {
        toast("Pricing refreshed", "Pricing and record data were refreshed from Google Sheets.", "success");
      }
    } catch (error) {
      console.error(error);
      state.pricingMaster = fallbackPricing;
      setSyncStatus("degraded", "Sheets unavailable, using local data", "error");
      if (announce) {
        toast("Remote refresh failed", "The sheet endpoint did not respond, so the app stayed in local pricing mode.", "error");
      }
    }
    renderAll();
  }

  function handleFormChange(event) {
    const target = event.target;

    if (target.id === "category") {
      const productName = populateProductOptions(target.value, state.quote?.product || "");
      populateMaterialOptions(productName);
    }

    if (target.id === "product") {
      populateMaterialOptions(target.value);
    }

    if (target.name === "finishing") {
      target.closest(".check-card").classList.toggle("active", target.checked);
    }

    syncMinimalFormDefaults();
    updateQuoteFromForm();
    renderAll();
  }

  function populateProductOptions(category, preferredProduct) {
    const select = document.getElementById("product");
    const products = state.config.catalog
      .filter((item) => item.category === category)
      .map((item) => item.product);
    fillSelectOptions(select, products, "Select product");
    const nextProduct = products.includes(preferredProduct) ? preferredProduct : (products[0] || "");
    select.value = nextProduct;
    return nextProduct;
  }

  function populateMaterialOptions(productName) {
    const select = document.getElementById("materialType");
    const product = getCatalogProduct(productName);
    fillSelectOptions(select, product ? product.materials : [], "Select material");
  }

  function handlePresetSelection() {
    const index = els.presetSelect.value;
    if (index === "") {
      return;
    }
    const preset = state.config.presets[Number(index)];
    if (!preset) {
      return;
    }
    applyQuoteData({
      ...defaultQuote(),
      ...state.quote,
      category: preset.category,
      product: preset.product,
      width: preset.width,
      height: preset.height,
      dimensionUnit: preset.dimensionUnit,
      quantity: preset.quantity,
      materialType: preset.materialType,
      quality: preset.quality,
      printingType: preset.printingType,
      colorType: preset.colorType,
      finishing: preset.finishing.slice(),
      installationRequired: preset.installationRequired,
      deliveryType: preset.deliveryType,
      urgency: preset.urgency,
      followUpStatus: preset.followUpStatus
    });
    state.quote.packageName = preset.name;
    renderAll();
    toast("Preset applied", `${preset.name} filled the product, size, and logistics details.`, "success");
  }

  function handleDraftSelection() {
    const draftChoice = els.draftSelect.value;
    if (draftChoice === "__new__") {
      resetQuote();
      toast("New quotation", "Started a fresh quotation.", "success");
      return;
    }
    if (draftChoice !== "__saved__") {
      return;
    }

    const draft = state.draftCache
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];

    if (!draft) {
      els.draftSelect.value = "__new__";
      toast("No saved draft", "There is no saved draft yet. Start a new quotation and save one first.", "warning");
      return;
    }

    applyQuoteData({
      ...draft,
      id: draft.quoteId || "",
      sourceDraftId: draft.id
    });
    toast("Draft loaded", `Draft ${draft.id} is back in the quote builder.`, "success");
  }

  function defaultQuote() {
    return {
      id: "",
      invoiceId: "",
      sourceDraftId: "",
      date: isoToday(),
      clientName: "",
      companyName: "",
      mobileNumber: "",
      email: "",
      gstNumber: "",
      location: "",
      industry: "",
      category: "",
      product: "",
      width: "",
      height: "",
      quantity: 1,
      dimensionUnit: "ft",
      materialType: "",
      quality: "Economy",
      printingType: "Eco-solvent",
      colorType: "Color",
      finishing: [],
      installationRequired: "No",
      deliveryType: "Pickup",
      urgency: "Normal",
      followUpStatus: "Fresh Lead",
      notes: "",
      discountMode: "percent",
      discountValue: 0,
      gstRate: state.config.defaults.gstRate || 18,
      preparedBy: state.config.defaults.preparedBy || "Sales Desk",
      packageName: "",
      syncState: "Local only",
      status: "Draft",
      paymentStatus: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function resetQuote() {
    state.quote = defaultQuote();
    state.lastSavedQuote = null;
    state.lastSavedInvoice = null;
    applyQuoteData(state.quote);
    goToStep(1);
    renderAll();
  }

  function updateQuoteFromForm() {
    state.quote = {
      ...(state.quote || defaultQuote()),
      id: state.quote?.id || "",
      invoiceId: state.quote?.invoiceId || "",
      sourceDraftId: state.quote?.sourceDraftId || "",
      date: state.quote?.date || isoToday(),
      clientName: fieldValue("clientName"),
      companyName: fieldValue("companyName"),
      mobileNumber: fieldValue("mobileNumber"),
      email: fieldValue("email"),
      gstNumber: fieldValue("gstNumber"),
      location: fieldValue("location"),
      industry: fieldValue("industry"),
      category: fieldValue("category"),
      product: fieldValue("product"),
      width: toNumber(fieldValue("width")),
      height: toNumber(fieldValue("height")),
      quantity: Math.max(1, toNumber(fieldValue("quantity")) || 1),
      dimensionUnit: fieldValue("dimensionUnit"),
      materialType: fieldValue("materialType"),
      quality: fieldValue("quality"),
      printingType: fieldValue("printingType"),
      colorType: fieldValue("colorType"),
      finishing: Array.from(document.querySelectorAll('input[name="finishing"]:checked')).map((input) => input.value),
      installationRequired: fieldValue("installationRequired"),
      deliveryType: fieldValue("deliveryType"),
      urgency: fieldValue("urgency"),
      followUpStatus: fieldValue("followUpStatus"),
      notes: fieldValue("notes"),
      discountMode: fieldValue("discountMode"),
      discountValue: toNumber(fieldValue("discountValue")),
      gstRate: toNumber(fieldValue("gstRate")),
      preparedBy: fieldValue("preparedBy") || state.config.defaults.preparedBy || "Sales Desk",
      updatedAt: new Date().toISOString()
    };
  }

  function applyQuoteData(quote) {
    state.quote = {
      ...defaultQuote(),
      ...quote,
      finishing: Array.isArray(quote.finishing) ? quote.finishing.slice() : []
    };

    document.getElementById("clientName").value = state.quote.clientName || "";
    document.getElementById("companyName").value = state.quote.companyName || "";
    document.getElementById("mobileNumber").value = state.quote.mobileNumber || "";
    document.getElementById("email").value = state.quote.email || "";
    document.getElementById("gstNumber").value = state.quote.gstNumber || "";
    document.getElementById("location").value = state.quote.location || "";
    document.getElementById("industry").value = state.quote.industry || "";
    document.getElementById("category").value = state.quote.category || "";
    populateProductOptions(state.quote.category || "", state.quote.product || "");
    populateMaterialOptions(state.quote.product || "");
    document.getElementById("width").value = state.quote.width || "";
    document.getElementById("height").value = state.quote.height || "";
    document.getElementById("quantity").value = state.quote.quantity || 1;
    document.getElementById("dimensionUnit").value = state.quote.dimensionUnit || "ft";
    document.getElementById("materialType").value = state.quote.materialType || "";
    document.getElementById("quality").value = state.quote.quality || "Economy";
    document.getElementById("printingType").value = state.quote.printingType || "Eco-solvent";
    document.getElementById("colorType").value = state.quote.colorType || "Color";
    document.getElementById("installationRequired").value = state.quote.installationRequired || "No";
    document.getElementById("deliveryType").value = state.quote.deliveryType || "Pickup";
    document.getElementById("urgency").value = state.quote.urgency || "Normal";
    document.getElementById("followUpStatus").value = state.quote.followUpStatus || "Fresh Lead";
    document.getElementById("notes").value = state.quote.notes || "";
    document.getElementById("discountMode").value = state.quote.discountMode || "percent";
    document.getElementById("discountValue").value = String(state.quote.discountValue || 0);
    document.getElementById("gstRate").value = String(state.quote.gstRate ?? state.config.defaults.gstRate ?? 18);
    document.getElementById("preparedBy").value = state.quote.preparedBy || state.config.defaults.preparedBy || "Sales Desk";

    document.querySelectorAll('input[name="finishing"]').forEach((input) => {
      input.checked = state.quote.finishing.includes(input.value);
      input.closest(".check-card").classList.toggle("active", input.checked);
    });

    syncMinimalFormDefaults();
    updateQuoteFromForm();
  }

  function syncMinimalFormDefaults() {
    const productName = fieldValue("product") || state.quote?.product || "";
    syncMaterialSelection(productName);
    ensureFieldValue("quality", state.quote?.quality || "Economy");
    ensureFieldValue("printingType", state.quote?.printingType || "Eco-solvent");
    ensureFieldValue("colorType", state.quote?.colorType || "Color");
    ensureFieldValue("installationRequired", state.quote?.installationRequired || "No");
    ensureFieldValue("deliveryType", state.quote?.deliveryType || "Pickup");
    ensureFieldValue("urgency", state.quote?.urgency || "Normal");
    ensureFieldValue("followUpStatus", state.quote?.followUpStatus || "Fresh Lead");
    ensureFieldValue("preparedBy", state.quote?.preparedBy || state.config.defaults.preparedBy || "Sales Desk");
    syncDimensionVisibility(productName);
  }

  function syncMaterialSelection(productName) {
    const select = document.getElementById("materialType");
    if (!select) {
      return;
    }

    const product = getCatalogProduct(productName);
    const materials = product ? product.materials : [];
    const currentOptions = Array.from(select.options)
      .slice(1)
      .map((option) => option.value);

    if (currentOptions.join("|") !== materials.join("|")) {
      fillSelectOptions(select, materials, "Select material");
    }

    if (!materials.length) {
      select.value = "";
      return;
    }

    const preferredValue = select.value || state.quote?.materialType || "";
    select.value = materials.includes(preferredValue) ? preferredValue : materials[0];
  }

  function syncDimensionVisibility(productName) {
    const product = getCatalogProduct(productName);
    const needsDimensions = !product || product.unitType === "area";

    ["widthField", "heightField", "unitField"].forEach((id) => {
      const field = document.getElementById(id);
      if (field) {
        field.classList.toggle("is-hidden", !needsDimensions);
      }
    });

    ["width", "height", "dimensionUnit"].forEach((id) => {
      const field = document.getElementById(id);
      if (field) {
        field.required = needsDimensions;
      }
    });

    const quantityLabel = document.getElementById("quantityLabel");
    if (quantityLabel) {
      quantityLabel.textContent = product?.unitType === "page" ? "Pages" : "Quantity";
    }
  }

  function ensureFieldValue(id, value) {
    const field = document.getElementById(id);
    if (!field) {
      return;
    }

    if (!String(field.value || "").trim()) {
      field.value = value;
    }
  }

  function goToStep(stepNumber) {
    const totalSteps = document.querySelectorAll(".form-step").length || 1;
    const clamped = Math.min(totalSteps, Math.max(1, stepNumber));
    state.currentStep = clamped;
  }

  function validateCurrentStep() {
    const step = document.querySelector(`.form-step[data-step="${state.currentStep}"]`);
    if (!step) {
      return true;
    }

    const requiredFields = Array.from(step.querySelectorAll("[required]"));
    const firstInvalid = requiredFields.find((field) => !String(field.value).trim());
    if (firstInvalid) {
      firstInvalid.focus();
      toast("Missing details", "Please fill the required fields before continuing.", "warning");
      return false;
    }

    updateQuoteFromForm();
    const pricing = calculatePricing();
    if (pricing.discountExceeded) {
      toast("Discount exceeds limit", pricing.discountMessage, "warning");
      document.getElementById("discountValue").focus();
      return false;
    }

    return true;
  }

  function calculatePricing() {
    const quote = state.quote || defaultQuote();
    const productMeta = getCatalogProduct(quote.product);
    const pricingRow = getPricingRow(quote.product, quote.materialType);
    const unitType = pricingRow?.unitType || productMeta?.unitType || "area";
    const areaSqft = calculateAreaSqft(quote.width, quote.height, quote.dimensionUnit, quote.quantity);
    const areaSqm = areaSqft / 10.7639;
    const quantity = Math.max(1, toNumber(quote.quantity) || 1);
    const measure = resolveMeasure(unitType, areaSqft, quantity);
    const industryMultiplier = state.config.industryMultipliers?.[quote.industry] || 1;
    const urgencyMultiplier = state.config.urgencyMultipliers?.[quote.urgency] || 1;
    const qualityAdjustment = pricingRow?.qualityAdjustments?.[quote.quality] || 0;
    const printAdjustment = pricingRow?.printingAdjustments?.[quote.printingType] || 0;
    const colorAdjustment = pricingRow?.colorAdjustments?.[quote.colorType] || 0;
    const baseRate = (pricingRow?.baseRate || 0) + qualityAdjustment + printAdjustment + colorAdjustment;
    const materialAndPrintCost = (pricingRow?.materialCost || 0) + (pricingRow?.printCost || 0);
    let baseAmount = measure * baseRate * industryMultiplier * urgencyMultiplier;
    let baseCost = measure * materialAndPrintCost;

    if (unitType === "order") {
      baseAmount = Math.max(baseAmount, pricingRow?.minimumCharge || baseRate || 0);
      baseCost = Math.max(baseCost, (pricingRow?.materialCost || 0) + (pricingRow?.printCost || 0));
    } else if (pricingRow?.minimumCharge) {
      baseAmount = Math.max(baseAmount, pricingRow.minimumCharge);
    }

    const finishingDetails = quote.finishing.map((name) => calculateFinishing(name, unitType, measure));
    const addOns = finishingDetails.reduce((sum, item) => sum + item.sell, 0);
    const addOnCost = finishingDetails.reduce((sum, item) => sum + item.cost, 0);

    const installationAmount = quote.installationRequired === "Yes"
      ? calculateInstallation(pricingRow, unitType, measure)
      : 0;
    const installationCost = quote.installationRequired === "Yes"
      ? calculateInstallationCost(pricingRow, unitType, measure)
      : 0;
    const delivery = state.config.deliveryCharges?.[quote.deliveryType] || { sell: 0, cost: 0 };
    const subtotal = baseAmount + addOns + installationAmount + delivery.sell;
    const discountRaw = calculateDiscount(subtotal, quote.discountMode, quote.discountValue);
    const discountLimit = state.role === "Admin" ? Number.POSITIVE_INFINITY : subtotal * ((state.config.defaults.discountLimitPercent || 12) / 100);
    const discountExceeded = discountRaw > discountLimit + 0.01;
    const discount = discountExceeded ? discountLimit : discountRaw;
    const taxable = Math.max(0, subtotal - discount);
    const gstAmount = taxable * ((toNumber(quote.gstRate) || 0) / 100);
    const finalAmount = taxable + gstAmount;
    const totalCost = baseCost + addOnCost + installationCost + delivery.cost;
    const profit = taxable - totalCost;
    const margin = taxable > 0 ? (profit / taxable) * 100 : 0;
    const costPerUnit = quantity > 0 ? finalAmount / quantity : finalAmount;

    return {
      unitType,
      productMeta,
      pricingRow,
      areaSqft,
      areaSqm,
      measure,
      baseRate,
      baseAmount,
      baseCost,
      finishingDetails,
      addOns,
      addOnCost,
      installationAmount,
      installationCost,
      deliveryAmount: delivery.sell,
      deliveryCost: delivery.cost,
      subtotal,
      discount,
      discountRaw,
      discountLimit,
      discountExceeded,
      discountMessage: `The current role can discount up to ${formatCurrency(discountLimit)} for this quote.`,
      taxable,
      gstAmount,
      finalAmount,
      totalCost,
      profit,
      margin,
      costPerUnit
    };
  }

  function calculateAreaSqft(width, height, unit, quantity) {
    const w = toNumber(width);
    const h = toNumber(height);
    const qty = Math.max(1, toNumber(quantity) || 1);
    if (!w || !h) {
      return 0;
    }
    let singleArea = 0;
    if (unit === "ft") {
      singleArea = w * h;
    } else if (unit === "inch") {
      singleArea = (w * h) / 144;
    } else {
      singleArea = (w * h) / 92903.04;
    }
    return singleArea * qty;
  }

  function resolveMeasure(unitType, areaSqft, quantity) {
    if (unitType === "area") {
      return areaSqft;
    }
    if (unitType === "page") {
      return quantity;
    }
    if (unitType === "order") {
      return 1;
    }
    return quantity;
  }

  function calculateFinishing(name, unitType, measure) {
    const rates = state.config.finishingRates?.[name] || {};
    const basis = rates[unitType] ? unitType : rates.area ? "area" : rates.unit ? "unit" : "order";
    const rateSet = rates[basis] || { sell: 0, cost: 0 };
    const multiplier = basis === "order" ? 1 : measure;
    return {
      name,
      sell: rateSet.sell * multiplier,
      cost: rateSet.cost * multiplier
    };
  }

  function calculateInstallation(pricingRow, unitType, measure) {
    const rate = pricingRow?.installationCost || 0;
    if (unitType === "area") {
      return rate * measure;
    }
    if (unitType === "unit") {
      return Math.min(1, measure) * rate;
    }
    return rate;
  }

  function calculateInstallationCost(pricingRow, unitType, measure) {
    return calculateInstallation(
      { installationCost: (pricingRow?.installationCost || 0) * 0.62 },
      unitType,
      measure
    );
  }

  function calculateDiscount(subtotal, mode, value) {
    const numericValue = Math.max(0, toNumber(value));
    if (mode === "amount") {
      return Math.min(subtotal, numericValue);
    }
    return Math.min(subtotal, subtotal * (numericValue / 100));
  }

  async function tryAutofillClient() {
    updateQuoteFromForm();
    const query = state.quote.mobileNumber || state.quote.clientName || state.quote.email;
    if (!query || String(query).trim().length < 3) {
      return;
    }

    const localClient = state.clients.find((client) =>
      [client.mobileNumber, client.clientName, client.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === String(query).toLowerCase())
    );
    if (localClient) {
      hydrateClient(localClient);
      return;
    }

    const url = getAppsScriptUrl();
    if (!url) {
      return;
    }

    try {
      const response = await apiGet("client", { query });
      if (response && response.client) {
        mergeIncomingClients([response.client]);
        hydrateClient(response.client);
      }
    } catch (error) {
      console.warn("Client lookup failed", error);
    }
  }

  function hydrateClient(client) {
    applyQuoteData({
      ...state.quote,
      clientName: client.clientName || state.quote.clientName,
      companyName: client.companyName || state.quote.companyName,
      mobileNumber: client.mobileNumber || state.quote.mobileNumber,
      email: client.email || state.quote.email,
      gstNumber: client.gstNumber || state.quote.gstNumber,
      location: client.location || state.quote.location,
      industry: client.industry || state.quote.industry
    });
    document.getElementById("repeatClientFlag").textContent = "Repeat client detected";
    document.getElementById("clientLookupHint").textContent = `Client ${client.clientName || client.companyName} reused from saved records.`;
    renderAll();
  }

  async function saveDraft() {
    updateQuoteFromForm();
    const pricing = calculatePricing();
    const draftId = state.quote.sourceDraftId || generateId("DR");
    state.quote.sourceDraftId = draftId;
    const draft = {
      ...state.quote,
      id: draftId,
      quoteId: state.quote.id && String(state.quote.id).startsWith("QT-") ? state.quote.id : "",
      sourceDraftId: draftId,
      status: "Draft",
      syncState: "Local draft",
      pricingSnapshot: pricing,
      updatedAt: new Date().toISOString()
    };
    upsertRecord(state.draftCache, draft, "id");
    persistCollection(STORAGE_KEYS.drafts, state.draftCache);
    renderDraftOptions();
    renderAll();
    toast("Draft saved", `${draft.id} is available from the drafts menu.`, "success");
  }

  async function generateQuotation(options = {}) {
    if (!validateAllSteps()) {
      return;
    }
    updateQuoteFromForm();
    const pricing = calculatePricing();
    if (pricing.discountExceeded) {
      toast("Discount exceeds limit", pricing.discountMessage, "warning");
      document.getElementById("discountValue").focus();
      return;
    }

    const prepared = buildQuotationPayload(pricing);
    let record = { ...prepared };
    const url = getAppsScriptUrl();

    if (url) {
      try {
        const response = await apiPost("createQuotation", record);
        record.id = response.quoteId || record.id || generateId("QT");
        record.syncState = "Synced";
        setSyncStatus("synced", "Google Sheets connected", "success");
      } catch (error) {
        console.error(error);
        record.syncState = "Pending sync";
        record.status = "Draft";
        upsertRecord(state.draftCache, record, "id");
        persistCollection(STORAGE_KEYS.drafts, state.draftCache);
        renderDraftOptions();
        setSyncStatus("degraded", "Cloud save failed", "error");
        if (!options.quiet) {
          toast("Save failed", "The quote was kept as a local draft because Google Sheets did not confirm the save.", "error");
        }
        return null;
      }
    } else {
      record.id = generateId("QT");
      record.syncState = "Local only";
    }

    record.status = "Generated";
    state.lastSavedQuote = record;
    state.quote.id = record.id;
    state.quote.status = record.status;
    state.quote.syncState = record.syncState;
    upsertRecord(state.quotations, record, "id");
    persistCollection(STORAGE_KEYS.quotations, state.quotations);
    absorbClientFromRecord(record);
    removeDraftById(record.sourceDraftId || state.quote.sourceDraftId || record.id);
    renderAll();
    if (!options.skipPdf) {
      await downloadPdf(record, "quotation");
    }
    if (!options.quiet) {
      toast("Quotation generated", `${record.id} was saved${options.skipPdf ? "" : " and the PDF download started"}.`, "success");
    }
    return record;
  }

  async function convertToInvoice() {
    if (!validateAllSteps()) {
      return;
    }
    updateQuoteFromForm();

    let sourceQuote = state.lastSavedQuote;
    if (!sourceQuote || !sourceQuote.id) {
      sourceQuote = await generateQuotation({ skipPdf: true, quiet: true });
    }
    if (!sourceQuote || !sourceQuote.id) {
      return;
    }

    const invoiceRecord = buildInvoicePayload(sourceQuote);
    const url = getAppsScriptUrl();

    if (url) {
      try {
        const response = await apiPost("createInvoice", invoiceRecord);
        invoiceRecord.id = response.invoiceId || invoiceRecord.id || generateId("INV");
        invoiceRecord.invoiceId = invoiceRecord.id;
        invoiceRecord.syncState = "Synced";
        setSyncStatus("synced", "Google Sheets connected", "success");
      } catch (error) {
        console.error(error);
        toast("Invoice save failed", "The invoice could not be saved to Google Sheets, so no PDF was generated.", "error");
        setSyncStatus("degraded", "Invoice sync failed", "error");
        return;
      }
    } else {
      invoiceRecord.id = invoiceRecord.id || generateId("INV");
      invoiceRecord.invoiceId = invoiceRecord.id;
      invoiceRecord.syncState = "Local only";
    }

    state.lastSavedInvoice = invoiceRecord;
    state.quote.invoiceId = invoiceRecord.id;
    state.quote.status = "Converted";
    upsertRecord(state.invoices, invoiceRecord, "id");
    persistCollection(STORAGE_KEYS.invoices, state.invoices);

    const quoteIndex = state.quotations.findIndex((quote) => quote.id === sourceQuote.id);
    if (quoteIndex >= 0) {
      state.quotations[quoteIndex] = {
        ...state.quotations[quoteIndex],
        status: "Converted",
        invoiceId: invoiceRecord.id
      };
      persistCollection(STORAGE_KEYS.quotations, state.quotations);
    }

    renderAll();
    await downloadPdf(invoiceRecord, "invoice");
    toast("Invoice created", `${invoiceRecord.id} was generated from ${sourceQuote.id}.`, "success");
  }

  function buildQuotationPayload(pricing) {
    return {
      ...state.quote,
      id: resolveQuoteId(state.quote.id),
      sourceDraftId: state.quote.sourceDraftId || "",
      status: "Generated",
      date: state.quote.date || isoToday(),
      syncState: state.quote.syncState || "Pending",
      areaSqft: pricing.areaSqft,
      areaSqm: pricing.areaSqm,
      baseAmount: pricing.baseAmount,
      addOns: pricing.addOns,
      installationAmount: pricing.installationAmount,
      deliveryAmount: pricing.deliveryAmount,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discount,
      gstAmount: pricing.gstAmount,
      finalAmount: pricing.finalAmount,
      totalCost: pricing.totalCost,
      profit: pricing.profit,
      margin: pricing.margin,
      costPerUnit: pricing.costPerUnit,
      pricingSnapshot: pricing
    };
  }

  function buildInvoicePayload(quotationRecord) {
    const invoiceId = generateId("INV");
    return {
      ...quotationRecord,
      id: invoiceId,
      invoiceId: invoiceId,
      quoteId: quotationRecord.id,
      status: "Pending",
      paymentStatus: quotationRecord.paymentStatus || "Pending",
      date: isoToday()
    };
  }

  function validateAllSteps() {
    const totalSteps = document.querySelectorAll(".form-step").length || 1;
    for (let step = 1; step <= totalSteps; step += 1) {
      state.currentStep = step;
      if (!validateCurrentStep()) {
        goToStep(step);
        return false;
      }
    }
    goToStep(totalSteps);
    return true;
  }

  async function downloadPdf(record, mode) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast("PDF library missing", "jsPDF did not load, so the file could not be downloaded.", "error");
      return;
    }
    const doc = buildPdfDocument(record, mode);
    doc.save(`${record.id}.pdf`);
  }

  function buildPdfDocument(record, mode) {
    const doc = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    const company = state.config.company;
    const pricing = record.pricingSnapshot || calculatePricing();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    const boxPadding = 14;
    const rowPadding = 8;
    const lineGap = 13;
    const companyNameFontSize = 18;
    const companyInfoFontSize = 10;
    const companyNameLineHeightFactor = 1.1;
    const companyInfoLineHeightFactor = 1.3;
    const companyNameLineGap = companyNameFontSize * companyNameLineHeightFactor;
    const companyInfoLineGap = companyInfoFontSize * companyInfoLineHeightFactor;
    const quotePanelWidth = 176;
    const quotePanelHeight = 78;
    const quotePanelY = 36;
    const quotePanelX = pageWidth - margin - quotePanelWidth;
    const brandX = margin;
    const brandY = 36;
    const brandSize = 52;
    const companyTextX = brandX + brandSize + 16;
    const companyTextWidth = quotePanelX - companyTextX - 16;

    const flattenLines = (lines, maxWidth) => lines.flatMap((line) => doc.splitTextToSize(line, maxWidth));
    const companyName = company.name || "Shivrudra Graphics Pvt Ltd";
    const companyGst = normalizeCompanyGst(company.gstNumber);
    const companyDetailLines = [];
    const companyAddress = String(company.address || "").trim();
    const companyContactParts = [company.phone, company.email].map((value) => String(value || "").trim()).filter(Boolean);
    const companyWebsite = String(company.website || "").trim();

    if (companyAddress) {
      companyDetailLines.push(companyAddress);
    }
    if (companyContactParts.length) {
      companyDetailLines.push(companyContactParts.join(" | "));
    }
    if (companyWebsite) {
      companyDetailLines.push(companyWebsite);
    }
    if (companyGst) {
      companyDetailLines.push(`GST: ${companyGst}`);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(companyNameFontSize);
    const companyNameLines = doc.splitTextToSize(companyName, companyTextWidth);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(companyInfoFontSize);
    const companyNameBottomY = 54 + ((Math.max(companyNameLines.length, 1) - 1) * companyNameLineGap);
    const companyInfoStartY = companyNameBottomY + 18;
    const companyLines = flattenLines(companyDetailLines, companyTextWidth);
    const companyInfoBottomY = companyLines.length
      ? companyInfoStartY + ((companyLines.length - 1) * companyInfoLineGap) + 4
      : companyNameBottomY;
    const headerBottomY = Math.max(
      brandY + brandSize,
      quotePanelY + quotePanelHeight,
      companyInfoBottomY
    );
    const dividerY = headerBottomY + 18;

    drawBrandMark(doc, brandX, brandY, brandSize);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(companyNameFontSize);
    doc.setTextColor(18, 32, 43);
    doc.text(companyNameLines, companyTextX, 54, { lineHeightFactor: companyNameLineHeightFactor });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(companyInfoFontSize);
    doc.setTextColor(99, 113, 131);
    if (companyLines.length) {
      doc.text(companyLines, companyTextX, companyInfoStartY, { lineHeightFactor: companyInfoLineHeightFactor });
    }

    doc.setFillColor(245, 248, 252);
    doc.roundedRect(quotePanelX, quotePanelY, quotePanelWidth, quotePanelHeight, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(208, 77, 63);
    doc.text(mode === "invoice" ? "TAX INVOICE" : "QUOTATION", quotePanelX + boxPadding, quotePanelY + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(18, 32, 43);
    doc.text(`${mode === "invoice" ? "Invoice ID" : "Quote ID"}: ${record.id}`, quotePanelX + boxPadding, quotePanelY + 42);
    doc.text(`Date: ${formatDate(record.date || isoToday())}`, quotePanelX + boxPadding, quotePanelY + 58);
    if (mode === "invoice") {
      doc.text(`Quote Ref: ${record.quoteId || record.id}`, quotePanelX + boxPadding, quotePanelY + 72);
    } else {
      doc.text(`Valid for: ${state.config.defaults.quotationValidityDays || 7} days`, quotePanelX + boxPadding, quotePanelY + 72);
    }

    doc.setDrawColor(216, 224, 234);
    doc.line(margin, dividerY, pageWidth - margin, dividerY);

    const clientBoxY = dividerY + 16;
    const clientMaxWidth = contentWidth - (boxPadding * 2);
    const clientDetailLines = [record.clientName || "-"];
    const companyLine = String(record.companyName || "").trim();
    const contactLine = [record.mobileNumber, record.email].map((value) => String(value || "").trim()).filter(Boolean).join(" | ");
    const locationLine = [record.location, record.industry].map((value) => String(value || "").trim()).filter(Boolean).join(" | ");

    if (companyLine) {
      clientDetailLines.push(companyLine);
    }
    if (contactLine) {
      clientDetailLines.push(contactLine);
    }
    if (locationLine) {
      clientDetailLines.push(locationLine);
    }
    clientDetailLines.push(`GST: ${record.gstNumber || "Not provided"}`);

    const clientLines = flattenLines(clientDetailLines, clientMaxWidth);
    const clientBoxHeight = Math.max(96, 34 + (clientLines.length * lineGap));

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, clientBoxY, contentWidth, clientBoxHeight, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(18, 32, 43);
    doc.text(mode === "invoice" ? "Bill To" : "Quote For", margin + boxPadding, clientBoxY + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    clientLines.forEach((line, index) => {
      doc.text(line, margin + boxPadding, clientBoxY + 38 + (index * lineGap));
    });

    const tableTop = clientBoxY + clientBoxHeight + 22;
    const columnWidths = [
      contentWidth * 0.39,
      contentWidth * 0.22,
      contentWidth * 0.09,
      contentWidth * 0.14,
      contentWidth * 0.16
    ];
    const columns = [
      { label: "Item", x: margin, width: columnWidths[0], align: "left" },
      { label: "Size / Specs", x: margin + columnWidths[0], width: columnWidths[1], align: "left" },
      { label: "Qty", x: margin + columnWidths[0] + columnWidths[1], width: columnWidths[2], align: "right" },
      { label: "Rate", x: margin + columnWidths[0] + columnWidths[1] + columnWidths[2], width: columnWidths[3], align: "right" },
      { label: "Amount", x: margin + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3], width: columnWidths[4], align: "right" }
    ];

    doc.setFillColor(18, 32, 43);
    doc.rect(margin, tableTop, contentWidth, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    columns.forEach((column) => {
      const labelX = column.align === "right" ? column.x + column.width - rowPadding : column.x + rowPadding;
      doc.text(column.label, labelX, tableTop + 18, { align: column.align });
    });

    const rows = buildPdfRows(record, pricing);
    let y = tableTop + 28;
    rows.forEach((row) => {
      const itemLines = doc.splitTextToSize(String(row.item || "-"), columns[0].width - (rowPadding * 2));
      const specLines = doc.splitTextToSize(String(row.specs || "-"), columns[1].width - (rowPadding * 2));
      const rowLineCount = Math.max(itemLines.length, specLines.length, 1);
      const rowHeight = Math.max(30, (rowLineCount * lineGap) + 10);
      const textTopY = y + 16;
      const valueY = y + (rowHeight / 2) + 3;

      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(18, 32, 43);
      doc.text(itemLines, columns[0].x + rowPadding, textTopY);
      doc.text(specLines, columns[1].x + rowPadding, textTopY);
      doc.text(String(row.qty || "-"), columns[2].x + columns[2].width - rowPadding, valueY, { align: "right" });
      doc.text(String(row.rate || "-"), columns[3].x + columns[3].width - rowPadding, valueY, { align: "right" });
      doc.text(String(row.amount || "-"), columns[4].x + columns[4].width - rowPadding, valueY, { align: "right" });
      y += rowHeight;
    });

    const totalsWidth = 190;
    const totalsHeight = 112;
    const totalsX = margin + contentWidth - totalsWidth;
    const totalsY = y + 18;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(totalsX, totalsY, totalsWidth, totalsHeight, 8, 8, "F");
    const totals = [
      ["Subtotal", formatCurrency(record.subtotal || pricing.subtotal)],
      ["Discount", formatCurrency(record.discountAmount || pricing.discount)],
      ["GST", formatCurrency(record.gstAmount || pricing.gstAmount)],
      ["Final Amount", formatCurrency(record.finalAmount || pricing.finalAmount)]
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(18, 32, 43);
    totals.forEach((item, index) => {
      const lineY = totalsY + 22 + (index * 22);
      doc.text(item[0], totalsX + boxPadding, lineY);
      doc.setFont("helvetica", index === totals.length - 1 ? "bold" : "normal");
      doc.text(item[1], totalsX + totalsWidth - boxPadding, lineY, { align: "right" });
    });

    const footerTopGap = 28;
    const footerBottomMargin = 40;
    const termsWidth = 340;
    const signatureWidth = 150;
    const termFontSize = 9;
    const termLineHeightFactor = 1.35;
    const termLineGap = termFontSize * termLineHeightFactor;
    const termBlockGap = 8;
    const termsHeadingHeight = 16;
    const signatureBlockHeight = 48;
    const metaLineHeight = 12;
    const signatureX = pageWidth - margin - signatureWidth;
    const signatureTopOffset = 52;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(termFontSize);
    const termBlocks = state.config.terms.slice(0, 4).map((term, index) =>
      doc.splitTextToSize(`${index + 1}. ${term}`, termsWidth)
    );
    const termsBodyHeight = termBlocks.reduce((sum, lines) => sum + (lines.length * termLineGap) + termBlockGap, 0);
    const footerBodyHeight = Math.max(termsHeadingHeight + 12 + termsBodyHeight, signatureTopOffset + signatureBlockHeight);
    const footerHeight = footerBodyHeight + 24 + metaLineHeight;
    let footerTop = Math.max(totalsY + totalsHeight + footerTopGap, pageHeight - footerBottomMargin - footerHeight);

    if ((footerTop + footerHeight) > (pageHeight - footerBottomMargin)) {
      doc.addPage();
      footerTop = 58;
    }

    const termsHeadingY = footerTop;
    let termsCursorY = termsHeadingY + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(18, 32, 43);
    doc.text("Terms & Conditions", margin, termsHeadingY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(termFontSize);
    termBlocks.forEach((lines) => {
      doc.text(lines, margin, termsCursorY, { lineHeightFactor: termLineHeightFactor });
      termsCursorY += (lines.length * termLineGap) + termBlockGap;
    });

    const signatureLineY = footerTop + signatureTopOffset;
    doc.setDrawColor(216, 224, 234);
    doc.line(signatureX, signatureLineY, signatureX + signatureWidth, signatureLineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(18, 32, 43);
    doc.text("Authorized Signatory", signatureX + 6, signatureLineY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(record.preparedBy || state.config.defaults.preparedBy || "Sales Desk", signatureX + 6, signatureLineY + 32);

    const footerMetaY = Math.max(termsCursorY + 10, signatureLineY + signatureBlockHeight);
    doc.setFontSize(9);
    doc.setTextColor(99, 113, 131);
    doc.text(`Prepared by ${record.preparedBy || state.config.defaults.preparedBy || "Sales Desk"} | Generated on ${formatDateTime(new Date().toISOString())}`, margin, footerMetaY);
    return doc;
  }

  function buildPdfRows(record, pricing) {
    const sizeText = `${displayNumber(record.width)} x ${displayNumber(record.height)} ${record.dimensionUnit || "ft"}`;
    const rows = [
      {
        item: `${record.product || "-"} (${record.materialType || "-"})`,
        specs: sizeText,
        qty: String(record.quantity || 1),
        rate: formatCurrency(pricing.baseRate || 0),
        amount: formatCurrency(record.baseAmount || pricing.baseAmount || 0)
      }
    ];

    (record.finishing || []).forEach((name) => {
      const match = pricing.finishingDetails?.find((item) => item.name === name);
      rows.push({
        item: `${name} finishing`,
        specs: record.product || "-",
        qty: "-",
        rate: match ? formatCurrency(match.sell) : formatCurrency(0),
        amount: match ? formatCurrency(match.sell) : formatCurrency(0)
      });
    });

    if ((record.installationRequired || "No") === "Yes") {
      rows.push({
        item: "Installation",
        specs: record.deliveryType || "-",
        qty: "-",
        rate: formatCurrency(record.installationAmount || pricing.installationAmount || 0),
        amount: formatCurrency(record.installationAmount || pricing.installationAmount || 0)
      });
    }

    if ((record.deliveryAmount || pricing.deliveryAmount || 0) > 0) {
      rows.push({
        item: "Delivery",
        specs: record.deliveryType || "-",
        qty: "-",
        rate: formatCurrency(record.deliveryAmount || pricing.deliveryAmount || 0),
        amount: formatCurrency(record.deliveryAmount || pricing.deliveryAmount || 0)
      });
    }

    return rows;
  }

  async function shareOnWhatsapp() {
    const record = state.lastSavedQuote || state.quotations[0];
    if (!record || !record.id) {
      toast("Generate a quote first", "WhatsApp sharing becomes available after a quotation is generated.", "warning");
      return;
    }
    const message = [
      `Hello ${record.clientName || ""},`,
      `Please find your quotation ${record.id} from ${state.config.company.name}.`,
      `${record.product || "Job"} | Qty ${record.quantity || 1} | ${formatCurrency(record.finalAmount || 0)}`,
      `Prepared by ${record.preparedBy || state.config.defaults.preparedBy || "Sales Desk"}.`
    ].join(" ");

    const shareUrl = `https://wa.me/${sanitizePhone(record.mobileNumber)}?text=${encodeURIComponent(message)}`;
    window.open(shareUrl, "_blank", "noopener");
  }

  async function downloadLatestQuotation() {
    const record = state.lastSavedQuote
      || state.quotations.find((quote) => quote.id === state.quote.id)
      || state.quotations[0];
    if (!record || !record.id) {
      toast("No quotation yet", "Generate or save a quotation first, then you can download it here.", "warning");
      return;
    }
    await downloadPdf(record, "quotation");
  }

  async function downloadLatestInvoice() {
    const record = state.lastSavedInvoice
      || state.invoices.find((invoice) => invoice.id === state.quote.invoiceId)
      || state.invoices.find((invoice) => invoice.quoteId === state.quote.id)
      || state.invoices[0];
    if (!record || !record.id) {
      toast("No invoice yet", "Convert a quotation to an invoice first, then you can download it here.", "warning");
      return;
    }
    await downloadPdf(record, "invoice");
  }

  function duplicateCurrentQuote() {
    updateQuoteFromForm();
    const duplicate = {
      ...state.quote,
      id: "",
      invoiceId: "",
      sourceDraftId: "",
      status: "Draft",
      syncState: "Local copy",
      updatedAt: new Date().toISOString()
    };
    applyQuoteData(duplicate);
    toast("Quote duplicated", "The current quote has been copied into a fresh draft state.", "success");
  }

  function renderAll() {
    syncMinimalFormDefaults();
    updateQuoteFromForm();
    state.quotePricing = calculatePricing();
    renderProgress();
    renderProductHints();
    renderChips();
    renderPricingPreview();
    renderSidebar();
    renderStats();
    renderRecords();
    renderDraftOptions();
    renderClientSuggestions();
    renderLatestState();
  }

  function renderProgress() {
    if (!els.progressFill || !els.progressLabel) {
      return;
    }

    els.progressFill.style.width = "100%";
    els.progressLabel.textContent = "Single-page form";
  }

  function renderProductHints() {
    const product = getCatalogProduct(state.quote.product);
    const productHeadline = document.getElementById("productHeadline");
    const productDescription = document.getElementById("productDescription");
    const productUnitChip = document.getElementById("productUnitChip");

    if (!product) {
      productHeadline.textContent = "No product selected yet";
      productDescription.textContent = "Choose the service, add quantity, and enter size only when needed.";
      productUnitChip.textContent = "Pricing rule will appear here";
      return;
    }

    const unitLabel = product.unitType === "area"
      ? "Area based pricing"
      : product.unitType === "unit"
        ? "Quantity based pricing"
        : product.unitType === "page"
          ? "Page based pricing"
          : "Order based pricing";

    productHeadline.textContent = product.product;
    productDescription.textContent = product.description;
    productUnitChip.textContent = unitLabel;
  }

  function renderChips() {
    const repeatClientFlag = document.getElementById("repeatClientFlag");
    if (repeatClientFlag) {
      repeatClientFlag.textContent = state.clients.some((client) => client.mobileNumber === state.quote.mobileNumber)
        ? "Repeat client"
        : "New client";
    }

    const areaChip = document.getElementById("areaChip");
    if (areaChip) {
      areaChip.textContent = buildMeasureBadge(state.quotePricing);
    }

    const materialChip = document.getElementById("materialChip");
    if (materialChip) {
      materialChip.textContent = state.quote.materialType || "Material pending";
    }

    const finishingChip = document.getElementById("finishingChip");
    if (finishingChip) {
      finishingChip.textContent = state.quote.finishing.length ? `${state.quote.finishing.length} selected` : "No extras";
    }

    const timelineChip = document.getElementById("timelineChip");
    if (timelineChip) {
      timelineChip.textContent = state.quote.urgency === "Express" ? "Express" : "Standard";
    }

    const marginChip = document.getElementById("marginChip");
    if (marginChip) {
      marginChip.textContent = state.role === "Admin"
        ? `${formatNumber(state.quotePricing.margin, 1)}% margin`
        : "Margin hidden";
    }

    const quoteStateChip = document.getElementById("quoteStateChip");
    if (quoteStateChip) {
      quoteStateChip.textContent = state.lastSavedQuote?.id
        ? `${state.lastSavedQuote.id} ready`
        : "Ready to save";
    }

    els.quoteValidityChip.textContent = `Validity: ${state.config.defaults.quotationValidityDays || 7} days`;
  }

  function renderPricingPreview() {
    const pricing = state.quotePricing;
    document.getElementById("previewBase").textContent = formatCurrency(pricing.baseAmount);
    document.getElementById("previewAddons").textContent = formatCurrency(pricing.addOns);
    document.getElementById("previewInstallation").textContent = formatCurrency(pricing.installationAmount);
    document.getElementById("previewDelivery").textContent = formatCurrency(pricing.deliveryAmount);
    document.getElementById("previewSubtotal").textContent = formatCurrency(pricing.subtotal);
    document.getElementById("previewDiscount").textContent = formatCurrency(pricing.discount);
    document.getElementById("previewGst").textContent = formatCurrency(pricing.gstAmount);
    document.getElementById("previewCostPerUnit").textContent = `Per unit ${formatCurrency(pricing.costPerUnit)}`;
    document.getElementById("previewMargin").textContent = `${formatNumber(pricing.margin, 1)}%`;
    document.getElementById("discountWarning").textContent = pricing.discountExceeded ? pricing.discountMessage : "";
  }

  function renderSidebar() {
    const pricing = state.quotePricing;
    document.getElementById("previewClientName").textContent = state.quote.clientName || "Not filled";
    document.getElementById("previewProductName").textContent = state.quote.product || "Select product";
    document.getElementById("previewMaterialName").textContent = state.quote.materialType || "Auto selected";
    document.getElementById("previewSpecs").textContent = buildSpecsSummary(pricing);
    document.getElementById("previewGrandTotal").textContent = formatCurrency(pricing.finalAmount);

    const primaryMeasureLabel = document.getElementById("primaryMeasureLabel");
    const secondaryMeasureBlock = document.getElementById("secondaryMeasureBlock");
    const secondaryMeasureLabel = document.getElementById("secondaryMeasureLabel");

    if (pricing.unitType === "area") {
      if (primaryMeasureLabel) {
        primaryMeasureLabel.textContent = "Total area";
      }
      document.getElementById("areaSummaryValue").textContent = `${formatNumber(pricing.areaSqft, 2)} sq.ft.`;
      if (secondaryMeasureLabel) {
        secondaryMeasureLabel.textContent = "Metric area";
      }
      document.getElementById("metricAreaValue").textContent = `${formatNumber(pricing.areaSqm, 2)} sq.m.`;
      if (secondaryMeasureBlock) {
        secondaryMeasureBlock.classList.remove("is-hidden");
      }
    } else {
      if (primaryMeasureLabel) {
        primaryMeasureLabel.textContent = humanizeUnitType(pricing.unitType);
      }
      document.getElementById("areaSummaryValue").textContent = formatMeasureCount(pricing.unitType, state.quote.quantity);
      document.getElementById("metricAreaValue").textContent = "";
      if (secondaryMeasureBlock) {
        secondaryMeasureBlock.classList.add("is-hidden");
      }
    }

    document.getElementById("pricingBasisValue").textContent = humanizeUnitType(pricing.unitType);
    document.getElementById("profitCost").textContent = formatCurrency(pricing.totalCost);
    document.getElementById("profitNetSales").textContent = formatCurrency(pricing.taxable);
    document.getElementById("profitValue").textContent = formatCurrency(pricing.profit);

    const items = [
      ["Base amount", pricing.baseAmount],
      ["Finishing", pricing.addOns],
      ["Installation", pricing.installationAmount],
      ["Delivery", pricing.deliveryAmount],
      ["GST", pricing.gstAmount]
    ].filter((item) => item[1] > 0);

    els.breakdownList.innerHTML = "";
    items.forEach(([label, amount]) => {
      const row = document.createElement("div");
      row.className = "breakdown-item";
      row.innerHTML = `<span>${label}</span><strong>${formatCurrency(amount)}</strong>`;
      els.breakdownList.appendChild(row);
    });
  }

  function renderStats() {
    const totalQuotes = state.quotations.length;
    const totalInvoices = state.invoices.length;
    const revenue = state.invoices.reduce((sum, invoice) => sum + (invoice.finalAmount || 0), 0);
    const followUps = state.quotations.filter((quote) =>
      ["Follow-up Today", "Negotiation", "Awaiting Approval"].includes(quote.followUpStatus)
    ).length;
    const conversion = totalQuotes ? (totalInvoices / totalQuotes) * 100 : 0;

    document.getElementById("statQuotes").textContent = String(totalQuotes);
    document.getElementById("statQuotesNote").textContent = `${state.draftCache.length} draft(s) waiting`;
    document.getElementById("statConversion").textContent = `${formatNumber(conversion, 1)}%`;
    document.getElementById("statConversionNote").textContent = `${totalInvoices} invoice(s) created`;
    document.getElementById("statRevenue").textContent = formatCurrency(revenue);
    document.getElementById("statRevenueNote").textContent = totalInvoices ? "Locked from invoices" : "No invoices yet";
    document.getElementById("statFollowups").textContent = String(followUps);
    document.getElementById("statFollowupsNote").textContent = followUps ? "Quotes need action" : "Queue is clear";
  }

  function renderRecords() {
    const mode = els.recordTypeFilter.value || "quotations";
    const records = mode === "quotations" ? state.quotations : state.invoices;
    const search = String(els.recordSearch.value || "").toLowerCase();
    const filtered = records
      .filter((record) => {
        const haystack = [
          record.id,
          record.quoteId,
          record.clientName,
          record.companyName,
          record.product,
          record.status
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => new Date(b.updatedAt || b.date || 0) - new Date(a.updatedAt || a.date || 0));

    els.recordsTableBody.innerHTML = "";
    if (!filtered.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="7">No ${mode} found yet.</td>`;
      els.recordsTableBody.appendChild(row);
      return;
    }

    filtered.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${record.id || "-"}</strong><br><span class="badge ${badgeClass(record.syncState)}">${record.syncState || "Local"}</span></td>
        <td>${formatDate(record.date || isoToday())}</td>
        <td>${record.clientName || "-"}<br><span class="subtle">${record.companyName || ""}</span></td>
        <td>${record.product || "-"}<br><span class="subtle">${record.materialType || ""}</span></td>
        <td><span class="badge ${badgeClass(record.status || record.paymentStatus)}">${record.status || record.paymentStatus || "-"}</span></td>
        <td><strong>${formatCurrency(record.finalAmount || 0)}</strong></td>
        <td></td>
      `;
      const actionsCell = row.lastElementChild;
      const actions = document.createElement("div");
      actions.className = "row-actions";

      if (mode === "quotations") {
        actions.appendChild(makeMiniButton("Load", () => applyQuoteData(record)));
        actions.appendChild(makeMiniButton("Duplicate", () => applyQuoteData({ ...record, id: "", invoiceId: "", sourceDraftId: "", status: "Draft" })));
        actions.appendChild(makeMiniButton("PDF", () => downloadPdf(record, "quotation")));
        actions.appendChild(makeMiniButton("Invoice", async () => {
          applyQuoteData(record);
          await convertToInvoice();
        }));
      } else {
        actions.appendChild(makeMiniButton("Load quote", () => {
          const source = state.quotations.find((quote) => quote.id === record.quoteId);
          if (source) {
            applyQuoteData(source);
          }
        }));
        actions.appendChild(makeMiniButton("PDF", () => downloadPdf(record, "invoice")));
      }

      actionsCell.appendChild(actions);
      els.recordsTableBody.appendChild(row);
    });
  }

  function renderDraftOptions() {
    const selectedValue = state.quote?.sourceDraftId ? "__saved__" : "__new__";
    els.draftSelect.innerHTML = [
      '<option value="__new__">New quotation</option>',
      '<option value="__saved__">Saved draft</option>'
    ].join("");
    els.draftSelect.value = selectedValue;
  }

  function renderClientSuggestions() {
    const clients = state.clients
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 8);

    els.recentClients.innerHTML = "";
    els.clientNameOptions.innerHTML = "";
    els.clientMobileOptions.innerHTML = "";

    clients.forEach((client) => {
      const optionByName = document.createElement("option");
      optionByName.value = client.clientName || client.companyName || "";
      els.clientNameOptions.appendChild(optionByName);

      const optionByMobile = document.createElement("option");
      optionByMobile.value = client.mobileNumber || "";
      els.clientMobileOptions.appendChild(optionByMobile);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-button";
      button.textContent = `${client.clientName || client.companyName} | ${client.mobileNumber || ""}`;
      button.addEventListener("click", () => hydrateClient(client));
      els.recentClients.appendChild(button);
    });
  }

  function renderLatestState() {
    document.getElementById("latestQuoteId").textContent = state.lastSavedQuote?.id || state.quote.id || "Pending";
    document.getElementById("latestInvoiceId").textContent = state.lastSavedInvoice?.id || state.quote.invoiceId || "Pending";
    document.getElementById("latestFinalAmount").textContent = formatCurrency(state.quotePricing.finalAmount);
    const latestSyncState = state.lastSavedInvoice?.syncState || state.lastSavedQuote?.syncState || state.quote.syncState || "Local only";
    document.getElementById("latestSyncStatus").textContent = latestSyncState;
    const latestSyncMirror = document.getElementById("latestSyncStatusMirror");
    if (latestSyncMirror) {
      latestSyncMirror.textContent = latestSyncState;
    }
  }

  function renderRole() {
    document.querySelectorAll(".role-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.role === state.role);
    });
    document.body.classList.toggle("admin-hidden", state.role !== "Admin");
  }

  function setSyncStatus(mode, label, tone) {
    state.syncStatus = { mode, label, tone };
    els.syncBadge.className = `status-pill ${tone}`;
    els.syncBadgeText.textContent = label;
  }

  function openSettingsDialog() {
    if (typeof els.settingsDialog.showModal === "function") {
      els.settingsDialog.showModal();
    }
  }

  function closeSettingsDialog() {
    els.settingsDialog.close();
  }

  function saveSettings() {
    const settings = {
      appsScriptUrl: els.settingsAppsScriptUrl.value.trim(),
      company: {
        address: els.settingsAddress.value.trim(),
        phone: els.settingsPhone.value.trim(),
        email: els.settingsCompanyEmail.value.trim(),
        gstNumber: els.settingsCompanyGst.value.trim()
      },
      defaults: {
        preparedBy: els.settingsPreparedBy.value.trim() || "Sales Desk",
        quotationValidityDays: Math.max(1, toNumber(els.settingsValidityDays.value) || 7)
      }
    };
    writeStorage(STORAGE_KEYS.settings, settings);
    state.settings = settings;
    state.config = buildConfig();
    applySettingsToForm();
    toast("Settings saved", "Company details and the Apps Script endpoint have been updated.", "success");
  }

  function absorbClientFromRecord(record) {
    const client = {
      clientName: record.clientName,
      companyName: record.companyName,
      mobileNumber: record.mobileNumber,
      email: record.email,
      gstNumber: record.gstNumber,
      location: record.location,
      industry: record.industry,
      updatedAt: record.updatedAt || new Date().toISOString()
    };
    upsertRecord(state.clients, client, "mobileNumber");
    persistCollection(STORAGE_KEYS.clients, state.clients);
  }

  function mergeIncomingClients(clients) {
    clients.forEach((client) => {
      upsertRecord(state.clients, client, "mobileNumber");
    });
    persistCollection(STORAGE_KEYS.clients, state.clients);
  }

  function mergeIncomingRecords(records, type) {
    const target = type === "quotations" ? state.quotations : state.invoices;
    records.forEach((record) => {
      upsertRecord(target, record, "id");
    });
    persistCollection(type === "quotations" ? STORAGE_KEYS.quotations : STORAGE_KEYS.invoices, target);
  }

  function removeDraftById(id) {
    const before = state.draftCache.length;
    state.draftCache = state.draftCache.filter((draft) => draft.id !== id);
    if (state.draftCache.length !== before) {
      persistCollection(STORAGE_KEYS.drafts, state.draftCache);
    }
  }

  function getPricingRow(product, material) {
    return state.pricingMaster.find((row) => row.product === product && row.material === material)
      || state.pricingMaster.find((row) => row.product === product)
      || null;
  }

  function getCatalogProduct(productName) {
    return state.config.catalog.find((item) => item.product === productName) || null;
  }

  function persistCollection(key, collection) {
    writeStorage(key, collection);
  }

  function upsertRecord(collection, record, keyField) {
    const key = record[keyField];
    const index = collection.findIndex((item) => item[keyField] === key);
    if (index >= 0) {
      collection[index] = { ...collection[index], ...record };
    } else {
      collection.unshift(record);
    }
  }

  function generateId(prefix) {
    const year = new Date().getFullYear();
    const counters = readStorage(STORAGE_KEYS.counters, {});
    const counterKey = `${prefix}-${year}`;
    const next = (counters[counterKey] || 0) + 1;
    counters[counterKey] = next;
    writeStorage(STORAGE_KEYS.counters, counters);
    return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
  }

  function resolveQuoteId(value) {
    return value && String(value).startsWith("QT-") ? value : generateId("QT");
  }

  function normalizeCompanyGst(value) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === "GSTIN-UPDATE-IN-SETTINGS") {
      return "";
    }
    return normalized;
  }

  async function apiGet(action, params = {}) {
    const url = getAppsScriptUrl();
    if (!url) {
      throw new Error("Apps Script URL missing");
    }
    const search = new URLSearchParams({ action, ...params });
    return requestJson(`${url}?${search.toString()}`, {
      method: "GET",
      cache: "no-store"
    });
  }

  async function apiPost(action, payload) {
    const url = getAppsScriptUrl();
    if (!url) {
      throw new Error("Apps Script URL missing");
    }
    return requestJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ action, payload })
    });
  }

  function getAppsScriptUrl() {
    return state.config.appsScriptUrl || "";
  }

  function drawBrandMark(doc, x, y, size) {
    doc.setFillColor(208, 77, 63);
    doc.roundedRect(x, y, size, size, 10, 10, "F");
    doc.setFillColor(15, 118, 110);
    doc.circle(x + size - 12, y + 12, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("SG", x + 14, y + 34);
  }

  function makeMiniButton(label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function toast(title, message, tone) {
    const item = document.createElement("div");
    item.className = `toast ${tone || "success"}`;
    item.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    els.toastStack.appendChild(item);
    window.setTimeout(() => {
      item.remove();
    }, 4200);
  }

  function fillSelectOptions(select, values, placeholder) {
    const firstLabel = placeholder || "Select";
    select.innerHTML = `<option value="">${firstLabel}</option>`;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function badgeClass(value) {
    const map = String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (map.includes("generated")) {
      return "generated";
    }
    if (map.includes("converted")) {
      return "converted";
    }
    if (map.includes("draft")) {
      return "draft";
    }
    if (map.includes("pending")) {
      return "pending";
    }
    if (map.includes("follow")) {
      return "follow-up";
    }
    if (map.includes("paid")) {
      return "paid";
    }
    if (map.includes("lost")) {
      return "lost";
    }
    if (map.includes("sync")) {
      return "local";
    }
    return "local";
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function humanizeUnitType(unitType) {
    if (unitType === "area") {
      return "Area (sq.ft.)";
    }
    if (unitType === "unit") {
      return "Quantity";
    }
    if (unitType === "page") {
      return "Pages";
    }
    return "Per job";
  }

  function formatMeasureCount(unitType, quantity) {
    const count = Math.max(1, toNumber(quantity) || 1);
    if (unitType === "page") {
      return `${formatNumber(count, 0)} page${count === 1 ? "" : "s"}`;
    }
    if (unitType === "unit") {
      return `${formatNumber(count, 0)} unit${count === 1 ? "" : "s"}`;
    }
    return "Per job";
  }

  function buildMeasureBadge(pricing) {
    if (pricing.unitType === "area") {
      return `${formatNumber(pricing.areaSqft, 2)} sq.ft.`;
    }
    return formatMeasureCount(pricing.unitType, state.quote.quantity);
  }

  function buildSpecsSummary(pricing) {
    if (pricing.unitType === "area") {
      return `${displayNumber(state.quote.width)} x ${displayNumber(state.quote.height)} ${state.quote.dimensionUnit || "ft"} x ${state.quote.quantity || 1}`;
    }
    return formatMeasureCount(pricing.unitType, state.quote.quantity);
  }

  function fieldValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : "";
  }

  async function requestJson(url, options) {
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`${options.method || "GET"} failed with ${response.status}`);
        }
        const text = await response.text();
        const data = JSON.parse(text);
        if (data && data.status === "error") {
          throw new Error(data.message || "Apps Script returned an error");
        }
        return data;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts) {
          break;
        }
        await wait(300 * attempt);
      }
    }

    throw lastError || new Error("Request failed");
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function displayNumber(value) {
    if (!value) {
      return "0";
    }
    return Number(value).toString();
  }

  function formatNumber(value, decimals) {
    return Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatCurrency(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function isoToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value || "-";
    }
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value || "-";
    }
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("Failed to read local storage", key, error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Failed to write local storage", key, error);
    }
  }
})();

