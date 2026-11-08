import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';
import { CardText } from './Screen4Reading.jsx';

/** 【画面7】再読解フェーズ2（滞在時間を内部計測） */
export default function Screen7Reread() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [card] = selectedCardsOf(state);
  const startRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    startRef.current = performance.now();
  }, []);

  const next = async () => {
    const rereadingMs = state.rereadingMs ?? Math.round(performance.now() - startRef.current);
    update({ rereadingMs });
    setError('');
    try {
      await withLoading('読解データを保存しています…', () =>
        callGas('logRereading', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          topicId: state.topicId,
          mode: state.mode,
          attempt: state.attempt,
          readingTime2_ms: rereadingMs,
          rereadingMs,
          rereadingSec: +(rereadingMs / 1000).toFixed(3),
        }),
      );
      goTo(8);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      narrow
      title="もう一度読んでください"
      subtitle="リテリングに向け、もう一度しっかり読み直してください。"
      footer={
        <button id="reread-next" className="btn btn-primary" onClick={next}>
          次へ
        </button>
      }
    >
      <CardText card={card} />
      <ErrorBox message={error} onRetry={next} />
    </ScreenLayout>
  );
}

