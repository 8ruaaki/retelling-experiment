import { useExperiment } from '../../context/ExperimentContext.jsx';

/** 画面9 共通：お題＋キーワード5語を上部に固定表示 */
export default function RetellingTopBar() {
  const { state } = useExperiment();
  return (
    <div className="border-b border-black bg-white">
      <div className="mx-auto w-full max-w-[1400px] px-8 py-4">
        <p id="retelling-topic" className="text-[22px] font-bold">
          「{state.target}」に {state.topic}を伝えよ！
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="meta mr-1">KEYWORDS</span>
          {state.keywords.map((k, i) => (
            <span key={i} className="badge">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

