// renderer.js

document.getElementById('fetchButton').addEventListener('click', async () => {
    try {
      // Example: Fetch orders from your FastAPI backend running on http://127.0.0.1:8000
      const data = await window.api.fetchData('http://127.0.0.1:8000/orders/');
      document.getElementById('output').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      document.getElementById('output').textContent = 'Error fetching data: ' + error;
    }
  });
  