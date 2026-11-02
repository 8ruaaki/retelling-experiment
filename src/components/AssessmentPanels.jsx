// ============================================================
// 評価表示コンポーネント（既存 Screen9Assessment から移植）
//  - 表示内容は既存仕様のまま、影・アニメーション・カラー絵文字のみ除去
// ============================================================

// ============================================================
// 評価軸①：相手キャラクターからのフィードバック
// ============================================================
export function CharacterFeedback({ name, data }) {
  const score = Math.max(0, Math.min(100, Number(data?.plausibility?.score) || 0));
  return (
    <section className="card p-8">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-[28px] font-bold text-white">{name.slice(0, 1)}</div>
        <div>
          <p className="meta">CHARACTER FEEDBACK</p>
          <h2 className="text-[26px] font-bold">{name}からのひとこと</h2>
        </div>
      </div>
      {data?.summary && (
        <blockquote className="mt-6 border border-black bg-[#fafafa] px-6 py-4 text-[22px] font-bold leading-relaxed">
          「{data.summary}」
        </blockquote>
      )}

      <div className="mt-7">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[22px] font-bold">① 納得度 <span className="text-[16px] text-[#666666]">Plausibility</span></h3>
          <span className="text-[32px] font-bold">{score}<span className="text-[18px] text-[#666666]"> / 100</span></span>
        </div>
        <div className="mt-2 h-4 border border-black bg-white">
          <div className="h-full bg-black" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-3 text-[20px] leading-relaxed">{data?.plausibility?.comment}</p>
      </div>

      <div className="mt-7 border-t border-dashed border-[#666666] pt-6">
        <h3 className="text-[22px] font-bold">② 気持ち・態度の変化 <span className="text-[16px] text-[#666666]">Pragmatic Impact</span></h3>
        <p className="mt-2 text-[20px] leading-relaxed">{data?.pragmaticImpact?.comment}</p>
      </div>

      <div className="mt-7 border-t border-dashed border-[#666666] pt-6">
        <h3 className="text-[22px] font-bold">③ もっと聞きたかったこと <span className="text-[16px] text-[#666666]">Logic Gaps</span></h3>
        <ul className="mt-2 space-y-2">
          {(data?.logicGaps || []).map((g, i) => (
            <li key={i} className="flex gap-3 text-[20px] leading-relaxed">
              <span className="font-bold">？</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================
// 評価軸②：アカデミック CAF 評価（横川, 2026 準拠）
// ============================================================
const CAF_ITEMS = [
  { key: 'content', label: '内容の正確さと網羅性', max: 12 },
  { key: 'organization', label: '構成と論理的な流れ', max: 10 },
  { key: 'language', label: '言語使用の正確さと流暢さ', max: 8 },
];

export function CafAssessment({ data }) {
  return (
    <section className="card p-8">
      <p className="meta">ACADEMIC CAF ASSESSMENT</p>
      <h2 className="text-[26px] font-bold">英語教師からの評価</h2>
      <p className="text-[16px] text-[#666666]">横川（2026）準拠ルーブリック</p>

      <div className="mt-6 flex items-end gap-3 bg-black px-7 py-5 text-white">
        <span className="text-[64px] font-bold leading-none">{data.total}</span>
        <span className="mb-1 text-[26px] font-bold">/ 30 点</span>
      </div>

      <div className="mt-6 space-y-6">
        {CAF_ITEMS.map(({ key, label, max }) => {
          const item = data[key] || {};
          return (
            <div key={key} className="border border-black p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[22px] font-bold">{label}</h3>
                <span className="text-[26px] font-bold">{item.score}<span className="text-[18px] text-[#666666]"> / {max}</span></span>
              </div>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: max }).map((_, i) => (
                  <span key={i} className={`h-2.5 flex-1 ${i < item.score ? 'bg-black' : 'bg-[#dddddd]'}`} />
                ))}
              </div>
              <FbList title="良かった点" mark="＋" items={item.good} />
              <FbList title="改善点" mark="－" items={item.improve} />
              {key === 'language' && item.corrections?.length > 0 && (
                <div className="mt-4">
                  <p className="text-[19px] font-bold">文法修正例</p>
                  <ul className="mt-2 space-y-3">
                    {item.corrections.map((c, i) => (
                      <li key={i} className="border border-[#cccccc] bg-[#fafafa] p-4 text-[19px] leading-relaxed">
                        <p className="text-[#666666] line-through">誤：{c.wrong}</p>
                        <p className="font-bold">正：{c.right}</p>
                        {c.note && <p className="mt-1 text-[17px] text-[#333333]">{c.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 border border-dashed border-black p-6">
        <p className="text-[19px] font-bold">先生からのステップアップコメント</p>
        <p className="mt-2 text-[20px] leading-relaxed">{data.teacherComment}</p>
      </div>
    </section>
  );
}

function FbList({ title, mark, items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-[19px] font-bold">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-[19px] leading-relaxed">
            <span className="font-bold">{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

