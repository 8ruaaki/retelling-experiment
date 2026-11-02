import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../../context/ExperimentContext.jsx';
import NavHeader from '../../components/NavHeader.jsx';
import { ErrorBox } from '../../components/Layout.jsx';
import { fmtTime, useRecorder } from '../../hooks/useRecorder.js';
import { buildTestTurnPrompt, buildTurnPrompt, evaluateTurnDirect, generateOpening } from '../../lib/ai.js';
import { blobToBase64, callGas } from '../../lib/gas.js';
import { CONFIG, isGasConfigured } from '../../lib/config.js';
import RetellingTopBar from './RetellingTopBar.jsx';
import TestTextInputWidget, { createTestWavBase64 } from './TestTextInputWidget.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * 【画面9】リテリング（モード1・3：対話型）
 *  既存アプリのチャットUI・ターン制対話ロジックをそのまま流用（相手ペルソナ = state.target）
 */
export default function RetellingDialogue() {
  const { state, update, goTo } = useExperiment();
  const cards = selectedCardsOf(state);
  const rec = useRecorder();
  const [busy, setBusy] = useState(null); // 'opening' | 'processing' | null
  const [error, setError] = useState('');
  const started = useRef(false);
  const chatEndRef = useRef(null);

  const conversation = state.conversation;
  const learnerTurns = conversation.filter((m) => m.role === 'learner' && !m.pending).length;
  const hasOpening = conversation.some((m) => m.role === 'partner');
  const recording = rec.status !== 'idle';
  const locked = !!busy || state.retellingDone;

  // ---------- 相手キャラの第一声 ----------
  const loadOpening = async () => {
    setError('');
    setBusy('opening');
    try {
      const { message, mustIncludePoints } = await generateOpening(state.target, state.topic, cards);
      update((s) => ({
        mustIncludePoints,
        conversation: [...s.conversation, { id: uid(), role: 'partner', text: message }],
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!hasOpening) loadOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自動スクロール（アニメーションなし）
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation.length, rec.previewText, busy]);

  // ---------- 録音停止 → 送信・判定 ----------
  const stopAndSend = async () => {
    const preview = rec.previewText;
    const durationSec = rec.elapsed;
    const blob = await rec.stop();
    if (!blob || blob.size === 0) {
      setError('音声が録音されていませんでした。もう一度録音してください。');
      return;
    }
    setError('');
    setBusy('processing');
    const pendingId = uid();
    const history = state.conversation.filter((m) => !m.pending);
    update((s) => ({
      conversation: [...s.conversation, { id: pendingId, role: 'learner', text: preview || '（音声を送信中…）', pending: true }],
    }));

    try {
      const audioBase64 = await blobToBase64(blob);
      const mimeType = (blob.type || 'audio/webm').split(';')[0];
      const turn = learnerTurns + 1;
      const evaluationPrompt = buildTurnPrompt({
        target: state.target,
        topic: state.topic,
        cards,
        keywords: state.keywords,
        history,
        turn,
        mustIncludePoints: state.mustIncludePoints,
      });

      let result = await callGas('uploadAudio', {
        sessionId: state.sessionId,
        participantId: state.participantId,
        attempt: state.attempt,
        turn,
        mimeType,
        audioBase64,
        fileName: `P${state.participantId}_M${state.mode}_T${turn}_${new Date().toISOString().replace(/[:.]/g, '-')}.${mimeType.split('/')[1] || 'webm'}`,
        durationSec,
        previewTranscript: preview,
        evaluationPrompt,
        model: CONFIG.geminiModel,
        keywords: state.keywords,
      });

      // GAS 未設定（モック）時はフロントから直接 Gemini で判定
      if (!isGasConfigured() || result.mock) {
        const r = await evaluateTurnDirect(evaluationPrompt, audioBase64, mimeType);
        result = { ...r, fileUrl: '' };
      }

      const convinced = result.verdict === 'convinced';
      update((s) => ({
        conversation: [
          ...s.conversation.map((m) =>
            m.id === pendingId
              ? { ...m, text: result.transcript || preview, preview, audioUrl: result.fileUrl, durationSec, pending: false }
              : m,
          ),
          { id: uid(), role: 'partner', text: result.reply, verdict: result.verdict, reason: result.reason_ja },
        ],
        audioUrls: result.fileUrl ? [...s.audioUrls, result.fileUrl] : s.audioUrls,
        retellingDone: convinced,
      }));
    } catch (e) {
      // 失敗時は保留中の吹き出しを取り除き、再録音できるようにする
      update((s) => ({ conversation: s.conversation.filter((m) => m.id !== pendingId) }));
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const canRecord = hasOpening && !locked;

  // ---------- 動作テスト用：ダミー音声(.wav)を生成してドライブ保存＋対話判定 ----------
  const sendTestText = async (text) => {
    if (!canRecord) return;
    setError('');
    setBusy('processing');
    const pendingId = uid();
    const history = state.conversation.filter((m) => !m.pending);
    update((s) => ({
      conversation: [...s.conversation, { id: pendingId, role: 'learner', text, pending: true }],
    }));

    try {
      const audioBase64 = createTestWavBase64(1);
      const mimeType = 'audio/wav';
      const durationSec = 1;
      const turn = learnerTurns + 1;
      const evaluationPrompt = buildTestTurnPrompt({
        target: state.target,
        topic: state.topic,
        cards,
        keywords: state.keywords,
        history,
        turn,
        mustIncludePoints: state.mustIncludePoints,
        text,
      });

      let result = await callGas('uploadAudio', {
        sessionId: state.sessionId,
        participantId: state.participantId,
        attempt: state.attempt,
        turn,
        mimeType,
        audioBase64,
        fileName: `P${state.participantId}_M${state.mode}_T${turn}_test_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`,
        durationSec,
        previewTranscript: text,
        evaluationPrompt,
        model: CONFIG.geminiModel,
        keywords: state.keywords,
      });

      if (!isGasConfigured() || result.mock) {
        const r = await evaluateTurnDirect(evaluationPrompt, audioBase64, mimeType);
        result = { ...r, fileUrl: '' };
      }

      const convinced = result.verdict === 'convinced';
      update((s) => ({
        conversation: [
          ...s.conversation.map((m) =>
            m.id === pendingId
              ? { ...m, text: result.transcript || text, preview: text, audioUrl: result.fileUrl, durationSec, pending: false }
              : m,
          ),
          { id: uid(), role: 'partner', text: result.reply, verdict: result.verdict, reason: result.reason_ja },
        ],
        audioUrls: result.fileUrl ? [...s.audioUrls, result.fileUrl] : s.audioUrls,
        retellingDone: convinced,
      }));
    } catch (e) {
      update((s) => ({ conversation: s.conversation.filter((m) => m.id !== pendingId) }));
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <NavHeader />
      <RetellingTopBar />

      {/* ---------- 録音操作バー ---------- */}
      <div className="border-b border-black bg-[#fafafa]">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-8 py-3">
          {!recording ? (
            <button id="rec-start" className="btn btn-primary" onClick={rec.start} disabled={!canRecord}>
              録音開始
            </button>
          ) : (
            <button id="rec-stop" className="btn btn-primary" onClick={stopAndSend} disabled={!!busy}>
              録音停止して送信
            </button>
          )}
          <button id="rec-pause" className="btn btn-secondary px-5" onClick={rec.pause} disabled={!recording || !!busy}>
            {rec.status === 'paused' ? '再開' : '一時停止'}
          </button>
          <button id="rec-reset" className="btn btn-secondary px-5" onClick={rec.reset} disabled={!recording || !!busy}>
            リセット
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[16px] font-bold text-[#666666]">
              {rec.status === 'recording' ? '録音中' : rec.status === 'paused' ? '一時停止中' : ''}
            </span>
            <span id="rec-timer" className="font-mono text-[30px] font-bold tabular-nums">{fmtTime(rec.elapsed)}</span>
          </div>
        </div>
        {!rec.speechSupported && (
          <p className="mx-auto w-full max-w-[1400px] px-8 pb-2 text-[16px] text-[#666666]">
            ※ このブラウザはリアルタイム文字起こしに未対応です（Google Chrome を推奨）。録音は可能です。
          </p>
        )}
      </div>

      {/* ---------- チャットエリア ---------- */}
      <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1100px] space-y-6 px-8 py-8">
          {conversation.map((m) =>
            m.role === 'partner' ? (
              <PartnerBubble key={m.id} name={state.target} text={m.text} />
            ) : (
              <LearnerBubble key={m.id} text={m.text} pending={m.pending} audioUrl={m.audioUrl} />
            ),
          )}

          {/* 録音中のリアルタイムプレビュー */}
          {recording && (
            <LearnerBubble live text={rec.previewText || (rec.status === 'paused' ? '（一時停止中）' : 'Listening…')} />
          )}

          {busy && <WaitingBubble name={state.target} />}

          <ErrorBox message={error || rec.error} onRetry={!hasOpening ? loadOpening : undefined} />

          {state.retellingDone && (
            <div className="mt-6 border-2 border-black p-6 text-center">
              <p className="text-[22px] font-bold">対話は終了しました。「評価へ」を押してください。</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="border-t border-black bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-end px-8 py-4">
          <button id="go-assessment" className="btn btn-primary" disabled={!state.retellingDone} onClick={() => goTo(10)}>
            評価へ
          </button>
        </div>
      </footer>

      <TestTextInputWidget
        sampleText={cards[0]?.body || ''}
        disabled={!canRecord || recording}
        submitLabel="テスト送信（ドライブ保存含む）"
        audioUrls={state.audioUrls}
        onSubmit={sendTestText}
      />
    </div>
  );
}

// ---------- 吹き出しコンポーネント（モノトーン・静的） ----------
function Avatar({ name }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black bg-white text-[20px] font-bold">
      {name?.slice(0, 1)}
    </div>
  );
}

function PartnerBubble({ name, text }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={name} />
      <div className="max-w-[75%]">
        <p className="mb-1 text-[15px] font-bold text-[#666666]">{name}</p>
        <div className="border border-black bg-white px-5 py-3 text-[21px] leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

function LearnerBubble({ text, pending, live, audioUrl }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <div
          className={`px-5 py-3 text-[21px] leading-relaxed ${live ? 'border border-dashed border-black bg-white text-[#333333]' : 'border border-black bg-black text-white'}`}
        >
          {text}
        </div>
        <p className="mt-1 text-right text-[15px] text-[#666666]">
          {live ? (
            '録音中（プレビュー）'
          ) : pending ? (
            '送信中…'
          ) : audioUrl ? (
            <a href={audioUrl} target="_blank" rel="noreferrer" className="underline">
              保存音声ファイル（Drive）
            </a>
          ) : (
            'You'
          )}
        </p>
      </div>
    </div>
  );
}

function WaitingBubble({ name }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={name} />
      <div className="border border-black bg-white px-5 py-3 text-[19px] text-[#666666]">応答を待っています…</div>
    </div>
  );
}

