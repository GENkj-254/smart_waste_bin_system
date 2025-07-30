// main.js - Central entry point for frontend logic

// Import only if using ES Modules and bundler setup
// Uncomment the line below if you're using import/export (e.g. via Webpack, Vite, or native modules)
import DashboardController from './js/dashboard-controller.js';
console.log("✅ main.js loaded");

document.addEventListener("DOMContentLoaded", function() {
    const currentPage = window.location.pathname;

    // Setup login page logic
    if (currentPage.includes("login.html") || currentPage === "/" || currentPage.includes("index.html")) {
        setupLoginEventListeners();
    }

    // Setup dashboard logic
    if (currentPage.includes("dashboard.html")) {
        if (typeof DashboardController !== "undefined") {
            const smart_waste_dashboard = new DashboardController();
            smart_waste_dashboard.initialize();
        } else {
            console.error("DashboardController not found. Make sure it's loaded before main.js.");
        }
    }
});

function setupLoginEventListeners() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("https://smart-waste-bin-management-system.onrender.com/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.token);
        window.location.href = "smart_waste_dashboard.html";
    } else {
        const error = await response.json();
        alert(error.message || "Login failed. Please try again.");
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
