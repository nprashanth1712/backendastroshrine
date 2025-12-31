# AstroShrine Backend

Node.js/Express API server for the AstroShrine mobile app.

## 🚀 Deploy to Railway

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/nprashanth1712/astroshrine-backend-.git
git push -u origin main --force
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables (see below)

### Step 3: Environment Variables

Add these in Railway → Variables:

```
PORT=5050
NODE_ENV=production

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=ap-south-1
AWS_S3_BUCKET_NAME_USER_PUBLIC=astroshrine-user-profile
AWS_S3_BUCKET_CHANNEL_MEDIA=astroshrine-channel-media

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Agora
AGORA_APP_ID=your_app_id
AGORA_APP_CERT=your_certificate

# Pusher
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=ap2

# Razorpay
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_secret

# Firebase (paste entire JSON content)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### Step 4: Get Your URL
After deployment, generate a domain in Railway Settings → Domains.

Update your mobile app's `.env`:
```
REACT_APP_SERVER_URL=https://your-railway-url.up.railway.app
```

## Local Development

```bash
npm install
npm run build
npm start
```

Server runs on http://localhost:5050
