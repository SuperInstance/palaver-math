// palaver-math: Mathematics of consensus-building
// Inspired by the West African Palaver tradition of community dialogue

// ─── Types ────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  position: number[];
  influence: number;
}

export interface Topic {
  id: string;
  dimensions: string[];
  idealPoint: number[];
}

export interface Proposal {
  id: string;
  position: number[];
  proposerId: string;
  votes: Map<string, number>;
}

export interface ConsensusResult {
  position: number[];
  confidence: number;
  rounds: number;
}

// ─── Consensus Functions ──────────────────────────────────────────────

export function computeCenter(participants: Participant[]): number[] {
  if (participants.length === 0) return [];
  const dim = participants[0].position.length;
  const sum = new Array(dim).fill(0);
  for (const p of participants) {
    for (let i = 0; i < dim; i++) {
      sum[i] += p.position[i];
    }
  }
  return sum.map(s => s / participants.length);
}

export function consensusDistance(participants: Participant[]): number {
  if (participants.length <= 1) return 0;
  const center = computeCenter(participants);
  let totalDist = 0;
  for (const p of participants) {
    totalDist += euclideanDist(p.position, center);
  }
  return totalDist / participants.length;
}

export function influenceWeightedCenter(participants: Participant[]): number[] {
  if (participants.length === 0) return [];
  const totalInfluence = participants.reduce((s, p) => s + p.influence, 0);
  if (totalInfluence === 0) return computeCenter(participants);
  const dim = participants[0].position.length;
  const weighted = new Array(dim).fill(0);
  for (const p of participants) {
    for (let i = 0; i < dim; i++) {
      weighted[i] += p.position[i] * p.influence;
    }
  }
  return weighted.map(w => w / totalInfluence);
}

// ─── Palaver Session ──────────────────────────────────────────────────

export class PalaverSession {
  participants: Map<string, Participant> = new Map();
  proposals: Proposal[] = [];
  rounds: number = 0;
  private topic?: Topic;

  constructor(topic?: Topic) {
    this.topic = topic;
  }

  addParticipant(p: Participant): void {
    this.participants.set(p.id, p);
  }

  addProposal(id: string, position: number[], proposerId: string): Proposal {
    const proposal: Proposal = { id, position, proposerId, votes: new Map() };
    this.proposals.push(proposal);
    return proposal;
  }

  vote(participantId: string, proposalId: string, weight: number): void {
    const proposal = this.proposals.find(p => p.id === proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    proposal.votes.set(participantId, weight);
  }

  computeConsensus(): ConsensusResult {
    this.rounds++;
    const participants = Array.from(this.participants.values());
    if (participants.length === 0) {
      return { position: [], confidence: 0, rounds: this.rounds };
    }

    // Calculate influence-weighted center of all proposals weighted by votes
    const weightedCenter = influenceWeightedCenter(participants);

    // If there are voted proposals, blend proposal positions with participant positions
    if (this.proposals.length > 0) {
      const proposalPositions: number[] = [];
      const proposalWeights: number[] = [];

      for (const prop of this.proposals) {
        let totalVoteWeight = 0;
        for (const [, w] of prop.votes) {
          totalVoteWeight += w;
        }
        if (totalVoteWeight > 0) {
          proposalPositions.push(...prop.position);
          proposalWeights.push(totalVoteWeight);
        }
      }

      if (proposalWeights.length > 0) {
        const dim = weightedCenter.length;
        const blended = new Array(dim).fill(0);
        let totalW = 0;
        for (let i = 0; i < proposalWeights.length; i++) {
          const pos = proposalPositions.slice(i * dim, (i + 1) * dim);
          for (let j = 0; j < dim; j++) {
            blended[j] += pos[j] * proposalWeights[i];
          }
          totalW += proposalWeights[i];
        }
        const proposalCenter = blended.map(b => b / totalW);
        // Blend participant center with proposal center
        for (let i = 0; i < dim; i++) {
          weightedCenter[i] = 0.4 * weightedCenter[i] + 0.6 * proposalCenter[i];
        }
      }
    }

    const dist = consensusDistance(participants);
    const dim = weightedCenter.length;
    const maxDist = Math.sqrt(dim) * 10; // theoretical max spread
    const confidence = Math.max(0, Math.min(1, 1 - dist / maxDist));

    return { position: weightedCenter, confidence, rounds: this.rounds };
  }
}

// ─── Convergence ──────────────────────────────────────────────────────

export function convergenceRate(sessionHistory: ConsensusResult[]): number {
  if (sessionHistory.length < 2) return 0;
  const distances: number[] = [];
  for (let i = 1; i < sessionHistory.length; i++) {
    distances.push(euclideanDist(
      sessionHistory[i - 1].position,
      sessionHistory[i].position
    ));
  }
  // Rate of change: fraction of consecutive steps that converge
  let decreases = 0;
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] < distances[i - 1]) decreases++;
  }
  const comparisons = distances.length - 1;
  return comparisons > 0 ? decreases / comparisons : 0;
}

export function predictConsensus(
  session: PalaverSession,
  maxRounds: number = 20
): number[] {
  const history: ConsensusResult[] = [];
  for (let i = 0; i < maxRounds; i++) {
    const result = session.computeConsensus();
    history.push(result);
  }
  // Return final position from last round
  return history.length > 0 ? history[history.length - 1].position : [];
}

// ─── Coalitions ───────────────────────────────────────────────────────

export function findCoalitions(
  participants: Participant[],
  threshold: number
): Participant[][] {
  if (participants.length === 0) return [];
  const visited = new Set<string>();
  const coalitions: Participant[][] = [];

  for (const p of participants) {
    if (visited.has(p.id)) continue;
    const coalition: Participant[] = [p];
    visited.add(p.id);

    for (const q of participants) {
      if (visited.has(q.id)) continue;
      if (euclideanDist(p.position, q.position) <= threshold) {
        coalition.push(q);
        visited.add(q.id);
      }
    }
    coalitions.push(coalition);
  }

  // Merge overlapping coalitions
  return mergeCoalitions(coalitions, threshold);
}

function mergeCoalitions(
  coalitions: Participant[][],
  threshold: number
): Participant[][] {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < coalitions.length && !changed; i++) {
      for (let j = i + 1; j < coalitions.length && !changed; j++) {
        // Check if any member of i is within threshold of any member of j
        for (const pi of coalitions[i]) {
          for (const pj of coalitions[j]) {
            if (euclideanDist(pi.position, pj.position) <= threshold) {
              coalitions[i] = [...coalitions[i], ...coalitions[j]];
              coalitions.splice(j, 1);
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
      }
    }
  }
  return coalitions;
}

export function coalitionStrength(coalition: Participant[]): number {
  if (coalition.length === 0) return 0;
  const totalInfluence = coalition.reduce((s, p) => s + p.influence, 0);
  const dist = consensusDistance(coalition);
  const dim = coalition[0].position.length;
  const maxDist = Math.sqrt(dim) * 10;
  const cohesion = maxDist > 0 ? 1 - dist / maxDist : 1;
  return totalInfluence * cohesion * Math.sqrt(coalition.length);
}

// ─── Dialogue Tree ────────────────────────────────────────────────────

export interface DialogueNode {
  statement: string;
  speaker: string;
  responses: DialogueNode[];
  isConsensus?: boolean;
}

export interface DialogueStatement {
  statement: string;
  speaker: string;
  isConsensus?: boolean;
  parentId?: number;
}

export function buildDialogueTree(statements: DialogueStatement[]): DialogueNode {
  if (statements.length === 0) {
    return { statement: '', speaker: '', responses: [] };
  }

  const nodes: DialogueNode[] = statements.map(s => ({
    statement: s.statement,
    speaker: s.speaker,
    responses: [],
    isConsensus: s.isConsensus ?? false,
  }));

  let rootIdx = 0;
  for (let i = 0; i < statements.length; i++) {
    const parentId = statements[i].parentId;
    if (parentId === undefined || parentId === null) {
      rootIdx = i;
    } else {
      nodes[parentId].responses.push(nodes[i]);
    }
  }

  return nodes[rootIdx];
}

export function findConsensusPath(tree: DialogueNode): DialogueNode[] {
  // BFS to find shortest path to a consensus node
  interface QueueItem {
    node: DialogueNode;
    path: DialogueNode[];
  }

  const queue: QueueItem[] = [{ node: tree, path: [tree] }];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (node.isConsensus) return path;
    for (const child of node.responses) {
      queue.push({ node: child, path: [...path, child] });
    }
  }

  return []; // no consensus found
}

// ─── Helpers ──────────────────────────────────────────────────────────

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
