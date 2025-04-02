"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // State variables
    let currentCategory = ""; // Store category ID, "" for All
    let allItemsCache = []; // Cache fetched items for client-side sorting
    let currentSortColumn = null;
    let currentSortDirection = 'none'; // 'none', 'asc', 'desc'

    // DOM Elements
    const categoryButtonsContainer = document.getElementById("category-buttons-container");
    const itemsTableBody = document.getElementById("itemsTableBody");
    const itemsTable = document.getElementById("itemsTable");
    const noItemsMessage = document.getElementById("noItemsMessage");

    // Category Form Elements
    const addCategoryBtn = document.getElementById("addCategoryBtn");
    const categoryForm = document.getElementById("categoryForm");
    const closeCategoryFormBtn = document.getElementById("closeCategoryForm");
    const addCategoryFormInternal = document.getElementById("addCategoryFormInternal");
    const categoryFormError = document.getElementById("categoryFormError");
    const sliderOverlay = document.getElementById("slider-overlay");

    // Item Form Elements
    const addItemBtn = document.getElementById("addItemBtn");
    const itemFormModal = document.getElementById("itemFormModal");
    const closeItemFormModal = document.getElementById("closeItemFormModal");
    const cancelItemFormBtn = document.getElementById("cancelItemForm");
    const itemForm = document.getElementById("itemForm");
    const itemFormTitle = document.getElementById("itemFormTitle");
    const saveItemBtn = document.getElementById("saveItemBtn");
    const itemFormError = document.getElementById("itemFormError");
    const itemCategorySelect = document.getElementById("itemCategory");
    const itemIdInput = document.getElementById("itemId"); // Hidden input for ID

    // Delete Confirmation Modal Elements
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    let itemToDeleteId = null; // Store ID of item to be deleted

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { detail: `HTTP error! Status: ${response.status}` };
                }
                console.error(`Error fetching ${endpoint}: ${response.status}`, errorData);
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }
            // Handle 204 No Content specifically for DELETE
            if (response.status === 204) {
                return null; // Or return a success indicator if needed
            }
            return await response.json();
        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error; // Re-throw the error to be caught by the caller
        }
    }

    function showLoading(tableBody, colSpan) {
         if(tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="loading-text">Loading...</td></tr>`;
         if(noItemsMessage) noItemsMessage.style.display = 'none';
    }

    function showNoItemsMessage() {
         if(itemsTableBody) itemsTableBody.innerHTML = ''; // Clear table
         if(noItemsMessage) noItemsMessage.style.display = 'block';
    }

    function hideNoItemsMessage() {
         if(noItemsMessage) noItemsMessage.style.display = 'none';
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

    // --- Category Functions ---
    async function loadCategories() {
        try {
            const categories = await fetchData("/menu/categories");
            if (!categories) return; // Error handled in fetchData

            categoryButtonsContainer.innerHTML = ''; // Clear previous buttons
             if(itemCategorySelect) itemCategorySelect.innerHTML = '<option value="">-- Select Category --</option>'; // Clear item form dropdown

            let totalItems = 0;
            categories.forEach(cat => totalItems += cat.item_count);

            // Create "All" button
            const allBtn = createCategoryButton("", "All", totalItems);
            allBtn.classList.add("active"); // Default active
            categoryButtonsContainer.appendChild(allBtn);

            // Create buttons for each category
            categories.forEach(cat => {
                categoryButtonsContainer.appendChild(
                    createCategoryButton(cat.category_id, cat.category_name, cat.item_count)
                );
                 // Add option to Item Form dropdown
                 if (itemCategorySelect) {
                    const option = document.createElement('option');
                    option.value = cat.category_id;
                    option.textContent = cat.category_name;
                    itemCategorySelect.appendChild(option);
                 }
            });
            attachCategoryButtonEvents(); // Re-attach events
        } catch (error) {
            console.error("Error loading categories:", error);
            // Display error to user?
        }
    }

    function createCategoryButton(id, name, count) {
        const btn = document.createElement("button");
        btn.className = "category";
        btn.dataset.categoryId = id;
        btn.innerHTML = `${name} <span>${count} items</span>`;
        return btn;
    }

    function attachCategoryButtonEvents() {
        categoryButtonsContainer.querySelectorAll("button.category").forEach(btn => {
            btn.addEventListener("click", () => {
                categoryButtonsContainer.querySelectorAll("button.category").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentCategory = btn.dataset.categoryId;
                loadItems(); // Load items for the selected category
            });
        });
    }

    // --- Item Functions ---
    async function loadItems() {
        showLoading(itemsTableBody, 7);
        hideNoItemsMessage();
        try {
            // Fetch items based on the *currently selected category*
            const url = currentCategory ? `/items/?category_id=${currentCategory}` : "/items/";
            const items = await fetchData(url);

            if (!items) { // Handle fetch error or empty response
                 allItemsCache = [];
                 showNoItemsMessage();
                 console.error("Failed to load items or received null response.");
                 return;
            }

            allItemsCache = items; // Cache for sorting
            sortAndRenderItems(); // Render sorted items

        } catch (error) {
            console.error("Error loading items:", error);
            showTableMessage(itemsTableBody, "Error loading items.", 7)
            allItemsCache = [];
        }
    }

    function renderItemsTable(items) {
         if(!itemsTableBody) return;
        itemsTableBody.innerHTML = ""; // Clear previous items

        if (!items || items.length === 0) {
            showNoItemsMessage();
            return;
        }

        hideNoItemsMessage(); // Hide no items message if we have items

        items.forEach(item => {
            const barcode = item.barcode ? item.barcode : "N/A";
            const price = parseFloat(item.price || 0).toFixed(2); // Default to 0 if null
            const costPrice = parseFloat(item.cost_price || 0).toFixed(2); // Default to 0
            const perishable = item.is_perishable ? "Yes" : "No";
            const tr = document.createElement("tr");
            tr.dataset.itemId = item.item_id; // Add id for easier selection
            tr.innerHTML = `
                <td>${item.item_id}</td>
                <td>${item.item_name}</td>
                <td>${barcode}</td>
                <td class="text-right">Rs ${price}</td>
                <td class="text-right">Rs ${costPrice}</td>
                <td>${perishable}</td>
                <td>
                    <div class="action-buttons">
                         <button class="action-btn-icon edit" title="Edit Item">
                            <ion-icon name="create-outline"></ion-icon>
                        </button>
                         <button class="action-btn-icon delete" title="Delete Item">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </td>
            `;
            itemsTableBody.appendChild(tr);
        });
        attachActionButtons(); // Attach listeners for newly added buttons
    }

    // --- Sorting ---
    function sortAndRenderItems() {
        if (!currentSortColumn) {
            renderItemsTable(allItemsCache);
            return;
        }

        const sortedItems = [...allItemsCache].sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Handle different data types
             if (typeof valA === 'string') valA = valA.toLowerCase();
             if (typeof valB === 'string') valB = valB.toLowerCase();
             if (currentSortColumn === 'price' || currentSortColumn === 'cost_price') {
                 valA = parseFloat(valA || 0); // Convert currency string/null to number
                 valB = parseFloat(valB || 0);
             }
             if (currentSortColumn === 'is_perishable') {
                 valA = valA ? 1 : 0; // Convert boolean to number for sorting
                 valB = valB ? 1 : 0;
             }

             let comparison = 0;
             if (valA > valB) comparison = 1;
             else if (valA < valB) comparison = -1;

             return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
        });

        renderItemsTable(sortedItems);
        updateSortIcons();
    }

    function updateSortIcons() {
        itemsTable.querySelectorAll('thead th[data-column]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.innerHTML = ''; // Clear previous icon content

            if (th.dataset.column === currentSortColumn) {
                if (currentSortDirection === 'asc') {
                    th.classList.add('sort-asc');
                    if(icon) icon.innerHTML = '▲'; // Up arrow
                } else if (currentSortDirection === 'desc') {
                    th.classList.add('sort-desc');
                     if(icon) icon.innerHTML = '▼'; // Down arrow
                }
            }
        });
    }

     // Add sorting event listeners to headers
     itemsTable.querySelectorAll('thead th[data-column]').forEach(th => {
         th.addEventListener('click', () => {
             const column = th.dataset.column;
             if (currentSortColumn === column) {
                 // Cycle direction: none -> asc -> desc -> none
                 if (currentSortDirection === 'asc') currentSortDirection = 'desc';
                 else if (currentSortDirection === 'desc') currentSortDirection = 'none'; // Optional: cycle back to none
                 else currentSortDirection = 'asc';
             } else {
                 currentSortColumn = column;
                 currentSortDirection = 'asc'; // Default to ascending on new column
             }
             // If cycling back to none, reset sort column as well
              if (currentSortDirection === 'none') currentSortColumn = null;

             sortAndRenderItems();
         });
     });


    // --- Item Actions (Edit/Delete Buttons in Table) ---
    function attachActionButtons() {
        itemsTableBody.querySelectorAll('.action-btn-icon.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const itemId = row.dataset.itemId;
                openItemFormForEdit(itemId);
            });
        });

        itemsTableBody.querySelectorAll('.action-btn-icon.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const itemId = row.dataset.itemId;
                const itemName = row.cells[1].textContent; // Get name from table cell
                promptForDelete(itemId, itemName);
            });
        });
    }

    // --- Add/Update Item Modal ---
    async function openItemFormForEdit(itemId) {
        clearFormError(itemFormError);
        itemForm.reset(); // Clear previous data
        itemFormTitle.textContent = "Update Item";
        itemIdInput.value = itemId; // Set the hidden ID field

        try {
            const itemData = await fetchData(`/items/${itemId}`);
            if (!itemData) {
                displayFormError(itemFormError, "Failed to fetch item details.");
                return;
            }
            // Populate form
            document.getElementById('itemName').value = itemData.item_name || '';
             // Ensure category exists in dropdown before setting
            if (itemData.category_id && itemCategorySelect.querySelector(`option[value="${itemData.category_id}"]`)) {
                 itemCategorySelect.value = itemData.category_id;
             } else {
                 itemCategorySelect.value = ""; // Select default if category not found/null
             }
            document.getElementById('itemPrice').value = parseFloat(itemData.price || 0).toFixed(2);
            document.getElementById('itemCostPrice').value = parseFloat(itemData.cost_price || 0).toFixed(2);
            document.getElementById('itemBarcode').value = itemData.barcode || '';
            document.getElementById('itemImageUrl').value = itemData.image_url || '';
            document.getElementById('itemPerishable').checked = itemData.is_perishable || false;

            itemFormModal.style.display = "block";
        } catch (error) {
            console.error("Error fetching item for edit:", error);
            displayFormError(itemFormError, `Error fetching item details: ${error.message}`);
            // Don't show modal if fetch failed
        }
    }

    function openItemFormForAdd() {
        clearFormError(itemFormError);
        itemForm.reset();
        itemFormTitle.textContent = "Add New Item";
        itemIdInput.value = ''; // Clear hidden ID field for adding
        itemFormModal.style.display = "block";
    }

    addItemBtn.addEventListener('click', openItemFormForAdd);
    closeItemFormModal.addEventListener('click', () => itemFormModal.style.display = "none");
    cancelItemFormBtn.addEventListener('click', () => itemFormModal.style.display = "none");

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormError(itemFormError);
        saveItemBtn.disabled = true;
        saveItemBtn.textContent = 'Saving...';

        const formData = new FormData(itemForm);
        const isUpdate = !!itemIdInput.value;
        const itemId = itemIdInput.value;
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/items/${itemId}` : '/items/';

        const payload = {
            item_name: formData.get('item_name'),
            category_id: formData.get('category_id') ? parseInt(formData.get('category_id'), 10) : null,
            price: parseFloat(formData.get('price')),
            cost_price: formData.get('cost_price') ? parseFloat(formData.get('cost_price')) : null,
            barcode: formData.get('barcode') || null, // Send null if empty
            is_perishable: formData.get('is_perishable') === 'on', // Checkbox value
            image_url: formData.get('image_url') || null
        };

        // Basic validation
        if (!payload.item_name || isNaN(payload.price) || payload.price < 0) {
             displayFormError(itemFormError, "Item Name and a valid Price are required.");
             saveItemBtn.disabled = false;
             saveItemBtn.textContent = 'Save Item';
             return;
        }

        try {
            const result = await fetchData(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result) {
                itemFormModal.style.display = "none";
                await loadItems(); // Reload items for the current category
                await loadCategories(); // Reload categories to update counts
                // Optional: Show success message
            } else {
                 // Error handled in fetchData, but maybe show generic message if needed
                 displayFormError(itemFormError, "An unexpected error occurred.");
            }
        } catch (error) {
            displayFormError(itemFormError, `Error saving item: ${error.message}`);
        } finally {
            saveItemBtn.disabled = false;
            saveItemBtn.textContent = 'Save Item';
        }
    });

    // --- Delete Confirmation Modal ---
    function promptForDelete(id, name) {
        itemToDeleteId = id;
        deleteConfirmMessage.textContent = `Are you sure you want to delete "${name}" (ID: ${id})? This action cannot be undone.`;
        deleteConfirmModal.style.display = "block";
    }

    closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!itemToDeleteId) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';

        try {
            await fetchData(`/items/${itemToDeleteId}`, { method: "DELETE" });
            deleteConfirmModal.style.display = "none";
            itemToDeleteId = null;
            await loadItems(); // Refresh items list
            await loadCategories(); // Refresh category counts
             // Optional: Show success message
        } catch (error) {
            console.error("Error deleting item:", error);
            // Display error within the modal?
            deleteConfirmMessage.textContent = `Error deleting item: ${error.message}. Please try again.`;
            // alert(`Error deleting item: ${error.message}`);
        } finally {
             confirmDeleteBtn.disabled = false;
             confirmDeleteBtn.textContent = 'Delete';
        }
    });


    // --- Add Category Slider Form ---
     function toggleCategoryForm(show) {
         if (show) {
             categoryForm.classList.add('active');
             sliderOverlay.classList.add('active');
         } else {
             categoryForm.classList.remove('active');
             sliderOverlay.classList.remove('active');
             clearFormError(categoryFormError); // Clear errors on close
             addCategoryFormInternal.reset(); // Reset form on close
         }
     }

    addCategoryBtn.addEventListener('click', () => toggleCategoryForm(true));
    closeCategoryFormBtn.addEventListener('click', () => toggleCategoryForm(false));
    sliderOverlay.addEventListener('click', () => toggleCategoryForm(false)); // Close on overlay click

     addCategoryFormInternal.addEventListener('submit', async (e) => {
         e.preventDefault();
         clearFormError(categoryFormError);
         const saveButton = document.getElementById('saveCategoryBtn');
         saveButton.disabled = true;
         saveButton.textContent = 'Saving...';

         const formData = new FormData(addCategoryFormInternal);
         const payload = {
             category_name: formData.get('category_name'),
             description: formData.get('description') || null,
             status: formData.get('status') || 'active'
         };

         if (!payload.category_name) {
             displayFormError(categoryFormError, "Category Name is required.");
             saveButton.disabled = false;
             saveButton.textContent = 'Save Category';
             return;
         }

         try {
             const result = await fetchData('/categories/', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(payload)
             });

             if (result) {
                 toggleCategoryForm(false); // Close form
                 await loadCategories(); // Refresh category list
                 // Optional: Show success message
             }
         } catch (error) {
             displayFormError(categoryFormError, `Error saving category: ${error.message}`);
         } finally {
             saveButton.disabled = false;
             saveButton.textContent = 'Save Category';
         }
     });

    // --- Modal Window Closing ---
    window.addEventListener("click", (event) => {
        if (event.target == itemFormModal) {
            itemFormModal.style.display = "none";
        }
        if (event.target == deleteConfirmModal) {
            deleteConfirmModal.style.display = "none";
        }
    });

    // --- Initial Load ---
    loadCategories().then(() => {
        // Load items only after categories are loaded (to ensure category dropdown is populated for item form)
        loadItems(); // Load initial items (All categories)
    });

}); // End DOMContentLoaded