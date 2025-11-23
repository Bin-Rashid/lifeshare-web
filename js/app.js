// Main Application Code
class BloodDonorApp {
    constructor() {
        this.dataStorage = new CloudStorage();
        this.authManager = authManager;
        this.donors = [];
        this.filteredDonors = [];
        this.currentSort = 'asc';
        this.draggedCard = null;
        this.init();
    }

    async init() {
        await this.loadDonors();
        this.setupEventListeners();
        this.updateStats();
        console.log('🚀 LifeShare Blood Donor System Initialized');
    }

    async loadDonors() {
        this.donors = await this.dataStorage.loadDonors();
        this.filteredDonors = [...this.donors];
        await this.displayDonors();
    }

    async displayDonors(donors = null) {
        const donorsToDisplay = donors || this.filteredDonors;
        const donorsList = document.getElementById('donorsList');
        const donorCountBadge = document.getElementById('donorCountBadge');
        
        donorCountBadge.textContent = donorsToDisplay.length;
        donorsList.innerHTML = '';
        
        if (donorsToDisplay.length === 0) {
            donorsList.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        // Sort donors
        const sortedDonors = this.sortDonors(donorsToDisplay);
        
        // Load positions for drag & drop
        const positions = await this.dataStorage.loadDonorPositions();
        
        sortedDonors.forEach((donor, index) => {
            const donorCard = this.createDonorCard(donor, index, positions);
            donorsList.appendChild(donorCard);
        });
        
        this.setupDonorCardEvents();
    }

    sortDonors(donors) {
        const sorted = [...donors];
        if (this.currentSort === 'asc') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            sorted.sort((a, b) => b.name.localeCompare(a.name));
        }
        return sorted;
    }

    createDonorCard(donor, index, positions) {
        const eligibility = this.dataStorage.getEligibilityStatus(donor.lastDonation);
        const statusClass = eligibility.eligible ? 'status-eligible' : 'status-not-eligible';
        const canEdit = this.authManager.canEditDonor(donor.id);
        const isAdmin = this.authManager.isAdminUser();
        const position = positions[donor.id] || index;

        const donorCard = document.createElement('div');
        donorCard.className = 'donor-card';
        donorCard.setAttribute('data-id', donor.id);
        donorCard.setAttribute('data-position', position);
        donorCard.style.order = position;
        
        if (isAdmin) {
            donorCard.setAttribute('draggable', 'true');
        }

        donorCard.innerHTML = `
            <div class="profile-picture-container">
                ${donor.profilePicture ? 
                    `<img src="${donor.profilePicture}" class="profile-picture" alt="${donor.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
                    ''
                }
                <div class="profile-picture-placeholder" style="${donor.profilePicture ? 'display:none' : 'display:flex'}">
                    <i class="fas fa-user"></i>
                </div>
            </div>
            
            <div class="donor-blood">${donor.bloodType || 'Unknown'}</div>
            <div class="donor-name">${donor.name}</div>
            <div class="donor-age">Age: ${donor.age || 'N/A'} years</div>
            
            <div class="donor-location">
                <i class="fas fa-map-marker-alt"></i>
                ${donor.district}, ${donor.city}
            </div>
            
            <div class="donor-contact">
                <a href="tel:${donor.phone}">
                    <i class="fas fa-phone"></i>
                    ${donor.phone}
                </a>
            </div>
            
            <div class="donor-status ${statusClass}">
                <i class="fas ${eligibility.icon}"></i>
                ${eligibility.message}
            </div>
            
            <div class="donor-actions">
                ${canEdit ? `
                    <button class="btn btn-outline btn-small edit-donor" data-id="${donor.id}">
                        <i class="fas fa-edit"></i>
                        Update
                    </button>
                ` : ''}
                ${isAdmin ? `
                    <button class="btn btn-danger btn-small delete-donor" data-id="${donor.id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                ` : ''}
            </div>
        `;
        
        return donorCard;
    }

    setupDonorCardEvents() {
        // Edit buttons
        document.querySelectorAll('.edit-donor').forEach(button => {
            button.addEventListener('click', (e) => {
                const donorId = e.target.closest('.edit-donor').getAttribute('data-id');
                this.openEditModal(donorId);
            });
        });
        
        // Delete buttons
        if (this.authManager.isAdminUser()) {
            document.querySelectorAll('.delete-donor').forEach(button => {
                button.addEventListener('click', (e) => {
                    const donorId = e.target.closest('.delete-donor').getAttribute('data-id');
                    this.openDeleteModal(donorId);
                });
            });
        }

        // Drag and drop for admin
        if (this.authManager.isAdminUser()) {
            this.setupDragAndDrop();
        }
    }

    setupDragAndDrop() {
        const donorsList = document.getElementById('donorsList');
        let draggedCard = null;

        donorsList.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('donor-card')) {
                draggedCard = e.target;
                setTimeout(() => {
                    draggedCard.classList.add('dragging');
                }, 0);
            }
        });

        donorsList.addEventListener('dragend', (e) => {
            if (draggedCard) {
                draggedCard.classList.remove('dragging');
                draggedCard = null;
            }
        });

        donorsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(donorsList, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable && afterElement) {
                donorsList.insertBefore(draggable, afterElement);
            }
        });

        donorsList.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (draggedCard) {
                await this.saveCardPositions();
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.donor-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async saveCardPositions() {
        const donorsList = document.getElementById('donorsList');
        const cards = donorsList.querySelectorAll('.donor-card');
        const positions = {};
        
        cards.forEach((card, index) => {
            const donorId = card.getAttribute('data-id');
            positions[donorId] = index;
        });
        
        await this.dataStorage.saveDonorPositions(positions);
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <h3>No Donors Found</h3>
                <p>No donors are currently registered. Be the first to register as a blood donor and help save lives!</p>
                <button class="btn mt-4" onclick="app.switchToTab('register')">
                    <i class="fas fa-user-plus"></i>
                    Register as Donor
                </button>
            </div>
        `;
    }

    async updateStats() {
        const stats = this.dataStorage.getStats(this.donors);
        
        document.getElementById('totalDonors').textContent = stats.total;
        document.getElementById('eligibleDonors').textContent = stats.eligible;
        document.getElementById('universalDonors').textContent = stats.universal;
        document.getElementById('recentDonors').textContent = stats.recent;
    }

    switchToTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                this.switchToTab(tabId);
                
                if (tabId === 'donors') {
                    this.displayDonors();
                    this.updateStats();
                } else if (tabId === 'profile') {
                    this.loadUserProfile();
                }
            });
        });

        // Form submission
        document.getElementById('bloodDonorForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('editDonorForm').addEventListener('submit', (e) => this.handleEditFormSubmit(e));

        // Admin functionality
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            document.getElementById('adminLoginModal').style.display = 'flex';
        });

        document.getElementById('adminLoginForm').addEventListener('submit', (e) => this.handleAdminLogin(e));

        document.getElementById('logoutAdmin').addEventListener('click', () => {
            this.authManager.logout();
            this.displayDonors();
            showNotification('Admin logged out successfully.', 'info');
        });

        // User profile buttons
        document.getElementById('profileBtn').addEventListener('click', () => {
            this.switchToTab('profile');
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.authManager.logout();
            this.switchToTab('register');
            showNotification('Logged out successfully.', 'info');
        });

        // Delete functionality
        document.getElementById('confirmDelete').addEventListener('click', async () => {
            const donorId = document.getElementById('confirmDelete').getAttribute('data-id');
            await this.deleteDonor(donorId);
        });

        // Filters and sorting
        document.getElementById('filterBloodType').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterDistrict').addEventListener('change', () => this.applyFilters());
        document.getElementById('filterCity').addEventListener('input', () => this.applyFilters());
        document.getElementById('filterStatus').addEventListener('change', () => this.applyFilters());
        document.getElementById('sortByName').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applyFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());

        // Export and refresh
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());

        // Modal close events
        document.getElementById('cancelAdminLogin').addEventListener('click', () => {
            document.getElementById('adminLoginModal').style.display = 'none';
        });

        document.getElementById('cancelDelete').addEventListener('click', () => {
            document.getElementById('deleteModal').style.display = 'none';
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            document.getElementById('editModal').style.display = 'none';
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Profile picture upload
        this.setupProfilePictureUpload(
            document.getElementById('registerProfilePicture'),
            document.getElementById('registerProfilePreview')
        );

        this.setupProfilePictureUpload(
            document.getElementById('editProfilePicture'),
            document.getElementById('profilePreview')
        );
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const submitLoading = document.getElementById('submitLoading');
        
        submitText.style.display = 'none';
        submitLoading.style.display = 'inline-block';
        submitBtn.disabled = true;
        
        const name = document.getElementById('name').value.trim();
        const age = document.getElementById('age').value;
        const phone = document.getElementById('phone').value.trim();
        const bloodType = document.getElementById('bloodType').value;
        const district = document.getElementById('district').value;
        const city = document.getElementById('city').value.trim();
        const lastDonation = document.getElementById('lastDonation').value;
        
        // Validation
        if (!name || !age || !phone || !district || !city || !lastDonation) {
            showNotification('Please fill in all required fields.', 'error');
            submitText.style.display = 'inline-block';
            submitLoading.style.display = 'none';
            submitBtn.disabled = false;
            return;
        }
        
        if (!document.getElementById('terms').checked) {
            showNotification('Please agree to the terms and conditions.', 'error');
            submitText.style.display = 'inline-block';
            submitLoading.style.display = 'none';
            submitBtn.disabled = false;
            return;
        }
        
        try {
            const profilePictureInput = document.getElementById('registerProfilePicture');
            
            if (profilePictureInput.files[0]) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    // Compress image if it's too large
                    let compressedImage = e.target.result;
                    if (compressedImage.length > 100000) {
                        compressedImage = await this.compressImage(compressedImage);
                    }
                    
                    const newDonor = {
                        name,
                        age: parseInt(age),
                        bloodType,
                        district,
                        city,
                        phone,
                        lastDonation,
                        profilePicture: compressedImage,
                        id: this.dataStorage.generateId(),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    const success = await this.addDonor(newDonor);
                    
                    if (success) {
                        // Register user
                        await this.authManager.registerUser(newDonor);
                        
                        showNotification('🎉 Thank you for registering as a blood donor! Your profile has been created.', 'success');
                        document.getElementById('bloodDonorForm').reset();
                        document.getElementById('registerProfilePreview').innerHTML = '<i class="fas fa-user"></i>';
                        
                        // Switch to profile tab
                        this.switchToTab('profile');
                    } else {
                        showNotification('There was an error saving your information. Please try again.', 'error');
                    }
                    
                    submitText.style.display = 'inline-block';
                    submitLoading.style.display = 'none';
                    submitBtn.disabled = false;
                };
                reader.readAsDataURL(profilePictureInput.files[0]);
            } else {
                const newDonor = {
                    name,
                    age: parseInt(age),
                    bloodType,
                    district,
                    city,
                    phone,
                    lastDonation,
                    id: this.dataStorage.generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                const success = await this.addDonor(newDonor);
                
                if (success) {
                    // Register user
                    await this.authManager.registerUser(newDonor);
                    
                    showNotification('🎉 Thank you for registering as a blood donor! Your profile has been created.', 'success');
                    e.target.reset();
                    document.getElementById('registerProfilePreview').innerHTML = '<i class="fas fa-user"></i>';
                    
                    // Switch to profile tab
                    this.switchToTab('profile');
                } else {
                    showNotification('There was an error saving your information. Please try again.', 'error');
                }
                
                submitText.style.display = 'inline-block';
                submitLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error in form submission:', error);
            showNotification('There was an error saving your information. Please try again.', 'error');
            submitText.style.display = 'inline-block';
            submitLoading.style.display = 'none';
            submitBtn.disabled = false;
        }
    }

    async handleEditFormSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('editId').value;
        const updatedData = {
            name: document.getElementById('editName').value.trim(),
            age: parseInt(document.getElementById('editAge').value),
            phone: document.getElementById('editPhone').value.trim(),
            bloodType: document.getElementById('editBloodType').value,
            district: document.getElementById('editDistrict').value,
            city: document.getElementById('editCity').value.trim(),
            lastDonation: document.getElementById('editLastDonation').value,
            updatedAt: new Date().toISOString()
        };
        
        // Validation
        if (!updatedData.name || !updatedData.age || !updatedData.phone || !updatedData.district || !updatedData.city || !updatedData.lastDonation) {
            showNotification('Please fill in all required fields.', 'error');
            return;
        }
        
        const profilePictureInput = document.getElementById('editProfilePicture');
        if (profilePictureInput.files[0]) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                // Compress image if it's too large
                let compressedImage = e.target.result;
                if (compressedImage.length > 100000) {
                    compressedImage = await this.compressImage(compressedImage);
                }
                
                updatedData.profilePicture = compressedImage;
                const success = await this.updateDonor(id, updatedData);
                if (success) {
                    showNotification('✅ Your information has been updated successfully!', 'success');
                    await this.displayDonors();
                    document.getElementById('editModal').style.display = 'none';
                    
                    // Update user data if it's the current user
                    const currentUser = this.authManager.getCurrentUser();
                    if (currentUser && currentUser.id === id) {
                        const updatedUser = { ...currentUser, ...updatedData };
                        localStorage.setItem('lifeshare-user', JSON.stringify(updatedUser));
                        this.authManager.currentUser = updatedUser;
                    }
                } else {
                    showNotification('Failed to update your information.', 'error');
                }
            };
            reader.readAsDataURL(profilePictureInput.files[0]);
        } else {
            const success = await this.updateDonor(id, updatedData);
            if (success) {
                showNotification('✅ Your information has been updated successfully!', 'success');
                await this.displayDonors();
                document.getElementById('editModal').style.display = 'none';
                
                // Update user data if it's the current user
                const currentUser = this.authManager.getCurrentUser();
                if (currentUser && currentUser.id === id) {
                    const updatedUser = { ...currentUser, ...updatedData };
                    localStorage.setItem('lifeshare-user', JSON.stringify(updatedUser));
                    this.authManager.currentUser = updatedUser;
                }
            } else {
                showNotification('Failed to update your information.', 'error');
            }
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (this.authManager.adminLogin(password)) {
            document.getElementById('adminLoginModal').style.display = 'none';
            this.displayDonors();
            showNotification('Admin login successful!', 'success');
        } else {
            showNotification('Incorrect password.', 'error');
        }
        
        e.target.reset();
    }

    applyFilters() {
        const bloodType = document.getElementById('filterBloodType').value;
        const district = document.getElementById('filterDistrict').value;
        const city = document.getElementById('filterCity').value.toLowerCase();
        const status = document.getElementById('filterStatus').value;
        
        this.filteredDonors = this.donors.filter(donor => {
            const matchesBloodType = !bloodType || donor.bloodType === bloodType;
            const matchesDistrict = !district || donor.district === district;
            const matchesCity = !city || donor.city.toLowerCase().includes(city);
            const matchesStatus = !status || 
                (status === 'eligible' && this.dataStorage.isEligibleToDonate(donor.lastDonation)) ||
                (status === 'not-eligible' && !this.dataStorage.isEligibleToDonate(donor.lastDonation));
            
            return matchesBloodType && matchesDistrict && matchesCity && matchesStatus;
        });
        
        this.displayDonors(this.filteredDonors);
    }

    clearFilters() {
        document.getElementById('filterBloodType').value = '';
        document.getElementById('filterDistrict').value = '';
        document.getElementById('filterCity').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('sortByName').value = 'asc';
        this.currentSort = 'asc';
        this.filteredDonors = [...this.donors];
        this.displayDonors();
    }

    async exportData() {
        const donors = await this.dataStorage.loadDonors();
        const dataStr = JSON.stringify(donors, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `blood-donors-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('Data exported successfully!', 'info');
    }

    async refreshData() {
        showNotification('Refreshing data from cloud...', 'info', 2000);
        await this.loadDonors();
        await this.updateStats();
        showNotification('Data refreshed successfully!', 'success');
    }

    async addDonor(donor) {
        this.donors.push(donor);
        const success = await this.dataStorage.saveDonors(this.donors);
        
        if (success) {
            console.log('✅ Donor added successfully');
            await this.updateStats();
            return true;
        } else {
            console.error('❌ Failed to add donor');
            return false;
        }
    }

    async updateDonor(id, updatedData) {
        const index = this.donors.findIndex(d => d.id === id);
        
        if (index !== -1) {
            this.donors[index] = {
                ...this.donors[index],
                ...updatedData
            };
            
            const success = await this.dataStorage.saveDonors(this.donors);
            return success;
        }
        
        return false;
    }

    async deleteDonor(id) {
        this.donors = this.donors.filter(d => d.id !== id);
        const success = await this.dataStorage.saveDonors(this.donors);
        
        if (success) {
            showNotification('Donor deleted successfully.', 'success');
            document.getElementById('deleteModal').style.display = 'none';
            await this.displayDonors();
            await this.updateStats();
        } else {
            showNotification('Failed to delete donor. Please try again.', 'error');
        }
    }

    openEditModal(donorId) {
        const donor = this.donors.find(d => d.id === donorId);
        
        if (!donor) {
            showNotification('Donor not found.', 'error');
            return;
        }
        
        // Populate form with donor data
        document.getElementById('editId').value = donor.id;
        document.getElementById('editName').value = donor.name || '';
        document.getElementById('editAge').value = donor.age || '';
        document.getElementById('editPhone').value = donor.phone || '';
        document.getElementById('editBloodType').value = donor.bloodType || '';
        document.getElementById('editDistrict').value = donor.district || '';
        document.getElementById('editCity').value = donor.city || '';
        document.getElementById('editLastDonation').value = donor.lastDonation || '';
        
        // Set profile picture preview
        const profilePreview = document.getElementById('profilePreview');
        if (donor.profilePicture) {
            profilePreview.innerHTML = `<img src="${donor.profilePicture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            profilePreview.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        document.getElementById('editModal').style.display = 'flex';
    }

    openDeleteModal(donorId) {
        document.getElementById('deleteModal').style.display = 'flex';
        document.getElementById('confirmDelete').setAttribute('data-id', donorId);
    }

    async loadUserProfile() {
        const user = this.authManager.getCurrentUser();
        if (!user) {
            this.switchToTab('register');
            showNotification('Please register first to view your profile.', 'info');
            return;
        }

        const profileContainer = document.getElementById('profileContainer');
        const eligibility = this.dataStorage.getEligibilityStatus(user.lastDonation);
        const statusClass = eligibility.eligible ? 'status-eligible' : 'status-not-eligible';

        profileContainer.innerHTML = `
            <div class="profile-header">
                <div class="profile-picture-container">
                    ${user.profilePicture ? 
                        `<img src="${user.profilePicture}" class="profile-picture" alt="${user.name}">` :
                        '<div class="profile-picture-placeholder"><i class="fas fa-user"></i></div>'
                    }
                </div>
                <h3>${user.name}</h3>
                <div class="donor-blood">${user.bloodType || 'Unknown'}</div>
                <div class="donor-status ${statusClass} mt-4">
                    <i class="fas ${eligibility.icon}"></i>
                    ${eligibility.message}
                </div>
            </div>

            <div class="profile-details">
                <div class="profile-detail-item">
                    <strong>Personal Information</strong>
                    <div>Age: ${user.age || 'N/A'} years</div>
                    <div>Phone: ${user.phone}</div>
                </div>
                
                <div class="profile-detail-item">
                    <strong>Location</strong>
                    <div>District: ${user.district}</div>
                    <div>City/Area: ${user.city}</div>
                </div>
                
                <div class="profile-detail-item">
                    <strong>Donation History</strong>
                    <div>Last Donation: ${user.lastDonation || 'Never donated'}</div>
                    <div>Registered: ${new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
            </div>

            <div class="text-center">
                <button class="btn" onclick="app.openEditModal('${user.id}')">
                    <i class="fas fa-edit"></i>
                    Edit My Profile
                </button>
            </div>
        `;
    }

    setupProfilePictureUpload(inputElement, previewElement) {
        inputElement.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('Please select an image smaller than 5MB', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewElement.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    compressImage(dataUrl, maxWidth = 150, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = dataUrl;
        });
    }
}

// Cloud Storage Class (Moved outside BloodDonorApp)
class CloudStorage {
    constructor() {
        this.donorsRef = donorsRef;
        this.positionsRef = positionsRef;
    }

    async loadDonors() {
        try {
            console.log('🔄 Loading donors from Firebase...');
            const snapshot = await this.donorsRef.once('value');
            const donorsData = snapshot.val();
            
            let donors = [];
            if (donorsData) {
                // Convert Firebase object to array
                donors = Object.values(donorsData);
                console.log(`✅ Loaded ${donors.length} donors from Firebase`);
            } else {
                console.log('ℹ️ No data found in Firebase, starting fresh');
            }
            
            // Always update localStorage with latest data
            localStorage.setItem('lifeshare-donors', JSON.stringify(donors));
            return donors;
            
        } catch (error) {
            console.error('❌ Firebase load error:', error);
            return this.loadFromLocalStorage();
        }
    }

    async saveDonors(donors) {
        try {
            console.log('💾 Saving donors to Firebase...');
            
            // Convert array to Firebase object format
            const donorsObject = {};
            donors.forEach(donor => {
                if (donor.profilePicture && donor.profilePicture.length > 50000) {
                    // Remove large images for Firebase
                    const { profilePicture, ...donorWithoutImage } = donor;
                    donorsObject[donor.id] = donorWithoutImage;
                } else {
                    donorsObject[donor.id] = donor;
                }
            });
            
            await this.donorsRef.set(donorsObject);
            console.log('✅ Donors saved to Firebase');
            
            // Update localStorage
            localStorage.setItem('lifeshare-donors', JSON.stringify(donors));
            return true;
            
        } catch (error) {
            console.error('❌ Firebase save error:', error);
            return this.saveToLocalStorage(donors);
        }
    }

    async saveDonorPositions(positions) {
        try {
            await this.positionsRef.set(positions);
            console.log('✅ Donor positions saved to Firebase');
            return true;
        } catch (error) {
            console.error('❌ Error saving positions:', error);
            return false;
        }
    }

    async loadDonorPositions() {
        try {
            const snapshot = await this.positionsRef.once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('❌ Error loading positions:', error);
            return {};
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('lifeshare-donors');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return [];
        }
    }

    saveToLocalStorage(donors) {
        try {
            localStorage.setItem('lifeshare-donors', JSON.stringify(donors));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    generateId() {
        return 'donor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    isEligibleToDonate(lastDonationDate) {
        if (!lastDonationDate) return true;
        const lastDonation = new Date(lastDonationDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return lastDonation <= threeMonthsAgo;
    }

    getEligibilityStatus(lastDonationDate) {
        if (!lastDonationDate) {
            return { 
                eligible: true, 
                message: "Eligible to donate now",
                icon: "fa-check-circle"
            };
        }
        
        const lastDonation = new Date(lastDonationDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        if (lastDonation <= threeMonthsAgo) {
            return { 
                eligible: true, 
                message: "Eligible to donate now",
                icon: "fa-check-circle"
            };
        } else {
            const nextDonationDate = new Date(lastDonation);
            nextDonationDate.setMonth(lastDonation.getMonth() + 3);
            const daysLeft = Math.ceil((nextDonationDate - new Date()) / (1000 * 60 * 60 * 24));
            return { 
                eligible: false, 
                message: `Not eligible yet (${daysLeft} days remaining)`,
                icon: "fa-times-circle"
            };
        }
    }

    getStats(donors) {
        const total = donors.length;
        const eligible = donors.filter(d => this.isEligibleToDonate(d.lastDonation)).length;
        const universal = donors.filter(d => d.bloodType === "O-").length;
        const recent = donors.filter(d => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(d.createdAt) >= weekAgo;
        }).length;

        return { total, eligible, universal, recent };
    }
}

// Notification function
function showNotification(message, type = 'success', duration = 4000) {
    const notification = document.getElementById('notification');
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Initialize the application
const app = new BloodDonorApp();

// Make app globally available for onclick handlers
window.app = app;
