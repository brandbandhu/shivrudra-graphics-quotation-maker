const APP_CONFIG = {
  sheets: {
    quotations: "Quotations",
    invoices: "Invoices",
    pricing: "Pricing Master",
    clients: "Clients"
  },
  quotationHeaders: [
    "Quote ID",
    "Date",
    "Client Name",
    "Company Name",
    "Mobile",
    "Email",
    "GST Number",
    "Location",
    "Industry",
    "Category",
    "Product",
    "Width",
    "Height",
    "Dimension Unit",
    "Size",
    "Qty",
    "Area Sqft",
    "Material",
    "Quality",
    "Printing Type",
    "Color Type",
    "Finishing",
    "Installation Required",
    "Delivery Type",
    "Urgency",
    "Base Cost",
    "Add-ons",
    "Installation",
    "Delivery",
    "Subtotal",
    "Discount",
    "GST Rate",
    "GST Amount",
    "Final Amount",
    "Total Cost",
    "Profit",
    "Margin",
    "Prepared By",
    "Follow-up Status",
    "Status",
    "Payment Status",
    "Notes",
    "Invoice ID",
    "Updated At",
    "Payload JSON"
  ],
  invoiceHeaders: [
    "Invoice ID",
    "Quote ID",
    "Date",
    "Client Name",
    "Company Name",
    "Mobile",
    "Product",
    "Qty",
    "Final Amount",
    "GST Amount",
    "Payment Status",
    "Status",
    "Updated At",
    "Payload JSON"
  ],
  pricingHeaders: [
    "Category",
    "Product",
    "Material",
    "Unit Type",
    "Base Rate",
    "Material Cost",
    "Print Cost",
    "Installation Cost",
    "Minimum Charge",
    "Quality Economy",
    "Quality Premium",
    "Print Eco-solvent",
    "Print UV",
    "Print Offset",
    "Print Screen",
    "Color BW",
    "Color Color"
  ],
  clientHeaders: [
    "Client Name",
    "Company Name",
    "Mobile",
    "Email",
    "GST Number",
    "Location",
    "Industry",
    "Updated At"
  ]
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "bootstrap";
    let response;

    switch (action) {
      case "pricing":
        response = { status: "success", pricingMaster: getPricingMaster_() };
        break;
      case "client":
        response = { status: "success", client: findClient_(e.parameter.query || "") };
        break;
      case "dashboard":
        response = { status: "success", dashboard: buildDashboard_() };
        break;
      case "quotations":
        response = { status: "success", quotations: listQuotations_() };
        break;
      case "invoices":
        response = { status: "success", invoices: listInvoices_() };
        break;
      case "bootstrap":
      default:
        response = {
          status: "success",
          pricingMaster: getPricingMaster_(),
          quotations: listQuotations_(),
          invoices: listInvoices_(),
          clients: listClients_(),
          dashboard: buildDashboard_()
        };
        break;
    }

    return jsonOutput_(response);
  } catch (error) {
    return jsonOutput_({
      status: "error",
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    const payload = parsePostPayload_(e);
    const action = payload.action;
    const data = payload.payload || {};
    let response;

    switch (action) {
      case "createQuotation":
        response = createQuotation_(data);
        break;
      case "createInvoice":
        response = createInvoice_(data);
        break;
      case "saveDraft":
        response = { status: "success", stored: true };
        break;
      default:
        throw new Error("Unsupported action: " + action);
    }

    return jsonOutput_(response);
  } catch (error) {
    return jsonOutput_({
      status: "error",
      message: error.message
    });
  }
}

function createQuotation_(data) {
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.quotations, APP_CONFIG.quotationHeaders);
  const quoteId = nextSequence_("QT", sheet, 1);
  const now = new Date();
  const dateText = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const sizeText = [data.width || 0, data.height || 0, data.dimensionUnit || "ft"].join(" x ");

  const row = [
    quoteId,
    dateText,
    data.clientName || "",
    data.companyName || "",
    data.mobileNumber || "",
    data.email || "",
    data.gstNumber || "",
    data.location || "",
    data.industry || "",
    data.category || "",
    data.product || "",
    data.width || 0,
    data.height || 0,
    data.dimensionUnit || "ft",
    sizeText,
    data.quantity || 0,
    data.areaSqft || 0,
    data.materialType || "",
    data.quality || "",
    data.printingType || "",
    data.colorType || "",
    (data.finishing || []).join(", "),
    data.installationRequired || "No",
    data.deliveryType || "",
    data.urgency || "",
    data.baseAmount || 0,
    data.addOns || 0,
    data.installationAmount || 0,
    data.deliveryAmount || 0,
    data.subtotal || 0,
    data.discountAmount || 0,
    data.gstRate || 0,
    data.gstAmount || 0,
    data.finalAmount || 0,
    data.totalCost || 0,
    data.profit || 0,
    data.margin || 0,
    data.preparedBy || "",
    data.followUpStatus || "",
    "Generated",
    data.paymentStatus || "Pending",
    data.notes || "",
    "",
    new Date(),
    JSON.stringify({ ...data, id: quoteId, date: dateText })
  ];

  sheet.appendRow(row);
  upsertClient_(data);

  return {
    status: "success",
    quoteId: quoteId
  };
}

function createInvoice_(data) {
  const invoiceSheet = getOrCreateSheet_(APP_CONFIG.sheets.invoices, APP_CONFIG.invoiceHeaders);
  const quotationSheet = getOrCreateSheet_(APP_CONFIG.sheets.quotations, APP_CONFIG.quotationHeaders);
  const invoiceId = nextSequence_("INV", invoiceSheet, 1);
  const now = new Date();
  const dateText = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const row = [
    invoiceId,
    data.quoteId || data.id || "",
    dateText,
    data.clientName || "",
    data.companyName || "",
    data.mobileNumber || "",
    data.product || "",
    data.quantity || 0,
    data.finalAmount || 0,
    data.gstAmount || 0,
    data.paymentStatus || "Pending",
    "Converted",
    new Date(),
    JSON.stringify({ ...data, id: invoiceId, date: dateText })
  ];

  invoiceSheet.appendRow(row);
  markQuotationConverted_(quotationSheet, data.quoteId || data.id || "", invoiceId);

  return {
    status: "success",
    invoiceId: invoiceId
  };
}

function markQuotationConverted_(sheet, quoteId, invoiceId) {
  if (!quoteId) {
    return;
  }
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (values[i][0] === quoteId) {
      sheet.getRange(i + 1, 40).setValue("Converted");
      sheet.getRange(i + 1, 43).setValue(invoiceId);
      sheet.getRange(i + 1, 44).setValue(new Date());
      break;
    }
  }
}

function getPricingMaster_() {
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.pricing, APP_CONFIG.pricingHeaders);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  return values.slice(1).filter((row) => row[1]).map((row) => ({
    category: row[0],
    product: row[1],
    material: row[2],
    unitType: row[3] || "area",
    baseRate: Number(row[4] || 0),
    materialCost: Number(row[5] || 0),
    printCost: Number(row[6] || 0),
    installationCost: Number(row[7] || 0),
    minimumCharge: Number(row[8] || 0),
    qualityAdjustments: {
      Economy: Number(row[9] || 0),
      Premium: Number(row[10] || 0)
    },
    printingAdjustments: {
      "Eco-solvent": Number(row[11] || 0),
      UV: Number(row[12] || 0),
      Offset: Number(row[13] || 0),
      Screen: Number(row[14] || 0)
    },
    colorAdjustments: {
      BW: Number(row[15] || 0),
      Color: Number(row[16] || 0)
    }
  }));
}

function listQuotations_() {
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.quotations, APP_CONFIG.quotationHeaders);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  return values.slice(1).filter((row) => row[0]).map((row) => parsePayloadCell_(row[44], {
    id: row[0],
    date: row[1],
    clientName: row[2],
    companyName: row[3],
    mobileNumber: row[4],
    email: row[5],
    gstNumber: row[6],
    location: row[7],
    industry: row[8],
    category: row[9],
    product: row[10],
    width: row[11],
    height: row[12],
    dimensionUnit: row[13],
    quantity: row[15],
    areaSqft: row[16],
    materialType: row[17],
    quality: row[18],
    printingType: row[19],
    colorType: row[20],
    finishing: row[21] ? String(row[21]).split(", ").filter(Boolean) : [],
    installationRequired: row[22],
    deliveryType: row[23],
    urgency: row[24],
    baseAmount: row[25],
    addOns: row[26],
    installationAmount: row[27],
    deliveryAmount: row[28],
    subtotal: row[29],
    discountAmount: row[30],
    gstRate: row[31],
    gstAmount: row[32],
    finalAmount: row[33],
    totalCost: row[34],
    profit: row[35],
    margin: row[36],
    preparedBy: row[37],
    followUpStatus: row[38],
    status: row[39],
    paymentStatus: row[40],
    notes: row[41],
    invoiceId: row[42],
    updatedAt: row[43],
    syncState: "Synced"
  }));
}

function listInvoices_() {
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.invoices, APP_CONFIG.invoiceHeaders);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  return values.slice(1).filter((row) => row[0]).map((row) => parsePayloadCell_(row[13], {
    id: row[0],
    quoteId: row[1],
    date: row[2],
    clientName: row[3],
    companyName: row[4],
    mobileNumber: row[5],
    product: row[6],
    quantity: row[7],
    finalAmount: row[8],
    gstAmount: row[9],
    paymentStatus: row[10],
    status: row[11],
    updatedAt: row[12],
    syncState: "Synced"
  }));
}

function listClients_() {
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.clients, APP_CONFIG.clientHeaders);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  return values.slice(1).filter((row) => row[2]).map((row) => ({
    clientName: row[0],
    companyName: row[1],
    mobileNumber: row[2],
    email: row[3],
    gstNumber: row[4],
    location: row[5],
    industry: row[6],
    updatedAt: row[7]
  }));
}

function buildDashboard_() {
  const quotations = listQuotations_();
  const invoices = listInvoices_();
  const quoteCount = quotations.length;
  const invoiceCount = invoices.length;
  const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || 0), 0);
  return {
    totalQuotes: quoteCount,
    totalInvoices: invoiceCount,
    conversionRate: quoteCount ? invoiceCount / quoteCount : 0,
    revenue: revenue,
    followUps: quotations.filter((quote) => {
      return ["Awaiting Approval", "Follow-up Today", "Negotiation"].indexOf(quote.followUpStatus) > -1;
    }).length
  };
}

function upsertClient_(data) {
  if (!data.mobileNumber) {
    return;
  }
  const sheet = getOrCreateSheet_(APP_CONFIG.sheets.clients, APP_CONFIG.clientHeaders);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][2]) === String(data.mobileNumber)) {
      sheet.getRange(i + 1, 1, 1, APP_CONFIG.clientHeaders.length).setValues([[
        data.clientName || "",
        data.companyName || "",
        data.mobileNumber || "",
        data.email || "",
        data.gstNumber || "",
        data.location || "",
        data.industry || "",
        new Date()
      ]]);
      return;
    }
  }

  sheet.appendRow([
    data.clientName || "",
    data.companyName || "",
    data.mobileNumber || "",
    data.email || "",
    data.gstNumber || "",
    data.location || "",
    data.industry || "",
    new Date()
  ]);
}

function findClient_(query) {
  if (!query) {
    return null;
  }
  const search = String(query).toLowerCase();
  const clients = listClients_();
  for (let i = 0; i < clients.length; i += 1) {
    const client = clients[i];
    const fields = [client.mobileNumber, client.clientName, client.companyName, client.email];
    const matched = fields.some((value) => value && String(value).toLowerCase() === search);
    if (matched) {
      return client;
    }
  }
  return null;
}

function nextSequence_(prefix, sheet, idColumnIndex) {
  const year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
  const values = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    const value = values[i][idColumnIndex - 1];
    if (!value) {
      continue;
    }
    const match = String(value).match(new RegExp("^" + prefix + "-" + year + "-(\\d+)$"));
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return prefix + "-" + year + "-" + Utilities.formatString("%03d", max + 1);
}

function parsePostPayload_(e) {
  const body = (e && e.postData && e.postData.contents) || "{}";
  return JSON.parse(body);
}

function parsePayloadCell_(payloadCell, fallback) {
  try {
    if (!payloadCell) {
      return fallback;
    }
    const parsed = JSON.parse(payloadCell);
    return Object.assign({}, parsed, fallback, { syncState: "Synced" });
  } catch (error) {
    return fallback;
  }
}

function getOrCreateSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existing = headerRange.getValues()[0];
  const needsHeaders = headers.some((header, index) => existing[index] !== header);
  if (needsHeaders) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
