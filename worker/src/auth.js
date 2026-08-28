export async function authMiddleware(c, next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== c.env.API_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}
