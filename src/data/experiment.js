// ============================================================
// 実験プロトコル用の固定データ（モード・お題・カード・クイズ）
// ============================================================

export const TOPIC = 'キャンプの魅力';

/**
 * 実験モード定義
 *   retelling : 'dialogue'（既存対話UI） | 'monologue'（独話録音UI）
 *   evaluation: 'caf'（右側CAF評価のみ） | 'full'（キャラクター評価＋CAF評価）
 */
export const MODES = {
  1: {
    id: 1,
    label: 'モード1',
    description: '説明型（近しい関係）／対話型リテリング／CAF評価のみ',
    target: '自然やアクティビティが好きな人',
    retelling: 'dialogue',
    evaluation: 'caf',
  },
  2: {
    id: 2,
    label: 'モード2',
    description: '説得型（反対・対立関係）／独話型リテリング／フル評価',
    target: '完全なインドア派で虫や汚れが苦手な人',
    retelling: 'monologue',
    evaluation: 'full',
  },
  3: {
    id: 3,
    label: 'モード3',
    description: '説得型（反対・対立関係）／対話型リテリング／フル評価',
    target: '完全なインドア派で虫や汚れが苦手な人',
    retelling: 'dialogue',
    evaluation: 'full',
  },
};

export const fullPromptOf = (target, topic = TOPIC) => `「${target}」に ${topic}を伝えよ！`;

/** 英文カード（PREP法・各約70語）。relevance_level は説得しやすさ（1=非常に説得しやすい〜4=非常に説得しにくい）で画面には表示しない */
export const CARDS = [
  {
    id: 'A',
    title: 'Card A',
    relevance_level: 1,
    body: 'Camping can be completely comfortable and stress-free. With modern glamping, you do not have to worry about cold weather or disturbing bugs, because spacious dome tents are fully equipped with air conditioning. Guests can sleep on clean, hotel-quality beds and use private shower facilities. You can easily enjoy nature while keeping all the comforts of home. Therefore, even people who dislike outdoor dirt can have a great experience.',
  },
  {
    id: 'B',
    title: 'Card B',
    relevance_level: 2,
    body: 'Camping provides the ultimate mental refreshment. Being surrounded by natural sounds, such as rustling leaves and flowing rivers, significantly reduces brain fatigue and daily anxiety. You do not need to do any heavy physical work; simply relaxing on a hammock with your favorite book or smartphone movie feels luxurious outdoors. Stepping away from urban noise restores your peace of mind. That is why simply sitting in nature is worthwhile.',
  },
  {
    id: 'C',
    title: 'Card C',
    relevance_level: 3,
    body: 'The true appeal of camping lies in embracing inconvenience. In our modern daily lives, everything is instant and easy, so doing basic tasks like gathering firewood and igniting a flame brings a unique sense of accomplishment. Cooking raw meat over real firewood smoke makes the meal taste far more rewarding than ordinary food. The slight hassle is not a problem; it is the most rewarding part of the entire journey.',
  },
  {
    id: 'D',
    title: 'Card D',
    relevance_level: 4,
    body: 'Camping offers direct encounters with wild creatures and raw nature. Forests are packed with fascinating insects, rare birds, and unusual plants that you never encounter in suburban towns. Spending hours searching through thick bushes, catching beetles, and getting your clothes covered in mud creates unforgettable excitement. Observing living creatures in their natural habitat teaches real biology. Experiencing the wild environment firsthand is what makes outdoor living truly thrilling.',
  },
];

export const cardById = (id) => CARDS.find((c) => c.id === id) || null;

/** 内容理解クイズ（各カード2問・4択）。answerIndex は 0 始まり */
export const QUIZ = {
  A: [
    {
      question: 'What feature of modern glamping is highlighted to keep guests comfortable?',
      options: ['Free sleeping bags', 'Air-conditioned dome tents and clean beds', 'Lessons on pitching tents', 'Cooking over campfire'],
      answerIndex: 1,
      explanation: '本文に dome tents are fully equipped with air conditioning および clean, hotel-quality beds と明記されています。',
    },
    {
      question: 'According to the text, who can have a great experience with glamping?',
      options: ['Professional mountain climbers', 'Budget travelers', 'People who dislike outdoor dirt', 'Survival instructors'],
      answerIndex: 2,
      explanation: '最終文に even people who dislike outdoor dirt can have a great experience と記述されています。',
    },
  ],
  B: [
    {
      question: 'According to the passage, what natural benefit helps reduce brain fatigue?',
      options: ['Intense physical exercise', 'Listening to natural sounds like rustling leaves', 'Building structures', 'Disconnecting devices'],
      answerIndex: 1,
      explanation: '本文第2文に natural sounds ... reduces brain fatigue と記述されています。',
    },
    {
      question: 'What does the author suggest doing on a hammock outdoors?',
      options: ['Sleeping through the night', 'Cooking meals', 'Relaxing with a book or watching a movie', 'Setting up bug nets'],
      answerIndex: 2,
      explanation: '本文第3文に relaxing on a hammock with your favorite book or smartphone movie と記述されています。',
    },
  ],
  C: [
    {
      question: 'Why does the passage claim that basic tasks like making a fire are appealing?',
      options: ['They save money', 'They bring a unique sense of accomplishment', 'They are campsite laws', 'They keep animals away'],
      answerIndex: 1,
      explanation: '本文第2文に doing basic tasks ... brings a unique sense of accomplishment と記述されています。',
    },
    {
      question: 'According to the author, how does food taste when cooked over firewood?',
      options: ['Unusually dry', 'Exactly like restaurant food', 'Far more rewarding than ordinary food', 'Too smoky'],
      answerIndex: 2,
      explanation: '本文第3文に makes the meal taste far more rewarding と記述されています。',
    },
  ],
  D: [
    {
      question: 'What activity is described as creating unforgettable excitement?',
      options: ['Renting luxury vehicles', 'Searching through bushes and catching beetles', 'Staying clean inside cabins', 'Heated pools'],
      answerIndex: 1,
      explanation: '本文第3文に catching beetles ... creates unforgettable excitement と記述されています。',
    },
    {
      question: 'What does observing creatures in their natural habitat teach, according to the text?',
      options: ['Advanced cooking', 'Survival navigation', 'Real biology', 'Weather forecasting'],
      answerIndex: 2,
      explanation: '本文第4文に Observing living creatures ... teaches real biology と明記されています。',
    },
  ],
};

export const KEYWORD_COUNT = 5;

