import { describe, expect, it } from 'vitest';
import { applyDemoEnd } from '../game/utils/GamePhase.js';

describe('demoEnd effect', () => {
  it('marks the demo complete without using the product victory phase', () => {
    const state = { gamePhase: 'playing', factions: [] };

    const next = applyDemoEnd(state);

    expect(next.gamePhase).toBe('demo_complete');
    expect(next).not.toBe(state);
  });
});
