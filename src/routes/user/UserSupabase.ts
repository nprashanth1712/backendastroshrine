import express from "express";
import { NextFunction, Request, Response } from "express";
import { UserDao } from "../../data-access-supabase/UserDao";
import { authenticateSupabase, AuthRequest } from "../../middleware/supabaseAuth";
import getLogger from "../../services/Logger";

const router = express.Router();
const logger = getLogger();

router.use(express.json());

const forbidIfNotSelf = (req: AuthRequest, res: Response, id: string) => {
  if (!req.userId) {
    res.status(401).json({ status: 401, error: "Not authenticated" });
    return true;
  }
  if (req.userId !== id) {
    res.status(403).json({ status: 403, error: "Forbidden" });
    return true;
  }
  return false;
};

/**
 * Initialize/Update user profile after Google Sign-In
 * PUT /v1/user-supabase/:id
 */
const initializeUserSupabase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, profile } = req.body;

    console.log("Initializing/updating user via Supabase:", id);
    console.log("User data:", JSON.stringify({ name, profile }));

    if (forbidIfNotSelf(req, res, id)) return;

    // Check if user exists
    let existingUser = null;
    try {
      existingUser = await UserDao.getUserById(id);
    } catch (error: any) {
      // User might not exist yet
      console.log("User not found, will create:", error.message);
    }

    // Check for both null and empty object (user with no id means doesn't exist)
    const userExists = existingUser && existingUser.id;

    if (userExists) {
      // Update existing user (do NOT overwrite stored profile/name with empty values)
      const updates: any = {};

      if (typeof name === "string" && name.trim().length > 0) {
        updates.username = name.trim();
        updates.name = name.trim();
      }

      if (profile && typeof profile === "object") {
        updates.profile = { ...(existingUser as any)?.profile, ...profile };
      }

      if (Object.keys(updates).length === 0) {
        return res.status(200).json({ status: 200, data: existingUser });
      }

      const updatedUser = await UserDao.updateUser(id, updates);
      console.log("User updated:", updatedUser);
      return res.status(200).json({ status: 200, data: updatedUser });
    } else {
      // If the DB trigger isn't installed, create the user row here.
      const email = req.authUser?.email;
      if (!email) {
        return res.status(400).json({
          status: 400,
          error: "Missing email on authenticated user",
        });
      }
      const defaultUsername = name || email.split("@")[0];
      const createdUser = await UserDao.createUser({
        id,
        email,
        username: defaultUsername,
        role: "USER",
      });
      const createdUpdates: any = {};
      if (typeof name === "string" && name.trim().length > 0) {
        createdUpdates.username = name.trim();
        createdUpdates.name = name.trim();
      } else {
        // Use the default username we passed to createUser
        createdUpdates.username = defaultUsername;
        createdUpdates.name = defaultUsername;
      }
      if (profile && typeof profile === "object") {
        createdUpdates.profile = profile;
      }

      const updatedUser = await UserDao.updateUser(id, createdUpdates);
      return res.status(200).json({ status: 200, data: updatedUser });
    }
  } catch (error: any) {
    logger.error("Error initializing user:", error);
    console.error("Error details:", error);
    return res.status(500).json({ status: 500, error: error.message });
  }
};

/**
 * Get user by ID
 * GET /v1/user-supabase/:id
 */
const getUserByIdSupabase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log("Getting user by ID:", id);
    
    const user = await UserDao.getUserById(id);
    
    // Check for null or empty object (no id means user doesn't exist)
    if (!user || !user.id) {
      return res.status(404).json({ status: 404, error: "User not found" });
    }
    
    return res.status(200).json(user);
  } catch (error: any) {
    logger.error("Error getting user:", error);
    return res.status(500).json({ status: 500, error: error.message });
  }
};

/**
 * Update user profile
 * POST /v1/user-supabase/:id/profile/profile-data
 */
const updateProfileDataSupabase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, profile } = req.body;

    console.log("Updating profile for user:", id);
    console.log("Profile data:", JSON.stringify({ name, profile }));

    if (forbidIfNotSelf(req, res, id)) return;

    // Update profile safely: merge JSON profile; only set name if provided
    const existingUser = await UserDao.getUserById(id);
    const updates: any = {};

    if (typeof name === "string" && name.trim().length > 0) {
      updates.username = name.trim();
      updates.name = name.trim();
    }

    if (profile && typeof profile === "object") {
      updates.profile = { ...(existingUser as any)?.profile, ...profile };
    }

    const updatedUser =
      Object.keys(updates).length > 0 ? await UserDao.updateUser(id, updates) : existingUser;

    console.log("Profile updated:", updatedUser);
    return res.status(200).json(updatedUser);
  } catch (error: any) {
    logger.error("Error updating profile:", error);
    return res.status(500).json({ status: 500, error: error.message });
  }
};

// Routes
router.put("/:id", authenticateSupabase, initializeUserSupabase);
router.get("/:id", authenticateSupabase, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (forbidIfNotSelf(req, res, id)) return;
  return getUserByIdSupabase(req, res, next);
});
router.post("/:id/profile/profile-data", authenticateSupabase, updateProfileDataSupabase);

export default router;


