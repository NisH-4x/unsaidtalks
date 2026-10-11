import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAttachment } from '../api/attachments.api';
import { fetchMessages } from '../api/messages.api';
import { emitWithAck } from '../realtime/socket';
import { Ack } from '../realtime/socketEvents';
import { Message } from '../types/message';
import { PublicUser } from '../types/user';
import { useMessagesStore } from './messages.store';

vi.mock('../realtime/socket', () => ({ emitWithAck: vi.fn() }));
vi.mock('../api/messages.api', () => ({ fetchMessages: vi.fn() }));
vi.mock('../api/attachments.api', () => ({ uploadAttachment: vi.fn() }));

const conversationId = 'c1';
const priya: PublicUser = { id: 'u-priya', name: 'Priya Sharma', role: 'mentor' };
const rahul: PublicUser = { id: 'u-rahul', name: 'Rahul Verma', role: 'mentee' };

const confirmed = (stored: Message) => ({ ok: true, message: stored }) as Ack;

function message(id: string, text: string, sender: PublicUser = priya): Message {
  return {
    id,
    conversationId,
    type: 'text',
    text,
    sender,
    attachment: null,
    replyTo: null,
    isAnnouncement: false,
    pin: null,
    doubt: null,
    reactions: [],
    editedAt: null,
    importedFrom: null,
    isDeleted: false,
    removedByModerator: false,
    createdAt: '2026-10-10T10:00:00.000Z',
  };
}

const thread = () => useMessagesStore.getState().threads[conversationId];
const texts = () => thread().messages.map((m) => m.text);

async function openWith(messages: Message[], hasMore = false) {
  vi.mocked(fetchMessages).mockResolvedValueOnce({ messages, hasMore });
  await useMessagesStore.getState().open(conversationId);
}

beforeEach(() => {
  useMessagesStore.getState().reset();
  vi.mocked(fetchMessages).mockReset();
  vi.mocked(emitWithAck).mockReset();
  vi.mocked(uploadAttachment).mockReset();
});

const pdf = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' });

function storedFile(id: string, sender: PublicUser = rahul): Message {
  return {
    ...message(id, '', sender),
    type: 'file',
    attachment: {
      name: 'sheet.pdf',
      mimeType: 'application/pdf',
      size: 8,
      width: null,
      height: null,
    },
  };
}

describe('messages store', () => {
  it('opens a conversation with its newest page', async () => {
    await openWith([message('a1', 'Hello'), message('a2', 'Mock test on Saturday')], true);

    expect(thread()).toMatchObject({ status: 'ready', hasMore: true });
    expect(texts()).toEqual(['Hello', 'Mock test on Saturday']);
  });

  it('shows a message only once when it arrives twice', async () => {
    await openWith([message('a1', 'Hello')]);

    useMessagesStore.getState().receive(message('a2', 'New'));
    useMessagesStore.getState().receive(message('a2', 'New'));

    expect(texts()).toEqual(['Hello', 'New']);
  });

  it('replaces a draft with the stored message once the server confirms it', async () => {
    await openWith([]);
    vi.mocked(emitWithAck).mockImplementationOnce(async (_event, payload) => {
      const { clientId } = payload as { clientId: string };
      // The broadcast reaches this tab before the acknowledgement does.
      useMessagesStore.getState().receive(message('a9', 'Hi ma’am', rahul), clientId);
      return confirmed(message('a9', 'Hi ma’am', rahul));
    });

    await useMessagesStore.getState().send(conversationId, { text: 'Hi ma’am' }, rahul);

    expect(thread().messages).toHaveLength(1);
    expect(thread().messages[0].id).toBe('a9');
    expect(thread().messages[0].delivery).toBeUndefined();
    expect(thread().messages[0].clientId).toBeDefined();
  });

  it('marks a failed draft and retries it with the same client id', async () => {
    await openWith([]);
    vi.mocked(emitWithAck).mockResolvedValueOnce({ ok: false, error: 'No response' });

    await useMessagesStore.getState().send(conversationId, { text: 'Are notes shared?' }, rahul);
    const [draft] = thread().messages;
    expect(draft).toMatchObject({ delivery: 'failed', failureReason: 'No response' });

    vi.mocked(emitWithAck).mockResolvedValueOnce(
      confirmed(message('a5', 'Are notes shared?', rahul)),
    );
    await useMessagesStore.getState().retry(conversationId, draft.clientId!);

    const firstPayload = vi.mocked(emitWithAck).mock.calls[0][1] as { clientId: string };
    const retryPayload = vi.mocked(emitWithAck).mock.calls[1][1] as { clientId: string };
    expect(retryPayload.clientId).toBe(firstPayload.clientId);
    expect(thread().messages.map((m) => [m.id, m.delivery])).toEqual([['a5', undefined]]);
  });

  it('keeps unsent drafts below messages that arrive meanwhile', async () => {
    await openWith([message('a1', 'Hello')]);
    vi.mocked(emitWithAck).mockResolvedValueOnce({ ok: false, error: 'Offline' });
    await useMessagesStore.getState().send(conversationId, { text: 'My draft' }, rahul);

    useMessagesStore.getState().receive(message('a2', 'From Priya'));

    expect(texts()).toEqual(['Hello', 'From Priya', 'My draft']);
  });

  it('adds older messages above the current ones', async () => {
    await openWith([message('a3', 'Third'), message('a4', 'Fourth')], true);
    vi.mocked(fetchMessages).mockResolvedValueOnce({
      messages: [message('a1', 'First'), message('a2', 'Second')],
      hasMore: false,
    });

    await useMessagesStore.getState().loadOlder(conversationId);

    expect(fetchMessages).toHaveBeenLastCalledWith(conversationId, { before: 'a3' });
    expect(texts()).toEqual(['First', 'Second', 'Third', 'Fourth']);
    expect(thread().hasMore).toBe(false);
  });

  it('after a reconnect, adds missed messages and refreshes the ones on screen', async () => {
    await openWith([message('a1', 'Before'), message('a2', 'My number is 98765 43210')]);
    vi.mocked(fetchMessages)
      .mockResolvedValueOnce({ messages: [message('a3', 'Missed one')], hasMore: false })
      .mockResolvedValueOnce({
        messages: [
          message('a1', 'Before'),
          { ...message('a2', ''), isDeleted: true },
          message('a3', 'Missed one'),
        ],
        hasMore: false,
      });

    await useMessagesStore.getState().catchUp(conversationId);

    expect(vi.mocked(fetchMessages).mock.calls.slice(1)).toEqual([
      [conversationId, { after: 'a2' }],
      [conversationId, { before: undefined, limit: 100 }],
    ]);
    expect(texts()).toEqual(['Before', '', 'Missed one']);
    expect(thread().messages[1].isDeleted).toBe(true);
  });

  it('sends a reply as a doubt and shows the quote on the draft straight away', async () => {
    const original = message('a1', 'Mock test on Saturday at 10');
    await openWith([original]);
    vi.mocked(emitWithAck).mockResolvedValueOnce({ ok: false, error: 'Offline' });

    await useMessagesStore
      .getState()
      .send(conversationId, { text: 'Is it online?', replyTo: original, isDoubt: true }, rahul);

    expect(vi.mocked(emitWithAck).mock.calls[0][1]).toMatchObject({
      text: 'Is it online?',
      replyToId: 'a1',
      isDoubt: true,
    });
    const draft = thread().messages[1];
    expect(draft.replyTo).toMatchObject({ messageId: 'a1', senderName: 'Priya Sharma' });
    expect(draft.doubt).toMatchObject({ status: 'open' });
  });

  it('applies a pin or doubt change without losing the bubble identity', async () => {
    await openWith([]);
    vi.mocked(emitWithAck).mockResolvedValueOnce(confirmed(message('a7', 'Notes?', rahul)));
    await useMessagesStore.getState().send(conversationId, { text: 'Notes?' }, rahul);
    const { clientId } = thread().messages[0];

    useMessagesStore.getState().update({
      ...message('a7', 'Notes?', rahul),
      pin: { pinnedBy: priya.id, pinnedAt: '2026-10-10T10:05:00.000Z' },
    });

    expect(thread().messages[0].pin).not.toBeNull();
    expect(thread().messages[0].clientId).toBe(clientId);
  });

  it('loads older pages until a jump target is on screen', async () => {
    await openWith([message('a5', 'Fifth')], true);
    vi.mocked(fetchMessages)
      .mockResolvedValueOnce({ messages: [message('a3', 'Third')], hasMore: true })
      .mockResolvedValueOnce({ messages: [message('a1', 'First')], hasMore: false });

    const found = await useMessagesStore.getState().jumpTo(conversationId, 'a1');

    expect(found).toBe(true);
    expect(texts()).toEqual(['First', 'Third', 'Fifth']);
    expect(useMessagesStore.getState().jumpTarget).toMatchObject({ messageId: 'a1' });
  });

  it('gives up on a jump when the message is not in the history', async () => {
    await openWith([message('a5', 'Fifth')]);

    const found = await useMessagesStore.getState().jumpTo(conversationId, 'missing');

    expect(found).toBe(false);
    expect(useMessagesStore.getState().jumpTarget).toBeNull();
  });

  it('shows a file draft with upload progress, then the stored message', async () => {
    await openWith([]);
    vi.mocked(uploadAttachment).mockImplementationOnce(async (_id, _upload, onProgress) => {
      onProgress(0.5);
      expect(thread().messages[0]).toMatchObject({
        type: 'file',
        attachment: { name: 'sheet.pdf' },
        upload: { progress: 0.5 },
        delivery: 'sending',
      });
      return storedFile('a3');
    });

    await useMessagesStore.getState().sendFile(conversationId, { file: pdf, text: '' }, rahul);

    expect(thread().messages.map((m) => [m.id, m.delivery])).toEqual([['a3', undefined]]);
  });

  it('explains a rejected upload and retries it with the same client id', async () => {
    await openWith([]);
    const tooLarge = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 413, data: { message: 'File too large' } },
    });
    vi.mocked(uploadAttachment).mockRejectedValueOnce(tooLarge);

    await useMessagesStore.getState().sendFile(conversationId, { file: pdf, text: 'Notes' }, rahul);
    const [draft] = thread().messages;
    expect(draft).toMatchObject({
      delivery: 'failed',
      failureReason: 'Files can be at most 5 MB.',
    });

    vi.mocked(uploadAttachment).mockResolvedValueOnce(storedFile('a4'));
    await useMessagesStore.getState().retry(conversationId, draft.clientId!);

    const [firstCall, retryCall] = vi.mocked(uploadAttachment).mock.calls;
    expect(retryCall[1]).toMatchObject({
      clientId: firstCall[1].clientId,
      text: 'Notes',
      file: pdf,
    });
    expect(thread().messages.map((m) => m.id)).toEqual(['a4']);
  });

  it('shows a deleted message as deleted and stops replies quoting it', async () => {
    const original = message('a1', 'My number is 98765 43210', rahul);
    const reply = {
      ...message('a2', 'Noted'),
      replyTo: {
        messageId: 'a1',
        senderName: 'Rahul Verma',
        type: 'text' as const,
        preview: 'My number is 98765 43210',
        isDeleted: false,
      },
    };
    await openWith([original, reply]);

    useMessagesStore
      .getState()
      .update({ ...original, text: '', isDeleted: true, removedByModerator: true });

    const [deleted, replyNow] = thread().messages;
    expect(deleted).toMatchObject({ isDeleted: true, text: '', removedByModerator: true });
    expect(replyNow.replyTo).toMatchObject({ isDeleted: true, preview: '' });
  });

  it('updates quotes in replies when the original is edited', async () => {
    const original = message('a1', 'Mock test on Satuday', rahul);
    const reply = {
      ...message('a2', 'Thanks'),
      replyTo: {
        messageId: 'a1',
        senderName: 'Rahul Verma',
        type: 'text' as const,
        preview: 'Mock test on Satuday',
        isDeleted: false,
      },
    };
    await openWith([original, reply]);

    useMessagesStore.getState().update({
      ...original,
      text: 'Mock test on Saturday',
      editedAt: '2026-10-10T10:01:00.000Z',
    });

    const [edited, replyNow] = thread().messages;
    expect(edited).toMatchObject({ text: 'Mock test on Saturday' });
    expect(replyNow.replyTo?.preview).toBe('Mock test on Saturday');
  });
});
