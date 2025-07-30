# Smart Waste Bin Management System

This project is a Smart Waste Bin Management System that includes a login feature for both administrators and workers. The system allows administrators to manage waste bins and view their statuses, while workers can access relevant information based on their roles.

## Project Structure

The project is divided into two main parts: the backend and the frontend.

### Backend

The backend is built using Node.js and Express. It handles user authentication, bin management, and serves API endpoints for the frontend.

- **src/app.js**: Entry point of the backend application. Sets up the Express server, connects to the database, and configures middleware and routes.
- **src/controllers/authController.js**: Contains functions for user authentication, including login and registration.
- **src/controllers/binController.js**: Manages waste bins, including retrieving bin status and updating bin information.
- **src/models/user.js**: Defines the User model with properties such as username, password, and role (administrator or worker).
- **src/models/bin.js**: Defines the Bin model with properties such as binId, fillLevel, and location.
- **src/routes/authRoutes.js**: Exports routes related to authentication.
- **src/routes/binRoutes.js**: Exports routes related to bin management.
- **src/middleware/authMiddleware.js**: Contains middleware functions for verifying user tokens and checking user roles.
- **package.json**: Configuration file for npm, listing dependencies required for the backend application.
- **README.md**: Documentation for the backend application.

### Frontend

The frontend is built using HTML, CSS, and JavaScript. It provides the user interface for the Smart Waste Bin Management System.

- **src/index.html**: Main HTML file for the frontend application.
- **src/login.html**: Contains the login form for user authentication.
- **src/dashboard.html**: Displays the dashboard for logged-in users.
- **src/js/main.js**: Main JavaScript logic for handling user interactions and API calls.
- **src/js/login.js**: JavaScript logic for the login page.
- **src/js/dashboard.js**: JavaScript logic for the dashboard page.
- **src/css/style.css**: Styles for the main layout and design.
- **src/css/dashboard.css**: Styles specific to the dashboard page.
- **README.md**: Documentation for the frontend application.

## Setup Instructions

### Backend

1. Navigate to the `backend` directory.
2. Run `npm install` to install the required dependencies.
3. Set up your database connection in `src/app.js`.
4. Start the server with `node src/app.js`.

### Frontend

1. Navigate to the `frontend` directory.
2. Open `src/index.html` in your web browser to access the application.

## API Endpoints

- **POST /api/auth/login**: Authenticate users and return a token.
- **POST /api/auth/register**: Register a new user.
- **GET /api/bin-data/latest**: Retrieve the latest bin data.
- **GET /api/bin-data/history**: Retrieve historical bin data.

## Contributing

Feel free to fork the repository and submit pull requests for any improvements or features.