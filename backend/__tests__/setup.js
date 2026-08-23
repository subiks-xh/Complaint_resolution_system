// Jest setup file
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";
process.env.MONGODB_URI = "mongodb://test-db";
process.env.CLOUDINARY_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.EMAIL_SERVICE = "test";
process.env.EMAIL_USER = "test@test.com";
process.env.EMAIL_PASSWORD = "test-password";
process.env.FRONTEND_URL = "http://localhost:3001";

// Add any global test setup here
global.console = {
  ...console,
  // Uncomment to suppress console logs in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
};
