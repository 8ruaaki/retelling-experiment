// ============================================================
// AI サービス層：各画面で使用する Gemini プロンプトと呼び出し
//  - お題・カード・クイズは実験プロトコルの固定データ（src/data/experiment.js）を使用
// ============================================================
import { generateJson } from './gemini.js';

// ---------- 画面⑨ 相手キャラの第一声 ----------
export async function generateOpening(target, topic, cards) {
  const r = await generateJson(
    `You are role-playing as "${target}" (described in Japanese) in a chat app.
A learner of English is about to explain or convince you about "${topic}".
They will base their speech on the following source cards:
${cards.map((c) => `- ${c.title}: ${c.body}`).join('\n')}

TASK 1: Write your FIRST chat message in English (2-3 short sentences, CEFR A2-B1, casual, in character as "${target}").
- If your persona "${target}" has a negative or reluctant attitude toward "${topic}", show some skepticism or a reason why you are hesitant.
- If your persona "${target}" has a positive or active attitude, show friendly interest and curiosity.
CRITICAL REQUIREMENT: The very last sentence of your message MUST explicitly ask the learner about the topic ("${topic}", translated to English).
For example, if the topic is "英会話の良さ", the last sentence should be "What are the good points of online English lessons?" or "Tell me about the benefits of online English lessons!"

TASK 2: Extract exactly 2 to 3 "must-include points" (short English phrases) from the source cards. These are the core logical points the learner MUST mention to successfully explain/convince you.

Output JSON only:
{"message":"...", "mustIncludePoints": ["point 1", "point 2"]}`,
    { temperature: 0.7 },
  );
  return r; // Returns { message, mustIncludePoints }
}

/**
 * 画面⑨ 各ターンの判定プロンプト（GAS / フロント直呼び共通）
 * 音声ファイルと共に Gemini へ渡す
 */
export function buildTurnPrompt({ target, topic, cards, keywords, history, turn, mustIncludePoints }) {
  return `You are role-playing as "${target}" (described in Japanese) in a chat-style persuasion/explanation task.
The learner (an English learner) is trying to convey "${topic}" to you.
The learner read these source cards beforehand:
${cards.map((c) => `- ${c.title}: ${c.body}`).join('\n')}
Learner's keywords: ${keywords.join(', ') || '(none)'}
Must-include points from the cards:
${(mustIncludePoints || []).map((p) => `- ${p}`).join('\n') || '(none)'}

Conversation so far:
${history.map((m) => `${m.role === 'partner' ? 'YOU' : 'LEARNER'}: ${m.text}`).join('\n') || '(none)'}

TASK:
1. Transcribe the attached audio of the learner's latest utterance VERBATIM in English (keep fillers like "uh", "um", false starts and grammatical errors; do NOT correct anything).
2. Judge in character whether you are satisfied/convinced. 
   CRITICAL RULE for judging: 
   - Check if the learner successfully mentioned ALL of the "Must-include points" across their utterances.
   - You MUST judge as "convinced" if they mentioned the points without major omissions.
   - You MUST judge as "rebuttal" (asking an additional follow-up question) if they clearly omitted any of the "Must-include points".
   - The maximum number of additional questions you can ask is 2. This is turn ${turn}. If turn >= 3, you MUST evaluate as "convinced".
3. Write your in-character reply in English (2-3 short sentences, CEFR A2-B1).
   - CRITICAL RULE FOR REBUTTAL (DO NOT SPOIL THE ANSWER):
     * NEVER mention the answer, facts, or exact keywords from the missing "Must-include points" (e.g., do NOT say "You didn't mention that it saves time and money, so how much does it save?").
     * Instead, act like your persona "${target}" who notices something is missing or wants to know more from their own perspective. Ask an open-ended, probing question that prompts the learner to explain that point themselves.
     * Examples:
       - Bad (spoiler): "What about the fact that it is good for the environment because it reduces CO2?"
       - Good (probing): "I see, but does this really help our planet? What kind of effect does it have on nature?"
       - Bad (spoiler): "You forgot to explain that it improves sleep quality."
       - Good (probing): "That sounds nice, but how does it actually affect my health or daily rest?"
   - For convinced: express that you are fully satisfied/persuaded and how your feelings/actions change.

Output JSON only:
{"transcript":"...","verdict":"rebuttal" | "convinced","reply":"...","reason_ja":"判定理由を日本語で1文"}`;
}

/** GAS 未設定時のフォールバック：フロントから直接 Gemini に音声を渡す */
export async function evaluateTurnDirect(promptText, audioBase64, mimeType) {
  return generateJson(
    [
      { text: promptText },
      { inline_data: { mime_type: mimeType, data: audioBase64 } },
    ],
    { temperature: 0.4 },
  );
}

/**
 * 音声が出せない環境での動作テスト用（対話型）：
 * ダミー音声ファイルと共に GAS uploadAudio（または直接 Gemini）へ渡す判定プロンプト
 */
export function buildTestTurnPrompt({ target, topic, cards, keywords, history, turn, mustIncludePoints, text }) {
  const basePrompt = buildTurnPrompt({ target, topic, cards, keywords, history, turn, mustIncludePoints });
  return `${basePrompt}\n\nIMPORTANT (TEST MODE): The attached audio is a dummy test file. Ignore the audio content and use the following text verbatim as "transcript", then judge ("convinced" or "rebuttal") and write your "reply" based on it:\nLEARNER UTTERANCE:\n${text}`;
}

/**
 * 音声が出せない環境での動作テスト用（独話型）：
 * ダミー音声ファイルと共に GAS uploadAudio へ渡す文字起こしプロンプト
 */
export function buildTestMonologuePrompt({ text }) {
  return `IMPORTANT (TEST MODE): The attached audio is a dummy test file. Ignore the audio content and output the following text verbatim as "transcript".\nTEXT:\n${text}\n\nOutput JSON only:\n{"transcript":${JSON.stringify(text)},"verdict":"none","reply":"","reason_ja":""}`;
}

/**
 * 画面9（モード2：独話型）文字起こし専用プロンプト（GAS uploadAudio / フロント直呼び共通）
 * 判定・返信は行わず、逐語文字起こしのみを返す
 */
export function buildMonologuePrompt({ target, topic, cards, keywords }) {
  return `The attached audio is a MONOLOGUE retelling by an English learner.
The learner is trying to convey "${topic}" to "${target}" (both described in Japanese), based on this source card:
${cards.map((c) => `- ${c.title}: ${c.body}`).join('\n')}
Learner's keywords: ${(keywords || []).join(', ') || '(none)'}

TASK:
Transcribe the attached audio VERBATIM in English (keep fillers like "uh", "um", false starts, repetitions and grammatical errors; do NOT correct, summarize or complete anything).
If a part is inaudible, write [inaudible].

Output JSON only:
{"transcript":"...","verdict":"none","reply":"","reason_ja":""}`;
}

// ---------- 画面⑩ 総合評価 ----------
export async function generateAssessment({ target, topic, cards, keywords, conversation, englishLevel }) {
  const learnerText = conversation
    .filter((m) => m.role === 'learner')
    .map((m, i) => `(Turn ${i + 1}) ${m.text}`)
    .join('\n');

  return generateJson(
    `あなたは2つの役割で、英語学習者のリテリング（読んだ内容を相手に伝える発話）を評価します。

【タスク情報】
お題: 「${target}」に「${topic}」を伝えよ！
学習者の自己申告英語レベル: ${englishLevel || '不明'}
学習者が読んだカード:
${cards.map((c) => `- [${c.id}] ${c.title}: ${c.body}`).join('\n')}
学習者のキーワードメモ: ${keywords.join(', ')}

【対話ログ】
${conversation.map((m) => `${m.role === 'partner' ? target : '学習者'}: ${m.text}`).join('\n')}

【学習者の発話（文字起こし）】
${learnerText}

========================
■ 役割A：相手キャラクター「${target}」としてのフィードバック（日本語・キャラクター口調）
文法・発音は一切無視し、以下の要素を考慮して、あなた（${target}）の感情や行動がどう動いたかを語ってください。
【考慮する要素】学習者が「どのカードを選んだか（カードの説得力や自身との関連性）」および「カードの情報をどれだけ漏らさずに伝えられたか」
- plausibility: 納得度（0〜100の数値）と、その理由（選んだカードの内容と情報の網羅性を踏まえて、キャラ口調で2〜3文）
- pragmaticImpact: 感情・態度のリアクション（どんな気持ちになり、何をしたくなったか。キャラ口調で2〜3文）
- logicGaps: 相手視点での論理の欠落・もっと聞きたかった点や漏れていた情報（キャラ口調の箇条書き1〜3個）

■ 役割B：英語教師としてのアカデミックCAF評価（横川, 2026 準拠ルーブリック）
合計30点満点:
- content（内容の正確さと網羅性）: 12点満点 — カード内容を正確に、かつ十分に伝えられたか
- organization（構成と論理的な流れ）: 10点満点 — 導入・根拠・結論の構成、談話標識、一貫性
- language（言語使用の正確さと流暢さ）: 8点満点 — 文法・語彙の正確さ、複雑さ、流暢さ（フィラー・言い直しの量）
また、分析用CAFサブスコア（各10点満点: 0〜10の整数）も算出してください:
- complexity（語彙・構文的複雑さスコア: 0〜10）
- accuracy（文法的正確さスコア: 0〜10）
- fluency（流暢さスコア: 0〜10）
各観点（content, organization, language）について、日本語で「good」（良かった点 1〜3個）と「improve」（改善点 1〜3個）を書く。
language には具体的な文法修正例 corrections を 1〜4 個（学習者の実際の発話から抜き出した wrong → 修正後 right、日本語の note）。
teacherComment: 次のステップに向けた教師からの励ましとアドバイス（日本語 3〜4文）。

JSON のみで出力:
{
  "character": {
    "plausibility": {"score": 0, "comment": "..."},
    "pragmaticImpact": {"comment": "..."},
    "logicGaps": ["..."],
    "summary": "キャラ口調のひとこと"
  },
  "caf": {
    "content": {"score": 0, "max": 12, "good": ["..."], "improve": ["..."]},
    "organization": {"score": 0, "max": 10, "good": ["..."], "improve": ["..."]},
    "language": {"score": 0, "max": 8, "good": ["..."], "improve": ["..."],
                 "corrections": [{"wrong": "...", "right": "...", "note": "..."}]},
    "complexity": 0,
    "accuracy": 0,
    "fluency": 0,
    "total": 0,
    "teacherComment": "..."
  }
}`,
    { temperature: 0.4 },
  ).then((r) => {
    // 合計点の整合性を保証
    const c = r.caf;
    const clamp = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
    c.content.score = clamp(c.content.score, 12);
    c.organization.score = clamp(c.organization.score, 10);
    c.language.score = clamp(c.language.score, 8);
    c.complexity = clamp(c.complexity ?? c.organization.score, 10);
    c.accuracy = clamp(c.accuracy ?? c.content.score, 10);
    c.fluency = clamp(c.fluency ?? c.language.score, 10);
    c.total = c.content.score + c.organization.score + c.language.score;
    return r;
  });
}
