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

    if (lastRow > 1) {
      var tokens = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < tokens.length; i++) {
        if (String(tokens[i][0]) === token) {
          return responder('duplicado');
        }
      }
    }

    sheet.appendRow([new Date(), token, voto]);
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
