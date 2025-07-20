# 🌱 Agrinix Server - Crop Disease Detection API

[![NestJS](https://img.shields.io/badge/NestJS-11.0.1-red.svg)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-6+-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

### Documentation
[Full documentation can be found here](https://docs.forxai.me)

A robust and scalable NestJS server for the **Agrinix** crop disease detection application. This server processes crop leaf images through advanced AI models to detect diseases and provide comprehensive agricultural insights to help farmers protect their crops.

## 🚀 Features

### Core Functionality

- **🖼️ Image Processing**: Receives and processes crop leaf images from mobile clients
- **🤖 AI-Powered Detection**: Integrates with Roboflow for accurate disease prediction
- **🧠 Intelligent Analysis**: Uses DeepSeek AI for detailed disease information and recommendations
- **📊 Real-time Results**: Provides instant disease detection with confidence scores
- **🔐 Secure Authentication**: JWT-based user authentication and authorization
- **📧 Email Verification**: Complete email verification system for user accounts
- **☁️ Cloud Storage**: Cloudinary integration for image storage and management

### Advanced Features

- **💬 Community Features**: Messaging system with likes and responses
- **🔔 Notifications**: Real-time notification system for users
- **📈 Analytics**: Disease prediction tracking and user activity monitoring
- **🔄 Background Jobs**: Queue-based processing for heavy operations
- **⚡ Caching**: Redis-based caching for improved performance
- **📝 Logging**: Comprehensive logging system for debugging and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Agrinix       │    │   External      │
│   (Client)      │◄──►│   Server        │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   Roboflow      │
                       │   Database      │    │   AI Models     │
                       └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Cache   │    │   DeepSeek AI   │
                       │   & Sessions    │    │   Analysis      │
                       └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Backend Framework

- **NestJS 11.0.1** - Progressive Node.js framework
- **TypeScript 5.7.3** - Type-safe JavaScript
- **Node.js 18+** - Runtime environment

### Database & Storage

- **PostgreSQL** - Primary database with Prisma ORM
- **Redis** - Queues and session management
- **Cloudinary** - Cloud image storage and optimization

### AI & Machine Learning

- **Roboflow** - Computer vision API for disease detection
- **DeepSeek AI** - Advanced language model for disease analysis
- **OpenRouter** - AI model orchestration

### Authentication & Security

- **JWT** - JSON Web Tokens for authentication
- **Argon2** - Password hashing
- **Passport.js** - Authentication middleware

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Prisma** - Database ORM and migrations

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **PostgreSQL** (v13 or higher)
- **Redis** (v6 or higher)
- **Git**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/techpepson/agrinix-server.git
cd agrinix-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Fill in the required environment variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/agrinix_db"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_USER=default

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_SECRET_OR_KEY=your_jwt_secondary_key

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Roboflow Configuration
ROBOFLOW_PRIVATE_API_KEY=your_roboflow_private_key
ROBOFLOW_PUBLISHABLE_API_KEY=your_roboflow_publishable_key
ROBOFLOW_ENDPOINT=https://serverless.roboflow.com/infer/workflows/agrinix/agrinix-workflow-3

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# Application Configuration
PORT=3000
SERVER_BASE_URL=http://localhost:3000
AGRINIX_LOGO_URL=https://your-domain.com/logo.jpg
```

### 4. Database Setup

#### PostgreSQL Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE agrinix_db;
```

2. Run Prisma migrations:

```bash
npx prisma migrate dev
```

3. Generate Prisma client:

```bash
npx prisma generate
```

#### Redis Setup

1. Install Redis on your system
2. Start Redis server:

```bash
redis-server
```

### 5. Start the Development Server

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The server will be available at `http://localhost:8000`

## 📚 API Documentation

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### Login User

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

### Crop Disease Detection

#### Upload and Detect Disease

```http
POST /api/crops/roboflow-detect-disease
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "image": <file>
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "diseaseClass": "healthy",
    "confidence": 0.95,
    "description": "Detailed disease description",
    "causes": ["Environmental factors", "Pathogen presence"],
    "symptoms": ["Leaf spots", "Wilting"],
    "prevention": ["Proper spacing", "Fungicide application"],
    "treatment": ["Remove infected plants", "Apply treatment"]
  }
}
```

### Community Features

#### Create Message

```http
POST /api/community/messages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "messageTitle": "Help with tomato disease",
  "messageBody": "I found spots on my tomato leaves...",
  "messageImage": "optional_image_url"
}
```

#### Get Messages

```http
GET /api/community/messages
Authorization: Bearer <jwt_token>
```

## 🔧 Development

### Project Structure

```
src/
├── auth/                 # Authentication module
├── crops/               # Crop disease detection
├── community/           # Community features
├── notifications/       # Notification system
├── processors/          # Background job processors
├── helpers/            # Utility services
├── config/             # Configuration management
├── guards/             # Authentication guards
├── dto/                # Data transfer objects
└── prisma/             # Database service
```

### Available Scripts

```bash
# Development
npm run start:dev          # Start development server
npm run start:debug        # Start with debug mode

# Production
npm run build             # Build the application
npm run start:prod        # Start production server

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:e2e          # Run end-to-end tests
npm run test:cov          # Run tests with coverage

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier

# Database
npx prisma migrate dev    # Run database migrations
npx prisma generate       # Generate Prisma client
npx prisma studio         # Open Prisma Studio
```

### Environment Variables

| Variable                   | Description                  | Required |
| -------------------------- | ---------------------------- | -------- |
| `DATABASE_URL`             | PostgreSQL connection string | ✅       |
| `REDIS_HOST`               | Redis server host            | ✅       |
| `REDIS_PORT`               | Redis server port            | ✅       |
| `JWT_SECRET`               | JWT signing secret           | ✅       |
| `EMAIL_USER`               | SMTP email username          | ✅       |
| `EMAIL_PASS`               | SMTP email password          | ✅       |
| `CLOUDINARY_CLOUD_NAME`    | Cloudinary cloud name        | ✅       |
| `CLOUDINARY_API_KEY`       | Cloudinary API key           | ✅       |
| `CLOUDINARY_API_SECRET`    | Cloudinary API secret        | ✅       |
| `ROBOFLOW_PRIVATE_API_KEY` | Roboflow private API key     | ✅       |
| `OPENROUTER_API_KEY`       | OpenRouter API key           | ✅       |

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Structure

```
test/
├── app.e2e-spec.ts      # End-to-end tests
└── jest-e2e.json        # Jest E2E configuration
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### Environment Setup for Production

1. Set up PostgreSQL database
2. Configure Redis instance
3. Set up Cloudinary account
4. Configure Roboflow API keys
5. Set up OpenRouter API access
6. Configure email service (Gmail, SendGrid, etc.)

## 📊 Monitoring & Logging

### Logging

The application uses NestJS built-in logging with different levels:

- `error` - Error messages
- `warn` - Warning messages
- `log` - General information
- `debug` - Debug information

<!-- ### Health Checks

```http
GET /health
``` -->

### Performance Monitoring

- Redis caching for improved response times
- Background job processing for heavy operations
- Rate limiting to prevent abuse
- Request throttling for API protection

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Argon2 for secure password storage
- **Rate Limiting** - Protection against brute force attacks
- **Input Validation** - Class-validator for request validation
- **CORS Protection** - Cross-origin resource sharing protection
<!-- - **Helmet** - Security headers middleware -->

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write comprehensive tests for new features
- Follow NestJS architectural patterns

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [NestJS Docs](https://docs.nestjs.com/)
- **Issues**: [GitHub Issues](https://github.com/your-username/agrinix-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/agrinix-server/discussions)

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Roboflow](https://roboflow.com/) - Computer vision platform
- [DeepSeek](https://www.deepseek.com/) - AI language models
- [Prisma](https://www.prisma.io/) - Database toolkit
- [Cloudinary](https://cloudinary.com/) - Cloud image management

---

**Made with ❤️ for farmers and agricultural communities**
