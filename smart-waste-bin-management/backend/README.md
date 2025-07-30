# Smart Waste Bin Management System - Backend

## Overview
This backend application serves as the server-side component of the Smart Waste Bin Management System. It provides RESTful APIs for user authentication and waste bin management, allowing administrators and workers to interact with the system based on their roles.

## Technologies Used
- Node.js
- Express.js
- MongoDB (via Mongoose)
- JSON Web Tokens (JWT) for authentication

## Setup Instructions

### Prerequisites
- Node.js (version 14 or higher)
- MongoDB (local or cloud instance)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd smart-waste-bin-management/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root of the backend directory and add the following environment variables:
   ```
   PORT=5000
   MONGODB_URI=<your-mongodb-uri>
   JWT_SECRET=<your-jwt-secret>
   ```

### Running the Application
To start the server, run:
```
npm start
```
The server will be running on `http://localhost:5000`.

## API Endpoints

### Authentication
- **POST /api/auth/login**: Authenticate a user and return a JWT token.
- **POST /api/auth/register**: Register a new user (administrator or worker).

### Bin Management
- **GET /api/bin-data/latest**: Retrieve the latest status of the waste bin.
- **GET /api/bin-data/history**: Retrieve historical data of the waste bin fill levels.
- **PUT /api/bin-data/:id**: Update the information of a specific waste bin (accessible only to administrators).

## Folder Structure
- `src/app.js`: Entry point of the application.
- `src/controllers/`: Contains logic for handling requests.
- `src/models/`: Defines data models for users and bins.
- `src/routes/`: Contains route definitions for authentication and bin management.
- `src/middleware/`: Contains middleware for authentication and authorization.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.
## 📡 ESP32 Firmware

The `esp32/` folder contains the Arduino firmware for the Smart Waste Bin ESP32 microcontroller. It handles:
- Ultrasonic sensor readings
- Sends bin level to backend
- Triggers buzzer alert when full

Upload using Arduino IDE or VS Code with Arduino extension.
