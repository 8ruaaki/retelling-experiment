import { selectedCardsOf, useExperiment } from '../context/ExperimentContext.jsx';
import NavHeader from '../components/NavHeader.jsx';
import { FooterBar } from '../components/Layout.jsx';
import { KEYWORD_COUNT } from '../data/experiment.js';

/** 空白文字（半角・全角スペース、タブ等）を含むか */
const hasSpace = (v) => /\s/.test(v);

/** 【画面8】キーワード選択（5枠・1枠1単語） */
export default function Screen8Keywords() {
  const { state, update, goTo } = useExperiment();
  const [card] = selectedCardsOf(state);
  const keywords = state.keywords.length === KEYWORD_COUNT ? state.keywords : Array(KEYWORD_COUNT).fill('');

  const errors = keywords.map((k) => hasSpace(k));
  const filled = keywords.filter((k, i) => k.length > 0 && !errors[i]).length;
  const canNext = filled === KEYWORD_COUNT;

  const setAt = (i, v) => update(() => ({ keywords: keywords.map((k, j) => (j === i ? v : k)) }));

  return (
    <div className="flex h-screen flex-col bg-white">
      <NavHeader />

      <div className="mx-auto w-full max-w-[1400px] px-8 pt-6 pb-4">
        <h1 className="page-title">キーワードを5つ書き出してください</h1>
        <p className="page-sub">リテリングで使いたい英単語を、1つの枠に1単語ずつ入力してください。</p>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-8 px-8 pb-28">
        {/* 左カラム：カード本文 */}
        <section className="scroll-thin min-h-0 flex-1 overflow-y-auto border border-black bg-white p-8" aria-label="カード本文">
          <span className="meta">{card?.title.toUpperCase()}</span>
          <p className="english mt-3">{card?.body}</p>
        </section>

        {/* 右カラム：キーワード入力 ×5 */}
        <aside className="scroll-thin flex min-h-0 w-[440px] shrink-0 flex-col overflow-y-auto border border-black bg-white p-8" aria-label="キーワード入力">
          <h2 className="text-[22px] font-bold">キーワード</h2>
          <ol className="mt-4 space-y-4">
            {keywords.map((k, i) => (
              <li key={i}>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right text-[18px] font-bold text-[#666666]">{i + 1}</span>
                  <input
                    id={`keyword-${i}`}
                    className={`input flex-1 ${errors[i] ? 'input-error' : ''}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={k}
                    onChange={(e) => setAt(i, e.target.value)}
                  />
                </div>
                {errors[i] && <p className="ml-9 mt-1 text-[16px] font-bold">1枠1単語のみ入力してください</p>}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <FooterBar>
        <span className="mr-auto text-[20px] font-bold">{filled} / {KEYWORD_COUNT} 入力済み</span>
        <button
          id="keywords-next"
          className="btn btn-primary"
          disabled={!canNext}
          onClick={() => {
            update({ keywords: keywords.map((k) => k.trim()) });
            goTo(9);
          }}
        >
          次へ
        </button>
      </FooterBar>
    </div>
  );
}
