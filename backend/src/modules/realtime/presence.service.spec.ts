import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  it('reports online on the first connection and offline after the last one closes', () => {
    const presence = new PresenceService();

    expect(presence.connect('rahul')).toBe(true);
    expect(presence.connect('rahul')).toBe(false);
    expect(presence.isOnline('rahul')).toBe(true);

    expect(presence.disconnect('rahul')).toBe(false);
    expect(presence.isOnline('rahul')).toBe(true);
    expect(presence.disconnect('rahul')).toBe(true);
    expect(presence.isOnline('rahul')).toBe(false);
  });

  it('filters a list down to the people who are online', () => {
    const presence = new PresenceService();
    presence.connect('priya');
    presence.connect('arjun');

    expect(presence.onlineAmong(['rahul', 'priya', 'arjun'])).toEqual(['priya', 'arjun']);
  });
});
