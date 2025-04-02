"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements
    const staffTableBody = document.getElementById("staffTableBody");
    const addStaffBtn = document.getElementById("addStaffBtn");
    const staffSearchInput = document.getElementById("staffSearch");
    const statusFilterSelect = document.getElementById("statusFilter");
    const noStaffMessage = document.getElementById("noStaffMessage");
    const staffTable = document.getElementById("staffTable");

    // Staff Form Modal Elements
    const staffFormModal = document.getElementById("staffFormModal");
    const closeStaffModal = document.getElementById("closeStaffModal");
    const staffForm = document.getElementById("staffForm");
    const modalTitle = document.getElementById("modalTitle");
    const staffIdInput = document.getElementById("staffId");
    const passwordSection = document.getElementById("passwordSection");
    const passwordInput = document.getElementById("password");
    const passwordHelp = document.getElementById("passwordHelp");
    const formError = document.getElementById("formError");
    const saveStaffBtn = document.getElementById("saveStaffBtn");
    const cancelStaffFormBtn = document.getElementById("cancelStaffForm");

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
    let allStaffData = []; // Cache for client-side search/sort
    let currentFilterStatus = 'active'; // Default filter
    let staffToDeleteId = null;
    let currentSortColumn = 'staff_id'; // Default sort
    let currentSortDirection = 'asc';

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const isJson = response.headers.get('content-type')?.includes('application/json');

            if (!response.ok) {
                let errorData = { detail: `HTTP error! Status: ${response.status}` };
                if (isJson) {
                    try {
                        errorData = await response.json();
                    } catch (e) { /* Ignore if parsing fails */ }
                }
                console.error(`Error fetching ${endpoint}: ${response.status}`, errorData);
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }
            if (response.status === 204) return null; // Handle No Content
            if (isJson) return await response.json();
            return await response.text(); // Handle non-json response if necessary

        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error;
        }
    }

    function showToast(message, type = 'info') { // type = 'success', 'error', 'info'
        toastNotification.textContent = message;
        toastNotification.className = `toast show ${type}`; // Add type class
        setTimeout(() => {
            toastNotification.className = 'toast';
        }, 3000); // Hide after 3 seconds
    }

    function showLoading(colSpan) {
         if(staffTableBody) staffTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="loading-text">Loading staff...</td></tr>`;
         if(noStaffMessage) noStaffMessage.style.display = 'none';
    }

    function showNoStaffMessage() {
         if(staffTableBody) staffTableBody.innerHTML = ''; // Clear table
         if(noStaffMessage) noStaffMessage.style.display = 'block';
    }

     function hideNoStaffMessage() {
         if(noStaffMessage) noStaffMessage.style.display = 'none';
     }

     function displayFormError(errorElement, message) {
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    function clearFormError(errorElement) {
         if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    // --- Staff Data Handling ---
    async function loadStaff(status = 'active') {
        showLoading(7); // 7 columns initially shown
        currentFilterStatus = status;
        try {
            const url = status ? `/staff/?status=${status}` : "/staff/"; // Adjust endpoint based on backend
            allStaffData = await fetchData(url);
            if (!allStaffData) allStaffData = []; // Ensure it's an array even on error/null
            filterAndRenderStaff(); // Apply search and sorting
        } catch (error) {
            showToast(`Error loading staff: ${error.message}`, 'error');
            showNoStaffMessage(); // Show message instead of empty table
        }
    }

    // Filter based on search input
    function filterAndRenderStaff() {
        const query = staffSearchInput.value.toLowerCase();
        const filtered = allStaffData.filter(staff =>
            (staff.full_name?.toLowerCase() || '').includes(query) ||
            (staff.email?.toLowerCase() || '').includes(query)
        );
        sortAndRenderStaff(filtered);
    }

     // --- Sorting ---
     function sortAndRenderStaff(dataToSort) {
        const sortedData = [...dataToSort].sort((a, b) => {
             let valA = a[currentSortColumn];
             let valB = b[currentSortColumn];

             // Type specific comparison
             if (typeof valA === 'string') valA = valA.toLowerCase();
             if (typeof valB === 'string') valB = valB.toLowerCase();
             if (currentSortColumn === 'salary') { // Assuming salary is numeric
                 valA = parseFloat(valA || 0);
                 valB = parseFloat(valB || 0);
             }
              if (currentSortColumn === 'staff_id') {
                 valA = parseInt(valA || 0);
                 valB = parseInt(valB || 0);
             }
             // Add more type handling if needed (dates etc.)

             let comparison = 0;
             if (valA > valB) comparison = 1;
             else if (valA < valB) comparison = -1;

             return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
         });

         renderStaffTable(sortedData);
         updateSortIcons();
     }

     function updateSortIcons() {
        staffTable.querySelectorAll('thead th[data-column]').forEach(th => {
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

    // Function to render staff table rows
    function renderStaffTable(data) {
        if(!staffTableBody) return;
        staffTableBody.innerHTML = "";

        if (!data || data.length === 0) {
            showNoStaffMessage();
            return;
        }
        hideNoStaffMessage();

        data.forEach(staff => {
            const idFormatted = "#" + (staff.staff_id?.toString() || 'N/A').padStart(3, "0");
            const phone = staff.phone_number || "-";
            const statusClass = staff.status === 'active' ? 'status-active' : 'status-inactive';

            const tr = document.createElement("tr");
            tr.dataset.staffId = staff.staff_id; // Store ID on row
            tr.innerHTML = `
                <td>${idFormatted}</td>
                <td>${staff.full_name}</td>
                <td>${staff.role}</td>
                <td><span class="status-badge ${statusClass}">${staff.status}</span></td>
                <td>${staff.email}</td>
                <td>${phone}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-icon edit" title="Edit Staff">
                            <ion-icon name="create-outline"></ion-icon>
                        </button>
                        <button class="action-btn-icon delete" title="Delete Staff">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </td>
            `;
            staffTableBody.appendChild(tr);
        });

        attachActionButtons(); // Re-attach listeners for the new buttons
    }

    // --- Event Listeners ---

    // Initial load and filter change
    statusFilterSelect.addEventListener('change', (e) => {
        loadStaff(e.target.value);
    });

    // Dynamic search filter
    staffSearchInput.addEventListener("input", filterAndRenderStaff);

     // Sorting event listeners
     staffTable.querySelectorAll('thead th[data-column]').forEach(th => {
         th.addEventListener('click', () => {
             const column = th.dataset.column;
             if (currentSortColumn === column) {
                 currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
             } else {
                 currentSortColumn = column;
                 currentSortDirection = 'asc';
             }
             filterAndRenderStaff(); // Re-filter and sort displayed data
         });
     });

    // "Add Staff" button opens modal in 'Add' mode
    addStaffBtn.addEventListener("click", () => {
        openStaffModal(); // Open in Add mode
    });

    // --- Modal Handling ---
    function openStaffModal(staffId = null) {
        clearFormError(formError);
        staffForm.reset(); // Clear form fields
        staffIdInput.value = staffId || ''; // Set or clear hidden ID

        if (staffId) {
            // --- EDIT MODE ---
            modalTitle.textContent = "Edit Staff";
            passwordSection.style.display = 'block'; // Show password section for potential change
            passwordInput.required = false; // Password not required for edit
            passwordInput.placeholder = "Leave blank to keep current password";
            passwordHelp.style.display = 'block';

            const staff = allStaffData.find(s => s.staff_id == staffId);
            if (!staff) {
                showToast("Could not find staff details to edit.", "error");
                return;
            }
            // Pre-fill form
            document.getElementById("fullName").value = staff.full_name || '';
            document.getElementById("email").value = staff.email || '';
            document.getElementById("phone").value = staff.phone_number || '';
            document.getElementById("role").value = staff.role || 'Employee';
            document.getElementById("status").value = staff.status || 'active';
            document.getElementById("dob").value = staff.date_of_birth || '';
            document.getElementById("salary").value = staff.salary || '';
             // Boolean needs string conversion for select
             document.getElementById("isManager").value = staff.is_manager ? 'true' : 'false';
            document.getElementById("shiftStart").value = staff.shift_start_time || '';
            document.getElementById("shiftEnd").value = staff.shift_end_time || '';
            document.getElementById("street").value = staff.street || '';
            document.getElementById("city").value = staff.city || '';
            document.getElementById("state").value = staff.state || '';
            document.getElementById("zipCode").value = staff.zip_code || '';
            document.getElementById("additionalDetails").value = staff.additional_details || '';

        } else {
            // --- ADD MODE ---
            modalTitle.textContent = "Add New Staff";
            passwordSection.style.display = 'block'; // Always show for add
            passwordInput.required = true; // Password IS required for add
            passwordInput.placeholder = "Required for new staff";
            passwordHelp.style.display = 'none'; // Less relevant for add
        }
        staffFormModal.style.display = "block";
    }

    // Close modal logic
    closeStaffModal.addEventListener("click", () => staffFormModal.style.display = "none");
    cancelStaffFormBtn.addEventListener("click", () => staffFormModal.style.display = "none");
    window.addEventListener("click", (event) => { // Close on outside click
        if (event.target == staffFormModal) {
            staffFormModal.style.display = "none";
        }
        if (event.target == deleteConfirmModal) {
             deleteConfirmModal.style.display = "none";
        }
    });

    // Handle Add/Edit form submission
    staffForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        clearFormError(formError); // Clear previous errors

        const isUpdate = !!staffIdInput.value;
        const staffId = staffIdInput.value;
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate ? `/staff/${staffId}` : "/staff/";

        // Disable button
        saveStaffBtn.disabled = true;
        saveStaffBtn.textContent = isUpdate ? "Saving Changes..." : "Adding Staff...";

        // Collect form data
        const formData = new FormData(staffForm);
        const payload = {};
        // Convert FormData to JSON, handling types and nulls
        formData.forEach((value, key) => {
             if (key === 'staffId') return; // Skip hidden ID field

             let processedValue = value.trim(); // Trim strings

             // Handle potential nulls for optional fields
             if (processedValue === '' && !['full_name', 'email', 'role', 'status', 'password'].includes(key)) {
                 processedValue = null;
             }
             // Handle password specifically for update
             else if (key === 'password') {
                  if (isUpdate && processedValue === '') {
                      // *** Don't send password field if blank during update ***
                      // This assumes backend handles missing password on PUT
                      return;
                  } else if (!isUpdate && processedValue === '') {
                      // Password required for add mode
                      displayFormError(formError, "Password is required for new staff.");
                      saveStaffBtn.disabled = false;
                      saveStaffBtn.textContent = isUpdate ? "Save Changes" : "Save Staff";
                      // Short circuit
                      throw new Error("Password required"); // Throw to exit async function cleanly
                  }
                 // If password *is* provided (for add or update), include it
                 payload[key] = processedValue;
                 return; // Go to next field
             }
             // Handle boolean select
             else if (key === 'is_manager') {
                 processedValue = (processedValue === 'true');
             }
             // Handle numeric fields
             else if (key === 'salary' && processedValue !== null) {
                 processedValue = parseFloat(processedValue) || 0.0;
             }

             payload[key] = processedValue;
         });

        // Add explicit is_manager if not in form (adjust if 'isManager' select name is different)
         if (payload.is_manager === undefined) payload.is_manager = false;


        try {
            const result = await fetchData(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (result || method === 'PUT') { // PUT might return 200 OK with data or 204
                staffFormModal.style.display = "none";
                showToast(`Staff ${isUpdate ? 'updated' : 'added'} successfully!`, 'success');
                loadStaff(currentFilterStatus); // Reload data for the current filter
            }
        } catch (error) {
            displayFormError(formError, `Error: ${error.message}`);
        } finally {
            saveStaffBtn.disabled = false;
            saveStaffBtn.textContent = isUpdate ? "Save Changes" : "Save Staff";
        }
    });

    // --- Delete Handling ---
    function attachActionButtons() {
        staffTableBody.querySelectorAll('.action-btn-icon.edit').forEach(btn => {
             const row = btn.closest('tr');
             const staffId = row.dataset.staffId;
            btn.addEventListener('click', () => openStaffModal(staffId));
        });

        staffTableBody.querySelectorAll('.action-btn-icon.delete').forEach(btn => {
             const row = btn.closest('tr');
             const staffId = row.dataset.staffId;
             const staffName = row.cells[1].textContent; // Get name from cell
            btn.addEventListener('click', () => promptForDelete(staffId, staffName));
        });
    }

    function promptForDelete(id, name) {
        staffToDeleteId = id;
        deleteConfirmMessage.textContent = `Are you sure you want to delete staff member "${name}" (ID: ${id})? This action might be irreversible depending on system configuration.`;
        clearFormError(deleteError); // Clear previous delete errors
        deleteConfirmModal.style.display = "block";
    }

    closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!staffToDeleteId) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';
        clearFormError(deleteError);

        try {
            await fetchData(`/staff/${staffToDeleteId}`, { method: "DELETE" });
            deleteConfirmModal.style.display = "none";
            showToast('Staff member deleted successfully!', 'success');
            staffToDeleteId = null;
            loadStaff(currentFilterStatus); // Reload data
        } catch (error) {
             displayFormError(deleteError, `Error: ${error.message}`);
            // Optionally re-enable button immediately on error
            // confirmDeleteBtn.disabled = false;
            // confirmDeleteBtn.textContent = 'Confirm Delete';
        } finally {
             // Keep button disabled on error? Or re-enable? User choice.
             confirmDeleteBtn.disabled = false; // Re-enable button
             confirmDeleteBtn.textContent = 'Confirm Delete';
        }
    });


    // --- Initial Load ---
    loadStaff(currentFilterStatus); // Load active staff initially

}); // End DOMContentLoaded