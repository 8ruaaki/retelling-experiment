import { useState } from 'react';
import { newSessionId, useExperiment } from '../context/ExperimentContext.jsx';
import { callGas } from '../lib/gas.js';
import { isGasConfigured, isGeminiConfigured } from '../lib/config.js';
import { ErrorBox } from '../components/Layout.jsx';
import { MODES, TOPICS, getPromptConfig } from '../data/experiment.js';

/** 【画面1】エントリー（被験者ID・実験テーマ・実験モード） */
export default function Screen1Entry() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [pid, setPid] = useState(state.participantId);
  const [topicId, setTopicId] = useState(state.topicId);
  const [mode, setMode] = useState(state.mode);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const pidValid = /^[A-Za-z0-9]+$/.test(pid);
  const canStart = pidValid && !!topicId && !!mode;

  const start = async () => {
    setTouched(true);
    if (!canStart) return;
    setError('');
    const sessionId = state.sessionId || newSessionId();
    const { target, topic, topicLabel, fullPrompt } = getPromptConfig(topicId, mode);
    try {
      await withLoading('被験者情報を登録しています…', () =>
        callGas('saveInitial', {
          sessionId,
          participantId: pid,
          topicId,
          mode,
          fullPrompt,
          attempt: 1,
        }),
      );
      update({
        sessionId,
        participantId: pid,
        topicId,
        topicLabel,
        mode,
        target,
        topic,
      });
      goTo(2);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
      <main className="w-full max-w-[760px]">
        <h1 className="page-title text-center">リテリング実験</h1>
        <p className="page-sub text-center">被験者ID・実験テーマ・実験モードを選択して「開始」を押してください。</p>

        <form
          className="card mt-8 p-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <div>
            <label htmlFor="participant-id" className="label">被験者ID（半角英数字）</label>
            <input
              id="participant-id"
              className={`input font-mono ${touched && pid && !pidValid ? 'input-error' : ''}`}
              autoComplete="off"
              placeholder="例: P001"
              value={pid}
              onChange={(e) => setPid(e.target.value.trim())}
              onBlur={() => setTouched(true)}
              autoFocus
            />
            {touched && !pid && <p className="mt-2 text-[18px] font-bold">被験者IDを入力してください</p>}
            {touched && pid && !pidValid && <p className="mt-2 text-[18px] font-bold">半角英数字のみで入力してください</p>}
          </div>

          <fieldset>
            <legend className="label">実験テーマ</legend>
            <div className="space-y-3">
              {Object.values(TOPICS).map((t) => {
                const active = topicId === t.id;
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-4 bg-white px-5 ${active ? 'border-2 border-black py-[11px]' : 'border border-[#666666] py-3'}`}
                  >
                    <input
                      id={`topic-${t.id}`}
                      type="radio"
                      name="topicId"
                      className="h-5 w-5 accent-black"
                      checked={active}
                      onChange={() => setTopicId(t.id)}
                    />
                    <span className="font-bold">{t.label}</span>
                  </label>
                );
              })}
            </div>
            {touched && !topicId && <p className="mt-2 text-[18px] font-bold">実験テーマを選択してください</p>}
          </fieldset>

          <fieldset>
            <legend className="label">実験モード</legend>
            <div className="space-y-3">
              {Object.values(MODES).map((m) => {
                const active = mode === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-4 bg-white px-5 ${active ? 'border-2 border-black py-[11px]' : 'border border-[#666666] py-3'}`}
                  >
                    <input
                      id={`mode-${m.id}`}
                      type="radio"
                      name="mode"
                      className="h-5 w-5 accent-black"
                      checked={active}
                      onChange={() => setMode(m.id)}
                    />
                    <span className="font-bold">{m.label}</span>
                  </label>
                );
              })}
            </div>
            {touched && !mode && <p className="mt-2 text-[18px] font-bold">実験モードを選択してください</p>}
          </fieldset>

          <button id="start-button" type="submit" className="btn btn-primary w-full" disabled={!canStart}>
            開始
          </button>
        </form>

        <ErrorBox message={error} onRetry={start} />

        {(!isGasConfigured() || !isGeminiConfigured()) && (
          <div className="mt-6 border border-dashed border-[#666666] p-4 text-[16px] text-[#333333]">
            {!isGasConfigured() && <p>● GAS / スプレッドシートID 未設定：モックモードで動作中（データは保存されず console に出力されます）</p>}
            {!isGeminiConfigured() && <p>● Gemini API キー未設定：AI 機能（対話・評価）は利用できません</p>}
          </div>
        )}
      </main>
    </div>
  );
}
