import { useEffect, useRef, useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';

/** 【画面11】実験終了・データ保存（既存の saveFinalAssessment を実行） */
export default function Screen11Finish() {
  const { state, update, resetAll, withLoading } = useExperiment();
  const [error, setError] = useState('');
  const started = useRef(false);

  const save = async () => {
    setError('');
    if (state.assessmentSaved) return;
    const a = state.assessment;
    const learner = state.conversation.filter((m) => m.role === 'learner');
    try {
      await withLoading('データを保存しています…', () =>
        callGas('saveFinalAssessment', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          attempt: state.attempt,
          mode: state.mode,
          rereadingSec: state.rereadingMs != null ? +(state.rereadingMs / 1000).toFixed(3) : undefined,
          keywords: state.keywords,
          audioUrls: state.audioUrls,
          transcript: learner.map((m, i) => `[T${i + 1}] ${m.text}`).join('\n'),
          conversation: state.conversation.map(({ role, text, verdict, audioUrl, preview, durationSec }) => ({
            role, text, verdict, audioUrl, preview, durationSec,
          })),
          caf: a
            ? {
                total: a.caf.total,
                content: a.caf.content.score,
                organization: a.caf.organization.score,
                language: a.caf.language.score,
                detail: a.caf,
              }
            : {},
          character: a?.character,
        }),
      );
      update({ assessmentSaved: true });
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
      </div>

      {state.assessmentSaved && (
        <button id="finish-reset" className="btn btn-secondary mt-24 text-[16px] px-4 py-1.5" onClick={resetAll}>
          最初の画面に戻る（実験者用）
        </button>
      )}
    </div>
  );
}

