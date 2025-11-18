async function sendVehicleReport(formData) {
    try {
        const response = await fetch("http://127.0.0.1:8000/report-vehicle", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        console.log("Backend Response:", data);

        if (!data || !data.result) {
            alert("No result from backend");
            return;
        }

        let cameraId = data.result.best_camera;
        let similarity = data.result.best_similarity;

        if (!cameraId) {
            alert("No matching camera found");
            return;
        }

        // Call map highlight function
        if (typeof highlightCamera === "function") {
            highlightCamera(cameraId);
        }

        // Show match info
        alert(
            "Vehicle found at: " + cameraId +
            "\nSimilarity: " + (similarity ? similarity.toFixed(3) : "N/A")
        );

    } catch (error) {
        console.error("Error calling backend:", error);
        alert("Failed to connect to backend");
    }
}
