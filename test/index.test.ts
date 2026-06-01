import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCenter,
  consensusDistance,
  influenceWeightedCenter,
  PalaverSession,
  convergenceRate,
  predictConsensus,
  findCoalitions,
  coalitionStrength,
  buildDialogueTree,
  findConsensusPath,
  type Participant,
  type Topic,
  type DialogueStatement,
} from '../src/index.js';

// ─── computeCenter ────────────────────────────────────────────────────

describe('computeCenter', () => {
  it('returns empty array for no participants', () => {
    assert.deepStrictEqual(computeCenter([]), []);
  });

  it('returns the position for a single participant', () => {
    const p: Participant = { id: 'a', position: [3, 4], influence: 1 };
    assert.deepStrictEqual(computeCenter([p]), [3, 4]);
  });

  it('computes centroid of multiple participants', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 1 },
      { id: 'b', position: [4, 6], influence: 1 },
    ];
    assert.deepStrictEqual(computeCenter(ps), [2, 3]);
  });

  it('works with 3D positions', () => {
    const ps: Participant[] = [
      { id: 'a', position: [1, 2, 3], influence: 1 },
      { id: 'b', position: [3, 4, 5], influence: 1 },
      { id: 'c', position: [5, 6, 7], influence: 1 },
    ];
    assert.deepStrictEqual(computeCenter(ps), [3, 4, 5]);
  });
});

// ─── consensusDistance ─────────────────────────────────────────────────

describe('consensusDistance', () => {
  it('returns 0 for empty participants', () => {
    assert.strictEqual(consensusDistance([]), 0);
  });

  it('returns 0 for a single participant', () => {
    assert.strictEqual(consensusDistance([{ id: 'a', position: [5, 5], influence: 1 }]), 0);
  });

  it('returns 0 when all participants share the same position', () => {
    const ps: Participant[] = [
      { id: 'a', position: [1, 1], influence: 1 },
      { id: 'b', position: [1, 1], influence: 1 },
    ];
    assert.strictEqual(consensusDistance(ps), 0);
  });

  it('computes positive distance for spread participants', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 1 },
      { id: 'b', position: [10, 10], influence: 1 },
    ];
    assert.ok(consensusDistance(ps) > 0);
  });
});

// ─── influenceWeightedCenter ──────────────────────────────────────────

describe('influenceWeightedCenter', () => {
  it('returns empty array for no participants', () => {
    assert.deepStrictEqual(influenceWeightedCenter([]), []);
  });

  it('favors high-influence participants', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 9 },
      { id: 'b', position: [10, 10], influence: 1 },
    ];
    const center = influenceWeightedCenter(ps);
    assert.ok(center[0] < 3); // should be close to 0
    assert.ok(center[1] < 3);
  });

  it('falls back to centroid when total influence is 0', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 0 },
      { id: 'b', position: [4, 6], influence: 0 },
    ];
    assert.deepStrictEqual(influenceWeightedCenter(ps), [2, 3]);
  });

  it('equal influence gives same result as computeCenter', () => {
    const ps: Participant[] = [
      { id: 'a', position: [1, 2], influence: 5 },
      { id: 'b', position: [5, 8], influence: 5 },
    ];
    assert.deepStrictEqual(influenceWeightedCenter(ps), computeCenter(ps));
  });
});

// ─── PalaverSession ───────────────────────────────────────────────────

describe('PalaverSession', () => {
  it('starts with no participants', () => {
    const s = new PalaverSession();
    assert.strictEqual(s.participants.size, 0);
  });

  it('adds participants', () => {
    const s = new PalaverSession();
    s.addParticipant({ id: 'a', position: [1, 1], influence: 1 });
    assert.strictEqual(s.participants.size, 1);
  });

  it('adds proposals', () => {
    const s = new PalaverSession();
    const prop = s.addProposal('p1', [5, 5], 'a');
    assert.strictEqual(prop.id, 'p1');
    assert.deepStrictEqual(prop.position, [5, 5]);
  });

  it('records votes', () => {
    const s = new PalaverSession();
    s.addParticipant({ id: 'a', position: [1, 1], influence: 1 });
    s.addParticipant({ id: 'b', position: [9, 9], influence: 1 });
    s.addProposal('p1', [5, 5], 'a');
    s.vote('a', 'p1', 1);
    s.vote('b', 'p1', 0.8);
    const prop = s.proposals.find(p => p.id === 'p1')!;
    assert.strictEqual(prop.votes.get('a'), 1);
    assert.strictEqual(prop.votes.get('b'), 0.8);
  });

  it('throws on voting for nonexistent proposal', () => {
    const s = new PalaverSession();
    assert.throws(() => s.vote('a', 'ghost', 1), /not found/);
  });

  it('computeConsensus returns result with rounds', () => {
    const s = new PalaverSession();
    s.addParticipant({ id: 'a', position: [5, 5], influence: 1 });
    const result = s.computeConsensus();
    assert.strictEqual(result.rounds, 1);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });

  it('computeConsensus returns empty for no participants', () => {
    const s = new PalaverSession();
    const result = s.computeConsensus();
    assert.deepStrictEqual(result.position, []);
    assert.strictEqual(result.confidence, 0);
  });

  it('incrementing rounds across multiple calls', () => {
    const s = new PalaverSession();
    s.addParticipant({ id: 'a', position: [1, 1], influence: 1 });
    s.computeConsensus();
    s.computeConsensus();
    const result = s.computeConsensus();
    assert.strictEqual(result.rounds, 3);
  });

  it('accepts a topic', () => {
    const topic: Topic = { id: 't1', dimensions: ['x', 'y'], idealPoint: [5, 5] };
    const s = new PalaverSession(topic);
    // topic is stored internally; verify via session construction
  });
});

// ─── convergenceRate ──────────────────────────────────────────────────

describe('convergenceRate', () => {
  it('returns 0 for fewer than 2 results', () => {
    assert.strictEqual(convergenceRate([]), 0);
    assert.strictEqual(convergenceRate([{ position: [1, 1], confidence: 0.5, rounds: 1 }]), 0);
  });

  it('returns 1 when positions always converge', () => {
    const history = [
      { position: [10, 10], confidence: 0.2, rounds: 1 },
      { position: [8, 8], confidence: 0.4, rounds: 2 },
      { position: [7, 7], confidence: 0.6, rounds: 3 },
      { position: [6.5, 6.5], confidence: 0.8, rounds: 4 },
    ];
    assert.strictEqual(convergenceRate(history), 1);
  });

  it('returns 0 when positions diverge', () => {
    const history = [
      { position: [1, 1], confidence: 0.5, rounds: 1 },
      { position: [3, 3], confidence: 0.5, rounds: 2 },
      { position: [7, 7], confidence: 0.5, rounds: 3 },
    ];
    assert.strictEqual(convergenceRate(history), 0);
  });
});

// ─── predictConsensus ─────────────────────────────────────────────────

describe('predictConsensus', () => {
  it('returns empty for session with no participants', () => {
    const s = new PalaverSession();
    assert.deepStrictEqual(predictConsensus(s, 5), []);
  });

  it('returns a position after simulating rounds', () => {
    const s = new PalaverSession();
    s.addParticipant({ id: 'a', position: [5, 5], influence: 1 });
    const result = predictConsensus(s, 3);
    assert.strictEqual(result.length, 2);
  });
});

// ─── findCoalitions ───────────────────────────────────────────────────

describe('findCoalitions', () => {
  it('returns empty for no participants', () => {
    assert.deepStrictEqual(findCoalitions([], 5), []);
  });

  it('groups nearby participants into one coalition', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 1 },
      { id: 'b', position: [1, 1], influence: 1 },
      { id: 'c', position: [2, 2], influence: 1 },
    ];
    const coalitions = findCoalitions(ps, 3);
    assert.strictEqual(coalitions.length, 1);
    assert.strictEqual(coalitions[0].length, 3);
  });

  it('splits distant participants into separate coalitions', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 1 },
      { id: 'b', position: [100, 100], influence: 1 },
    ];
    const coalitions = findCoalitions(ps, 5);
    assert.strictEqual(coalitions.length, 2);
  });

  it('uses threshold to determine grouping', () => {
    const ps: Participant[] = [
      { id: 'a', position: [0, 0], influence: 1 },
      { id: 'b', position: [3, 4], influence: 1 }, // distance = 5
    ];
    const tight = findCoalitions(ps, 4.9);
    assert.strictEqual(tight.length, 2);
    const loose = findCoalitions(ps, 5.1);
    assert.strictEqual(loose.length, 1);
  });
});

// ─── coalitionStrength ────────────────────────────────────────────────

describe('coalitionStrength', () => {
  it('returns 0 for empty coalition', () => {
    assert.strictEqual(coalitionStrength([]), 0);
  });

  it('is higher for unified high-influence coalition', () => {
    const unified: Participant[] = [
      { id: 'a', position: [5, 5], influence: 5 },
      { id: 'b', position: [5, 5], influence: 5 },
    ];
    const spread: Participant[] = [
      { id: 'a', position: [0, 0], influence: 5 },
      { id: 'b', position: [10, 10], influence: 5 },
    ];
    assert.ok(coalitionStrength(unified) > coalitionStrength(spread));
  });
});

// ─── buildDialogueTree ────────────────────────────────────────────────

describe('buildDialogueTree', () => {
  it('builds a tree from flat statements', () => {
    const stmts: DialogueStatement[] = [
      { statement: 'root', speaker: 'a' },
      { statement: 'reply1', speaker: 'b', parentId: 0 },
      { statement: 'reply2', speaker: 'c', parentId: 0 },
    ];
    const tree = buildDialogueTree(stmts);
    assert.strictEqual(tree.statement, 'root');
    assert.strictEqual(tree.responses.length, 2);
    assert.strictEqual(tree.responses[0].statement, 'reply1');
    assert.strictEqual(tree.responses[1].statement, 'reply2');
  });

  it('handles nested replies', () => {
    const stmts: DialogueStatement[] = [
      { statement: 'root', speaker: 'a' },
      { statement: 'level1', speaker: 'b', parentId: 0 },
      { statement: 'level2', speaker: 'c', parentId: 1 },
    ];
    const tree = buildDialogueTree(stmts);
    assert.strictEqual(tree.responses[0].responses[0].statement, 'level2');
  });

  it('returns empty node for empty statements', () => {
    const tree = buildDialogueTree([]);
    assert.strictEqual(tree.statement, '');
  });
});

// ─── findConsensusPath ────────────────────────────────────────────────

describe('findConsensusPath', () => {
  it('returns root if it is consensus', () => {
    const tree = {
      statement: 'agree', speaker: 'all', responses: [], isConsensus: true,
    };
    const path = findConsensusPath(tree);
    assert.strictEqual(path.length, 1);
    assert.strictEqual(path[0].statement, 'agree');
  });

  it('finds shortest path to consensus', () => {
    const tree = {
      statement: 'open', speaker: 'a', responses: [
        { statement: 'nope', speaker: 'b', responses: [], isConsensus: false },
        { statement: 'yes', speaker: 'c', responses: [], isConsensus: true },
      ],
    };
    const path = findConsensusPath(tree as any);
    assert.strictEqual(path.length, 2);
    assert.strictEqual(path[1].statement, 'yes');
  });

  it('returns empty when no consensus exists', () => {
    const tree = {
      statement: 'open', speaker: 'a', responses: [
        { statement: 'disagree', speaker: 'b', responses: [] },
      ],
    };
    assert.deepStrictEqual(findConsensusPath(tree as any), []);
  });

  it('handles single-entry history for convergence', () => {
    assert.strictEqual(convergenceRate([{ position: [5], confidence: 1, rounds: 1 }]), 0);
  });

  it('returns 0.5 for mixed convergence/divergence', () => {
    const history = [
      { position: [0, 0], confidence: 0.5, rounds: 1 },
      { position: [1, 1], confidence: 0.5, rounds: 2 },
      { position: [0.5, 0.5], confidence: 0.5, rounds: 3 },
    ];
    // distances: ~1.414, ~0.707 => 1 decrease out of 1 comparison = 1.0
    // Let me use clear diverge/converge
    // Actually let's make it diverge then converge
    const history2 = [
      { position: [0, 0], confidence: 0.5, rounds: 1 },
      { position: [1, 1], confidence: 0.5, rounds: 2 },
      { position: [3, 3], confidence: 0.5, rounds: 3 },
      { position: [3.5, 3.5], confidence: 0.5, rounds: 4 },
    ];
    // distances: 1.414, 2.828, 0.707
    // comparisons: 2.828>1.414 (diverge), 0.707<2.828 (converge) => 1/2 = 0.5
    assert.strictEqual(convergenceRate(history2), 0.5);
  });

  it('finds consensus in deep tree', () => {
    const tree = {
      statement: 'root', speaker: 'a', responses: [
        {
          statement: 'branch', speaker: 'b', responses: [
            {
              statement: 'leaf-consensus', speaker: 'c',
              responses: [], isConsensus: true,
            },
          ],
        },
      ],
    };
    const path = findConsensusPath(tree as any);
    assert.strictEqual(path.length, 3);
    assert.strictEqual(path[2].statement, 'leaf-consensus');
  });

  it('finds first consensus among multiple', () => {
    const tree = {
      statement: 'root', speaker: 'a', responses: [
        { statement: 'agree1', speaker: 'b', responses: [], isConsensus: true },
        {
          statement: 'branch', speaker: 'c', responses: [
            { statement: 'agree2', speaker: 'd', responses: [], isConsensus: true },
          ],
        },
      ],
    };
    const path = findConsensusPath(tree as any);
    assert.strictEqual(path.length, 2);
    assert.strictEqual(path[1].statement, 'agree1');
  });

  it('handles single-node tree with no consensus', () => {
    const tree = { statement: 'solo', speaker: 'a', responses: [] };
    assert.deepStrictEqual(findConsensusPath(tree as any), []);
  });
});
