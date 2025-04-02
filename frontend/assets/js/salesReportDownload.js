document.addEventListener("DOMContentLoaded", () => {
    const downloadBtn = document.getElementById("downloadReportBtn");
    const reportPeriodSelect = document.getElementById("reportPeriod");
  
    downloadBtn.addEventListener("click", () => {
      const period = reportPeriodSelect.value;
      // Construct URL to the backend endpoint with the selected period.
      const url = `http://127.0.0.1:8000/sales_report/pdf?period=${period}`;
      // Open the URL in a new window/tab to trigger the download.
      window.open(url, "_blank");
    });
  });
  