# AstroShrine Backend - Environment Variables

Copy these to Railway Dashboard → Settings → Variables

## Required Variables

### Server
```
NODE_ENV=production
PORT=5050
```

### AWS Credentials (S3, DynamoDB, SQS, CloudWatch)
```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=ap-south-1
```

### AWS S3 Buckets
```
AWS_S3_BUCKET_NAME_USER_PUBLIC=astroshrine-user-profile
AWS_S3_BUCKET_ASTROLOGER_PUBLIC=astroshrine-user-profile
AWS_S3_BUCKET_CONTENT_TEMPLATE=astroshrine-content-template
AWS_S3_BUCKET_CHANNEL_MEDIA=astroshrine-channel-media
AWS_S3_BUCKET_GIFT_MEDIA=astroshrine-channel-gift
AWS_CDN_USERPROFILE_BUCKET_URL=https://your-cloudfront-url.cloudfront.net/
```

### Supabase (Database + Auth)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Agora (Video/Voice Calls & Livestream)
```
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERT=your_agora_app_certificate
```

### Pusher (Real-time Events)
```
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=ap2
```

### Firebase (Push Notifications)
```
GOOGLE_APPLICATION_CREDENTIALS=serviceAccKey.json
```

### Razorpay (Payments)
```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Cognito (Legacy Auth - Optional)
```
COGNITO_USER_POOL_REGION=ap-south-1
COGNITO_USER_POOL_ID=your_cognito_pool_id
```

### OpenAI (Optional - AI Features)
```
OPENAI_API_KEY=your_openai_api_key
```

---

## Where to Get These Values

| Service | Where to Find |
|---------|--------------|
| AWS | AWS Console → IAM → Users → Security Credentials |
| Supabase | Supabase Dashboard → Project Settings → API |
| Agora | Agora Console → Project Management |
| Pusher | Pusher Dashboard → App Keys |
| Firebase | Firebase Console → Project Settings → Service Accounts |
| Razorpay | Razorpay Dashboard → Settings → API Keys |
| OpenAI | OpenAI Platform → API Keys |
