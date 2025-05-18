import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  fetchUsers,
  SendEmail,
  listPDFs,
  viewPDF,
  downloadPDF,
  deleteUser,
} from "../Controller/user.controller.js";
import { verifyJWT } from "../Middleware/authMiddleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/contact").post(SendEmail),
router.route("/refresh-token").post(refreshAccessToken);
// secured routes

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/").get(verifyJWT, fetchUsers);
router.route("/:id").delete(verifyJWT, deleteUser);
router.route("/pdfs").get(verifyJWT, listPDFs); // List all PDFs
router.route("/view/:filename").get(verifyJWT, viewPDF); // View PDF inline
router.route("/download/:filename").get(verifyJWT, downloadPDF); // Download PDF

export default router;
