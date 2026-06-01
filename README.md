# palaver-math

> Dialogue and consensus mathematics for JavaScript — iterative convergence, coalition formation, and dialogue trees.

## What This Does

`palaver-math` models group consensus as iterative convergence, inspired by West African palaver tradition. Participants hold position vectors, vote on proposals, and drift toward agreement. It detects convergence, finds coalitions, predicts consensus, and builds dialogue trees. Use it for multi-agent systems, collaborative filtering, or opinion dynamics.

## The Cultural Root

See the Python version (`palaver-math` on PyPI) for the full cultural background. A palaver is community dialogue under a tree — no voting, just iteration until everyone agrees.

## Install

```bash
npm install palaver-math
```

## Quick Start

```typescript
import {
  PalaverSession, computeCenter, consensusDistance,
  convergenceRate, isConverging,
  findCoalitions, coalitionStrength,
  buildDialogueTree, findConsensusPath,
} from "palaver-math";

const session = new PalaverSession({ threshold: 0.5, stepSize: 0.1 });
session.addParticipant([1.0, 0.0]);
session.addParticipant([0.0, 1.0]);
session.addParticipant([0.5, 0.5]);

const proposal = session.addProposal([0.4, 0.4]);
session.vote(0, proposal);

const result = session.computeConsensus();
console.log(result.consensusReached, result.center, result.rounds);
```

## API Reference

### `PalaverSession`
- `addParticipant(position: number[]) → number`
- `addProposal(position: number[]) → number`
- `vote(participantIdx, proposalIdx) → void`
- `computeConsensus() → { consensusReached, center, distance, rounds, positions }`
- `participants() → Participant[]`
- `history() → number[][][]`

### Consensus
- `computeCenter(participants) → number[]`
- `consensusDistance(participants) → number`
- `influenceWeightedCenter(participants, weights?) → number[]`

### Convergence
- `convergenceRate(history) → number`
- `isConverging(history) → boolean`

### Coalitions
- `findCoalitions(participants, threshold) → number[][]`
- `coalitionStrength(coalition) → number`

### Dialogue
- `buildDialogueTree(statements) → DialogueNode`
- `findConsensusPath(tree) → DialogueNode[]`

## License

MIT
