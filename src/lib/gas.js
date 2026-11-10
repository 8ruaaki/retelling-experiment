// ============================================================
// GAS Web App クライアント
//  - CORS プリフライト回避のため Content-Type: text/plain で POST
//  - spreadsheetId / folderId は毎回ペイロードに含める（GAS へのハードコード禁止）
//  - GAS 側のロック競合（ロックのタイムアウト等）発生時は指数バックオフで自動リトライ
// ============================================================
import { CONFIG, isGasConfigured } from './config.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1500, 3000, 5000];

const isRetryableGasError = (msg = '') =>
  /ロック|Lock|timeout|タイムアウト|Service invoked too many times|Rate Limit/i.test(msg);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callGas(action, payload = {}) {
  const body = {
    action,
    spreadsheetId: CONFIG.spreadsheetId,
    folderId: CONFIG.driveFolderId,
    ...payload,
  };

  if (!isGasConfigured()) {
    // モックモード：開発・動作確認用
    console.info(`[GAS mock] ${action}`, body);
    await sleep(300);
    return { ok: true, mock: true };
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(CONFIG.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
      if (!res.ok) {
        if (res.status >= 500 || res.status === 429) {
          throw new Error(`GAS 通信エラー (${res.status}) [retryable]`);
        }
        throw new Error(`GAS 通信エラー (${res.status})`);
      }
      const json = await res.json();
      if (!json.ok) {
        const errMsg = json.error || 'unknown';
        throw new Error(`GAS 処理エラー: ${errMsg}`);
      }
      return json;
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err);
      const canRetry = attempt < MAX_RETRIES && (isRetryableGasError(msg) || msg.includes('[retryable]'));
      if (!canRetry) break;
      const jitter = Math.floor(Math.random() * 500);
      await sleep(RETRY_DELAYS_MS[attempt] + jitter);
    }
  }
  throw new Error(String(lastError?.message || lastError).replace(' [retryable]', ''));
}

/** Blob → Base64（data: プレフィックス除去） */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
