// Authentication and User Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.ADMIN_PASSWORD = "admin123";
        this.init();
    }

    init() {
        // Check if user is logged in from localStorage
        const savedUser = localStorage.getItem('lifeshare-user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUI();
        }
    }

    // User Registration/Login
    async registerUser(donorData) {
        try {
            // Generate unique user ID
            const userId = this.generateUserId();
            const userData = {
                ...donorData,
                userId: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Save user data to localStorage
            localStorage.setItem('lifeshare-user', JSON.stringify(userData));
            this.currentUser = userData;
            this.updateUI();

            return { success: true, user: userData };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    // Admin Login
    adminLogin(password) {
        if (password === this.ADMIN_PASSWORD) {
            this.isAdmin = true;
            localStorage.setItem('lifeshare-admin', 'true');
            this.updateUI();
            return true;
        }
        return false;
    }

    // Logout
    logout() {
        this.currentUser = null;
        this.isAdmin = false;
        localStorage.removeItem('lifeshare-user');
        localStorage.removeItem('lifeshare-admin');
        this.updateUI();
    }

    // Check if user can edit a donor
    canEditDonor(donorId) {
        if (this.isAdmin) return true;
        if (this.currentUser && this.currentUser.id === donorId) return true;
        return false;
    }

    // Update UI based on auth state
    updateUI() {
        const userMenu = document.getElementById('userMenu');
        const profileTab = document.getElementById('profileTab');
        const adminPanel = document.getElementById('adminPanel');

        if (this.currentUser) {
            userMenu.style.display = 'flex';
            profileTab.style.display = 'flex';
        } else {
            userMenu.style.display = 'none';
            profileTab.style.display = 'none';
        }

        if (this.isAdmin) {
            adminPanel.style.display = 'block';
        } else {
            adminPanel.style.display = 'none';
        }
    }

    // Generate unique user ID
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get current user data
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Check if user is admin
    isAdminUser() {
        return this.isAdmin;
    }
}

// Initialize Auth Manager
const authManager = new AuthManager();
