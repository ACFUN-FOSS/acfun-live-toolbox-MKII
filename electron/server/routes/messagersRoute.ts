import express from "express";
import { register, emit } from "../controllers/messagersControllers";
const router = express.Router();

router.get("/register", register);

router.post("/emit", emit);

export default router;
