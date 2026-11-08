import { useState } from 'react';
import { selectedCardsOf, useExperiment } from '../../context/ExperimentContext.jsx';
import NavHeader from '../../components/NavHeader.jsx';
import { ErrorBox } from '../../components/Layout.jsx';
import { fmtTime, useRecorder } from '../../hooks/useRecorder.js';
import { buildMonologuePrompt, buildTestMonologuePrompt, evaluateTurnDirect } from '../../lib/ai.js';
import { blobToBase64, callGas } from '../../lib/gas.js';
import { CONFIG, isGasConfigured } from '../../lib/config.js';
import RetellingTopBar from './RetellingTopBar.jsx';
import TestTextInputWidget, { createTestWavBase64 } from './TestTextInputWidget.jsx';

/**
 * 【画面9】リテリング（モード2：独話型）
 *  録音は既存 useRecorder を流用。確定時に既存 uploadAudio で保存＋Gemini 逐語文字起こし。
 */
export default function RetellingMonologue() {
  const { state, update, goTo, withLoading } = useExperiment();
  const cards = selectedCardsOf(state);
  const rec = useRecorder();
  const [error, setError] = useState('');
  // 送信失敗時に再送できるよう、確定済み録音を保持
  const [pending, setPending] = useState(null); // { blob, preview, durationSec }

  const initial = (state.participantId || 'U').slice(0, 1).toUpperCase();
  const hasRecording = rec.status !== 'idle' || !!pending;

  const onStart = () => {
    if (rec.status === 'idle') {
      setPending(null);
      rec.start();
    } else if (rec.status === 'paused') {
      rec.pause(); // 一時停止中 → 再開
    }
  };

  const onPause = () => {
    if (rec.status === 'recording') rec.pause();
  };

  const onReset = () => {
    setPending(null);
    setError('');
    rec.reset();
  };

  const send = async (p = pending) => {
    const { blob, preview, durationSec } = p;
    setError('');
    try {
      const result = await withLoading('音声を保存し、文字起こしをしています…', async () => {
        const audioBase64 = await blobToBase64(blob);
        const mimeType = (blob.type || 'audio/webm').split(';')[0];
        const evaluationPrompt = buildMonologuePrompt({
          target: state.target,
          topic: state.topic,
          cards,
          keywords: state.keywords,
        });
        let r = await callGas('uploadAudio', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          topicId: state.topicId,
          mode: state.mode,
          attempt: state.attempt,
          turn: 1,
          mimeType,
          audioBase64,
          fileName: `P${state.participantId}_${state.topicId || 'english'}_M${state.mode}_monologue_${new Date().toISOString().replace(/[:.]/g, '-')}.${mimeType.split('/')[1] || 'webm'}`,
          durationSec,
          previewTranscript: preview,
          evaluationPrompt,
          model: CONFIG.geminiModel,
          keywords: state.keywords,
        });
        // GAS 未設定（モック）時はフロントから直接 Gemini で文字起こし
        if (!isGasConfigured() || r.mock) {
          const d = await evaluateTurnDirect(evaluationPrompt, audioBase64, mimeType);
          r = { transcript: d.transcript, fileUrl: '' };
        }
        return r;
      });

      const transcript = result.transcript || preview || '';
      update({
        monologue: { transcript, preview, durationSec, audioUrl: result.fileUrl || '' },
        // 既存の評価・保存ロジックと互換の形式で保持
        conversation: [{ id: 'monologue', role: 'learner', text: transcript, preview, audioUrl: result.fileUrl || '', durationSec }],
        audioUrls: result.fileUrl ? [result.fileUrl] : [],
        retellingDone: true,
      });
      setPending(null);
      goTo(10);
    } catch (e) {
      setError(e.message);
    }
  };

  const finish = async () => {
    let p = pending;
    if (!p) {
      const preview = rec.previewText;
      const durationSec = rec.elapsed;
      const blob = await rec.stop();
      if (!blob || blob.size === 0) {
        setError('音声が録音されていませんでした。「リセット」してから録音し直してください。');
        return;
      }
      p = { blob, preview, durationSec };
      setPending(p);
    }
    await send(p);
  };

  // ---------- 動作テスト用：ダミー音声(.wav)をドライブ保存して次へ ----------
  const submitTestText = async (text) => {
    rec.reset();
    setPending(null);
    setError('');
    try {
      const audioBase64 = createTestWavBase64(1);
      const mimeType = 'audio/wav';
      const durationSec = 1;
      const evaluationPrompt = buildTestMonologuePrompt({ text });

      const result = await withLoading('テスト音声をドライブに保存しています…', async () => {
        let r = await callGas('uploadAudio', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          topicId: state.topicId,
          mode: state.mode,
          attempt: state.attempt,
          turn: 1,
          mimeType,
          audioBase64,
          fileName: `P${state.participantId}_${state.topicId || 'english'}_M${state.mode}_monologue_test_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`,
          durationSec,
          previewTranscript: text,
          evaluationPrompt,
          model: CONFIG.geminiModel,
          keywords: state.keywords,
        });
        if (!isGasConfigured() || r.mock) {
          r = { transcript: text, fileUrl: '' };
        }
        return r;
      });

      const transcript = result.transcript || text;
      const fileUrl = result.fileUrl || '';
      update({
        monologue: { transcript, preview: text, durationSec, audioUrl: fileUrl },
        conversation: [{ id: 'monologue', role: 'learner', text: transcript, preview: text, audioUrl: fileUrl, durationSec }],
        audioUrls: fileUrl ? [fileUrl] : [],
        retellingDone: true,
      });
      goTo(10);
    } catch (e) {
      setError(e.message);
    }
  };

  const statusLabel =
    rec.status === 'recording' ? '録音中' : rec.status === 'paused' ? '一時停止中' : pending ? '録音確定済み' : '待機中';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <NavHeader />
      <RetellingTopBar />

      <main className="flex flex-1 flex-col items-center justify-center px-8 py-12">
        <div
          aria-hidden="true"
          className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-black text-[64px] font-bold"
        >
          {initial}
        </div>

        <p id="mono-timer" className="mt-8 font-mono text-[72px] font-bold leading-none tabular-nums">
          {fmtTime(pending ? pending.durationSec : rec.elapsed)}
        </p>
        <p className="mt-3 text-[18px] font-bold text-[#666666]">{statusLabel}</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            id="mono-start"
            className="btn btn-secondary min-w-[160px]"
            onClick={onStart}
            disabled={rec.status === 'recording' || !!pending}
          >
            スタート
          </button>
          <button id="mono-pause" className="btn btn-secondary min-w-[160px]" onClick={onPause} disabled={rec.status !== 'recording'}>
            一時停止
          </button>
          <button id="mono-reset" className="btn btn-secondary min-w-[160px]" onClick={onReset} disabled={!hasRecording}>
            リセット
          </button>
          <button id="mono-finish" className="btn btn-primary min-w-[200px]" onClick={finish} disabled={!hasRecording}>
            終了して次へ
          </button>
        </div>

        {!rec.speechSupported && (
          <p className="mt-6 text-[16px] text-[#666666]">※ Google Chrome での実施を推奨します。</p>
        )}
        <div className="w-full max-w-[800px]">
          <ErrorBox message={error || rec.error} onRetry={pending ? () => send() : undefined} />
        </div>
      </main>

      <TestTextInputWidget
        sampleText={cards[0]?.body || ''}
        disabled={rec.status === 'recording'}
        submitLabel="テスト送信して次へ（ドライブ保存含む）"
        audioUrls={state.audioUrls}
        onSubmit={submitTestText}
      />
    </div>
  );
}
