import { useExperiment } from '../context/ExperimentContext.jsx';

/**
 * 画面2〜10共通ヘッダー
 *  - 実験プロトコル逸脱を防ぐため「戻る」「ホーム」操作は設けない
 */
export default function NavHeader() {
  const { state } = useExperiment();
  return (
    <header className="sticky top-0 z-40 border-b border-black bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-6 px-8 py-3 text-[18px]">
        <span className="font-bold">リテリング実験</span>
        <span className="ml-auto text-[#333333]">画面 {state.screen} / 11</span>
        <span className="font-bold">ID: {state.participantId}</span>
      </div>
    </header>
  );
}
