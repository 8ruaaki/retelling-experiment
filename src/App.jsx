import { useExperiment } from './context/ExperimentContext.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import Screen1Entry from './screens/Screen1Entry.jsx';
import Screen2Topic from './screens/Screen2Topic.jsx';
import Screen3Cards from './screens/Screen3Cards.jsx';
import Screen4Reading from './screens/Screen4Reading.jsx';
import Screen5Quiz from './screens/Screen5Quiz.jsx';
import Screen6QuizResult from './screens/Screen6QuizResult.jsx';
import Screen7Reread from './screens/Screen7Reread.jsx';
import Screen8Keywords from './screens/Screen8Keywords.jsx';
import Screen9Retelling from './screens/Screen9Retelling.jsx';
import Screen10Assessment from './screens/Screen10Assessment.jsx';
import Screen11Finish from './screens/Screen11Finish.jsx';

const SCREENS = {
  1: Screen1Entry,
  2: Screen2Topic,
  3: Screen3Cards,
  4: Screen4Reading,
  5: Screen5Quiz,
  6: Screen6QuizResult,
  7: Screen7Reread,
  8: Screen8Keywords,
  9: Screen9Retelling,
  10: Screen10Assessment,
  11: Screen11Finish,
};

export default function App() {
  const { state } = useExperiment();
  const Screen = SCREENS[state.screen] || Screen1Entry;
  return (
    <>
      {/* key で画面ごとに再マウント（計測・録音のライフサイクルを画面単位に閉じる） */}
      <Screen key={`${state.screen}-${state.sessionId}`} />
      <LoadingOverlay />
    </>
  );
}
