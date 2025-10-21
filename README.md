# Full-Stack React Native + Expo + Electron App

A complete full-stack application using JavaScript only, supporting mobile (Android/iOS), web, and desktop (Windows/Linux/macOS) platforms.

## Features

- **Authentication**: Register/Login with email/password, JWT tokens, "Remember me" option
- **File Upload**: Support for .xlsx, .xls, .csv, .json, .sql, .txt files
- **Data Transformation**: Client-side column operations (delete/rename/filter/reorder) using SheetJS
- **Visualization**: Charts (Bar, Line, Pie, Scatter, Histogram) using Victory
- **Guest Mode**: Upload without login (temporary storage)
- **Cross-Platform**: Mobile (Expo), Web (Expo Web), Desktop (Electron)

## Tech Stack

### Frontend
- React Native + Expo
- Navigation: React Navigation
- Styling: Tailwind CSS (NativeWind)
- Charts: Victory Native
- File Handling: Expo Document Picker, File System
- Auth Storage: Expo Secure Store

### Backend
- Node.js + Express
- Database: MongoDB
- Auth: bcrypt + JWT
- File Upload: Multer
- Data Parsing: SheetJS (xlsx)

### Desktop
- Electron

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB
- Expo CLI: `npm install -g @expo/cli`
- For mobile: Android Studio (Android) or Xcode (iOS)

### Backend Setup
1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create `.env` file in backend directory:
   ```
   MONGO_URI=mongodb://localhost:27017/basicapp
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH=your_refresh_secret_key
   PORT=5000
   ```

4. Start MongoDB (if using local):
   ```bash
   mongod
   ```

5. Run backend:
   ```bash
   npm start
   ```

   Or with Docker:
   ```bash
   docker-compose up
   ```

### Frontend Setup
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Expo development server:
   ```bash
   npx expo start
   ```

### Desktop Setup (Electron)
1. Navigate to electron directory:
   ```bash
   cd electron
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Electron app (ensure Expo web is running on port 19006):
   ```bash
   npm run dev
   ```

## Running the App

### Web
```bash
cd frontend
npx expo start --web
```
Open http://localhost:19006 in browser.

### Mobile
```bash
cd frontend
npx expo start
```
Scan QR code with Expo Go app or use emulator.

### Desktop
```bash
cd electron
npm run dev
```

## API Endpoints

| Method | Endpoint                  | Description                   |
|--------|---------------------------|-------------------------------|
| POST   | `/api/auth/register`      | Register new user             |
| POST   | `/api/auth/login`         | Login user                    |
| POST   | `/api/auth/refresh`       | Refresh access token          |
| POST   | `/api/files/upload`       | Upload file (authenticated)   |
| POST   | `/api/files/upload-guest` | Upload file (guest)           |
| GET    | `/api/files`              | Get user's files              |
| GET    | `/api/files/:id/download` | Download file                 |
| DELETE | `/api/files/:id`          | Delete file                   |
| POST   | `/api/transform`          | Transform and re-upload file  |

## File Structure

```
/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── File.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── fileRoutes.js
│   │   └── transformRoutes.js
│   ├── utils/
│   │   └── calculateSha256.js
│   ├── uploads/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── HomeScreen.js
│   │   ├── UploadScreen.js
│   │   ├── TransformScreen.js
│   │   └── VisualizationScreen.js
│   ├── App.js
│   ├── package.json
│   └── ...
├── electron/
│   ├── main.js
│   └── package.json
├── babel.config.js
├── tailwind.config.js
└── README.md
```

## Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- File type validation and size limits (50MB)
- Files stored outside web root
- Guest uploads use random IDs

## Development Notes

- All code is JavaScript only (no TypeScript)
- Backend is Docker-ready
- Frontend uses Expo for easy cross-platform development
- Charts are rendered client-side using Victory
- Data transformations happen client-side before upload

## Troubleshooting

- Ensure MongoDB is running for backend
- For mobile development, install Expo Go app
- For desktop, ensure Expo web server is running before starting Electron
- Check console logs for errors in each platform

## License

ISC
