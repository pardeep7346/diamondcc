import { Router } from "express";
import { registerAdmin,logoutUser } from "../Controller/user.controller.js";
import { verifyJWT } from "../Middleware/authMiddleware.js";


const router = Router();


router.route('/register-admin').post( registerAdmin)
router.route("/logout").post(verifyJWT, logoutUser);


export default router;