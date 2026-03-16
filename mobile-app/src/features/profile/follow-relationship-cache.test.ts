import { toggleFollowRelationshipOptimistic } from './follow-relationship-cache';

describe('follow relationship cache', () => {
  it('toggles follow on and increments follower count', () => {
    const next = toggleFollowRelationshipOptimistic({
      isFollowing: false,
      followersCount: 10,
      followingCount: 3,
    });

    expect(next).toEqual({
      isFollowing: true,
      followersCount: 11,
      followingCount: 3,
    });
  });

  it('toggles follow off and decrements follower count with floor at zero', () => {
    const next = toggleFollowRelationshipOptimistic({
      isFollowing: true,
      followersCount: 0,
      followingCount: 3,
    });

    expect(next).toEqual({
      isFollowing: false,
      followersCount: 0,
      followingCount: 3,
    });
  });
});
