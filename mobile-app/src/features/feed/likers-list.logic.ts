export const LIKER_PAGE_SIZE = 20;

export function canOpenLikerList(likeCount: number) {
  return likeCount > 0;
}

export function shouldFetchNextLikersPage(hasNextPage: boolean | undefined, isFetchingNextPage: boolean) {
  return Boolean(hasNextPage) && !isFetchingNextPage;
}
