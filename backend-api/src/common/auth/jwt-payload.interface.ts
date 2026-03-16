export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}
