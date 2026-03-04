const SPREADSHEET_ID = "1XHIq8lJONXZEPQbh2LGm1HVkbbqo5Znt0z9DLjR78q8";
const SHEET_NAME = "only timers/few timers";
const HEADER_ROW = 3;
const DATA_START_ROW = 4;

const FIELD_TO_HEADER = {
  toDo: "To do",
  statusFinalOutcome: "Status Final outcome",
  tipo: "Tipo",
  nextStep: "Next step",
  dueDateNextStep: "Due date for next step",
  statusNextStep: "Status for next step"
};

const STATUS_FINAL_OUTCOME = ["To-do", "On-going", "Done", "On hold"];
const TIPO = ["Otros", "Recruiting", "S3", "Clases", "Finanzas", "Personal"];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "").trim();
    if (action === "list") return json_({ tasks: listTasks_() });
    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "").trim();
    const body = parseBody_(e);

    if (action === "add") return json_(addTask_(body));
    if (action === "update") return json_(updateTask_(body));

    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function listTasks_() {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < DATA_START_ROW) return [];

  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol).getValues();
  const tasks = [];

  for (var i = 0; i < values.length; i++) {
    const row = values[i];
    const task = {
      rowId: DATA_START_ROW + i,
      toDo: str_(row[headerMap.toDo - 1]),
      statusFinalOutcome: normalizeStatus_(str_(row[headerMap.statusFinalOutcome - 1]) || "To-do"),
      tipo: str_(row[headerMap.tipo - 1]) || "Otros",
      nextStep: str_(row[headerMap.nextStep - 1]),
      dueDateNextStep: toIsoDate_(row[headerMap.dueDateNextStep - 1]),
      statusNextStep: str_(row[headerMap.statusNextStep - 1])
    };

    if (
      !task.toDo &&
      !task.statusFinalOutcome &&
      !task.tipo &&
      !task.nextStep &&
      !task.dueDateNextStep &&
      !task.statusNextStep
    ) {
      continue;
    }

    tasks.push(task);
  }

  return tasks;
}

function addTask_(body) {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);

  const payload = normalizePayload_(body, true);
  validatePayload_(payload);

  const rowId = Math.max(sheet.getLastRow() + 1, DATA_START_ROW);

  const sourceValidationRow = rowId > DATA_START_ROW ? rowId - 1 : DATA_START_ROW;
  applyValidationFromRow_(sheet, sourceValidationRow, rowId, [
    headerMap.statusFinalOutcome,
    headerMap.tipo,
    headerMap.statusNextStep
  ]);

  sheet.getRange(rowId, headerMap.toDo).setValue(payload.toDo);
  sheet.getRange(rowId, headerMap.statusFinalOutcome).setValue(payload.statusFinalOutcome);
  sheet.getRange(rowId, headerMap.tipo).setValue(payload.tipo);
  sheet.getRange(rowId, headerMap.nextStep).setValue(payload.nextStep);
  sheet.getRange(rowId, headerMap.dueDateNextStep).setValue(payload.dueDateNextStep);
  // Keep this formula-driven. Copy formula from previous row when available.
  copyFormulaFromRow_(sheet, sourceValidationRow, rowId, headerMap.statusNextStep);

  return { ok: true, rowId: rowId };
}

function updateTask_(body) {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);

  const rowId = Number(body.rowId);
  if (!Number.isInteger(rowId) || rowId < DATA_START_ROW) throw new Error("Invalid rowId");
  if (rowId > sheet.getLastRow()) throw new Error("rowId not found");

  const patch = body.patch || {};
  const current = readTaskAtRow_(sheet, headerMap, rowId);

  const merged = {
    ...current,
    ...(Object.prototype.hasOwnProperty.call(patch, "toDo") ? { toDo: str_(patch.toDo) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "statusFinalOutcome")
      ? { statusFinalOutcome: normalizeStatus_(str_(patch.statusFinalOutcome)) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "tipo") ? { tipo: str_(patch.tipo) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "nextStep") ? { nextStep: str_(patch.nextStep) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "dueDateNextStep")
      ? { dueDateNextStep: str_(patch.dueDateNextStep) }
      : {})
  };

  validatePayload_(merged);

  if (Object.prototype.hasOwnProperty.call(patch, "toDo")) {
    sheet.getRange(rowId, headerMap.toDo).setValue(merged.toDo);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "statusFinalOutcome")) {
    sheet.getRange(rowId, headerMap.statusFinalOutcome).setValue(merged.statusFinalOutcome);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "tipo")) {
    sheet.getRange(rowId, headerMap.tipo).setValue(merged.tipo);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "nextStep")) {
    sheet.getRange(rowId, headerMap.nextStep).setValue(merged.nextStep);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "dueDateNextStep")) {
    sheet.getRange(rowId, headerMap.dueDateNextStep).setValue(merged.dueDateNextStep);
  }

  // Keep "Status for next step" formula-driven after any key change.
  if (
    Object.prototype.hasOwnProperty.call(patch, "dueDateNextStep") ||
    Object.prototype.hasOwnProperty.call(patch, "nextStep") ||
    Object.prototype.hasOwnProperty.call(patch, "statusFinalOutcome")
  ) {
    reapplyStatusNextStepFormula_(sheet, headerMap, rowId);
  }

  return { ok: true };
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Missing sheet tab: " + SHEET_NAME);
  return sheet;
}

function getHeaderMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headerValues = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
  const headers = headerValues.map(str_);

  const map = {};
  Object.keys(FIELD_TO_HEADER).forEach(function (field) {
    const expectedHeader = FIELD_TO_HEADER[field];
    const index = headers.indexOf(expectedHeader);
    if (index < 0) {
      throw new Error('Header not found in row ' + HEADER_ROW + ': "' + expectedHeader + '"');
    }
    map[field] = index + 1;
  });

  return map;
}

function readTaskAtRow_(sheet, headerMap, rowId) {
  const lastCol = sheet.getLastColumn();
  const row = sheet.getRange(rowId, 1, 1, lastCol).getValues()[0];
  return {
    toDo: str_(row[headerMap.toDo - 1]),
    statusFinalOutcome: normalizeStatus_(str_(row[headerMap.statusFinalOutcome - 1]) || "To-do"),
    tipo: str_(row[headerMap.tipo - 1]) || "Otros",
    nextStep: str_(row[headerMap.nextStep - 1]),
    dueDateNextStep: toIsoDate_(row[headerMap.dueDateNextStep - 1]),
    statusNextStep: str_(row[headerMap.statusNextStep - 1])
  };
}

function normalizePayload_(input, isAdd) {
  return {
    toDo: str_(input.toDo),
    statusFinalOutcome: normalizeStatus_(str_(input.statusFinalOutcome) || (isAdd ? "To-do" : "")),
    tipo: str_(input.tipo) || (isAdd ? "Otros" : ""),
    nextStep: str_(input.nextStep),
    dueDateNextStep: str_(input.dueDateNextStep),
    statusNextStep: str_(input.statusNextStep)
  };
}

function validatePayload_(payload) {
  if (!payload.toDo) throw new Error("toDo is required");
  if (!payload.dueDateNextStep) throw new Error("dueDateNextStep is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dueDateNextStep)) {
    throw new Error("dueDateNextStep must be YYYY-MM-DD");
  }
  if (STATUS_FINAL_OUTCOME.indexOf(payload.statusFinalOutcome) === -1) {
    throw new Error("Invalid statusFinalOutcome");
  }
  if (TIPO.indexOf(payload.tipo) === -1) {
    throw new Error("Invalid tipo");
  }
}

function applyValidationFromRow_(sheet, sourceRow, targetRow, columns) {
  columns.forEach(function (column) {
    const sourceRule = sheet.getRange(sourceRow, column).getDataValidation();
    if (sourceRule) {
      sheet.getRange(targetRow, column).setDataValidation(sourceRule.copy().build());
    }
  });
}

function copyFormulaFromRow_(sheet, sourceRow, targetRow, column) {
  const sourceCell = sheet.getRange(sourceRow, column);
  const targetCell = sheet.getRange(targetRow, column);
  const sourceFormulaR1C1 = sourceCell.getFormulaR1C1();
  if (sourceFormulaR1C1) {
    targetCell.setFormulaR1C1(sourceFormulaR1C1);
  }
}

function reapplyStatusNextStepFormula_(sheet, headerMap, targetRow) {
  const formulaColumn = headerMap.statusNextStep;
  const sourceRow = findFormulaTemplateRow_(sheet, formulaColumn, targetRow);
  if (!sourceRow) return;
  copyFormulaFromRow_(sheet, sourceRow, targetRow, formulaColumn);
}

function findFormulaTemplateRow_(sheet, formulaColumn, targetRow) {
  const lastRow = sheet.getLastRow();
  const startRow = Math.max(DATA_START_ROW, Math.min(targetRow, lastRow));

  // Prefer rows above target first.
  for (var row = startRow; row >= DATA_START_ROW; row--) {
    if (sheet.getRange(row, formulaColumn).getFormulaR1C1()) return row;
  }
  // Fallback: search below.
  for (var row2 = startRow + 1; row2 <= lastRow; row2++) {
    if (sheet.getRange(row2, formulaColumn).getFormulaR1C1()) return row2;
  }
  return 0;
}

function normalizeStatus_(value) {
  if (value === "On-hold") return "On hold";
  return value;
}

function toIsoDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const stringValue = str_(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;

  const parsed = new Date(stringValue);
  if (isNaN(parsed)) return "";
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function str_(value) {
  return String(value == null ? "" : value).trim();
}

function parseBody_(e) {
  const raw = (e && e.postData && e.postData.contents) || "{}";
  try {
    return JSON.parse(raw);
  } catch (_err) {
    throw new Error("Invalid JSON body");
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
