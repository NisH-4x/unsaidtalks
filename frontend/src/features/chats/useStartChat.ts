import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openDirectChat } from '../../api/directChats.api';
import { toApiError } from '../../api/errors';
import { useAuthStore } from '../../store/auth.store';
import { useChatsStore } from '../../store/chats.store';

/** Opens (or creates) the private chat with someone and navigates to it. */
export function useStartChat() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const loadChats = useChatsStore((state) => state.load);
  const [startingWith, setStartingWith] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(personId: string): Promise<boolean> {
    setStartingWith(personId);
    setError(null);
    try {
      const { conversationId } = await openDirectChat(personId);
      if (userId) void loadChats(userId);
      navigate(`/chats/${conversationId}`);
      return true;
    } catch (caught) {
      setError(toApiError(caught).message);
      return false;
    } finally {
      setStartingWith(null);
    }
  }

  return { start, startingWith, error };
}
