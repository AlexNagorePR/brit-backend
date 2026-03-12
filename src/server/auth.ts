import utils from '@transitive-sdk/utils';

const log = utils.getLogger('auth');
log.setLevel('debug');

export interface AccountLike {
    _id: string;
    email?: string;
    admin?: boolean;
    verified?: boolean;
}

function wantsJson(req: any): boolean {
  if (req.path?.startsWith('/api/')) return true;

  const accept = String(req.headers?.accept || '').toLowerCase();
  return Boolean(req.xhr) || accept.includes('json');
}

export const requireLogin = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  
  if (user && user._id) {
    return next();
  } 

  log.debug('not logged in', req.url);

  if (wantsJson(req)) {
    return res.status(401).json({
      error: 'Not authorized. Please log in.',
      ok: false,
    });
  }
    
  return res.redirect('/auth/login');
};

export const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.session?.user;

  if (!user?._id) {
    return res.status(401).json({
      error: 'Not authorized. Please log in.',
      ok: false,
    });
  }

  if (!user.admin) {
    return res.status(403).json({
      error: 'Forbiden. Admin acess required.',
      ok: false,
    });
  }

  return next();
};

export const login = (
  req: any,
  res: any,
  opts: { account: AccountLike, redirect?: string | false }
) => {
  const { account, redirect = false } = opts;
  
  req.session.user = account;

  if (redirect) {
    return res.redirect(redirect);
  }

  return res.json({ status: 'ok' });
};