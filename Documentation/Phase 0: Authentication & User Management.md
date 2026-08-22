# Phase 0: Authentication & User Management

## Overview

Phase 0 establishes the authentication and user management foundation for Analyst Studio. This phase must be completed before Steps 1-4 (Validate, Extract, Review, Promote) can function properly, as all subsequent steps depend on knowing who the user is and what role they have in the project.

**Key Principle:** Start simple with email + Google OAuth. Migrate to Clerk later if needed.

---

## Architecture

### Authentication Flow

```
User visits app
    ↓
Not authenticated? → Redirect to Login Page
    ↓
Login Page: Email or "Sign in with Google"
    ↓
NextAuth.js processes auth
    ↓
User created/linked in database
    ↓
Redirect to Project Selection Page
    ↓
User selects project
    ↓
Redirect to Role Confirmation (Step Zero)
    ↓
User confirms role → Access to Steps 1-4
```

### Why NextAuth.js?

- **Minimal setup** — Works with existing Prisma schema
- **Email + Google OAuth** — Simple, covers most MVP users
- **Session management** — Handles JWT tokens and cookies
- **Database-agnostic** — Easy to migrate to Clerk later
- **Open source** — No vendor lock-in during MVP

---

## Database Schema

### New Tables

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  
  // Relations
  accounts      Account[]
  sessions      Session[]
  projectAccess ProjectAccess[]
  auditLog      ProjectAuditLog[]
}

model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String  // "oauth" or "email"
  provider           String  // "google" or "email"
  providerAccountId  String
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
}

model Session {
  id        String   @id @default(cuid())
  sessionToken String @unique
  userId    String
  expires   DateTime
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String @unique
  expires    DateTime
  
  @@unique([identifier, token])
}
```

### Updated Tables

```prisma
// Update ProjectAccess to link to User
model ProjectAccess {
  id        String  @id @default(cuid())
  projectId String
  userId    String  // Changed from string to FK
  role      ProjectRole
  assignedAt DateTime @default(now())
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, userId])
  @@index([userId])
}

// Update ProjectAuditLog to link to User
model ProjectAuditLog {
  id        String    @id @default(cuid())
  projectId String
  userId    String    // Changed from string to FK
  action    String    // "validate_source", "extract", "accept_insight", etc.
  metadata  Json?     // Any additional context
  createdAt DateTime  @default(now())
  
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
  @@index([userId])
  @@index([createdAt])
}
```

---

## NextAuth.js Setup

### 1. Install Dependencies

```bash
npm install next-auth@latest
npm install @next-auth/prisma-adapter
```

### 2. Create Auth Configuration

Create `pages/api/auth/[...nextauth].js`:

```javascript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/auth/verify-email",
  },
}

export default NextAuth(authOptions)
```

### 3. Environment Variables

Add to `.env.local`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Email (optional for MVP, can use SendGrid, Resend, etc.)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@analyst-studio.app
```

---

## User Interface

### 1. Login Page (`/login`)

**Goal:** Allow users to sign in with email or Google

**Components:**
- Email input field
- "Sign in with Email" button → sends magic link
- "Continue with Google" button → OAuth flow
- "Sign up" link (NextAuth auto-creates users on first signin)

**Flow:**
- Email: User enters email → receives magic link → clicks link → authenticated → redirected to /projects
- Google: User clicks "Continue with Google" → Google consent screen → redirected to /projects

### 2. Project Selection Page (`/projects`)

**Goal:** User selects which project they're working on

**Components:**
- List of projects user has access to (from ProjectAccess table)
- Project card shows: name, description, role in project
- Click to select → redirect to `/projects/[id]/confirm-role`

**Data Query:**
```javascript
const projects = await prisma.projectAccess.findMany({
  where: { userId: session.user.id },
  include: { project: true },
})
```

### 3. Role Confirmation Page (Step Zero) (`/projects/[id]/confirm-role`)

**Goal:** Confirm user's role before accessing the project

**Components:**
- Display: "You are joining [Project Name]"
- Display: "Your role: [Business Analyst / Functional Analyst / etc.]"
- Display: role description (what they can do)
- "Confirm & Continue" button → redirect to `/projects/[id]/step-1`
- "Change role" link (if multi-role scenarios)

**Data Query:**
```javascript
const access = await prisma.projectAccess.findUnique({
  where: { projectId_userId: { projectId, userId: session.user.id } },
  include: { project: true },
})
```

### 4. Auth Middleware

Protect all routes under `/projects`:

```javascript
// middleware.js
import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"

export async function middleware(request) {
  const token = await getToken({ req: request })

  if (!token && request.nextUrl.pathname.startsWith("/projects")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/projects/:path*"],
}
```

---

## Implementation Checklist

### Database
- [ ] Update Prisma schema with User, Account, Session, VerificationToken tables
- [ ] Update ProjectAccess to link to User (userId as FK)
- [ ] Update ProjectAuditLog to link to User (userId as FK)
- [ ] Run `prisma migrate dev` to create migration
- [ ] Seed test data: users, projects, ProjectAccess with roles

### Backend
- [ ] Set up NextAuth.js configuration file
- [ ] Create Google OAuth app in Google Cloud Console
- [ ] Set up email provider (SendGrid, Resend, or Gmail)
- [ ] Create API routes for auth callbacks
- [ ] Implement auth middleware for protected routes
- [ ] Create API endpoint: `GET /api/projects` — list user's projects
- [ ] Create API endpoint: `POST /api/projects/[id]/confirm-role` — confirm role entry

### Frontend
- [ ] Create `/login` page (email + Google buttons)
- [ ] Create `/auth/verify-email` page (email verification message)
- [ ] Create `/projects` page (project selection)
- [ ] Create `/projects/[id]/confirm-role` page (role confirmation)
- [ ] Create `useSession()` hook usage in components
- [ ] Implement redirect logic (login → projects → confirm role → step 1)

### Testing
- [ ] Test email login (sign up → magic link → authenticated)
- [ ] Test Google OAuth (sign in → Google consent → authenticated)
- [ ] Test project selection (shows only user's projects)
- [ ] Test role confirmation (shows correct role)
- [ ] Test auth middleware (unauthenticated redirect to login)
- [ ] Test session persistence (reload page → still authenticated)

### Deployment
- [ ] Set NEXTAUTH_URL to production domain
- [ ] Set NEXTAUTH_SECRET to secure random value
- [ ] Configure Google OAuth with production domain
- [ ] Configure email provider for production
- [ ] Test auth flow on staging environment

---

## Migration Path to Clerk (Future)

When you're ready to migrate to Clerk (for better user management UI, organizations, etc.):

1. Keep the User table structure (Clerk can populate it)
2. Replace NextAuth provider logic with Clerk SDK
3. Update environment variables for Clerk API keys
4. Clerk organizations map to Analyst Studio projects
5. Clerk roles map to ProjectRole enum
6. No breaking changes to ProjectAccess or ProjectAuditLog

**Timeline:** Build MVP with NextAuth, migrate to Clerk when you have 100+ users or need advanced features.

---

## Security Notes

- **NEXTAUTH_SECRET:** Generate with `openssl rand -base64 32` — must be unique per environment
- **NEXTAUTH_URL:** Must match your deployment domain (localhost for dev, production URL for prod)
- **Email verification:** Users must verify email before accessing protected routes (NextAuth handles this)
- **Session expiration:** Default 30 days. Adjust with `maxAge` in NextAuth config if needed
- **HTTPS required:** Production deployment must use HTTPS (NextAuth enforces this)

---

## Next Steps (After Phase 0)

Once Phase 0 is complete:
1. User can log in and select project
2. User's role is confirmed
3. Proceed to Phase 1: Validate Resources (Step 1)
4. All subsequent steps can filter by user role

**Phase 0 blockers on Phase 1-4:** None. Phase 0 is independent. Can be built in parallel if Chris works on both.
