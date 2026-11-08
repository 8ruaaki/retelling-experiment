import { useEffect, useRef, useState } from 'react';
import { newSessionId, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';
import { KEYWORD_COUNT, fullPromptOf } from '../data/experiment.js';

const BACKUP_LIST_KEY = 'retelling_experiment_logs_backup';

/** ローカルストレージへのフェイルセーフ退避 */
export function saveBackupToLocalStorage(sessionId, payload) {
  try {
    localStorage.setItem(`retelling_backup_${sessionId}`, JSON.stringify(payload));
    const raw = localStorage.getItem(BACKUP_LIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(list) ? list.filter((item) => item._sessionId !== sessionId) : [];
    filtered.push({ ...payload, _sessionId: sessionId });
    localStorage.setItem(BACKUP_LIST_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to save backup to localStorage:', err);
    return false;
  }
}

/** 実験ログ送信用ペイロード（ExperimentLogPayload 準拠）を構築 */
export function buildExperimentLogPayload(state) {
  const a = state.assessment;
  const learner = state.conversation.filter((m) => m.role === 'learner');
  const cleanedConversation = state.conversation.map(({ role, text, verdict, audioUrl, preview, durationSec }) => ({
    role,
    text,
    verdict,
    audioUrl,
    preview,
    durationSec,
  }));

  const retellingDurationSec =
    state.mode === 2
      ? Number(state.monologue?.durationSec ?? learner.reduce((sum, m) => sum + (Number(m.durationSec) || 0), 0))
      : learner.reduce((sum, m) => sum + (Number(m.durationSec) || 0), 0);

  const speechTranscript =
    state.mode === 2
      ? state.monologue?.transcript || learner.map((m) => m.text).join('\n') || ''
      : JSON.stringify(cleanedConversation);

  const persuasionScore =
    state.mode === 2 || state.mode === 3
      ? a?.character?.plausibility?.score != null
        ? Number(a.character.plausibility.score)
        : null
      : null;

  return {
    // 基本メタデータ
    timestamp: new Date().toISOString(),
    participantId: state.participantId,
    topicId: state.topicId || 'english',
    mode: Number(state.mode),

    // 読解・カード選択データ
    selectedCard: state.cardId,
    readingTime1_ms: state.readingMs ?? 0,
    readingTime2_ms: state.rereadingMs ?? 0,

    // クイズ回答ログ
    quizAttemptCount: state.quizAttemptCount || 1,
    quizAnswersHistory: JSON.stringify(state.quizHistory || []),

    // 足場架けデータ
    extractedKeywords: (state.keywords || []).filter(Boolean).join(', '),

    // リテリング / 対話ログ
    retellingDuration_sec: retellingDurationSec,
    speechTranscript,

    // 評価指標
    caf_complexity: Number(a?.caf?.complexity ?? a?.caf?.organization?.score ?? 0),
    caf_accuracy: Number(a?.caf?.accuracy ?? a?.caf?.content?.score ?? 0),
    caf_fluency: Number(a?.caf?.fluency ?? a?.caf?.language?.score ?? 0),
    persuasion_score: persuasionScore,
    full_evaluation_json: JSON.stringify(a || {}),
  };
}

/** GAS へ最終評価および ExperimentLogPayload を保存 */
export async function saveFinalAssessmentToGas(state) {
  const a = state.assessment;
  const learner = state.conversation.filter((m) => m.role === 'learner');
  const experimentLog = buildExperimentLogPayload(state);

  await callGas('saveFinalAssessment', {
    // ExperimentLogPayload 必須フィールド
    ...experimentLog,
    // 既存GAS互換フィールド（セッション行特定・既存列更新用）
    sessionId: state.sessionId,
    attempt: state.attempt,
    fullPrompt: fullPromptOf(state.target, state.topic),
    rereadingSec: state.rereadingMs != null ? +(state.rereadingMs / 1000).toFixed(3) : undefined,
    keywords: state.keywords,
    audioUrls: state.audioUrls,
    transcript: learner.map((m, i) => `[T${i + 1}] ${m.text}`).join('\n'),
    conversation: state.conversation.map(({ role, text, verdict, audioUrl, preview, durationSec }) => ({
      role,
      text,
      verdict,
      audioUrl,
      preview,
      durationSec,
    })),
    caf: a
      ? {
          total: a.caf.total,
          content: a.caf.content.score,
          organization: a.caf.organization.score,
          language: a.caf.language.score,
          complexity: experimentLog.caf_complexity,
          accuracy: experimentLog.caf_accuracy,
          fluency: experimentLog.caf_fluency,
          detail: a.caf,
        }
      : {},
    character: a?.character,
  });

  return experimentLog;
}

/**
 * 再挑戦処理（画面10・画面11共通）
 * @param {'cards' | 'keywords'} scope  'cards' → 画面3（カード選択） / 'keywords' → 画面8（キーワード選択）
 */
export async function executeRetry({ state, update, goTo, scope }) {
  // 1) 現試行の評価データが未保存なら先に保存する
  if (!state.assessmentSaved && state.assessment) {
    try {
      await saveFinalAssessmentToGas(state);
      update({ assessmentSaved: true });
    } catch (e) {
      saveBackupToLocalStorage(state.sessionId, buildExperimentLogPayload(state));
      throw e;
    }
  }

  // 2) GAS 側で前半データを引き継いだ新規行を末尾に作成（Append）
  const nextSessionId = newSessionId();
  const nextAttempt = (state.attempt || 1) + 1;
  await callGas('duplicateForRetry', {
    sessionId: state.sessionId,
    newSessionId: nextSessionId,
    attempt: nextAttempt,
    scope,
  });

  // 3) ステートをリセットして遷移
  if (scope === 'cards') {
    update({
      sessionId: nextSessionId,
      attempt: nextAttempt,
      cardId: '',
      readingMs: null,
      answers: {},
      quizAttemptCount: 0,
      quizHistory: [],
      quizSaved: false,
      rereadingMs: null,
      keywords: Array(KEYWORD_COUNT).fill(''),
      conversation: [],
      mustIncludePoints: [],
      retellingDone: false,
      audioUrls: [],
      monologue: null,
      assessment: null,
      assessmentSaved: false,
    });
    goTo(3);
  } else {
    update({
      sessionId: nextSessionId,
      attempt: nextAttempt,
      keywords: Array(KEYWORD_COUNT).fill(''),
      conversation: [],
      mustIncludePoints: [],
      retellingDone: false,
      audioUrls: [],
      monologue: null,
      assessment: null,
      assessmentSaved: false,
    });
    goTo(8);
  }
}

/** 【画面11】実験終了・データ保存 */
export default function Screen11Finish() {
  const { state, update, goTo, resetAll, withLoading } = useExperiment();
  const [error, setError] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const started = useRef(false);

  const save = async () => {
    setError('');
    if (state.assessmentSaved) return;
    const experimentLog = buildExperimentLogPayload(state);

    try {
      await withLoading('データを保存しています…', () => saveFinalAssessmentToGas(state));
      update({ assessmentSaved: true });
    } catch (e) {
      const okBackup = saveBackupToLocalStorage(state.sessionId, experimentLog);
      setBackedUp(okBackup);
      setError(e.message);
    }
  };

  const handleRetry = async (scope) => {
    setError('');
    try {
      await withLoading('再挑戦の準備をしています…', () => executeRetry({ state, update, goTo, scope }));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8">
      {state.assessmentSaved ? (
        <p id="finish-message" className="text-center text-[30px] font-bold leading-relaxed">
          実験はすべて終了しました。
          <br />
          ご協力ありがとうございました。
        </p>
      ) : (
        !error && <p className="text-[22px] text-[#666666]">データを保存しています…</p>
      )}

      <div className="w-full max-w-[800px]">
        <ErrorBox message={error} onRetry={save} />
        {error && backedUp && (
          <p className="mt-3 border border-black bg-[#fafafa] px-5 py-3 text-[16px] text-[#333333]">
            ※ 送信失敗に伴い、実験ログデータをこのブラウザのローカルストレージ（localStorage）にフェイルセーフ保存しました。ネットワーク復旧後に「再試行」を押してください。
          </p>
        )}
      </div>

      {state.assessmentSaved && (
        <div className="mt-16 flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button id="finish-retry-cards" className="btn btn-secondary" onClick={() => handleRetry('cards')}>
              カード選択に戻って再挑戦
            </button>
            <button id="finish-retry-keywords" className="btn btn-secondary" onClick={() => handleRetry('keywords')}>
              キーワード選択に戻って再挑戦
            </button>
          </div>
          <button id="finish-reset" className="btn btn-secondary mt-4 text-[16px] px-4 py-1.5" onClick={resetAll}>
            最初の画面に戻る（実験者用）
          </button>
        </div>
      )}
    </div>
  );
}
