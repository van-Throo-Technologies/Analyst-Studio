// Auth.js handles every /api/auth/* route — sign-in, callback, session, signout
// — from this one catch-all. The handlers come straight from the config in
// lib/auth.ts, so there is nothing to configure here.
import { handlers } from "../../../../lib/auth";

export const { GET, POST } = handlers;
