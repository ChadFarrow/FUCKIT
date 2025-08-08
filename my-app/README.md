# Your Volo App

Welcome to your new full-stack application! This project was created with `create-volo-app` and comes pre-configured with a modern tech stack and production-ready architecture.

## 🎯 **Philosophy**

This application provides a highly opinionated, production-ready foundation for building full-stack applications with a decoupled frontend and backend. It's designed to maximize development velocity while adhering to best practices, including clear separation of concerns and secure handling of sensitive credentials.

Many boilerplates offer a rapid 'hello world' experience for local development but often defer critical decisions about authentication, database integration, and production deployment. This template takes a different approach. We believe that the complexities of a true full-stack application - setting up auth, a database, and distinct hosting for UI and API - are largely unavoidable for production use. By addressing these components comprehensively from the start, this template aims to provide a clearer, more predictable path to a robust, deployable application, minimizing 'surprise' hurdles down the line and fostering a deeper understanding of the full stack architecture.

Start with everything running locally on your machine, then progressively connect to production services when you're ready or dive in and connect them all at app creation.

## 🚀 **What You Have**


**Frontend:**
- ⚛️ React + TypeScript + Vite
- 🎨 Tailwind CSS + ShadCN components
- 🔐 Firebase Authentication (Google Sign-In)

**Backend:**
- 🔥 Hono API backend (NodeJS)
- 🗄️ PostgreSQL with Drizzle ORM
- 🔑 Firebase Admin SDK

**Local Development (Default):**
- ⚡ Runs UI + Server + DB + Auth on your computer
- 🏠 Embedded PostgreSQL database
- 🔧 Firebase Auth emulator
- ✅ Zero sign-ins or accounts needed

**Production (when connected):**
- 🌐 Cloudflare Pages + Workers deployment ready
- 🗄️ Neon, Supabase, or custom PostgreSQL
- 🔐 Production Firebase Auth

## 🛠️ **Development**

Start both frontend and backend (with embedded PostgreSQL database and Firebase emulator):

```bash
pnpm run dev
```

This automatically assigns available ports and displays them on startup:
- **Frontend**: Usually `http://localhost:5173` (or next available)
- **Backend API**: Usually `http://localhost:8787` (or next available)
- **PostgreSQL**: Embedded database on dynamic port (starts from 5433)

The system handles port conflicts automatically. For multiple projects, use separate folders.

> **📋 Port Management**: See [`docs/PORT_HANDLING.md`](docs/PORT_HANDLING.md) for details on running multiple instances and port conflict resolution.

### Individual Commands

```bash
# Frontend only
cd ui && pnpm dev

# Backend only  
cd server && pnpm dev

# Build frontend
cd ui && pnpm build

# Deploy backend (requires production setup)
cd server && pnpm run deploy
```

## 🔗 **Connecting Production Services**

Your app defaults to everything running locally. Connect to production services when you're ready:

### Connect Production Database
```bash
# Choose from available providers
pnpm connect:database

# Or connect to specific provider
pnpm connect:database:neon      # Neon PostgreSQL
pnpm connect:database:supabase  # Supabase PostgreSQL
pnpm connect:database:custom    # Custom PostgreSQL
```

### Connect Production Authentication
```bash
# Set up production Firebase Auth
pnpm connect:auth
```

### Connect Production Deployment
```bash
# Set up Cloudflare Workers + Pages deployment
pnpm connect:deploy
```

### Check Connection Status
```bash
# See what's connected to production vs local
pnpm connection:status
```

**What happens when you connect services:**
- Your `.env` files are automatically updated
- A backup of your current config is created
- You can always revert to local development by restoring the backup

## 📁 **Project Structure**

```
├── ui/                    # React frontend
│   ├── src/
│   │   ├── components/    # UI components (ShadCN)
│   │   ├── lib/          # Utilities & Firebase config
│   │   └── App.tsx       # Main app component
│   └── package.json
├── server/               # Hono API backend
│   ├── src/
│   │   ├── middleware/   # Auth & other middleware
│   │   ├── schema/       # Database schema (Drizzle)
│   │   └── index.ts      # API routes
│   ├── wrangler.toml     # Cloudflare Worker config (when connected)
│   ├── .env              # Your environmental variables
│   └── package.json
├── data/                 # Local development data
│   ├── postgres/         # Embedded PostgreSQL data
│   └── firebase-emulator/ # Firebase emulator data (auto-backed up)
└── scripts/
    ├── post-setup.js     # Setup automation
    ├── run-dev.js        # Development server runner
    └── periodic-emulator-backup.js # Firebase data backup (runs automatically)
```

## 🔧 **Customization**

### Adding API Routes

Edit `server/src/index.ts`:

```typescript
// Add to the existing api router
api.get('/your-route', (c) => {
  return c.json({ message: 'Hello!' });
});

// For protected routes, add to protectedRoutes:
protectedRoutes.get('/private-route', (c) => {
  const user = c.get('user'); // Get authenticated user
  return c.json({ user });
});
```

### Database Changes

1. Edit schema in `server/src/schema/`
2. Push changes: `cd server && pnpm db:push`

### UI Components

- Add components in `ui/src/components/`
- Use ShadCN/UI: Browse components at [ui.shadcn.com](https://ui.shadcn.com)
- Install new components: `cd ui && npx shadcn-ui@latest add [component]`

### Styling

- Modify `ui/tailwind.config.js` for custom themes
- Global styles in `ui/src/index.css`
- Use Tailwind utility classes throughout

## 🚀 **Deployment**

> **Note**: Embedded PostgreSQL is for local development only. Production deployments require an external database (configured during setup).

### Backend (Cloudflare Workers)

```bash
cd server
pnpm run deploy
```

Your API will be available at: `https://your-worker-name.your-subdomain.workers.dev`

### Frontend (Cloudflare Pages)

1. **Connect to Git**: Link your repository to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. **Build Settings**:
   - Build command: `pnpm run build`
   - Build output: `ui/dist`
3. **Deploy**: Automatic on every git push

### Environment Variables (Production)

Set these in Cloudflare dashboards:

**Worker Environment Variables:**
- `DATABASE_URL` - Your database connection string
- `FIREBASE_PROJECT_ID` - Firebase project ID

**Pages Environment Variables (if needed):**
- `VITE_API_URL` - Your deployed worker URL (optional, defaults work)

### Post-Deployment Setup

1. **Update Firebase authorized domains**:
   - Go to [Firebase Console](https://console.firebase.google.com) > Authentication > Settings
   - Add your Pages domain (e.g., `your-app.pages.dev`)

2. **Test your deployment**:
   ```bash
   curl https://your-worker-name.your-subdomain.workers.dev/api/v1/hello
   ```

## 🔐 **Authentication Flow**

Your app includes a complete authentication system that works in both local and production modes:

### Local Mode (Default)
1. **Sign in**: Use any email/password combination in the UI
2. **Storage**: User data stored in local Firebase emulator
3. **API calls**: Authenticated requests work normally
4. **Development**: No external accounts needed

### Production Mode (After `pnpm connect:auth`)
1. **Login**: Users sign in with Google (or other configured providers)
2. **Token**: Frontend gets Firebase ID token
3. **API calls**: Token sent in `Authorization: Bearer <token>` header
4. **Verification**: Backend verifies token and creates/finds user in database
5. **Protection**: Protected routes automatically have user context

### Example API Call

```typescript
// Frontend (already implemented in lib/serverComm.ts)
const response = await api.getCurrentUser();
console.log(response.user);
```

## 🗄️ **Database**

Your database is set up with Drizzle ORM and works the same whether local or production:

### User Schema (included)

```typescript
// server/src/schema/users.ts
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  display_name: text('display_name'),
  photo_url: text('photo_url'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
```

### Adding New Tables

1. Create schema file in `server/src/schema/`
2. Export from main schema file
3. Push to database: `cd server && pnpm db:push`

## 📚 **Learning Resources**

- **React**: [react.dev](https://react.dev)
- **Hono**: [hono.dev](https://hono.dev)
- **Drizzle ORM**: [orm.drizzle.team](https://orm.drizzle.team)
- **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com)
- **ShadCN/UI**: [ui.shadcn.com](https://ui.shadcn.com)
- **Cloudflare Workers**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)
- **Firebase Auth**: [firebase.google.com/docs/auth](https://firebase.google.com/docs/auth)

## 🆘 **Troubleshooting**

### Development Issues

**Backend won't start:**
```bash
cd server
# Check environment variables
cat .env
# Reinstall dependencies
pnpm install
```

**Database connection errors:**
```bash
cd server
# Test database connection
pnpm db:push
```

**Frontend build errors:**
```bash
cd ui
# Clear cache and reinstall
rm -rf node_modules .vite dist
pnpm install
```

### Authentication Issues

**Local Development:**
- Firebase emulator should start automatically with `pnpm dev`
- Try signing in with any email/password combination
- Check `data/firebase-emulator/` for persisted data
- **Data Protection**: Emulator data is automatically backed up every 60 seconds and on clean shutdown to prevent data loss during crashes

**Production Mode:**
1. **Check Firebase config**: `ui/src/lib/firebase-config.json`
2. **Verify environment variables**: `server/.env`
3. **Check authorized domains** in Firebase Console

### Deployment Issues

1. **Verify build succeeds locally**
2. **Check environment variables** in Cloudflare dashboards
3. **Review logs** in Cloudflare Workers/Pages dashboards

## 🎯 **Next Steps**

1. **Explore the code**: Start with `ui/src/App.tsx` and `server/src/index.ts`
2. **Customize the UI**: Modify components and styling
3. **Add features**: Build your app logic in both frontend and backend
4. **Deploy**: Push to git for automatic deployment

---

**Happy coding!** 🚀

Need help? Check the detailed documentation in each workspace (`server/README.md`, `ui/README.md`) or visit the [community discussions](https://github.com/VoloBuilds/create-volo-app/discussions). 