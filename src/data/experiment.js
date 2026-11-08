// ============================================================
// 実験プロトコル用の固定データ（テーマ・モード・お題・カード・クイズ）
// ============================================================

/**
 * 実験テーマ定義
 *   topicId: "english" | "bicycle"
 */
export const TOPICS = {
  english: {
    id: 'english',
    label: 'オンライン英会話',
    topic: '英会話の良さ',
    targets: {
      1: '英語が好きな人',
      2: '英語が苦手な人',
      3: '英語が苦手な人',
    },
  },
  bicycle: {
    id: 'bicycle',
    label: '自転車通学',
    topic: '自転車通学の良さ',
    targets: {
      1: 'アクティブな人',
      2: '電車派の人',
      3: '電車派の人',
    },
  },
};

export const TOPIC = TOPICS.english.topic;

/**
 * 実験モード定義
 *   retelling : 'dialogue'（対話UI） | 'monologue'（独話録音UI）
 *   evaluation: 'caf'（右側CAF評価のみ） | 'full'（キャラクター評価＋CAF評価）
 */
export const MODES = {
  1: {
    id: 1,
    label: 'モード1: 説明・対話型',
    description: '説明型（近しい関係）／対話型リテリング／CAF評価のみ',
    target: TOPICS.english.targets[1],
    retelling: 'dialogue',
    evaluation: 'caf',
  },
  2: {
    id: 2,
    label: 'モード2: 説得・独話型',
    description: '説得型（反対・対立関係）／独話型リテリング／フル評価',
    target: TOPICS.english.targets[2],
    retelling: 'monologue',
    evaluation: 'full',
  },
  3: {
    id: 3,
    label: 'モード3: 説得・対話型',
    description: '説得型（反対・対立関係）／対話型リテリング／フル評価',
    target: TOPICS.english.targets[3],
    retelling: 'dialogue',
    evaluation: 'full',
  },
};

/** topicId と mode からお題設定（target, topic, topicLabel, fullPrompt）を取得 */
export const getPromptConfig = (topicId = 'english', mode = 1) => {
  const t = TOPICS[topicId] || TOPICS.english;
  const target = t.targets[mode] || t.targets[1];
  const topic = t.topic;
  return {
    topicId: t.id,
    topicLabel: t.label,
    target,
    topic,
    fullPrompt: fullPromptOf(target, topic),
  };
};

export const fullPromptOf = (target, topic = TOPIC) => `「${target}」に ${topic}を伝えよ！`;

/**
 * テーマ別 英文カード（全5文・58〜65語・FKGL 5.6〜6.8で統制）
 * relevance_level は説得しやすさ（1=非常に説得しやすい〜4=非常に説得しにくい）で画面には表示しない
 */
export const CARDS_BY_TOPIC = {
  english: [
    {
      id: 'A',
      title: 'Card A',
      relevance_level: 1,
      body: 'Online English lessons are very easy and safe for beginners. Many sites offer simple translation tools and kind teachers who speak Japanese. If you do not know a word, you can just write it in the chat box without fear. You do not have to speak well right away. Therefore, even people who feel scared of talking with foreigners can start with peace of mind.',
    },
    {
      id: 'B',
      title: 'Card B',
      relevance_level: 2,
      body: 'Online lessons give you great privacy and personal comfort. You can take classes from your bedroom with your camera off, so no one sees your face. Each lesson lasts only twenty-five minutes, which makes it simple to join after school. You can practice without worrying about people around you. Studying at home creates a very calm, stress-free space for your learning.',
    },
    {
      id: 'C',
      title: 'Card C',
      relevance_level: 3,
      body: 'Low cost is the biggest benefit of online language practice. Normal conversation schools often cost a lot of money. However, web services let you take daily classes for a cheap monthly price. You can practice speaking every single day and get plenty of talk time. Daily practice takes personal effort, but the low price makes it the best choice to save money.',
    },
    {
      id: 'D',
      title: 'Card D',
      relevance_level: 4,
      body: 'Online lessons create a hard, English-only speaking space. You must talk right away with foreign instructors who do not know any Japanese words. You have to use basic signs and simple words during the conversation. This sudden challenge pushes you out of your comfort zone. Strong speaking pressure is difficult, but it forces your language skills to grow rapidly.',
    },
  ],
  bicycle: [
    {
      id: 'A',
      title: 'Card A',
      relevance_level: 1,
      body: 'Power bikes make daily school travel very easy and convenient. Small motors help you ride up steep hills with personal comfort. You never get sweaty because the gentle power moves you forward. Riding to school feels simple and free of stress each morning. Therefore, even people who dislike hard exercise can start riding bikes with peace of mind.',
    },
    {
      id: 'B',
      title: 'Card B',
      relevance_level: 2,
      body: 'Riding a bicycle provides great personal freedom from crowded trains. You do not have to stand inside packed cars with noisy passengers. You can leave your home at any time without checking train timetables. Riding on open streets creates a quiet, comfortable space for your morning. That is why choosing a bike creates a very peaceful setting for your trip.',
    },
    {
      id: 'C',
      title: 'Card C',
      relevance_level: 3,
      body: 'Saving money is the biggest benefit of riding a bicycle. Buying monthly train passes often costs a lot of cash each term. However, using a bike lets you travel without paying expensive fares. You can ride every single day and save personal money for fun things. Daily rides take regular effort, but the low cost makes it a great choice.',
    },
    {
      id: 'D',
      title: 'Card D',
      relevance_level: 4,
      body: 'Riding to school creates a hard, daily body training space. You must ride right away against cold winds and difficult morning rain. You have to push heavy pedals up big hills during the ride. This sudden challenge pushes you out of your comfort zone. Hard body training is tough, but it forces your muscle power to develop very fast.',
    },
  ],
};

export const CARDS = CARDS_BY_TOPIC.english;

export const cardsForTopic = (topicId = 'english') =>
  CARDS_BY_TOPIC[topicId] || CARDS_BY_TOPIC.english;

export const cardById = (id, topicId = 'english') =>
  cardsForTopic(topicId).find((c) => c.id === id) || null;

/** テーマ別 内容理解クイズ（各カード2問・4択）。answerIndex は 0 始まり */
export const QUIZ_BY_TOPIC = {
  english: {
    A: [
      {
        question: 'What helps beginners feel safe during lessons?',
        options: [
          'Daily grammar tests',
          'Translation tools and Japanese-speaking teachers',
          'Group debates with native speakers',
          'Reading long news stories',
        ],
        answerIndex: 1,
        explanation: '本文第2文（Many sites offer simple translation tools and kind teachers who speak Japanese.）に基づきます。',
      },
      {
        question: 'According to the text, who can start online lessons with peace of mind?',
        options: [
          'Only advanced students',
          'Professional translators',
          'People who feel scared of talking with foreigners',
          'Tour guides',
        ],
        answerIndex: 2,
        explanation: '本文最終文（Therefore, even people who feel scared of talking with foreigners can start with peace of mind.）に基づきます。',
      },
    ],
    B: [
      {
        question: 'What can learners do to keep their privacy during class?',
        options: [
          'Turn off their camera',
          'Use a fake name',
          'Wear formal clothes',
          'Take classes in the library',
        ],
        answerIndex: 0,
        explanation: '本文第2文（You can take classes from your bedroom with your camera off, so no one sees your face.）に基づきます。',
      },
      {
        question: 'Why is the twenty-five-minute lesson length an advantage?',
        options: [
          'It includes a ten-minute break',
          'It is simple to fit into a busy day',
          'It requires deep grammar study',
          'It allows multiple group games',
        ],
        answerIndex: 1,
        explanation: '本文第3文（Each lesson lasts only twenty-five minutes, which makes it simple to join after school.）に基づきます。',
      },
    ],
    C: [
      {
        question: 'Why are web services financially attractive compared to normal schools?',
        options: [
          'They send free books',
          'They let you take daily classes for a cheap monthly price',
          'They give cash back for good grades',
          'They do not charge any fees at all',
        ],
        answerIndex: 1,
        explanation: '本文第3文（However, web services let you take daily classes for a cheap monthly price.）に基づきます。',
      },
      {
        question: 'What does the text say is needed to practice every day?',
        options: [
          'Special computers',
          'Living abroad',
          'Personal effort',
          'Native-like pronunciation',
        ],
        answerIndex: 2,
        explanation: '本文最終文（Daily practice takes personal effort, but the low price makes it the best choice to save money.）に基づきます。',
      },
    ],
    D: [
      {
        question: 'What kind of instructors are described in the lesson?',
        options: [
          'Instructors who speak fluent Japanese',
          'Instructors who do not know any Japanese words',
          'Instructors who only use text messages',
          'Instructors who never ask questions',
        ],
        answerIndex: 1,
        explanation: '本文第2文（You must talk right away with foreign instructors who do not know any Japanese words.）に基づきます。',
      },
      {
        question: 'Why does the text describe this intense environment as effective?',
        options: [
          'It is very relaxing and quiet',
          'Strong pressure forces language skills to grow rapidly',
          'It prepares you for written paper tests',
          'It does not require any active effort',
        ],
        answerIndex: 1,
        explanation: '本文最終文（Strong speaking pressure is difficult, but it forces your language skills to grow rapidly.）に基づきます。',
      },
    ],
  },
  bicycle: {
    A: [
      {
        question: 'What helps riders go up steep hills without hard effort?',
        options: [
          'Wearing heavy training shoes',
          'Small motors that give gentle power',
          'Drinking special energy drinks',
          'Walking with the bike',
        ],
        answerIndex: 1,
        explanation: '本文第2文（Small motors help you ride up steep hills with personal comfort.）に基づきます。',
      },
      {
        question: 'According to the text, who can start riding bikes with peace of mind?',
        options: [
          'Only professional racers',
          'People who dislike hard exercise',
          'Train station staff members',
          'Students who live next to school',
        ],
        answerIndex: 1,
        explanation: '本文最終文（Therefore, even people who dislike hard exercise can start riding bikes with peace of mind.）に基づきます。',
      },
    ],
    B: [
      {
        question: 'What unpleasant situation can students avoid by riding a bike?',
        options: [
          'Rainy afternoon weather',
          'Standing inside packed cars with noisy passengers',
          'Buying books at bookstores',
          'Eating breakfast alone',
        ],
        answerIndex: 1,
        explanation: '本文第2文（You do not have to stand inside packed cars with noisy passengers.）に基づきます。',
      },
      {
        question: 'Why does the bicycle trip offer great daily freedom?',
        options: [
          'You can leave home at any time without checking timetables',
          'It allows you to skip school classes',
          'You can ride on high-speed motorways',
          'It costs nothing to fix flat tyres',
        ],
        answerIndex: 0,
        explanation: '本文第3文（You can leave your home at any time without checking train timetables.）に基づきます。',
      },
    ],
    C: [
      {
        question: 'What makes traveling by bicycle financially attractive?',
        options: [
          'Free bicycles provided by the government',
          'Saving money by traveling without paying expensive fares',
          'Getting cash prizes for riding to school',
          'Complete refunds from local train stations',
        ],
        answerIndex: 1,
        explanation: '本文第3文（However, using a bike lets you travel without paying expensive fares.）に基づきます。',
      },
      {
        question: 'What does the passage say daily rides require?',
        options: [
          'Buying expensive racing clothes',
          'Regular effort',
          'Moving closer to the school building',
          'Traveling only on weekends',
        ],
        answerIndex: 1,
        explanation: '本文最終文（Daily rides take regular effort, but the low cost makes it a great choice.）に基づきます。',
      },
    ],
    D: [
      {
        question: 'What difficult weather condition must riders face on the road?',
        options: [
          'Burning hot summer sand',
          'Cold winds and difficult morning rain',
          'Heavy snow inside the classroom',
          'Thick indoor smoke',
        ],
        answerIndex: 1,
        explanation: '本文第2文（You must ride right away against cold winds and difficult morning rain.）に基づきます。',
      },
      {
        question: 'Why does the text describe this intense cycling as beneficial?',
        options: [
          'It allows riders to arrive asleep',
          'It forces your muscle power to develop very fast',
          'It requires no physical power',
          'It guarantees high grades in paper tests',
        ],
        answerIndex: 1,
        explanation: '本文最終文（Hard body training is tough, but it forces your muscle power to develop very fast.）に基づきます。',
      },
    ],
  },
};

export const QUIZ = QUIZ_BY_TOPIC.english;

export const quizForCard = (topicId = 'english', cardId) =>
  (QUIZ_BY_TOPIC[topicId] || QUIZ_BY_TOPIC.english)?.[cardId] || [];

export const KEYWORD_COUNT = 5;
