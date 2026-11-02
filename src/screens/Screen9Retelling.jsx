import { useExperiment } from '../context/ExperimentContext.jsx';
import { MODES } from '../data/experiment.js';
import RetellingDialogue from './retelling/RetellingDialogue.jsx';
import RetellingMonologue from './retelling/RetellingMonologue.jsx';

/** 【画面9】リテリング：モード2は独話型、モード1・3は既存の対話型 */
export default function Screen9Retelling() {
  const { state } = useExperiment();
  return MODES[state.mode]?.retelling === 'monologue' ? <RetellingMonologue /> : <RetellingDialogue />;
}

