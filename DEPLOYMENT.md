# Deployment Guide for GeoPressCI Backend

## Environment Variables Required for Deployment

### MongoDB Configuration
The most critical environment variable for deployment is the MongoDB connection string:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/geopressci?retryWrites=true&w=majority
```

### Complete Environment Variables List

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/geopressci?retryWrites=true&w=majority

# Server Configuration
NODE_ENV=production
PORT=5002
FRONTEND_URL=https://your-frontend-domain.com

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d

# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM_NAME=GeoPressCI
EMAIL_FROM_ADDRESS=no-reply@geopressci.ci
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Twilio SMS Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

## MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Go to https://cloud.mongodb.com
   - Sign up for a free account

2. **Create a Cluster**
   - Choose the free tier (M0)
   - Select a region close to your deployment location
   - Create the cluster

3. **Configure Database Access**
   - Go to "Database Access" in the left sidebar
   - Add a new database user
   - Choose "Password" authentication
   - Set username and password
   - Grant "Read and write to any database" privileges

4. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Add IP Address
   - For deployment platforms, add `0.0.0.0/0` (allow access from anywhere)
   - Or add your deployment platform's IP addresses

5. **Get Connection String**
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `geopressci`

## Back4App Deployment

1. **Set Environment Variables in Back4App**
   - Go to your Back4App dashboard
   - Navigate to your app settings
   - Add all the environment variables listed above
   - Make sure `MONGODB_URI` is set correctly

2. **Deploy**
   - Push your code changes
   - Back4App will automatically redeploy

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check if your MongoDB Atlas cluster is active
   - Verify network access settings (IP whitelist)
   - Ensure connection string is correct

2. **Authentication Failed**
   - Verify username and password in connection string
   - Check database user permissions

3. **Server Not Starting**
   - Check if PORT environment variable is set
   - Verify all required environment variables are defined

### Health Check Endpoint

The server now includes better error handling and will start even if the database connection fails. You can check the server status by accessing:

```
GET /api/v1/health
```

This endpoint should return server status and database connection status.

## Production Considerations

1. **Security**
   - Use strong JWT secrets
   - Restrict MongoDB network access to specific IPs when possible
   - Use environment-specific CORS origins

2. **Performance**
   - Monitor MongoDB Atlas metrics
   - Consider upgrading to a paid tier for better performance
   - Implement proper logging and monitoring

3. **Backup**
   - MongoDB Atlas provides automatic backups
   - Consider implementing application-level backup strategies for critical data
