import { canOpenLikerList, shouldFetchNextLikersPage } from './likers-list.logic';

describe('liker list logic', () => {
  it('allows opening liker list only when there is at least one like', () => {
    expect(canOpenLikerList(0)).toBe(false);
    expect(canOpenLikerList(1)).toBe(true);
    expect(canOpenLikerList(25)).toBe(true);
  });

  it('fetches next page only when next page exists and fetch is idle', () => {
    expect(shouldFetchNextLikersPage(true, false)).toBe(true);
    expect(shouldFetchNextLikersPage(false, false)).toBe(false);
    expect(shouldFetchNextLikersPage(true, true)).toBe(false);
    expect(shouldFetchNextLikersPage(undefined, false)).toBe(false);
  });
});
