"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements
    const storeTableBody = document.getElementById("storeTableBody");
    const addStoreBtn = document.getElementById("addStoreBtn");
    const statusFilterSelect = document.getElementById("statusFilter");
    const noStoresMessage = document.getElementById("noStoresMessage");
    const storesTable = document.getElementById("storesTable"); // Get table for sorting

    // Store Form Modal Elements
    const storeFormModal = document.getElementById("storeFormModal");
    const closeStoreModal = document.getElementById("closeStoreModal");
    const storeForm = document.getElementById("storeForm"); // Combined form ID
    const modalTitle = document.getElementById("modalTitle");
    const storeIdInput = document.getElementById("storeId");
    const managerIdSelect = document.getElementById("managerId"); // Now a select
    const formError = document.getElementById("formError");
    const saveStoreBtn = document.getElementById("saveStoreBtn");
    const cancelStoreFormBtn = document.getElementById("cancelStoreForm");

    // Delete Modal Elements
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    const deleteError = document.getElementById("deleteError");

    // Toast Notification
    const toastNotification = document.getElementById("toastNotification");

    // State
    let allStoresData = []; // Cache for client-side sort
    let managerList = []; // Cache manager data
    let storeToDeleteId = null;
    let currentFilterStatus = 'active'; // Default filter
    let currentSortColumn = 'store_id';
    let currentSortDirection = 'asc';

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const isJson = response.headers.get('content-type')?.includes('application/json');
            if (!response.ok) {
                let errorData = { detail: `HTTP error! Status: ${response.status}` };
                if (isJson) try { errorData = await response.json(); } catch (e) { /* ignore */ }
                console.error(`Error fetching ${endpoint}: ${response.status}`, errorData);
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }
            if (response.status === 204) return null;
            if (isJson) return await response.json();
            return await response.text();
        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error;
        }
    }

    function showToast(message, type = 'info') {
        toastNotification.textContent = message;
        toastNotification.className = `toast show ${type}`;
        setTimeout(() => { toastNotification.className = 'toast'; }, 3000);
    }

     function showLoading(colSpan) {
         if(storeTableBody) storeTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="loading-text">Loading stores...</td></tr>`;
         if(noStoresMessage) noStoresMessage.style.display = 'none';
     }

     function showNoStoresMessage() {
         if(storeTableBody) storeTableBody.innerHTML = '';
         if(noStoresMessage) noStoresMessage.style.display = 'block';
     }

     function hideNoStoresMessage() {
          if(noStoresMessage) noStoresMessage.style.display = 'none';
     }

     function displayFormError(errorElement, message) {
        if (errorElement) { errorElement.textContent = message; errorElement.style.display = 'block'; }
     }

     function clearFormError(errorElement) {
          if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
     }

    function formatDate(dateString) {
        if (!dateString) return "-";
        try {
            return new Date(dateString).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
        } catch (e) {
            return dateString; // Return original if parsing fails
        }
    }


    // --- Manager List Handling ---
    async function loadManagers() {
        try {
             // Fetch only active managers
             const staff = await fetchData("/staff/?status=active"); // Assuming backend supports status filter
             if (!staff) return;

             managerList = staff.filter(s => s.is_manager); // Filter for managers client-side OR modify backend

             // Populate dropdown
             managerIdSelect.innerHTML = '<option value="">-- Select Manager --</option>'; // Clear existing
             managerList.forEach(manager => {
                 const option = document.createElement('option');
                 option.value = manager.staff_id;
                 option.textContent = `${manager.full_name} (ID: ${manager.staff_id})`;
                 managerIdSelect.appendChild(option);
             });
         } catch (error) {
             console.error("Error loading managers:", error);
             showToast("Could not load manager list.", "error");
             managerIdSelect.innerHTML = '<option value="">-- Error Loading --</option>';
         }
    }

    function getManagerName(managerId) {
         if (!managerId) return 'N/A';
         const manager = managerList.find(m => m.staff_id == managerId);
         return manager ? manager.full_name : `ID: ${managerId}`; // Show ID if name not found
    }


    // --- Store Data Handling ---
    async function loadStores(status = 'active') {
        showLoading(8); // 8 columns
        currentFilterStatus = status;
        try {
            const url = status ? `/stores/?status=${status}` : "/stores/"; // Assumes backend supports status filter
            allStoresData = await fetchData(url);
            if (!allStoresData) allStoresData = [];
            sortAndRenderStores(allStoresData); // Apply sorting
        } catch (error) {
            showToast(`Error loading stores: ${error.message}`, 'error');
            showNoStoresMessage();
        }
    }

    // --- Sorting ---
    function sortAndRenderStores(dataToSort) {
         const sortedData = [...dataToSort].sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Basic type handling (add more if needed)
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
             if (currentSortColumn === 'store_id' || currentSortColumn === 'manager_id') {
                 valA = parseInt(valA || 0);
                 valB = parseInt(valB || 0);
             }

            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;

            return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
        });
        renderStoreTable(sortedData);
        updateSortIcons();
    }

     function updateSortIcons() {
        storesTable.querySelectorAll('thead th[data-column]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.innerHTML = '';

            if (th.dataset.column === currentSortColumn) {
                if (currentSortDirection === 'asc') {
                    th.classList.add('sort-asc');
                    if(icon) icon.innerHTML = '▲'; // Up
                } else if (currentSortDirection === 'desc') {
                    th.classList.add('sort-desc');
                     if(icon) icon.innerHTML = '▼'; // Down
                }
            }
        });
    }

    // Function to render store table rows
    function renderStoreTable(stores) {
        if(!storeTableBody) return;
        storeTableBody.innerHTML = "";

        if (!stores || stores.length === 0) {
            showNoStoresMessage();
            return;
        }
        hideNoStoresMessage();

        stores.forEach(store => {
            const statusClass = store.status === 'active' ? 'status-active' : 'status-inactive';
            const managerName = getManagerName(store.manager_id); // Get manager name

            const tr = document.createElement("tr");
            tr.dataset.storeId = store.store_id; // Store ID on row
            tr.innerHTML = `
                <td>#${store.store_id}</td>
                <td>${store.store_name}</td>
                <td>${store.city || '-'}</td>
                <td>${store.state || '-'}</td>
                <td>${store.contact_number || '-'}</td>
                <td>${managerName}</td>
                <td><span class="status-badge ${statusClass}">${store.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-icon edit" title="Edit Store">
                            <ion-icon name="create-outline"></ion-icon>
                        </button>
                        <button class="action-btn-icon delete" title="Delete Store">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </td>
            `;
            storeTableBody.appendChild(tr);
        });
        attachStoreActions(); // Attach listeners for the new buttons
    }

    // --- Event Listeners ---

    // Filter change
    statusFilterSelect.addEventListener('change', (e) => {
        loadStores(e.target.value);
    });

    // Sorting
     storesTable.querySelectorAll('thead th[data-column]').forEach(th => {
         th.addEventListener('click', () => {
             const column = th.dataset.column;
             if (currentSortColumn === column) {
                 currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
             } else {
                 currentSortColumn = column;
                 currentSortDirection = 'asc';
             }
             sortAndRenderStores(allStoresData); // Sort current data
         });
     });

    // "Add Store" button opens modal in 'Add' mode
    addStoreBtn.addEventListener("click", () => {
        openStoreModal(); // Open in Add mode
    });

    // --- Modal Handling ---
    async function openStoreModal(storeId = null) {
        clearFormError(formError);
        storeForm.reset(); // Clear form fields
        storeIdInput.value = storeId || ''; // Set or clear hidden ID
        managerIdSelect.disabled = false; // Enable manager select by default

        // Ensure manager list is loaded (might already be cached)
        if (managerList.length === 0) {
            await loadManagers(); // Load if not already loaded
        } else {
             // Ensure dropdown is populated even if list was cached
            managerIdSelect.innerHTML = '<option value="">-- Select Manager --</option>';
            managerList.forEach(manager => {
                 const option = document.createElement('option');
                 option.value = manager.staff_id;
                 option.textContent = `${manager.full_name} (ID: ${manager.staff_id})`;
                 managerIdSelect.appendChild(option);
             });
        }


        if (storeId) {
            // --- EDIT MODE ---
            modalTitle.textContent = "Edit Store";
            // Fetch fresh data for the specific store being edited
            try {
                 const store = await fetchData(`/stores/${storeId}`);
                 if (!store) {
                     showToast("Could not load store details.", "error");
                     return;
                 }
                // Pre-fill form
                document.getElementById("storeName").value = store.store_name || '';
                document.getElementById("contactNumber").value = store.contact_number || '';
                document.getElementById("street").value = store.street || '';
                document.getElementById("city").value = store.city || '';
                document.getElementById("state").value = store.state || '';
                document.getElementById("zipCode").value = store.zip_code || '';
                 // Set manager dropdown - check if the manager exists in the current list
                 if (store.manager_id && managerIdSelect.querySelector(`option[value="${store.manager_id}"]`)) {
                      managerIdSelect.value = store.manager_id;
                  } else if (store.manager_id) {
                     // Manager might be inactive or deleted, show ID but disable changing?
                      const option = document.createElement('option');
                      option.value = store.manager_id;
                      option.textContent = `Manager ID: ${store.manager_id} (Inactive/Unknown)`;
                      option.disabled = true; // Prevent selection if not in active list
                      managerIdSelect.appendChild(option);
                      managerIdSelect.value = store.manager_id;
                     // Or maybe disable the field entirely: managerIdSelect.disabled = true;
                  } else {
                      managerIdSelect.value = ""; // No manager assigned
                  }
                document.getElementById("status").value = store.status || 'active';

             } catch (error) {
                 showToast(`Error fetching store details: ${error.message}`, "error");
                 return; // Don't open modal if data fetch fails
             }

        } else {
            // --- ADD MODE ---
            modalTitle.textContent = "Add New Store";
            // Ensure default status is selected
            document.getElementById("status").value = 'active';
        }
        storeFormModal.style.display = "block";
    }

    // Close modal logic
    closeStoreModal.addEventListener("click", () => storeFormModal.style.display = "none");
    cancelStoreFormBtn.addEventListener("click", () => storeFormModal.style.display = "none");
    window.addEventListener("click", (event) => {
        if (event.target == storeFormModal) storeFormModal.style.display = "none";
        if (event.target == deleteConfirmModal) deleteConfirmModal.style.display = "none";
    });

    // Handle Add/Edit form submission
    storeForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        clearFormError(formError);

        const isUpdate = !!storeIdInput.value;
        const storeId = storeIdInput.value;
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate ? `/stores/${storeId}` : "/stores/";

        saveStoreBtn.disabled = true;
        saveStoreBtn.textContent = isUpdate ? "Saving Changes..." : "Adding Store...";

        // Collect form data
        const formData = new FormData(storeForm);
        const payload = {
             store_name: formData.get('store_name'),
             street: formData.get('street') || null,
             city: formData.get('city') || null,
             state: formData.get('state') || null,
             zip_code: formData.get('zip_code') || null,
             contact_number: formData.get('contact_number') || null,
             manager_id: formData.get('manager_id') ? parseInt(formData.get('manager_id'), 10) : null,
             status: formData.get('status')
        };

        // Basic Validation
        if (!payload.store_name) {
            displayFormError(formError, "Store Name is required.");
            saveStoreBtn.disabled = false;
            saveStoreBtn.textContent = isUpdate ? "Save Changes" : "Save Store";
            return;
        }
         // Add more validation as needed (zip code format, phone format etc.)

        try {
            const result = await fetchData(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

             if (result || method === 'PUT') { // PUT might return 200 OK or 204
                storeFormModal.style.display = "none";
                showToast(`Store ${isUpdate ? 'updated' : 'added'} successfully!`, 'success');
                loadStores(currentFilterStatus); // Reload data
            }
        } catch (error) {
            displayFormError(formError, `Error: ${error.message}`);
        } finally {
            saveStoreBtn.disabled = false;
            saveStoreBtn.textContent = isUpdate ? "Save Changes" : "Save Store";
        }
    });

    // --- Delete Handling ---
    function attachStoreActions() {
        storeTableBody.querySelectorAll('.action-btn-icon.edit').forEach(btn => {
             const row = btn.closest('tr');
             const storeId = row.dataset.storeId;
            btn.addEventListener('click', () => openStoreModal(storeId));
        });

        storeTableBody.querySelectorAll('.action-btn-icon.delete').forEach(btn => {
             const row = btn.closest('tr');
             const storeId = row.dataset.storeId;
             const storeName = row.cells[1].textContent; // Get name from cell
            btn.addEventListener('click', () => promptForDelete(storeId, storeName));
        });
    }

    function promptForDelete(id, name) {
        storeToDeleteId = id;
        deleteConfirmMessage.textContent = `Are you sure you want to delete store "${name}" (ID: ${id})? This might fail if the store has associated data (stock, sales). Consider setting status to 'inactive' instead.`;
        clearFormError(deleteError);
        deleteConfirmModal.style.display = "block";
    }

    closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!storeToDeleteId) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';
        clearFormError(deleteError);

        try {
            await fetchData(`/stores/${storeToDeleteId}`, { method: "DELETE" });
            deleteConfirmModal.style.display = "none";
            showToast('Store deleted successfully!', 'success');
            storeToDeleteId = null;
            loadStores(currentFilterStatus); // Reload data
        } catch (error) {
             displayFormError(deleteError, `Error: ${error.message}`);
             // Keep button disabled on error? Or re-enable?
             confirmDeleteBtn.disabled = false;
             confirmDeleteBtn.textContent = 'Delete Store';
        } finally {
             // Ensure button is re-enabled unless deletion succeeded
             if (storeToDeleteId) {
                 confirmDeleteBtn.disabled = false;
                 confirmDeleteBtn.textContent = 'Delete Store';
             }
        }
    });


    // --- Initial Load ---
    loadManagers(); // Load managers first for the dropdown
    loadStores(currentFilterStatus); // Load active stores initially

}); // End DOMContentLoaded