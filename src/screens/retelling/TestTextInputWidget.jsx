import { useState } from 'react';

/**
 * 1秒間のテスト用 WAV 音声（440Hz サイン波・モノラル 8kHz 16bit PCM）をメモリ上で生成し Base64 で返す
 *  - マイクやスピーカーを使わずに Google ドライブ保存（uploadAudio）の動作をテストするため
 */
export function createTestWavBase64(durationSec = 1) {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // 1 channel (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.15;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * 画面9 左下隅に小さく配置する「音声なし動作テスト用」テキスト入力ウィジェット
 *  - 送信時はダミーの .wav 音声を生成して GAS uploadAudio に送るため、ドライブ保存も同時に検証可能
 */
export default function TestTextInputWidget({
  sampleText = '',
  disabled = false,
  submitLabel = 'テスト送信（ドライブ保存含む）',
  audioUrls = [],
  onSubmit,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    await onSubmit(trimmed);
    setText('');
  };

  if (!open) {
    return (
      <button
        id="test-input-toggle"
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-50 border border-[#666666] bg-white px-2.5 py-1 text-[13px] font-bold text-[#666666] hover:border-black hover:text-black cursor-pointer"
        title="音声が出せない環境での動作テスト用テキスト入力"
      >
        テスト入力
      </button>
    );
  }

  return (
    <aside
      aria-label="動作テスト用テキスト入力"
      className="fixed bottom-3 left-3 z-50 w-[440px] max-w-[calc(100vw-24px)] border-2 border-black bg-white p-4"
    >
      <div className="flex items-center justify-between border-b border-[#cccccc] pb-2">
        <span className="text-[14px] font-bold">動作テスト用入力（ダミー音声＋ドライブ保存）</span>
        <button
          id="test-input-close"
          type="button"
          onClick={() => setOpen(false)}
          className="border border-black bg-white px-2 py-0.5 text-[13px] font-bold hover:bg-black hover:text-white cursor-pointer"
        >
          閉じる
        </button>
      </div>

      <form onSubmit={handleSend} className="mt-3 space-y-2.5">
        <textarea
          id="test-input-textarea"
          rows={3}
          className="w-full border border-[#666666] bg-white p-2 text-[16px] leading-snug text-black focus:border-2 focus:border-black focus:outline-none"
          placeholder="発話の代わりとなる英文を入力してください…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <div className="flex items-center justify-between gap-2">
          {sampleText && (
            <button
              id="test-input-sample"
              type="button"
              onClick={() => setText(sampleText)}
              disabled={disabled}
              className="border border-[#666666] bg-white px-2.5 py-1 text-[13px] font-bold text-[#333333] hover:border-black hover:text-black cursor-pointer disabled:opacity-40"
            >
              カード本文を挿入
            </button>
          )}
          <button
            id="test-input-submit"
            type="submit"
            disabled={disabled || !text.trim()}
            className="ml-auto border-2 border-black bg-black px-4 py-1 text-[14px] font-bold text-white hover:bg-white hover:text-black cursor-pointer disabled:border-[#cccccc] disabled:bg-white disabled:text-[#999999]"
          >
            {submitLabel}
          </button>
        </div>
      </form>

      {audioUrls.length > 0 && (
        <div className="mt-3 border-t border-[#cccccc] pt-2 text-[13px]">
          <p className="font-bold text-[#333333]">保存済みドライブ音声URL:</p>
          <ul className="mt-1 space-y-0.5">
            {audioUrls.map((url, i) => (
              <li key={i} className="truncate">
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  [T{i + 1}] {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
