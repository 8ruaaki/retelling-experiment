// ============================================================
// 実験全体のステート管理（画面1〜11）
//  - 実験プロトコル上のデータはすべてここで保持する
// ============================================================
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { KEYWORD_COUNT, cardById } from '../data/experiment.js';

const newSessionId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const initialState = () => ({
  screen: 1,
  sessionId: newSessionId(),
  participantId: '',
  mode: null, // 1 | 2 | 3
  attempt: 1, // 本プロトコルでは再挑戦なし（既存の保存処理・ファイル名との互換のため固定）
  // ② お題
  target: '',
  topic: '',
  // ③ カード
  cardId: '',
  // ④ 読解時間
  readingMs: null,
  // ⑤⑥ クイズ
  answers: {}, // { [qIndex]: optionIndex }
  quizSaved: false,
  // ⑦ 再読解時間
  rereadingMs: null,
  // ⑧ キーワード
  keywords: Array(KEYWORD_COUNT).fill(''),
  // ⑨ リテリング（対話型：既存仕様）
  conversation: [],
  mustIncludePoints: [],
  retellingDone: false,
  audioUrls: [],
  // ⑨ リテリング（独話型）
  monologue: null, // { transcript, preview, durationSec, audioUrl }
  // ⑩ 評価
  assessment: null,
  assessmentSaved: false,
});

const Ctx = createContext(null);

export function ExperimentProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState({ active: false, message: '' });

  const update = useCallback((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const goTo = useCallback((screen) => {
    setState((s) => ({ ...s, screen }));
    window.scrollTo({ top: 0 });
  }, []);

  const resetAll = useCallback(() => {
    setState(initialState());
    window.scrollTo({ top: 0 });
  }, []);

  /** ローディング表示をしながら非同期処理を実行 */
  const withLoading = useCallback(async (message, fn) => {
    setLoading({ active: true, message });
    try {
      return await fn();
    } finally {
      setLoading({ active: false, message: '' });
    }
  }, []);

  const value = useMemo(
    () => ({ state, update, goTo, resetAll, loading, withLoading }),
    [state, update, goTo, resetAll, loading, withLoading],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useExperiment = () => useContext(Ctx);

/** 選択済みカード（既存の対話・評価ロジックと互換の配列形式） */
export const selectedCardsOf = (state) => {
  const c = cardById(state.cardId);
  return c ? [c] : [];
};

export { newSessionId };
