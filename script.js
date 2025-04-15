document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const selectFileBtn = document.getElementById('selectFileBtn');
    const generateCloudBtn = document.getElementById('generateCloudBtn');
    const excelFileInput = document.getElementById('excelFile');
    const wordCloudContainer = document.getElementById('wordCloudContainer');
    const statusDiv = document.getElementById('status');

    // --- Global Variables ---
    let selectedFile = null; // Stores the selected Excel file object
    let wordData = []; // Stores the raw text extracted from Excel

    // --- Animation State Variables ---
    let wordSpans = []; // Stores the generated word <span> elements
    let wordStates = []; // Stores state for each word {element, x, y, dx, dy}
    let animationFrameId = null; // ID for cancelling animation frame

    // --- Button 1: Trigger File Selection ---
    selectFileBtn.addEventListener('click', () => {
        excelFileInput.click(); // Programmatically click the hidden file input
    });

    // --- File Input Change Event ---
    excelFileInput.addEventListener('change', (event) => {
        // Stop any existing animation when a new file is selected (or selection cancelled)
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        wordStates = []; // Clear animation states

        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            statusDiv.textContent = `已選擇檔案： ${file.name}`;
            generateCloudBtn.disabled = false; // Enable the generate button
            // Clear previous results
            wordCloudContainer.innerHTML = '';
            wordCloudContainer.classList.remove('has-cloud');
            wordData = [];
            // Reset file input to allow re-selecting the same file
            excelFileInput.value = '';
        } else {
            // No file selected or selection cancelled
            statusDiv.textContent = '未選擇任何檔案。';
            generateCloudBtn.disabled = true;
            selectedFile = null;
        }
    });

    // --- Button 2: Generate Word Cloud ---
    generateCloudBtn.
