import { useExperiment } from '../context/ExperimentContext.jsx';
import { ScreenLayout } from '../components/Layout.jsx';
import { cardsForTopic } from '../data/experiment.js';

/** 【画面3】カード選択（選択テーマに応じた4枚から1枚） */
export default function Screen3Cards() {
  const { state, update, goTo } = useExperiment();
  const cards = cardsForTopic(state.topicId);

  const select = (id) =>
    update((s) =>
      s.cardId === id
        ? {}
        : // カードが変わったら下流データを初期化
          { cardId: id, readingMs: null, answers: {}, quizAttemptCount: 0, quizHistory: [], quizSaved: false },
    );

  return (
    <ScreenLayout
      title="伝える内容のカードを1枚選んでください"
      subtitle={`「${state.target}」に${state.topic}を伝えるために使うカードを1枚選んでください。`}
      footer={
        <button id="cards-next" className="btn btn-primary" disabled={!state.cardId} onClick={() => goTo(4)}>
          決定して次へ
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        {cards.map((c) => {
          const selected = state.cardId === c.id;
          return (
            <button
              key={c.id}
              id={`card-${c.id}`}
              aria-pressed={selected}
              onClick={() => select(c.id)}
              className={`cursor-pointer bg-white text-left ${selected ? 'border-2 border-black p-[27px]' : 'border border-[#666666] p-7'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-bold">{c.title}</span>
                {selected && <span className="bg-black px-3 py-0.5 text-[16px] font-bold text-white">選択中</span>}
              </div>
              <p className="english mt-3 text-[21px] leading-[1.8]">{c.body}</p>
            </button>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
