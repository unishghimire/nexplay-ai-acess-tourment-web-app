import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = (req: any, res, next): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }

  next();
};

export const requireOrganizer: RequestHandler = (req: any, res, next): void => {
  if (req.user?.role !== 'organizer' && req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Organizer or Admin access required' });
    return;
  }

  next();
};
