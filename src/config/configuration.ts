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
});
