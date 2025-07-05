export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    supabaseDatabaseUrl: process.env.SUPABASE_DATABASE_URL,
    redisPublicEndpoint: process.env.REDIS_PUBLIC_ENDPOINT,
    redisPassword: process.env.REDIS_PASSWORD,
    redisHost: process.env.REDIS_HOST,
    redisUser: process.env.REDIS_USER,
  },
  email: {
    password: process.env.EMAIL_PASS,
    user: process.env.EMAIL_USER,
  },
  appEnv: {
    baseUrl: process.env.SERVER_BASE_URL,
    logoUrl: process.env.AGRINIX_LOGO_URL,
  },
  images: {
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  roboflow: {
    privateKey: process.env.ROBOFLOW_PRIVATE_API_KEY,
    publishableKey: process.env.ROBOFLOW_PUBLISHABLE_API_KEY,
    endpoint: process.env.ROBOFLOW_ENDPOINT,
  },
  plantid: {
    apiKey: process.env.PLANTID_API_KEY,
  },
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    secondaryKey: process.env.JWT_SECRET_OR_KEY,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    userName: process.env.REDIS_USER,
  },
  openRouter: {
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    key: process.env.OPENROUTER_API_KEY,
  },
});
