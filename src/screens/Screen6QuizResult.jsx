import { useMemo, useState } from 'react';
import { useExperiment } from '../context/ExperimentContext.jsx';
import { ErrorBox, ScreenLayout } from '../components/Layout.jsx';
import { callGas } from '../lib/gas.js';
import { quizForCard } from '../data/experiment.js';
import { LETTERS } from './Screen5Quiz.jsx';

/** 【画面6】答え合わせ・解説（再挑戦なし：得点に関わらず画面7へ） */
export default function Screen6QuizResult() {
  const { state, update, goTo, withLoading } = useExperiment();
  const [error, setError] = useState('');

  const results = useMemo(
    () =>
      quizForCard(state.topicId, state.cardId).map((q, qi) => {
        const picked = state.answers[qi];
        return { qIndex: qi, ...q, picked, correct: picked === q.answerIndex };
      }),
    [state.topicId, state.cardId, state.answers],
  );

  const correct = results.filter((r) => r.correct).length;
  const total = results.length;

  const next = async () => {
    setError('');
    try {
      if (!state.quizSaved) {
        const details = results.map(({ qIndex, question, options, picked, answerIndex, correct }) => ({
          topicId: state.topicId,
          cardId: state.cardId,
          qIndex,
          question,
          picked: picked !== undefined ? LETTERS[picked] : null,
          pickedText: picked !== undefined ? options[picked] : null,
          answer: LETTERS[answerIndex],
          correct,
        }));
        const quizAttemptCount = state.quizAttemptCount || 1;
        const quizAnswersHistory = JSON.stringify(
          state.quizHistory && state.quizHistory.length > 0
            ? state.quizHistory
            : [{ attempt: 1, answers: details.map((d) => d.picked).join(','), score: `${correct}/${total}`, details }],
        );
        await withLoading('クイズ結果を保存しています…', () =>
          callGas('saveQuiz', {
            sessionId: state.sessionId,
            participantId: state.participantId,
            topicId: state.topicId,
            mode: state.mode,
            attempt: state.attempt,
            correct,
            total,
            rate: total ? +(correct / total).toFixed(4) : 0,
            quizAttemptCount,
            quizAnswersHistory,
            details,
          }),
        );
        update({ quizSaved: true });
      }
      goTo(7);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScreenLayout
      narrow
      title="答え合わせ"
      footer={
        <button id="quiz-result-next" className="btn btn-primary" onClick={next}>
          次へ
        </button>
      }
    >
      <section className="card mb-8 p-8">
        <p className="meta">得点</p>
        <p id="quiz-score" className="mt-1 text-[40px] font-bold leading-none">
          {correct} <span className="text-[24px] text-[#666666]">/ {total} 点</span>
        </p>
      </section>

      <div className="space-y-6">
        {results.map((r) => (
          <article key={r.qIndex} className="card p-8">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 min-w-9 items-center justify-center border-2 border-black px-2 text-[20px] font-bold ${r.correct ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                {r.correct ? '○' : '×'}
              </span>
              <span className="text-[18px] font-bold">Q{r.qIndex + 1}　{r.correct ? '正解' : '不正解'}</span>
            </div>
            <p className="mt-4 text-[22px] font-bold leading-relaxed">{r.question}</p>
            <ul className="mt-4 space-y-2">
              {r.options.map((opt, oi) => {
                const isAnswer = oi === r.answerIndex;
                const isPicked = oi === r.picked;
                return (
                  <li
                    key={oi}
                    className={`flex items-center gap-3 px-5 py-2 text-[20px] ${isAnswer ? 'border-2 border-black bg-black text-white font-bold' : isPicked ? 'border-2 border-dashed border-black' : 'border border-[#cccccc] text-[#666666]'}`}
                  >
                    <span className="w-7 font-bold">{LETTERS[oi]})</span>
                    <span className="flex-1">{opt}</span>
                    {isAnswer && <span className="text-[16px] font-bold">正解</span>}
                    {isPicked && !isAnswer && <span className="text-[16px] font-bold">あなたの回答</span>}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 border-l-4 border-black bg-[#fafafa] px-5 py-3 text-[19px] leading-relaxed">
              <span className="mr-2 font-bold">解説</span>
              {r.explanation}
            </div>
          </article>
        ))}
      </div>
      <ErrorBox message={error} onRetry={next} />
    </ScreenLayout>
  );
}
