fetch("http://127.0.0.1:8000/products")
    .then(response => response.json())
    .then(data => {
        console.log(data);
        document.getElementById("products").innerText = JSON.stringify(data, null, 2);
    });
