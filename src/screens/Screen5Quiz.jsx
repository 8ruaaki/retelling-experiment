import { useExperiment } from '../context/ExperimentContext.jsx';
import { ScreenLayout } from '../components/Layout.jsx';
import { quizForCard } from '../data/experiment.js';

export const LETTERS = ['A', 'B', 'C', 'D'];

/** 【画面5】内容理解クイズ（2問・4択） */
export default function Screen5Quiz() {
  const { state, update, goTo } = useExperiment();
  const questions = quizForCard(state.topicId, state.cardId);
  const allAnswered = questions.length > 0 && questions.every((_, qi) => state.answers[qi] !== undefined);

  const choose = (qi, oi) => update((s) => ({ answers: { ...s.answers, [qi]: oi } }));

  const submitQuiz = () => {
    const attemptDetails = questions.map((q, qi) => {
      const picked = state.answers[qi];
      return {
        qIndex: qi + 1,
        picked: picked !== undefined ? LETTERS[picked] : null,
        answer: LETTERS[q.answerIndex],
        correct: picked === q.answerIndex,
      };
    });
    const correctCount = attemptDetails.filter((d) => d.correct).length;
    update((s) => {
      const nextCount = (s.quizAttemptCount || 0) + 1;
      return {
        quizAttemptCount: nextCount,
        quizHistory: [
          ...(s.quizHistory || []),
          {
            attempt: nextCount,
            answers: attemptDetails.map((d) => d.picked).join(','),
            score: `${correctCount}/${questions.length}`,
            details: attemptDetails,
          },
        ],
      };
    });
    goTo(6);
  };

  return (
    <ScreenLayout
      narrow
      title="内容理解クイズ"
      subtitle="読んだカードの内容について、2問とも答えてください。"
      footer={
        <button id="quiz-next" className="btn btn-primary" disabled={!allAnswered} onClick={submitQuiz}>
          回答する
        </button>
      }
    >
      <div className="space-y-8">
        {questions.map((q, qi) => (
          <fieldset key={qi} className="card p-8">
            <legend className="sr-only">Question {qi + 1}</legend>
            <p className="text-[22px] font-bold leading-relaxed">
              Q{qi + 1}. {q.question}
            </p>
            <div className="mt-5 space-y-3">
              {q.options.map((opt, oi) => {
                const active = state.answers[qi] === oi;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-4 bg-white px-5 text-[21px] ${active ? 'border-2 border-black py-[9px]' : 'border border-[#666666] py-2.5'}`}
                  >
                    <input
                      id={`quiz-${qi}-opt-${oi}`}
                      type="radio"
                      name={`quiz-${qi}`}
                      className="h-5 w-5 shrink-0 accent-black"
                      checked={active}
                      onChange={() => choose(qi, oi)}
                    />
                    <span className="font-bold">{LETTERS[oi]})</span>
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </ScreenLayout>
  );
}
