import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.js';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // get or create user, handle concurrent inserts safely
    const [dbUser] = await db.insert(users).values({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { email: decodedToken.email || '' }
    })
    .returning();
    
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
