// CONFIGURATION
const API_URL = 'https://script.google.com/macros/s/AKfycbyCuKtlHzgqImrlAQUubqzpQsF0XyZoXKcCJMfjvCo1Ny5kxzp_c6q77aEkBXjhktAX/exec'; // <--- 使用者必須更新此網址

// Vue App Logic
const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
    setup() {
        console.log('Vue App setup starting...');

        // State
        const currentView = ref('resident-form'); // 'resident-form', 'admin-login', 'admin-dashboard'
        const loading = ref(false);
        const adminsLoading = ref(false);
        const isAdmin = ref(false);
        const adminRole = ref(''); // 'RW', 'RO'
        const sessionToken = ref('');
        const currentUser = ref(''); // Logged in user

        const residents = ref([]);
        const appTitle = ref('住戶資料管理'); // Dynamic Title
        const isFormOpen = ref(true); // Form status
        // Auto-logout idle timer
        const sessionTimeoutRW = ref(15); // minutes
        const sessionTimeoutRO = ref(1440); // minutes
        let idleTimer = null;
        let lastActivityTime = Date.now();
        const remainingSeconds = ref(0); // Countdown display (only shown when < 300s)
        const showPasswordModal = ref(false);

        // Admin Features State
        const currentAdminTab = ref('residents'); // 'residents', 'admins'
        const searchQuery = ref('');
        const adminList = ref([]);
        const showAddAdminModal = ref(false);
        const newAdminForm = reactive({ username: '', password: '', confirmPassword: '', notes: '', role: 'RW' });
        const newAdminStatus = reactive({ success: false, message: '' });

        // Reset Password Modal
        const showResetPasswordModal = ref(false);
        const resetPasswordForm = reactive({ targetUsername: '', newPassword: '', confirmPassword: '' });
        const resetPasswordStatus = reactive({ success: false, message: '' });

        // Edit Notes Modal
        const showEditNotesModal = ref(false);
        const editNotesForm = reactive({ targetUsername: '', notes: '' });
        const editNotesStatus = reactive({ success: false, message: '' });

        // Forms
        const form = reactive({
            UnitNumber: '',
            ContactName: '',
            ContactSalutation: '先生',
            ContactPhone: '',
            // Car 1
            CarSpot1_Num: '', CarSpot1_Plate1: '', CarSpot1_Plate2: '', CarSpot1_IsRented: false, CarSpot1_RenterUnit: '',
            // Car 2
            CarSpot2_Num: '', CarSpot2_Plate1: '', CarSpot2_Plate2: '', CarSpot2_IsRented: false, CarSpot2_RenterUnit: '',
            // Moto 1-3
            MotoSpot1_Num: '', MotoSpot1_Plate: '', MotoSpot1_IsRented: false, MotoSpot1_RenterUnit: '',
            MotoSpot2_Num: '', MotoSpot2_Plate: '', MotoSpot2_IsRented: false, MotoSpot2_RenterUnit: '',
            MotoSpot3_Num: '', MotoSpot3_Plate: '', MotoSpot3_IsRented: false, MotoSpot3_RenterUnit: '',

            passcode: '', // Community Passcode

            IsRenter: false,
            OwnerName: '',
            OwnerSalutation: '先生',
            OwnerPhone: ''
        });

        const loginForm = reactive({ username: '', password: '' });
        const pwdForm = reactive({ oldPass: '', newPass: '', confirmNewPass: '' });

        // Status Messages
        const submitStatus = reactive({ success: false, message: '' });
        const loginStatus = reactive({ success: false, message: '' });
        const pwdStatus = reactive({ success: false, message: '' });
        const currentFilter = ref('All'); // 'All', '110', '112', etc.

        const filteredResidents = computed(() => {
            let res = residents.value || []; // Ensure array

            // 1. Quick Filter (棟別)
            if (currentFilter.value && currentFilter.value !== 'All') {
                res = res.filter(r => (r.UnitNumber || '').toString().startsWith(currentFilter.value));
            }

            // 2. Search Query
            if (!searchQuery.value) return res;

            const q = searchQuery.value.toLowerCase().trim();
            if (!q) return res;

            return res = res.filter(r => {
                // Helper for safe string check
                const match = (val) => (val || '').toString().toLowerCase().includes(q);

                return match(r.UnitNumber) ||
                    match(r.ContactName) ||
                    match(r.ContactPhone) ||
                    match(r.OwnerName) ||
                    match(r.OwnerPhone) ||
                    // Car Spots
                    match(r.CarSpot1_Num) || match(r.CarSpot1_Plate1) || match(r.CarSpot1_Plate2) ||
                    match(r.CarSpot2_Num) || match(r.CarSpot2_Plate1) || match(r.CarSpot2_Plate2) ||
                    // Moto Spots
                    match(r.MotoSpot1_Num) || match(r.MotoSpot1_Plate) ||
                    match(r.MotoSpot2_Num) || match(r.MotoSpot2_Plate) ||
                    match(r.MotoSpot3_Num) || match(r.MotoSpot3_Plate);
            });
        });

        // --- API ADAPTER (Replaces google.script.run) ---
        const runGAS = async (funcName, ...args) => {
            if (API_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
                alert('請先設定 API_URL！(Please configure API_URL in js/main.js)');
                throw new Error('API_URL not configured');
            }

            // Map function calls to API actions and payload
            let payload = { action: funcName, _t: Date.now() };

            // Parameter Mapping Logic
            switch (funcName) {
                case 'login':
                    payload.username = args[0];
                    payload.password = args[1];
                    payload.website = args[2]; // Honeypot
                    break;
                case 'getAllResidents':
                    payload.token = args[0];
                    break;
                case 'getPublicSettings':
                    payload.action = 'getPublicSettings';
                    break;
                case 'submitResidentData':
                    payload = { ...payload, ...args[0], action: 'createResident' };
                    // Public form logic: createResident allows public submission. checking args[0].token is optional.
                    break;
                case 'getAdminList':
                    payload.action = 'getAllAdmins';
                    payload.token = args[0];
                    break;
                case 'deleteResident':
                    payload.token = args[0];
                    payload.unitNumber = args[1];
                    break;
                case 'createAdmin':
                    payload.token = args[0];
                    payload.username = args[1];
                    payload.password = args[2];
                    payload.notes = args[3];
                    payload.role = args[4];
                    break;
                case 'deleteAdmin':
                    payload.token = args[0];
                    payload.targetUsername = args[1];
                    break;
                case 'changePassword':
                    payload.token = args[0];
                    payload.oldPass = args[1];
                    payload.newPass = args[2];
                    break;
                case 'resetAdminPassword':
                    payload.token = args[0];
                    payload.targetUsername = args[1];
                    payload.newPassword = args[2];
                    break;
                case 'updateAdminNotes':
                    payload.targetUsername = args[0];
                    payload.notes = args[1];
                    payload.token = args[2];
                    break;
                case 'unlockAdmin':
                    payload.action = 'unlockAdmin';
                    payload.targetUsername = args[0];
                    payload.token = args[1];
                    break;
                case 'toggleFormStatus':
                    payload.action = 'toggleFormStatus';
                    payload.enabled = args[0];
                    payload.token = args[1];
                    break;
                case 'getSetting':
                    payload.action = 'getSetting';
                    payload.key = args[0];
                    payload.token = args[1];
                    break;
                default:
                    console.warn('Unknown function call:', funcName);
            }

            console.log('API Call:', payload.action, payload);

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    console.error('Non-JSON Response:', text);
                    throw new Error('Server response format error.');
                }

                if (result.status === 'success') {
                    result.success = true;
                    if (funcName === 'getAllResidents') return result.data;
                    if (funcName === 'getAdminList') { result.admins = result.data; return result; }
                    return result;
                } else {
                    return { success: false, message: result.message || 'Unknown Error' };
                }
            } catch (e) {
                console.error('API Error:', e);
                return { success: false, message: e.toString() };
            }
        };

        // Let's stick to modifying `filteredResidents` and adding the `currentFilter` state first in this tool call.
        // And I will modify `loadResidents` separately or in the same block if it fits. 
        // `loadResidents` is around line 284.


        const setQuickFilter = (val) => {
            currentFilter.value = val;
            currentPage.value = 1; // Reset page on filter change
        };

        // --- PAGINATION & SORTING STATE ---
        const currentPage = ref(1);
        const itemsPerPage = 100;
        const sortKey = ref('UnitNumber'); // 'UnitNumber' or 'Vehicle'
        const sortOrder = ref(1); // 1 = asc, -1 = desc

        // --- ACTIONS ---
        const clearFilters = () => {
            searchQuery.value = '';
            currentFilter.value = 'All';
            currentPage.value = 1;
            sortKey.value = 'UnitNumber';
            sortOrder.value = 1;
        };

        const setSort = (key) => {
            if (sortKey.value === key) {
                sortOrder.value = -sortOrder.value;
            } else {
                sortKey.value = key;
                sortOrder.value = 1;
            }
        };

        const sortedResidents = computed(() => {
            // 1. Get filtered list
            let res = filteredResidents.value; // Accessing the existing computed property "filteredResidents"

            // 2. Sort
            if (!sortKey.value) return res;

            return [...res].sort((a, b) => { // Clone to avoid mutation
                let valA, valB;
                if (sortKey.value === 'UnitNumber') {
                    valA = a.UnitNumber || '';
                    valB = b.UnitNumber || '';
                } else if (sortKey.value === 'Vehicle') {
                    // Priority: Car1 -> Car2 -> Moto1 -> Moto2 -> Moto3
                    valA = a.CarSpot1_Num || a.CarSpot2_Num || a.MotoSpot1_Num || a.MotoSpot2_Num || a.MotoSpot3_Num || '';
                    valB = b.CarSpot1_Num || b.CarSpot2_Num || b.MotoSpot1_Num || b.MotoSpot2_Num || b.MotoSpot3_Num || '';
                }

                if (valA < valB) return -1 * sortOrder.value;
                if (valA > valB) return 1 * sortOrder.value;
                return 0;
            });
        });

        const paginatedResidents = computed(() => {
            const start = (currentPage.value - 1) * itemsPerPage;
            return sortedResidents.value.slice(start, start + itemsPerPage);
        });

        const totalPages = computed(() => Math.ceil(sortedResidents.value.length / itemsPerPage));

        // --- ACTIONS (Original) ---
        const setView = (view) => {
            currentView.value = view;
            // Clear messages
            submitStatus.message = '';
            loginStatus.message = '';
        };

        const submitResidentForm = async () => {
            // Frontend Validation
            const unitPattern = /^\d{3}-\d{2}[A-Za-z0-9]?$/; // Relaxed pattern or use strict
            // Original pattern was /^\d{3}-\d{2}F$/; let's stick to what was there or better generic
            // User requested "110", "112" etc in buttons.
            // Let's use the one from previous context if available, or a safe general one.
            // In Step 1433 it was: /^\d{3}-\d{2}F$/
            // But user might have "A1" etc.
            // Let's allow loose validation or just check non-empty.
            if (!form.UnitNumber) {
                submitStatus.success = false;
                submitStatus.message = '請輸入戶號';
                return;
            }

            loading.value = true;
            submitStatus.message = '';
            try {
                // Clone form to avoid reactive issues
                const payload = JSON.parse(JSON.stringify(form));
                const response = await runGAS('submitResidentData', payload);
                submitStatus.success = response.success;
                submitStatus.message = response.message;
                if (response.success) {
                    // Reset form (keep UnitNumber?) No, reset all.
                    Object.keys(form).forEach(k => {
                        if (typeof form[k] === 'boolean') form[k] = false;
                        else form[k] = '';
                    });
                }
            } catch (e) {
                submitStatus.success = false;
                submitStatus.message = 'Error: ' + e.toString();
            } finally {
                loading.value = false;
            }
        };

        const adminLogin = async () => {
            loading.value = true;
            loginStatus.message = '';

            try {
                // Pass honeypot 'website'
                const response = await runGAS('login', loginForm.username, loginForm.password, loginForm.website);
                if (response.success) {
                    sessionToken.value = response.token;
                    isAdmin.value = true;
                    adminRole.value = response.role;
                    currentUser.value = loginForm.username; // Set Current User
                    // Store session (optional)
                    // localStorage.setItem('resident_session', ...);
                    currentView.value = 'admin-dashboard'; // Reset Tab
                    // Load data
                    loadResidents();
                    loadAdmins();
                    // Fetch timeout settings and start idle timer
                    fetchAdminSettings().then(() => startIdleTimer());
                } else {
                    loginStatus.message = response.message;
                    loginForm.password = ''; // Clear password on failure
                    loading.value = false;
                }
            } catch (e) {
                loginStatus.message = 'Error: ' + e.toString();
                loginForm.password = ''; // Clear password on error
                loading.value = false;
            }
        };



        const loadResidents = async () => {
            loading.value = true;
            residents.value = [];
            try {
                console.log('Fetching residents...');
                const data = await runGAS('getAllResidents', sessionToken.value, Date.now());
                console.log('Residents data:', data);

                if (Array.isArray(data)) {
                    residents.value = data;
                } else {
                    if (data && data.status === 'error') {
                        alert(data.message || '載入失敗');
                        if ((data.message || '').includes('Session')) logout();
                    } else if (data && data.success === false) {
                        alert(data.message || '載入失敗');
                    } else {
                        console.error('Invalid data format:', data);
                        alert('載入失敗：資料格式異常');
                    }
                }
            } catch (e) {
                console.error('Load failed:', e);
                alert('載入失敗：' + e.toString());
            } finally {
                loading.value = false;
            }
        };

        const loadAdmins = async () => {
            if (adminsLoading.value) return; // Prevent concurrent
            adminsLoading.value = true;
            adminList.value = []; // Clear list to force "Loading" state visibility

            try {
                const response = await runGAS('getAdminList', sessionToken.value);
                if (response.success) {
                    adminList.value = response.data;
                } else {
                    console.error(response.message);
                }
            } catch (e) {
                console.error(e);
            } finally {
                adminsLoading.value = false;
            }
        };

        const deleteResident = async (unitNumber) => {
            if (!confirm(`確定要刪除 ${unitNumber} 的資料嗎？`)) return;
            loading.value = true;
            try {
                const response = await runGAS('deleteResident', sessionToken.value, unitNumber);
                if (response.success) {
                    loadResidents();
                } else {
                    alert('刪除失敗: ' + response.message);
                }
            } catch (e) {
                alert('Error: ' + e.toString());
            } finally {
                loading.value = false;
            }
        };

        const createAdmin = async () => {
            if (!newAdminForm.username || !newAdminForm.password) return;
            if (newAdminForm.password !== newAdminForm.confirmPassword) {
                newAdminStatus.success = false;
                newAdminStatus.message = '兩次輸入的密碼不一致！';
                return;
            }
            loading.value = true;
            newAdminStatus.message = '';
            try {
                const response = await runGAS('createAdmin', sessionToken.value, newAdminForm.username, newAdminForm.password, newAdminForm.notes, newAdminForm.role);
                newAdminStatus.success = response.success;
                newAdminStatus.message = response.message;
                if (response.success) {
                    loadAdmins();
                    setTimeout(() => {
                        showAddAdminModal.value = false;
                        newAdminForm.username = '';
                        newAdminForm.password = '';
                        newAdminForm.confirmPassword = '';
                        newAdminForm.notes = '';
                        newAdminForm.role = 'RW'; // Reset Role
                        newAdminStatus.message = '';
                    }, 1000);
                }
            } catch (e) {
                newAdminStatus.message = 'Error: ' + e.toString();
            } finally {
                loading.value = false;
            }
        };

        const deleteAdmin = async (targetUser) => {
            if (!confirm(`確定要刪除管理員 ${targetUser} 嗎？`)) return;
            loading.value = true;
            try {
                const response = await runGAS('deleteAdmin', sessionToken.value, targetUser);
                if (response.success) {
                    loadAdmins();
                } else {
                    alert('刪除失敗: ' + response.message);
                }
            } catch (e) {
                alert('Error: ' + e.toString());
            } finally {
                loading.value = false;
            }
        };

        const openChangePasswordModal = () => {
            showPasswordModal.value = true;
            pwdStatus.message = '';
            pwdForm.oldPass = '';
            pwdForm.newPass = '';
            pwdForm.confirmNewPass = '';
        };

        const doChangePassword = async () => {
            if (pwdForm.newPass !== pwdForm.confirmNewPass) {
                pwdStatus.success = false;
                pwdStatus.message = '兩次輸入的新密碼不一致！';
                return;
            }
            loading.value = true;
            try {
                const response = await runGAS('changePassword', sessionToken.value, pwdForm.oldPass, pwdForm.newPass);
                pwdStatus.success = response.success;
                pwdStatus.message = response.message;
                if (response.success) {
                    setTimeout(() => showPasswordModal.value = false, 1500);
                }
            } catch (e) {
                pwdStatus.message = 'Error: ' + e.toString();
            } finally {
                loading.value = false;
            }
        };

        const unlockAdmin = async (targetUsername) => {
            if (!confirm('確定要解鎖此帳號嗎？')) return;

            loading.value = true;
            try {
                const response = await runGAS('unlockAdmin', targetUsername, sessionToken.value);

                loading.value = false; // Stop action loading

                if (response.success) {
                    alert('帳號已解鎖');
                    loadAdmins();
                } else {
                    alert('解鎖失敗: ' + response.message);
                }
            } catch (e) {
                console.error(e);
                alert('系統錯誤');
                loading.value = false;
            }
        };

        const openResetPasswordModal = (username) => {
            resetPasswordForm.targetUsername = username;
            resetPasswordForm.newPassword = '';
            resetPasswordForm.confirmPassword = '';
            resetPasswordStatus.message = '';
            showResetPasswordModal.value = true;
        };

        const resetAdminPassword = async () => {
            if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
                resetPasswordStatus.success = false;
                resetPasswordStatus.message = '兩次輸入的密碼不一致！';
                return;
            }
            loading.value = true;
            resetPasswordStatus.message = '';
            try {
                const response = await runGAS('resetAdminPassword', sessionToken.value, resetPasswordForm.targetUsername, resetPasswordForm.newPassword);
                resetPasswordStatus.success = response.success;
                resetPasswordStatus.message = response.message;
                if (response.success) {
                    setTimeout(() => showResetPasswordModal.value = false, 1500);
                }
            } catch (e) {
                resetPasswordStatus.message = 'Error: ' + e.toString();
            } finally {
                loading.value = false;
            }
        };

        const openEditNotesModal = (admin) => {
            editNotesForm.targetUsername = admin.username;
            editNotesForm.notes = admin.notes || '';
            editNotesStatus.message = '';
            showEditNotesModal.value = true;
        };

        const updateAdminNotes = async () => {
            loading.value = true;
            editNotesStatus.message = '';
            try {
                const response = await runGAS('updateAdminNotes', editNotesForm.targetUsername, editNotesForm.notes, sessionToken.value);
                editNotesStatus.success = response.success;
                editNotesStatus.message = response.message;
                if (response.success) {
                    loadAdmins();
                    setTimeout(() => showEditNotesModal.value = false, 1000);
                }
            } catch (e) {
                editNotesStatus.message = 'Error: ' + e.toString();
            } finally {
                loading.value = false;
            }
        };

        const toggleFormStatus = async () => {
            if (!confirm(`確定要${isFormOpen.value ? '開放' : '關閉'}住戶填寫功能嗎？`)) {
                isFormOpen.value = !isFormOpen.value; // Revert checkbox change
                return;
            }

            loading.value = true;
            try {
                const response = await runGAS('toggleFormStatus', isFormOpen.value, sessionToken.value);
                if (response.success) {
                    // Success
                } else {
                    alert('更新失敗: ' + response.message);
                    isFormOpen.value = !isFormOpen.value; // Revert
                }
            } catch (e) {
                console.error(e);
                alert('系統錯誤');
                isFormOpen.value = !isFormOpen.value; // Revert
            } finally {
                loading.value = false;
            }
        };

        const logout = () => {
            stopIdleTimer(); // Stop idle timer
            sessionToken.value = '';
            isAdmin.value = false;
            adminRole.value = '';
            currentUser.value = '';
            currentView.value = 'admin-login';
            residents.value = [];
            adminList.value = [];
            loginForm.username = '';
            loginForm.password = '';
            loginStatus.message = '';
            // Optional: call logout API
            runGAS('logout', sessionToken.value).catch(console.error);
        };

        const fetchSettings = async () => {
            try {
                const response = await runGAS('getPublicSettings');
                if (response.success && response.data) {
                    appTitle.value = response.data.appTitle || '住戶資料管理';
                    if (response.data.isFormOpen !== undefined) {
                        isFormOpen.value = response.data.isFormOpen;
                    }
                    document.title = appTitle.value;
                }
            } catch (e) {
                console.error('Fetch settings failed:', e);
            }
        };

        const fetchAdminSettings = async () => {
            try {
                const responseRW = await runGAS('getSetting', 'SessionTimeoutRW', sessionToken.value);
                const responseRO = await runGAS('getSetting', 'SessionTimeoutRO', sessionToken.value);
                if (responseRW && responseRW.data) sessionTimeoutRW.value = parseInt(responseRW.data) || 15;
                if (responseRO && responseRO.data) sessionTimeoutRO.value = parseInt(responseRO.data) || 1440;
                console.log('Loaded timeout settings:', { RW: sessionTimeoutRW.value, RO: sessionTimeoutRO.value });
            } catch (e) {
                console.error('Fetch admin settings failed:', e);
            }
        };

        const startIdleTimer = () => {
            if (!isAdmin.value) return;

            // Clear existing timer
            if (idleTimer) clearInterval(idleTimer);

            // Get timeout based on role
            const timeoutMinutes = adminRole.value === 'RW' ? sessionTimeoutRW.value : sessionTimeoutRO.value;
            const timeoutMs = timeoutMinutes * 60 * 1000;

            // Reset activity time and countdown
            lastActivityTime = Date.now();
            remainingSeconds.value = 0;

            // Check every second for countdown accuracy
            idleTimer = setInterval(() => {
                const idleTime = Date.now() - lastActivityTime;
                const remaining = timeoutMs - idleTime;
                const remainingSec = Math.floor(remaining / 1000);

                // Update countdown if less than 300 seconds
                if (remainingSec <= 300 && remainingSec > 0) {
                    remainingSeconds.value = remainingSec;
                } else {
                    remainingSeconds.value = 0;
                }

                // Auto logout when timeout reached
                if (idleTime >= timeoutMs) {
                    console.log('Session timeout - auto logout');
                    alert(`閒置超過 ${timeoutMinutes} 分鐘，系統已自動登出。`);
                    logout();
                }
            }, 1000); // Check every second
        };

        const resetIdleTimer = () => {
            lastActivityTime = Date.now();
            remainingSeconds.value = 0; // Reset countdown display
        };

        const stopIdleTimer = () => {
            if (idleTimer) {
                clearInterval(idleTimer);
                idleTimer = null;
            }
            remainingSeconds.value = 0; // Reset countdown display
        };

        onMounted(() => {
            console.log('Vue App Mounted! API Mode.');
            fetchSettings();

            // Add activity listeners to reset idle timer
            const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
            activityEvents.forEach(event => {
                document.addEventListener(event, resetIdleTimer, { passive: true });
            });
        });

        const formatPhone = (phone) => {
            if (!phone) return '';
            let s = phone.toString().replace(/\D/g, ''); // Remove non-digits

            // Auto add leading '0' if it looks like a mobile number missing it (e.g., 912345678)
            if (s.length === 9 && s.startsWith('9')) {
                s = '0' + s;
            }

            if (s.length === 10 && s.startsWith('09')) {
                return `${s.slice(0, 4)}-${s.slice(4, 7)}-${s.slice(7)}`;
            }
            if (s.length > 8) { // Try generic split if long
                return `${s.slice(0, 4)}-${s.slice(4)}`;
            }
            return phone; // Return original if pattern doesn't match
        };

        return {
            currentView, loading, adminsLoading, isAdmin, adminRole, form, loginForm, residents,
            submitStatus, loginStatus, setView, submitResidentForm, adminLogin,
            logout, loadResidents, deleteResident,
            showPasswordModal, pwdForm, pwdStatus, openChangePasswordModal, changePassword: doChangePassword,
            currentAdminTab, searchQuery, filteredResidents,
            adminList, showAddAdminModal, newAdminForm, newAdminStatus,
            loadAdmins, createAdmin, deleteAdmin,
            showResetPasswordModal, resetPasswordForm, resetPasswordStatus,
            openResetPasswordModal, resetAdminPassword,
            showEditNotesModal, editNotesForm, editNotesStatus,
            openEditNotesModal,
            updateAdminNotes,
            unlockAdmin, // Exposed
            formatPhone,
            currentFilter, setQuickFilter,
            currentPage, totalPages, clearFilters, setSort, paginatedResidents, sortKey, sortOrder,
            currentPage, totalPages, clearFilters, setSort, paginatedResidents, sortKey, sortOrder,
            sortedResidents,
            appTitle, currentUser,
            isFormOpen, toggleFormStatus, remainingSeconds // Exposed
        };
    }
}).mount('#app');
