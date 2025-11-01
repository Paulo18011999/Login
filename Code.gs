/**
 * Cole este arquivo diretamente em "Code.gs" no Apps Script.
 * Não inclua cabeçalhos de diff (por exemplo, linhas começando com "diff --git").
 */

const SHEETS = {
  companies: {
    name: 'Empresas',
    headers: ['ID', 'Nome', 'Email', 'Tipo', 'Telefone', 'Observacoes', 'Ativo']
  },
  bankAccounts: {
    name: 'ContasBancarias',
    headers: [
      'ID', 'Banco', 'Agencia', 'Conta', 'Carteira', 'Tipo', 'Notificar', 'Email',
      'Observacoes', 'Ativo'
    ]
  },
  accounts: {
    name: 'ContasAPagar',
    headers: [
      'ID', 'EmpresaID', 'Empresa', 'TipoConta', 'Titulo', 'Valor', 'Vencimento',
      'ContaBancariaID', 'ContaBancaria', 'Status', 'DataPagamento', 'DebitoAutomatico',
      'MesReferencia', 'Descricao', 'CriadoEm', 'AtualizadoEm', 'ObservacoesInternas'
    ]
  },
  settings: {
    name: 'Configuracoes',
    headers: ['Chave', 'Valor']
  },
  history: {
    name: 'HistoricoMeses',
    headers: [
      'MesReferencia', 'ContaID', 'Empresa', 'Titulo', 'Valor', 'Vencimento', 'Status',
      'DataPagamento', 'ContaBancaria', 'DebitoAutomatico', 'FechadoEm', 'Observacao'
    ]
  }
};

const STATUS = {
  pending: 'Pendente',
  overdue: 'Em Atraso',
  paid: 'Pago',
  autoDebit: 'Débito Automático'
};

const DEFAULT_SETTINGS = {
  EmailNotificacao: '',
  DiasAntecedencia: '3',
  ObservacaoFechamento: ''
};

function doGet() {
  initializeSheets_();
  const template = HtmlService.createTemplateFromFile('Index');
  return template
    .evaluate()
    .setTitle('E-protocolo • Borderô de pagamentos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getInitialData() {
  initializeSheets_();
  refreshAccountStatuses_();

  return {
    companies: readSheetObjects_('companies'),
    bankAccounts: readSheetObjects_('bankAccounts'),
    accounts: readSheetObjects_('accounts'),
    months: getAvailableMonths_(),
    settings: getSettings_()
  };
}

function saveCompany(company) {
  initializeSheets_();
  const headers = SHEETS.companies.headers;
  const record = normaliseRecord_(company, headers);
  const sheet = getSheet_('companies');
  const rowIndex = findRowIndex_(sheet, 'ID', record.ID);

  if (!record.ID) {
    record.ID = Utilities.getUuid();
    record.Ativo = record.Ativo === false ? 'FALSE' : 'TRUE';
    recordRowAppend_(sheet, headers, record);
  } else if (rowIndex > 0) {
    record.Ativo = record.Ativo === false ? 'FALSE' : String(record.Ativo || 'TRUE');
    recordRowUpdate_(sheet, headers, rowIndex, record);
  } else {
    record.ID = Utilities.getUuid();
    record.Ativo = record.Ativo === false ? 'FALSE' : 'TRUE';
    recordRowAppend_(sheet, headers, record);
  }

  return readSheetObjects_('companies');
}

function deleteCompany(id) {
  initializeSheets_();
  deleteRecordById_('companies', id);
  return readSheetObjects_('companies');
}

function saveBankAccount(account) {
  initializeSheets_();
  const headers = SHEETS.bankAccounts.headers;
  const record = normaliseRecord_(account, headers);
  const sheet = getSheet_('bankAccounts');
  const rowIndex = findRowIndex_(sheet, 'ID', record.ID);

  if (!record.ID) {
    record.ID = Utilities.getUuid();
    record.Ativo = record.Ativo === false ? 'FALSE' : 'TRUE';
    record.Notificar = record.Notificar ? 'TRUE' : 'FALSE';
    recordRowAppend_(sheet, headers, record);
  } else if (rowIndex > 0) {
    record.Ativo = record.Ativo === false ? 'FALSE' : String(record.Ativo || 'TRUE');
    record.Notificar = record.Notificar ? 'TRUE' : String(record.Notificar || 'FALSE');
    recordRowUpdate_(sheet, headers, rowIndex, record);
  } else {
    record.ID = Utilities.getUuid();
    recordRowAppend_(sheet, headers, record);
  }

  return readSheetObjects_('bankAccounts');
}

function deleteBankAccount(id) {
  initializeSheets_();
  deleteRecordById_('bankAccounts', id);
  return readSheetObjects_('bankAccounts');
}

function saveAccount(account) {
  initializeSheets_();
  const headers = SHEETS.accounts.headers;
  const sheet = getSheet_('accounts');
  const record = normaliseRecord_(account, headers);

  record.EmpresaID = record.EmpresaID || '';
  record.ContaBancariaID = record.ContaBancariaID || '';
  record.DebitoAutomatico = record.DebitoAutomatico ? 'TRUE' : 'FALSE';

  const companies = readSheetObjects_('companies');
  const bankAccounts = readSheetObjects_('bankAccounts');
  const company = companies.find(item => item.ID === record.EmpresaID);
  const bank = bankAccounts.find(item => item.ID === record.ContaBancariaID);
  record.Empresa = company ? company.Nome : '';
  record.ContaBancaria = bank ? `${bank.Banco} • ${bank.Conta}` : '';

  const nowIso = formatDateIso_(new Date());
  record.AtualizadoEm = nowIso;
  if (!record.CriadoEm) {
    record.CriadoEm = nowIso;
  }

  if (!record.MesReferencia) {
    record.MesReferencia = deriveMonthFromDate_(record.Vencimento || nowIso);
  }

  if (!record.ID) {
    record.ID = Utilities.getUuid();
    record.Status = record.DebitoAutomatico === 'TRUE' ? STATUS.autoDebit : STATUS.pending;
    recordRowAppend_(sheet, headers, record);
  } else {
    const rowIndex = findRowIndex_(sheet, 'ID', record.ID);
    if (rowIndex > 0) {
      recordRowUpdate_(sheet, headers, rowIndex, record);
    } else {
      recordRowAppend_(sheet, headers, record);
    }
  }

  refreshAccountStatuses_();
  return {
    accounts: readSheetObjects_('accounts'),
    months: getAvailableMonths_()
  };
}

function deleteAccount(id) {
  initializeSheets_();
  deleteRecordById_('accounts', id);
  refreshAccountStatuses_();
  return {
    accounts: readSheetObjects_('accounts'),
    months: getAvailableMonths_()
  };
}

function markAccountPaid(payload) {
  initializeSheets_();
  const sheet = getSheet_('accounts');
  const headers = SHEETS.accounts.headers;
  const rowIndex = findRowIndex_(sheet, 'ID', payload.id);

  if (rowIndex <= 0) {
    return readSheetObjects_('accounts');
  }

  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const record = headers.reduce((acc, key, index) => {
    acc[key] = values[index];
    return acc;
  }, {});

  record.Status = STATUS.paid;
  record.DataPagamento = payload.dataPagamento || formatDateIso_(new Date());
  record.ContaBancariaID = payload.contaBancariaId || record.ContaBancariaID || '';

  if (payload.contaBancariaId) {
    const bank = readSheetObjects_('bankAccounts').find(item => item.ID === payload.contaBancariaId);
    record.ContaBancaria = bank ? `${bank.Banco} • ${bank.Conta}` : record.ContaBancaria;
  }

  recordRowUpdate_(sheet, headers, rowIndex, record);
  refreshAccountStatuses_();
  return readSheetObjects_('accounts');
}

function reopenAccount(id) {
  initializeSheets_();
  const sheet = getSheet_('accounts');
  const headers = SHEETS.accounts.headers;
  const rowIndex = findRowIndex_(sheet, 'ID', id);

  if (rowIndex <= 0) {
    return readSheetObjects_('accounts');
  }

  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const record = headers.reduce((acc, key, index) => {
    acc[key] = values[index];
    return acc;
  }, {});

  record.Status = record.DebitoAutomatico === 'TRUE' ? STATUS.autoDebit : STATUS.pending;
  record.DataPagamento = '';
  recordRowUpdate_(sheet, headers, rowIndex, record);
  refreshAccountStatuses_();
  return readSheetObjects_('accounts');
}

function closeMonth(payload) {
  initializeSheets_();
  const month = payload.mesReferencia;
  const observation = payload.observacao || '';
  if (!month) {
    throw new Error('Informe um mês de referência (AAAA-MM).');
  }

  const accounts = readSheetObjects_('accounts');
  const filtered = accounts.filter(item => item.MesReferencia === month);
  const historySheet = getSheet_('history');
  const closedOn = formatDateIso_(new Date());

  filtered.forEach(item => {
    const row = [
      item.MesReferencia,
      item.ID,
      item.Empresa,
      item.Titulo,
      item.Valor,
      item.Vencimento,
      item.Status,
      item.DataPagamento,
      item.ContaBancaria,
      item.DebitoAutomatico,
      closedOn,
      observation
    ];
    historySheet.appendRow(row);
  });

  const nextMonth = advanceMonth_(month, 1);
  const sheet = getSheet_('accounts');
  const headers = SHEETS.accounts.headers;

  filtered.forEach(item => {
    const newRecord = Object.assign({}, item);
    newRecord.ID = Utilities.getUuid();
    newRecord.Status = item.DebitoAutomatico === 'TRUE' ? STATUS.autoDebit : STATUS.pending;
    newRecord.DataPagamento = '';
    newRecord.MesReferencia = nextMonth;
    if (item.Vencimento) {
      newRecord.Vencimento = advanceDateString_(item.Vencimento, 1);
    }
    newRecord.CriadoEm = formatDateIso_(new Date());
    newRecord.AtualizadoEm = newRecord.CriadoEm;
    recordRowAppend_(sheet, headers, newRecord);
  });

  return {
    accounts: readSheetObjects_('accounts'),
    months: getAvailableMonths_(),
    history: readSheetObjects_('history')
  };
}

function getHistory() {
  initializeSheets_();
  return readSheetObjects_('history');
}

function exportAccountsCsv(filters) {
  initializeSheets_();
  const month = filters && filters.month ? filters.month : null;
  const accounts = readSheetObjects_('accounts').filter(item => !month || item.MesReferencia === month);
  const headers = SHEETS.accounts.headers;
  const csv = [headers.join(',')].concat(
    accounts.map(account => headers.map(key => escapeCsvCell_(account[key] || '')).join(','))
  ).join('\n');

  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.CSV);
}

function getAccountsCsvData(filters) {
  initializeSheets_();
  const month = filters && filters.month ? filters.month : null;
  const accounts = readSheetObjects_('accounts').filter(item => !month || item.MesReferencia === month);
  const headers = SHEETS.accounts.headers;
  const csv = [headers.join(',')].concat(
    accounts.map(account => headers.map(key => escapeCsvCell_(account[key] || '')).join(','))
  ).join('\n');

  return {
    fileName: month ? `contas-${month}.csv` : 'contas.csv',
    base64: Utilities.base64Encode(csv, Utilities.Charset.UTF_8)
  };
}

function getChartData(range) {
  initializeSheets_();
  const start = range && range.start ? range.start : null;
  const end = range && range.end ? range.end : null;
  const accounts = readSheetObjects_('accounts').filter(item => {
    if (!item.Vencimento) return false;
    if (start && item.Vencimento < start) return false;
    if (end && item.Vencimento > end) return false;
    return true;
  });

  const grouped = accounts.reduce((acc, item) => {
    const month = item.MesReferencia || deriveMonthFromDate_(item.Vencimento);
    const key = `${month}`;
    const value = parseFloat(item.Valor || 0) || 0;
    acc[key] = (acc[key] || 0) + value;
    return acc;
  }, {});

  const labels = Object.keys(grouped).sort();
  const values = labels.map(label => grouped[label]);
  return { labels, values };
}

function saveSettings(settings) {
  initializeSheets_();
  const sheet = getSheet_('settings');
  const headers = SHEETS.settings.headers;

  Object.keys(DEFAULT_SETTINGS).forEach(key => {
    const value = settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
    const rowIndex = findRowIndex_(sheet, 'Chave', key);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });

  return getSettings_();
}

function getSettings_() {
  const sheet = getSheet_('settings');
  const data = sheet.getDataRange().getValues();
  const settings = Object.assign({}, DEFAULT_SETTINGS);
  data.slice(1).forEach(row => {
    if (row[0]) {
      settings[row[0]] = row[1];
    }
  });
  if (!settings.EmailNotificacao) {
    settings.EmailNotificacao = Session.getActiveUser().getEmail();
  }
  return settings;
}

function processNotifications() {
  initializeSheets_();
  refreshAccountStatuses_();
  const settings = getSettings_();
  const recipient = settings.EmailNotificacao || Session.getActiveUser().getEmail();
  const daysBefore = parseInt(settings.DiasAntecedencia, 10) || 3;
  const today = new Date();
  const todayIso = formatDateIso_(today);
  const accounts = readSheetObjects_('accounts');

  const dueSoon = accounts.filter(account => {
    if (account.Status === STATUS.paid) return false;
    if (!account.Vencimento) return false;
    const dueDate = parseDate_(account.Vencimento);
    const diff = Math.floor((dueDate.getTime() - today.getTime()) / (24 * 3600 * 1000));
    if (diff === daysBefore) return true;
    if (diff < 0) return true;
    return false;
  });

  if (!dueSoon.length) {
    return { sent: false };
  }

  const appUrl = ScriptApp.getService().getUrl();
  const subject = `Contas com vencimento - ${todayIso}`;
  const rows = dueSoon.map(item => `• ${item.Titulo} (${item.Empresa}) - Vence em ${item.Vencimento} - Valor: R$ ${item.Valor}`);
  const body = [
    'Olá,',
    '',
    `As seguintes contas estão próximas do vencimento ou em atraso (link ${daysBefore} dias / diária).`,
    '',
    rows.join('\n'),
    '',
    `Acesse o aplicativo: ${appUrl}`,
    '',
    'Esta mensagem foi enviada automaticamente pelo E-protocolo.'
  ].join('\n');

  MailApp.sendEmail(recipient, subject, body);
  return { sent: true, count: dueSoon.length };
}

function refreshAccountStatuses_() {
  const sheet = getSheet_('accounts');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = SHEETS.accounts.headers;
  const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const data = dataRange.getValues();
  const today = new Date();
  let updated = false;

  const updatedRows = data.map(row => {
    const record = headers.reduce((acc, key, index) => {
      acc[key] = row[index];
      return acc;
    }, {});

    if (record.Status === STATUS.paid) {
      return row;
    }

    if (record.DebitoAutomatico === 'TRUE') {
      if (record.Status !== STATUS.autoDebit) {
        record.Status = STATUS.autoDebit;
        updated = true;
      }
    } else if (record.Vencimento) {
      const due = parseDate_(record.Vencimento);
      if (due < today && record.Status !== STATUS.overdue) {
        record.Status = STATUS.overdue;
        updated = true;
      } else if (due >= today && record.Status !== STATUS.pending) {
        record.Status = STATUS.pending;
        updated = true;
      }
    }

    return headers.map(key => record[key]);
  });

  if (updated) {
    dataRange.setValues(updatedRows);
  }
}

function initializeSheets_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(key => {
    const config = SHEETS[key];
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
    }
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);
  });
}

function getSheet_(key) {
  const ss = SpreadsheetApp.getActive();
  const config = SHEETS[key];
  if (!config) {
    throw new Error(`Sheet config not found for ${key}`);
  }
  const sheet = ss.getSheetByName(config.name);
  if (!sheet) {
    throw new Error(`Sheet ${config.name} não encontrada.`);
  }
  return sheet;
}

function readSheetObjects_(key) {
  const sheet = getSheet_(key);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }
  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => headers.reduce((acc, header, index) => {
      acc[header] = row[index];
      return acc;
    }, {}));
}

function recordRowAppend_(sheet, headers, record) {
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  sheet.appendRow(row);
}

function recordRowUpdate_(sheet, headers, rowIndex, record) {
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

function deleteRecordById_(key, id) {
  if (!id) return;
  const sheet = getSheet_(key);
  const rowIndex = findRowIndex_(sheet, 'ID', id);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
  }
}

function normaliseRecord_(data, headers) {
  const source = data || {};
  const normalised = {};
  Object.keys(source).forEach(key => {
    normalised[normalizeKey_(key)] = source[key];
  });

  const record = {};
  headers.forEach(header => {
    const key = normalizeKey_(header);
    if (normalised.hasOwnProperty(key)) {
      record[header] = normalised[key];
    } else {
      record[header] = '';
    }
  });

  if (!record.ID) {
    record.ID = normalised.id || normalised.Id || '';
  }

  return Object.assign(record, source);
}

function findRowIndex_(sheet, idColumn, id) {
  if (!id) return -1;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const columnIndex = headers.indexOf(idColumn);
  if (columnIndex === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][columnIndex]) === String(id)) {
      return i + 1;
    }
  }
  return -1;
}

function parseDate_(dateString) {
  if (!dateString) {
    return new Date();
  }
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    return new Date(year, month, day);
  }
  return new Date(dateString);
}

function formatDateIso_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function deriveMonthFromDate_(dateString) {
  if (!dateString) {
    const today = new Date();
    return Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const date = parseDate_(dateString);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function advanceMonth_(monthString, offset) {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function advanceDateString_(dateString, months) {
  if (!dateString) return '';
  const date = parseDate_(dateString);
  date.setMonth(date.getMonth() + months);
  return formatDateIso_(date);
}

function getAvailableMonths_() {
  const accounts = readSheetObjects_('accounts');
  const months = {};
  accounts.forEach(account => {
    if (account.MesReferencia) {
      months[account.MesReferencia] = true;
    }
  });
  return Object.keys(months).sort();
}

function escapeCsvCell_(value) {
  const string = String(value || '');
  if (/[",\n]/.test(string)) {
    return '"' + string.replace(/"/g, '""') + '"';
  }
  return string;
}

function capitalizeFirstLetter_(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeKey_(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getNotificationsPreview() {
  initializeSheets_();
  refreshAccountStatuses_();
  const settings = getSettings_();
  const daysBefore = parseInt(settings.DiasAntecedencia, 10) || 3;
  const today = new Date();
  const accounts = readSheetObjects_('accounts');
  const preview = accounts.filter(account => {
    if (account.Status === STATUS.paid) return false;
    if (!account.Vencimento) return false;
    const diff = Math.floor((parseDate_(account.Vencimento).getTime() - today.getTime()) / (24 * 3600 * 1000));
    return diff <= daysBefore;
  });
  return {
    daysBefore,
    list: preview
  };
}

function setupTriggers() {
  ScriptApp.newTrigger('processNotifications')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

