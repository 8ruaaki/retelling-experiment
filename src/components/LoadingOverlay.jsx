import { useExperiment } from '../context/ExperimentContext.jsx';

/** 全画面ローディング：API呼び出し・保存中の多重クリックを抑止（静的表示のみ） */
export default function LoadingOverlay() {
  const { loading } = useExperiment();
  if (!loading.active) return null;
  return (
    <div
      id="loading-overlay"
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90"
      onClickCapture={(e) => e.stopPropagation()}
    >
      <div className="border-2 border-black bg-white px-14 py-10">
        <p className="text-[24px] font-bold text-center whitespace-pre-line">
          {loading.message || '処理中です…'}
        </p>
      </div>
    </div>
  );
}
