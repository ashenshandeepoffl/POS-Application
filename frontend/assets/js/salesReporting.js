"use strict";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Report Center Initializing...");
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements
    const reportTypeSelect = document.getElementById("reportTypeSelect");
    const reportParametersDiv = document.getElementById("reportParameters");
    const downloadActionDiv = document.getElementById("downloadAction");
    const paramStoreSelect = document.getElementById("paramStore");
    const paramStartDate = document.getElementById("paramStartDate");
    const paramEndDate = document.getElementById("paramEndDate");
    const paramPeriodSelect = document.getElementById("paramPeriod");
    const paramStockStatusSelect = document.getElementById("paramStockStatus");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    // const downloadCsvBtn = document.getElementById("downloadCsvBtn"); // If adding CSV later
    const downloadError = document.getElementById("downloadError");
    const toastNotification = document.getElementById("toastNotification");

    // State
    let storesList = [];
    // Add caches for other dropdowns if needed (staff, categories)

    // --- Utility Functions (Keep robust versions) ---
     async function fetchData(endpoint, options = {}) {
        console.log(`Fetching: ${endpoint}`, options);
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            // Check if response is likely a file download based on content type
            const contentType = response.headers.get('content-type');
            const isFile = contentType && (contentType.includes('pdf') || contentType.includes('csv') || contentType.includes('octet-stream'));

            if (!response.ok) {
                 let errorDetail = `Request failed (${response.status})`;
                 try {
                     // Try to parse error JSON, otherwise use status text
                     const errorJson = await response.json();
                     errorDetail = errorJson.detail || JSON.stringify(errorJson);
                 } catch (e) { errorDetail += ` - ${response.statusText}`; }
                 console.error(`[Fetch Error] ${endpoint}: ${errorDetail}`);
                 throw new Error(errorDetail);
             }

             // Handle successful file download
             if (isFile) {
                 console.log(`[Fetch Success] ${endpoint}: Received file.`);
                 return response.blob(); // Return blob for file handling
             }

            // Handle No Content
            if (response.status === 204) {
                 console.log(`[Fetch Success] ${endpoint}: 204 No Content`);
                 return null;
            }

            // Handle JSON
             const jsonData = await response.json();
             console.log(`[Fetch Success] Data for ${endpoint}:`, jsonData);
             return jsonData;

        } catch (error) {
            console.error(`[Fetch Network Error] ${endpoint}:`, error);
            throw error;
        }
    }
     function showToast(message, type = 'info') { /* ... */ }
     function displayFormError(errorElement, message) { /* ... */ }
     function clearFormError(errorElement) { /* ... */ }

    // --- Initial Data Loading for Filters ---
    async function loadFilterOptions() {
        try {
            // Fetch only active stores for selection
            storesList = await fetchData("/stores/?status=active") || [];
            populateSelect(paramStoreSelect, storesList, 'store_id', 'store_name', "All Stores");
            // Load other options (staff, categories) if needed for future reports
        } catch (error) {
            console.error("Error loading filter options:", error);
            showToast("Error loading store options.", "error");
        }
    }

    function populateSelect(selectElement, items, valueKey, textKey, defaultOptionText) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey]; // Can add ID like `${item[textKey]} (ID: ${item[valueKey]})`
            selectElement.appendChild(option);
        });
    }

    // --- Report Parameter Handling ---
    function updateVisibleParameters() {
        const selectedReport = reportTypeSelect.value;
        console.log("Selected report type:", selectedReport);

        // Hide parameter section and download button initially
        reportParametersDiv.style.display = 'none';
        downloadActionDiv.style.display = 'none';
        clearFormError(downloadError); // Clear previous errors

        if (!selectedReport) return; // No report selected

        // Show the parameter section
        reportParametersDiv.style.display = 'block';
        downloadActionDiv.style.display = 'block'; // Always show download if type selected

        // Loop through each parameter group and show/hide based on data-reports attribute
        reportParametersDiv.querySelectorAll('.parameter').forEach(paramGroup => {
            const requiredFor = paramGroup.dataset.reports?.split(',') || [];
            if (requiredFor.includes(selectedReport)) {
                paramGroup.style.display = 'block'; // Or 'flex', 'grid' depending on group style
            } else {
                paramGroup.style.display = 'none';
            }
        });
    }

    // --- Report Download ---
    async function handleDownload(format = 'pdf') {
        const reportType = reportTypeSelect.value;
        if (!reportType) {
            displayFormError(downloadError, "Please select a report type first.");
            return;
        }
        clearFormError(downloadError);
        downloadPdfBtn.disabled = true;
        downloadPdfBtn.innerHTML = `<ion-icon name="hourglass-outline"></ion-icon> Generating...`;

        // Build URL and parameters based on report type
        let url = '';
        const params = new URLSearchParams();

        // Get common parameters if visible
        const storeId = paramStoreSelect.value;
        const startDate = paramStartDate.value;
        const endDate = paramEndDate.value;

        if(paramStoreSelect.closest('.parameter').style.display !== 'none' && storeId) {
             params.append('store_id', storeId);
        }
        if(paramStartDate.closest('.parameter').style.display !== 'none' && startDate) {
             params.append('start_date', startDate);
        }
         if(paramEndDate.closest('.parameter').style.display !== 'none' && endDate) {
             params.append('end_date', endDate);
        }
         // Date range validation
         if (startDate && endDate && startDate > endDate) {
             displayFormError(downloadError, "End Date cannot be before Start Date.");
             downloadPdfBtn.disabled = false;
             downloadPdfBtn.innerHTML = `<ion-icon name="document-text-outline"></ion-icon> Download PDF`;
             return;
         }


        // --- Endpoint Mapping (CRUCIAL: Update backend endpoints accordingly) ---
        switch (reportType) {
            case 'sales_summary_period':
                const period = paramPeriodSelect.value;
                params.append('period', period);
                 url = `/sales_report/pdf?${params.toString()}`; // Use existing endpoint
                 break;
            case 'sales_summary_custom':
                if (!startDate || !endDate) {
                     displayFormError(downloadError, "Start Date and End Date are required for custom range.");
                     // Re-enable button logic needed here too
                     downloadPdfBtn.disabled = false; downloadPdfBtn.innerHTML = `<ion-icon name="document-text-outline"></ion-icon> Download PDF`;
                     return;
                 }
                 // *** Needs a NEW backend endpoint, e.g., /reports/sales/summary/pdf ***
                 url = `/reports/sales/summary/pdf?${params.toString()}`;
                 break;
            case 'stock_level':
                const stockStatus = paramStockStatusSelect.value;
                 if (stockStatus !== 'all') params.append('status_filter', stockStatus); // e.g., status_filter=low
                // *** Needs a NEW backend endpoint, e.g., /reports/stock/level/pdf ***
                url = `/reports/stock/level/pdf?${params.toString()}`;
                break;
            // Add cases for other report types...
            // case 'sales_by_category':
            //     url = `/reports/sales/category/pdf?${params.toString()}`;
            //     break;
            // case 'low_stock':
            //     url = `/reports/stock/low/pdf?${params.toString()}`;
            //     break;

            default:
                displayFormError(downloadError, "Selected report type is not yet configured for download.");
                 downloadPdfBtn.disabled = false; downloadPdfBtn.innerHTML = `<ion-icon name="document-text-outline"></ion-icon> Download PDF`;
                return;
        }

        console.log("Requesting report:", url);

        try {
            // Fetch the report as a blob
            const blob = await fetchData(url, { method: 'GET' });

            if (blob && blob.size > 0) {
                 // Create a temporary link to trigger the download
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                // Suggest filename based on report type and date/period
                const filename = `${reportType}_${(params.get('period') || params.get('start_date') || 'report')}.${format}`;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                a.remove();
                showToast("Report downloaded successfully!", "success");
            } else {
                 // This might happen if the backend returns OK but empty content
                 throw new Error("Received empty file from server. No data for selected criteria?");
             }
        } catch (error) {
            console.error("Download error:", error);
            displayFormError(downloadError, `Failed to download report: ${error.message}`);
            showToast(`Failed to download report: ${error.message}`, "error");
        } finally {
             downloadPdfBtn.disabled = false;
             downloadPdfBtn.innerHTML = `<ion-icon name="document-text-outline"></ion-icon> Download PDF`;
        }
    }


    // --- Event Listeners ---
    reportTypeSelect.addEventListener('change', updateVisibleParameters);
    downloadPdfBtn.addEventListener('click', () => handleDownload('pdf'));
    // downloadCsvBtn.addEventListener('click', () => handleDownload('csv')); // If adding CSV

    // --- Initial Load ---
    loadFilterOptions(); // Load store dropdown options

}); // End DOMContentLoaded