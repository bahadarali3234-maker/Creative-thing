import { describe, expect, it } from 'vitest';
import { mergeChatThreads, threadsFromRows } from '../app/utils/chatThreads';

describe('Selected conversation persistence', () => {
  it('shows one conversation per saved row, not duplicate title and ID entries', () => {
    const result = threadsFromRows([{ id: 'thread-1', title: 'My chat', messages: [{ id: 'one' }] }]);
    expect(Object.keys(result)).toEqual(['My chat']);
    expect(result['My chat'].id).toBe('thread-1');
  });
  it('does not replace newer messages in the selected chat with an older saved version', () => {
    const local = { 'My chat': { id: 'thread-1', messages: [{ id: 'one' }, { id: 'two' }] } };
    const result = mergeChatThreads({ 'My chat': { id: 'thread-1', messages: [{ id: 'one' }] } }, local);
    expect(result['My chat'].messages.map((m: any) => m.id)).toEqual(['one', 'two']);
    expect(Object.keys(result)).toEqual(['My chat']);
  });
});