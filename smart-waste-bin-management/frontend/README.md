# Smart Waste Bin Management System

## Overview
The Smart Waste Bin Management System is a web application designed to monitor and manage waste bins efficiently. It provides a user-friendly interface for both administrators and workers to interact with the system.

## Features
- **User Authentication**: Secure login for administrators and workers.
- **Dashboard**: Real-time monitoring of waste bin status.
- **Data Management**: Administrators can update bin information and manage user roles.

## Project Structure
```
smart-waste-bin-management
├── backend
│   ├── src
│   │   ├── app.js
│   │   ├── controllers
│   │   │   ├── authController.js
│   │   │   └── binController.js
│   │   ├── models
│   │   │   ├── user.js
│   │   │   └── bin.js
│   │   ├── routes
│   │   │   ├── authRoutes.js
│   │   │   └── binRoutes.js
│   │   └── middleware
│   │       └── authMiddleware.js
│   ├── package.json
│   └── README.md
├── frontend
│   ├── src
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── js
│   │   │   ├── main.js
│   │   │   ├── login.js
│   │   │   └── dashboard.js
│   │   └── css
│   │       ├── style.css
│   │       └── dashboard.css
│   └── README.md
└── README.md
```

## Setup Instructions

### Backend
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```

### Frontend
1. Navigate to the `frontend` directory.
2. Open `src/index.html` in a web browser to access the application.

## Usage
- **Login**: Users can log in as either administrators or workers. Administrators have access to additional features for managing the system.
- **Dashboard**: After logging in, users will see the dashboard displaying relevant information based on their role.

## Technologies Used
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express, MongoDB

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.