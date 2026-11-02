import { useEffect, useRef, useState } from 'react';
import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';
import { fullPromptOf } from '../data/experiment.js';

/** 【画面4】読解フェーズ1（読解時間は不可視で内部計測） */
export default function Screen4Reading() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [card] = selectedCardsOf(state);
  const startRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // 入室時刻を記録（画面上には一切表示しない）
    startRef.current = performance.now();
  }, []);

  const next = async () => {
    // 保存エラー後の再試行でも、最初に「次へ」を押した時点の読解時間を使う
    const readingMs = state.readingMs ?? Math.round(performance.now() - startRef.current);
    update({ readingMs });
    setError('');
    try {
      await withLoading('読解データを保存しています…', () =>
        callGas('logReading', {
          sessionId: state.sessionId,
          participantId: state.participantId,
          attempt: state.attempt,
          fullPrompt: fullPromptOf(state.target, state.topic),
          cards: [{ id: card.id, title: card.title, body: card.body, relevance_level: card.relevance_level }],
          readingMs,
          readingSec: +(readingMs / 1000).toFixed(3),
        }),
      );
      goTo(5);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      narrow
      title="カードを読んでください"
      subtitle="内容をしっかり読んで理解してください。読み終わったら「次へ」を押してください。"
      footer={
        <button id="reading-next" className="btn btn-primary" onClick={next}>
          次へ
        </button>
      }
    >
      <CardText card={card} />
      <ErrorBox message={error} onRetry={next} />
    </ScreenLayout>
  );
}

export function CardText({ card }) {
  if (!card) return null;
  return (
    <article className="card select-text p-10">
      <span className="meta">{card.title.toUpperCase()}</span>
      <p className="english mt-3">{card.body}</p>
    </article>
  );
}
