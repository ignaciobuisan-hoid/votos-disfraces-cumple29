// Nombre exacto de la pestaña de la hoja donde se guardan los votos.
var SHEET_NAME = 'Hoja 1';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return responder('error');
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var token = data && data.token;
    var voto = data && data.voto;

    if (!token || !voto) {
      return responder('error');
    }

    token = String(token).trim();
    voto = String(voto).trim().slice(0, 80);

    if (!token || !voto) {
      return responder('error');
    }

    // Evita que el texto se interprete como fórmula en la hoja.
    if (/^[=+\-@]/.test(voto)) {
      voto = "'" + voto;
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var lastRow = sheet.getLastRow();
    var filaExistente = -1;

    if (lastRow > 1) {
      var tokens = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < tokens.length; i++) {
        if (String(tokens[i][0]) === token) {
          filaExistente = i + 2; // +2: los datos arrancan en la fila 2 y el loop es 0-indexado
          break;
        }
      }
    }

    if (filaExistente > 0) {
      // Ya había votado con este token: pisa su voto anterior (permite "cambiar mi voto").
      sheet.getRange(filaExistente, 1, 1, 3).setValues([[new Date(), token, voto]]);
    } else {
      sheet.appendRow([new Date(), token, voto]);
    }

    return responder('ok');
  } catch (err) {
    return responder('error');
  } finally {
    lock.releaseLock();
  }
}

function responder(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// Resultados normalizados con Gemini (pestaña "Resultados")
// ============================================================
// Setup (una sola vez, manual, ver README):
//   1. Cargar la API key de Gemini en Propiedades del script (GEMINI_API_KEY).
//   2. Ejecutar configurarAperturaAutomatica() una vez desde el editor y autorizar.
// A partir de ahí, cada vez que abrís la planilla se recalculan solos.

var RESULTS_SHEET_NAME = 'Resultados';
var GEMINI_MODEL = 'gemini-3.8-flash';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎭 Resultados disfraces')
    .addItem('Actualizar ahora', 'actualizarResultados')
    .addToUi();
}

function configurarAperturaAutomatica() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'alAbrirPlanilla') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('alAbrirPlanilla').forSpreadsheet(ss).onOpen().create();
}

function alAbrirPlanilla() {
  try {
    actualizarResultados();
  } catch (err) {
    console.error(err);
  }
}

function actualizarResultados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaVotos = ss.getSheetByName(SHEET_NAME);
  var lastRow = hojaVotos.getLastRow();

  var votos = [];
  if (lastRow > 1) {
    votos = hojaVotos.getRange(2, 3, lastRow - 1, 1).getValues()
      .map(function (fila) { return String(fila[0]).trim(); })
      .filter(function (v) { return v.length > 0; });
  }

  var resultados = votos.length > 0 ? normalizarConGemini(votos) : [];
  escribirResultados(resultados);
}

function normalizarConGemini(votos) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Falta configurar GEMINI_API_KEY en Propiedades del script.');
  }

  var prompt = 'Tenés una lista de disfraces votados en una fiesta de cumpleaños, ' +
    'escritos libremente por los invitados (pueden tener errores de tipeo, ' +
    'sinónimos, mayúsculas/minúsculas distintas, con o sin "el/la"). Agrupá bajo ' +
    'un único nombre corto y prolijo en español los que claramente son el mismo ' +
    'disfraz. Devolvé SOLO un JSON array (sin texto adicional, sin markdown) con ' +
    'objetos {"disfraz": string, "votos": number}, ordenado de mayor a menor ' +
    'cantidad de votos.\n\nLista de votos:\n' +
    votos.map(function (v, i) { return (i + 1) + '. ' + v; }).join('\n');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent?key=' + apiKey;

  var payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });

  var intentos = 3;

  for (var i = 0; i < intentos; i++) {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    });

    var status = res.getResponseCode();
    if (status === 200) {
      var body = JSON.parse(res.getContentText());
      var resultados = JSON.parse(body.candidates[0].content.parts[0].text);
      resultados.sort(function (a, b) { return b.votos - a.votos; });
      return resultados;
    }

    // 503 = modelo saturado (temporal): vale la pena reintentar. Otros errores no.
    if (status !== 503 || i === intentos - 1) {
      throw new Error('Gemini error ' + status + ': ' + res.getContentText());
    }

    Utilities.sleep(2000 * (i + 1)); // espera creciente: 2s, 4s
  }
}

function escribirResultados(resultados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(RESULTS_SHEET_NAME);
  if (!hoja) {
    hoja = ss.insertSheet(RESULTS_SHEET_NAME);
  }
  hoja.clear();
  hoja.getRange(1, 1, 1, 2).setValues([['Disfraz', 'Votos']]);

  if (resultados.length > 0) {
    var filas = resultados.map(function (r) { return [r.disfraz, r.votos]; });
    hoja.getRange(2, 1, filas.length, 2).setValues(filas);
  }

  hoja.autoResizeColumns(1, 2);
}
