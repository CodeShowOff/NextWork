import { FollowRelationship } from '../../shared/api/follows.api';

export function toggleFollowRelationshipOptimistic(
  current: FollowRelationship | undefined,
): FollowRelationship | undefined {
  if (!current) {
    return current;
  }

  if (current.isFollowing) {
    return {
      ...current,
      isFollowing: false,
      followersCount: Math.max(0, current.followersCount - 1),
    };
  }

  return {
    ...current,
    isFollowing: true,
    followersCount: current.followersCount + 1,
  };
}
