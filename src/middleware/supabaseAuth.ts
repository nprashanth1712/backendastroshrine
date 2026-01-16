import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken, getUserById } from '../services/supabaseClient';

export interface AuthRequest extends Request {
  authUser?: any;
  user?: any;
  userId?: string;
}

export const authenticateSupabase = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const authUser = await verifySupabaseToken(token);
    
    if (!authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Always attach the authenticated Supabase user id
    req.authUser = authUser;
    req.userId = authUser.id;
    
    // Best-effort: attach full profile from `public.users` if it exists
    try {
      const userProfile = await getUserById(authUser.id);
    req.user = userProfile;
    } catch (e) {
      req.user = undefined;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await verifySupabaseToken(token);
      
      if (user) {
        const userProfile = await getUserById(user.id);
        req.user = userProfile;
        req.userId = user.id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};




