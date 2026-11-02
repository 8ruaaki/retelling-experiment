import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { CafAssessment, CharacterFeedback } from '../components/AssessmentPanels.jsx';
import { generateAssessment } from '../lib/ai.js';
import { MODES } from '../data/experiment.js';

/** 【画面10】評価：モード1は CAF 評価のみ、モード2・3は既存のフル評価 */
export default function Screen10Assessment() {
  const { state, update, goTo, withLoading } = useExperiment();
  const cards = selectedCardsOf(state);
  const [error, setError] = useState('');
  const started = useRef(false);
  const a = state.assessment;
  const full = MODES[state.mode]?.evaluation === 'full';

  // 既存の評価生成ロジックをそのまま使用
  const run = async () => {
    setError('');
    try {
      if (state.assessment) return;
      const assessment = await withLoading('発話を評価しています…', () =>
        generateAssessment({
          target: state.target,
          topic: state.topic,
          cards,
          keywords: state.keywords,
          conversation: state.conversation,
        }),
      );
      update({ assessment });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScreenLayout
      title="評価"
      subtitle={`「${state.target}」に ${state.topic}を伝えよ！`}
      footer={
        <button id="assessment-done" className="btn btn-primary" disabled={!a} onClick={() => goTo(11)}>
          完了
        </button>
      }
    >
      <ErrorBox message={error} onRetry={run} />

      {a &&
        (full ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <CharacterFeedback name={state.target} data={a.character} />
            <CafAssessment data={a.caf} />
          </div>
        ) : (
          <div className="mx-auto max-w-[900px]">
            <CafAssessment data={a.caf} />
          </div>
        ))}
    </ScreenLayout>
  );
}

