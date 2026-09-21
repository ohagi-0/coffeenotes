import { beforeEach, describe, expect, it } from 'vitest';
import {
  NEW_LOG_DRAFT_KEY,
  clearNewLogDraft,
  readNewLogDraft,
  writeNewLogDraft,
  type NewLogDraft,
} from '@/features/logs/new-log-draft';

beforeEach(() => sessionStorage.clear());

describe('new-log-draft', () => {
  it('書いて読める。消せば null', () => {
    const draft: NewLogDraft = { bean: { kind: 'existing', id: 'b1', name: 'Geisha' } };
    writeNewLogDraft(draft);
    expect(readNewLogDraft()).toEqual(draft);
    clearNewLogDraft();
    expect(readNewLogDraft()).toBeNull();
  });

  it('壊れた値は null にする', () => {
    sessionStorage.setItem(NEW_LOG_DRAFT_KEY, '{not json');
    expect(readNewLogDraft()).toBeNull();
    sessionStorage.setItem(NEW_LOG_DRAFT_KEY, JSON.stringify({ foo: 1 }));
    expect(readNewLogDraft()).toBeNull();
  });
});
