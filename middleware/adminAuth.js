/**
 * Admin Authentication Middleware
 * Verifies that the request is from an admin user
 */

// Simple admin authentication middleware
export const adminAuthMiddleware = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    // Check for Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Token format should be: Bearer [token]'
      });
    }

    const token = parts[1];
    
    // For now, use a simple admin secret from environment variables
    // TODO: Replace with JWT verification when you implement admin users
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'mediguide-admin-secret-2024';
    
    if (token !== ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin token'
      });
    }

    // Add admin flag to request for use in controllers
    req.isAdmin = true;
    
    next();
    
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

// Optional: Admin role check middleware for future use
export const requireAdminRole = (req, res, next) => {
  try {
    // This would check user role from JWT or session
    // For now, we'll use the simple token approach
    
    // Example future implementation:
    // if (req.user && req.user.role === 'admin') {
    //   return next();
    // }
    
    // For now, just check the isAdmin flag set by adminAuthMiddleware
    if (req.isAdmin) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'Admin role required'
    });
    
  } catch (error) {
    console.error('Admin role check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Role verification error'
    });
  }
};

// Optional: Super admin check for critical operations
export const requireSuperAdmin = (req, res, next) => {
  try {
    // Check for super admin token or role
    const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || 'mediguide-super-admin-2024';
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (token !== SUPER_ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }
    
    req.isSuperAdmin = true;
    next();
    
  } catch (error) {
    console.error('Super admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Super admin authentication error'
    });
  }
};
