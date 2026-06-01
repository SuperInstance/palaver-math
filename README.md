# palaver-math

> Mathematics of consensus-building, inspired by the West African Palaver tradition.

**Palaver** is the tradition of extended community dialogue — structured conversation that builds consensus through deliberation. This package implements the mathematical foundations of that process.

## Install

```bash
npm install palaver-math
```

## Usage

```typescript
import {
  computeCenter, consensusDistance, influenceWeightedCenter,
  PalaverSession, convergenceRate, predictConsensus,
  findCoalitions, coalitionStrength,
  buildDialogueTree, findConsensusPath,
} from 'palaver-math';

// Define participants with positions and influence
const participants = [
  { id: 'elder', position: [7, 3], influence: 5 },
  { id: 'youth', position: [3, 8], influence: 2 },
  { id: 'merchant', position: [5, 5], influence: 3 },
];

// Compute consensus
const center = computeCenter(participants);        // unweighted centroid
const weighted = influenceWeightedCenter(participants);  // influence-weighted
const spread = consensusDistance(participants);     // how far apart they are

// Run a Palaver session
const session = new PalaverSession();
participants.forEach(p => session.addParticipant(p));
session.addProposal('compromise', [5, 5], 'elder');
session.vote('elder', 'compromise', 1.0);
session.vote('youth', 'compromise', 0.6);
const result = session.computeConsensus();

// Find coalitions
const coalitions = findCoalitions(participants, 4.0);
const strength = coalitionStrength(coalitions[0]);

// Build dialogue trees and find consensus paths
const tree = buildDialogueTree([
  { statement: 'We need to decide.', speaker: 'elder' },
  { statement: 'I agree to the compromise.', speaker: 'youth', parentId: 0, isConsensus: true },
]);
const path = findConsensusPath(tree);
```

## API

### Types
- **Participant** `{ id, position: number[], influence: number }`
- **Topic** `{ id, dimensions: string[], idealPoint: number[] }`
- **Proposal** `{ id, position: number[], proposerId, votes: Map }`
- **ConsensusResult** `{ position: number[], confidence: number, rounds: number }`
- **DialogueNode** `{ statement, speaker, responses: DialogueNode[], isConsensus? }`

### Consensus Functions
- `computeCenter(participants)` → centroid
- `consensusDistance(participants)` → average distance from center
- `influenceWeightedCenter(participants)` → influence-weighted centroid

### PalaverSession
- `addParticipant(p)`, `addProposal(id, position, proposerId)`
- `vote(participantId, proposalId, weight)`
- `computeConsensus()` → `{ position, confidence, rounds }`

### Convergence
- `convergenceRate(sessionHistory)` → fraction of steps that converge
- `predictConsensus(session, maxRounds)` → predicted final position

### Coalitions
- `findCoalitions(participants, threshold)` → groups of nearby participants
- `coalitionStrength(coalition)` → combined influence × cohesion

### Dialogue Tree
- `buildDialogueTree(statements)` → tree structure
- `findConsensusPath(tree)` → shortest BFS path to consensus node

## License

MIT
