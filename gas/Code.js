/**
 * ============================================================
 * リテリング実験システム — Google Apps Script バックエンド (Code.js)
 * ============================================================
 * デプロイ設定:
 *   種類: ウェブアプリ / 実行ユーザー: 自分 / アクセスできるユーザー: 全員（Anyone）
 *
 * スクリプトプロパティ（[プロジェクトの設定] → [スクリプト プロパティ]）:
 *   GEMINI_API_KEY   : Gemini API キー（uploadAudio での文字起こし・判定に使用）【必須】
 *   GEMINI_MODEL     : 任意（既定: gemini-3.8-flash。payload.model が優先）
 *   SPREADSHEET_ID   : 任意（payload.spreadsheetId が無い場合のフォールバック）
 *   DRIVE_FOLDER_ID  : 任意（payload.folderId が無い場合のフォールバック）
 *
 * ※ スプレッドシートID・フォルダIDはコード内にハードコードしないこと。
 * ※ 同一 participantId でも sessionId ごとに必ず新規行として末尾に追記（Append）されます。
 * ============================================================
 */

var SHEET_NAME = 'RetellingData';
var DEFAULT_MODEL = 'gemini-3.8-flash';
var CELL_LIMIT = 49000; // セル文字数上限(50,000)の安全マージン
var LOCK_TIMEOUT_MS = 30000; // GAS LockService 最大待機時間 (30秒)

/**
 * カラム定義 [key, ヘッダー表示名]
 * 2要因実験（topicId × mode）分析用の必須カラム（ExperimentLogPayload）＋詳細ログ列
 */
var COLUMNS = [
  ['timestamp', 'タイムスタンプ(ISO)'],
  ['sessionId', 'セッションID'],
  ['participantId', '被験者ID'],
  ['topicId', '実験テーマ(topicId)'],
  ['mode', '実験モード(mode)'],
  ['selectedCard', '選択カード(selectedCard)'],
  ['readingTime1_ms', '読解時間1(readingTime1_ms)'],
  ['readingTime2_ms', '再読解時間2(readingTime2_ms)'],
  ['quizAttemptCount', 'クイズ試行回数(quizAttemptCount)'],
  ['quizAnswersHistory', 'クイズ回答履歴(quizAnswersHistory)'],
  ['extractedKeywords', '抽出キーワード(extractedKeywords)'],
  ['retellingDuration_sec', '発話・対話時間秒(retellingDuration_sec)'],
  ['speechTranscript', '発話・対話ログ(speechTranscript)'],
  ['caf_complexity', 'CAF複雑さ(caf_complexity)'],
  ['caf_accuracy', 'CAF正確さ(caf_accuracy)'],
  ['caf_fluency', 'CAF流暢さ(caf_fluency)'],
  ['persuasion_score', '説得度スコア(persuasion_score)'],
  ['full_evaluation_json', '生評価JSON(full_evaluation_json)'],
  // 既存互換・詳細補助カラム
  ['attempt', '試行回数'],
  ['fullPrompt', 'お題テキスト'],
  ['cardIds', '選択カードID'],
  ['cardTexts', '選択カード本文'],
  ['readingSec', '読解所要時間（秒）'],
  ['quizCorrect', 'クイズ正答数'],
  ['quizRate', 'クイズ正答率'],
  ['quizDetail', 'クイズ詳細(JSON)'],
  ['rereadingSec', '再読解所要時間（秒）'],
  ['keywords', '抽出キーワード一覧'],
  ['audioUrls', '保存音声のドライブURL'],
  ['transcript', 'リテリング確定文字起こし（Gemini）'],
  ['dialogLog', '対話ログ(JSON)'],
  ['cafTotal', 'CAF総合点(/30)'],
  ['cafContent', '内容の正確さと網羅性(/12)'],
  ['cafOrganization', '構成と論理的な流れ(/10)'],
  ['cafLanguage', '言語使用の正確さと流暢さ(/8)'],
  ['cafDetail', 'CAF詳細(JSON)'],
  ['characterFeedback', 'キャラクター定性評価ログ'],
  ['updatedAt', '最終更新'],
];

/** 再挑戦（キーワード選択から）時に複製する範囲 */
var RETRY_COPY_KEYS = [
  'participantId', 'topicId', 'mode', 'selectedCard', 'fullPrompt', 'cardIds', 'cardTexts',
  'readingTime1_ms', 'readingSec', 'quizAttemptCount', 'quizAnswersHistory', 'quizCorrect', 'quizRate', 'quizDetail',
  'readingTime2_ms', 'rereadingSec',
];

/** 再挑戦（カード選択から）時に複製する範囲 */
var RETRY_COPY_KEYS_CARDS = [
  'participantId', 'topicId', 'mode', 'fullPrompt',
];

// ============================================================
// エントリーポイント
// ============================================================
function doGet() {
  return json_({ ok: true, service: 'retelling-research-gas', time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = req.action;

    // 音声の Drive 保存・Gemini 処理やスプレッドシートのオープンはロック外で行い、
    // シートへの読み書き部分のみを最小限の時間でロックする
    var handlers = {
      saveInitial: saveInitial_,
      logReading: logReading_,
      saveQuiz: saveQuiz_,
      logRereading: logRereading_,
      uploadAudio: uploadAudio_,
      duplicateForRetry: duplicateForRetry_,
      saveFinalAssessment: saveFinalAssessment_,
    };
    if (!handlers[action]) throw new Error('Unknown action: ' + action);

    var result = handlers[action](req, lock) || {};
    result.ok = true;
    return json_(result);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try {
      if (lock.hasLock()) {
        SpreadsheetApp.flush();
        lock.releaseLock();
      }
    } catch (_) {}
  }
}

/**
 * スプレッドシートをロック外で開いた上で、ロックを取得してコールバックを実行し、
 * 即座に flush & releaseLock するヘルパー
 */
function withSheetLock_(req, lock, fn) {
  var ss = openSpreadsheet_(req);
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
    var sheet = ensureSheet_(ss);
    var res = fn(sheet);
    SpreadsheetApp.flush();
    return res;
  } finally {
    try {
      if (lock.hasLock()) lock.releaseLock();
    } catch (_) {}
  }
}

// ============================================================
// アクション
// ============================================================

/** 画面① 初期登録（セッションごとに必ず末尾に新規行を Append） */
function saveInitial_(req, lock) {
  return withSheetLock_(req, lock, function (sheet) {
    var nowIso = new Date().toISOString();
    appendRow_(sheet, {
      timestamp: req.timestamp || nowIso,
      sessionId: req.sessionId,
      participantId: req.participantId,
      topicId: req.topicId || '',
      mode: req.mode !== undefined ? req.mode : '',
      fullPrompt: req.fullPrompt || '',
      attempt: req.attempt || 1,
      updatedAt: nowIso,
    });
    return { sessionId: req.sessionId };
  });
}

/** 画面④ 読解時間・カード本文 */
function logReading_(req, lock) {
  var cards = req.cards || [];
  var selectedCard = req.selectedCard || (cards[0] && cards[0].id) || '';
  var patch = {
    topicId: req.topicId,
    mode: req.mode,
    fullPrompt: req.fullPrompt,
    selectedCard: selectedCard,
    cardIds: cards.map(function (c) { return c.id; }).join(', '),
    cardTexts: cards.map(function (c) {
      var levelInfo = c.relevance_level ? ' [Level: ' + c.relevance_level + ']' : '';
      return '[' + c.id + ']' + levelInfo + ' ' + c.title + '\n' + c.body;
    }).join('\n\n'),
    readingTime1_ms: req.readingTime1_ms !== undefined ? req.readingTime1_ms : req.readingMs,
    readingSec: req.readingSec,
  };
  return withSheetLock_(req, lock, function (sheet) {
    var row = findRowOrCreate_(sheet, req);
    setValues_(sheet, row, patch);
    return {};
  });
}

/** 画面⑥ クイズ結果 */
function saveQuiz_(req, lock) {
  var patch = {
    quizAttemptCount: req.quizAttemptCount !== undefined ? req.quizAttemptCount : 1,
    quizAnswersHistory: req.quizAnswersHistory || JSON.stringify(req.details || []),
    quizCorrect: req.correct + ' / ' + req.total,
    quizRate: req.rate,
    quizDetail: JSON.stringify(req.details || []),
  };
  return withSheetLock_(req, lock, function (sheet) {
    var row = findRowOrCreate_(sheet, req);
    setValues_(sheet, row, patch);
    return {};
  });
}

/** 画面⑦ 再読解時間 */
function logRereading_(req, lock) {
  var patch = {
    readingTime2_ms: req.readingTime2_ms !== undefined ? req.readingTime2_ms : req.rereadingMs,
    rereadingSec: req.rereadingSec,
  };
  return withSheetLock_(req, lock, function (sheet) {
    var row = findRowOrCreate_(sheet, req);
    setValues_(sheet, row, patch);
    return {};
  });
}

/** 画面⑨ 音声保存 → Gemini 文字起こし・判定 */
function uploadAudio_(req, lock) {
  // 1) ドライブ保存（ロック外）
  var folderId = req.folderId || prop_('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID が未設定です');
  var folder = DriveApp.getFolderById(folderId);
  var mimeType = req.mimeType || 'audio/webm';
  var bytes = Utilities.base64Decode(req.audioBase64);
  var blob = Utilities.newBlob(bytes, mimeType, req.fileName || ('audio_' + Date.now() + '.webm'));
  var file = folder.createFile(blob);
  file.setDescription(
    'participant=' + req.participantId +
    ' topic=' + (req.topicId || '') +
    ' mode=' + (req.mode || '') +
    ' attempt=' + req.attempt +
    ' turn=' + req.turn +
    ' session=' + req.sessionId
  );
  var fileUrl = file.getUrl();
  var fileId = file.getId();

  // 2) Gemini 文字起こし・判定（ロック外で実行）
  var ai = callGeminiWithAudio_(req.evaluationPrompt, req.audioBase64, mimeType, req.model);

  // 3) シートへ一括追記（ロック保持時間を最小化）
  var patch = {};
  if (req.keywords && req.keywords.length) {
    var kw = req.keywords.join(', ');
    patch.extractedKeywords = kw;
    patch.keywords = kw;
  }
  var appendPatch = {
    audioUrls: '[T' + req.turn + '] ' + fileUrl,
    transcript: '[T' + req.turn + '] ' + (ai.transcript || ''),
  };
  withSheetLock_(req, lock, function (sheet) {
    var row = findRowOrCreate_(sheet, req);
    setValues_(sheet, row, patch, appendPatch);
  });

  return {
    fileId: fileId,
    fileUrl: fileUrl,
    transcript: ai.transcript || '',
    verdict: ai.verdict === 'convinced' ? 'convinced' : 'rebuttal',
    reply: ai.reply || '',
    reason_ja: ai.reason_ja || '',
  };
}

/**
 * 画面⑨ 再挑戦：前半データを複製した新規行
 */
function duplicateForRetry_(req, lock) {
  return withSheetLock_(req, lock, function (sheet) {
    var src = findRowOrCreate_(sheet, req);
    var values = sheet.getRange(src, 1, 1, COLUMNS.length).getValues()[0];
    var obj = {};
    var keys = req.scope === 'cards' ? RETRY_COPY_KEYS_CARDS : RETRY_COPY_KEYS;
    keys.forEach(function (k) { obj[k] = values[colIndex_(k) - 1]; });
    var nowIso = new Date().toISOString();
    obj.timestamp = nowIso;
    obj.updatedAt = nowIso;
    obj.sessionId = req.newSessionId;
    obj.attempt = req.attempt || (Number(values[colIndex_('attempt') - 1]) + 1);
    appendRow_(sheet, obj);
    return { sessionId: req.newSessionId, attempt: obj.attempt };
  });
}

/** 画面⑪ 最終評価・ExperimentLogPayload 保存 */
function saveFinalAssessment_(req, lock) {
  var caf = req.caf || {};
  var extractedKeywords = req.extractedKeywords !== undefined
    ? req.extractedKeywords
    : (req.keywords || []).join(', ');
  var patch = {
    timestamp: req.timestamp || undefined,
    participantId: req.participantId || undefined,
    topicId: req.topicId !== undefined ? req.topicId : undefined,
    mode: req.mode !== undefined ? req.mode : undefined,
    selectedCard: req.selectedCard !== undefined ? req.selectedCard : undefined,
    readingTime1_ms: req.readingTime1_ms !== undefined ? req.readingTime1_ms : undefined,
    readingTime2_ms: req.readingTime2_ms !== undefined ? req.readingTime2_ms : undefined,
    quizAttemptCount: req.quizAttemptCount !== undefined ? req.quizAttemptCount : undefined,
    quizAnswersHistory: req.quizAnswersHistory !== undefined ? req.quizAnswersHistory : undefined,
    extractedKeywords: extractedKeywords,
    retellingDuration_sec: req.retellingDuration_sec !== undefined ? req.retellingDuration_sec : undefined,
    speechTranscript: req.speechTranscript !== undefined ? req.speechTranscript : req.transcript,
    caf_complexity: req.caf_complexity !== undefined ? req.caf_complexity : caf.complexity,
    caf_accuracy: req.caf_accuracy !== undefined ? req.caf_accuracy : caf.accuracy,
    caf_fluency: req.caf_fluency !== undefined ? req.caf_fluency : caf.fluency,
    persuasion_score: req.persuasion_score !== undefined && req.persuasion_score !== null ? req.persuasion_score : '',
    full_evaluation_json: req.full_evaluation_json !== undefined ? req.full_evaluation_json : JSON.stringify({ caf: caf.detail || {}, character: req.character || null }),
    // 既存カラム
    fullPrompt: req.fullPrompt !== undefined ? req.fullPrompt : undefined,
    rereadingSec: req.rereadingSec !== undefined ? req.rereadingSec : undefined,
    keywords: extractedKeywords,
    transcript: req.transcript,
    dialogLog: JSON.stringify(req.conversation || []),
    cafTotal: caf.total,
    cafContent: caf.content,
    cafOrganization: caf.organization,
    cafLanguage: caf.language,
    cafDetail: JSON.stringify(caf.detail || {}),
    characterFeedback: formatCharacter_(req.character),
  };
  if (req.audioUrls && req.audioUrls.length) {
    patch.audioUrls = req.audioUrls.map(function (u, i) { return '[T' + (i + 1) + '] ' + u; }).join('\n');
  }
  return withSheetLock_(req, lock, function (sheet) {
    var row = findRowOrCreate_(sheet, req);
    setValues_(sheet, row, patch);
    return {};
  });
}

// ============================================================
// Gemini
// ============================================================
function callGeminiWithAudio_(promptText, audioBase64, mimeType, model) {
  var apiKey = prop_('GEMINI_API_KEY');
  if (!apiKey) throw new Error('スクリプトプロパティ GEMINI_API_KEY が未設定です');
  var m = model || prop_('GEMINI_MODEL') || DEFAULT_MODEL;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent';
  var body = {
    contents: [{
      role: 'user',
      parts: [
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  };
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 300) throw new Error('Gemini API エラー (' + code + '): ' + text.slice(0, 300));
  var data = JSON.parse(text);
  var out = ((data.candidates || [])[0] || {}).content;
  var str = out && out.parts ? out.parts.map(function (p) { return p.text || ''; }).join('') : '';
  return parseJsonLoose_(str);
}

function parseJsonLoose_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    var m = str.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Gemini 応答の JSON 解析に失敗しました');
  }
}

// ============================================================
// シート操作ユーティリティ
// ============================================================
function openSpreadsheet_(req) {
  var id = req.spreadsheetId || prop_('SPREADSHEET_ID');
  if (!id) throw new Error('spreadsheetId が指定されていません');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    ensureHeader_(sheet);
  } else if (sheet.getLastRow() === 0) {
    ensureHeader_(sheet);
  }
  return sheet;
}

function getSheet_(req) {
  return ensureSheet_(openSpreadsheet_(req));
}

function ensureHeader_(sheet) {
  var headers = COLUMNS.map(function (c) { return c[1]; });
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = range.getValues()[0];
  if (current.join('') !== headers.join('')) {
    range.setValues([headers]).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function colIndex_(key) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return i + 1;
  throw new Error('Unknown column: ' + key);
}

function findRow_(sheet, sessionId) {
  if (!sessionId) return null;
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var hit = sheet.getRange(2, colIndex_('sessionId'), last - 1, 1)
    .createTextFinder(String(sessionId)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : null;
}

/** sessionId の行を探し、無ければ末尾に新規作成（同一 participantId でも別セッションは必ず新規行として Append） */
function findRowOrCreate_(sheet, req) {
  var row = findRow_(sheet, req.sessionId);
  if (row) return row;
  var nowIso = new Date().toISOString();
  appendRow_(sheet, {
    timestamp: req.timestamp || nowIso,
    sessionId: req.sessionId,
    participantId: req.participantId,
    topicId: req.topicId || '',
    mode: req.mode !== undefined ? req.mode : '',
    attempt: req.attempt || 1,
    updatedAt: nowIso,
  });
  return sheet.getLastRow();
}

function appendRow_(sheet, obj) {
  var row = COLUMNS.map(function (c) { return obj[c[0]] !== undefined ? clip_(obj[c[0]]) : ''; });
  sheet.appendRow(row);
}

/** 1行分をまとめて取得・更新して 1 回の setValues で書き戻す（ロック保持時間を最小化） */
function setValues_(sheet, row, patch, appendPatch) {
  patch.updatedAt = new Date().toISOString();
  var range = sheet.getRange(row, 1, 1, COLUMNS.length);
  var rowVals = range.getValues()[0];
  while (rowVals.length < COLUMNS.length) rowVals.push('');

  if (appendPatch) {
    Object.keys(appendPatch).forEach(function (k) {
      if (appendPatch[k] === undefined || appendPatch[k] === '') return;
      var idx = colIndex_(k) - 1;
      var cur = String(rowVals[idx] || '');
      rowVals[idx] = clip_(cur ? cur + '\n' + appendPatch[k] : appendPatch[k]);
    });
  }

  Object.keys(patch).forEach(function (k) {
    if (patch[k] === undefined) return;
    var idx = colIndex_(k) - 1;
    rowVals[idx] = clip_(patch[k]);
  });

  range.setValues([rowVals]);
}

function appendCell_(sheet, row, key, line) {
  var cell = sheet.getRange(row, colIndex_(key));
  var cur = String(cell.getValue() || '');
  cell.setValue(clip_(cur ? cur + '\n' + line : line));
}

function clip_(v) {
  if (typeof v === 'string' && v.length > CELL_LIMIT) return v.slice(0, CELL_LIMIT) + '…(truncated)';
  return v;
}

function formatCharacter_(c) {
  if (!c) return '';
  var lines = [];
  if (c.summary) lines.push('【ひとこと】' + c.summary);
  if (c.plausibility) lines.push('【納得度】' + c.plausibility.score + '/100 ' + (c.plausibility.comment || ''));
  if (c.pragmaticImpact) lines.push('【感情・態度】' + (c.pragmaticImpact.comment || ''));
  if (c.logicGaps && c.logicGaps.length) lines.push('【論理の欠落】' + c.logicGaps.join(' / '));
  return lines.join('\n');
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 初回のみ手動実行：Drive / Spreadsheet / UrlFetch の権限承認用 */
function authorize() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getActiveSpreadsheet();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  console.log('authorized');
}
