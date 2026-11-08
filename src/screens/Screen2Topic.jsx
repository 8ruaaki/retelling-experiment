import { useExperiment } from '../context/ExperimentContext.jsx';
import { ScreenLayout } from '../components/Layout.jsx';

/** 【画面2】お題提示（モードに応じて相手が切り替わる） */
export default function Screen2Topic() {
  const { state, goTo } = useExperiment();

  return (
    <ScreenLayout
      narrow
      footer={
        <button id="topic-next" className="btn btn-primary" onClick={() => goTo(3)}>
          次へ
        </button>
      }
    >
      <section className="card mt-16 px-10 py-14 text-center">
        <p className="meta">テーマ：{state.topicLabel || state.topic}</p>
        <p id="topic-text" className="mt-6 text-[34px] font-bold leading-relaxed">
          「{state.target}」に
          <br />
          {state.topic}を伝えよ！
        </p>
      </section>
    </ScreenLayout>
  );
}
