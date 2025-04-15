/**
 * Dynamic Chinese Word Cloud Generator Script
 * Author: Gemini AI Assistant
 * Last Updated: 2025-04-15 (Based on user interaction)
 * Description: Reads the first column of an Excel file, performs Chinese word segmentation,
 * generates an animated word cloud respecting container boundaries,
 * and applies size capping and stop word filtering.
 */
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
    generateCloudBtn.addEventListener('click', () => {
        if (!selectedFile) {
            alert('請先選擇一個 Excel 檔案！');
            return;
        }

        // Stop any potentially running animation from a previous generation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        wordStates = []; // Clear animation states

        statusDiv.textContent = '正在讀取並處理檔案...';
        generateCloudBtn.disabled = true; // Disable button during processing

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                // 1. Read Excel Data using SheetJS
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    throw new Error("Excel 檔案中找不到工作表。");
                }
                const worksheet = workbook.Sheets[firstSheetName];

                // Extract text from the first column (A) into an array of strings
                // header: 1 converts rows to arrays; range: 0 limits to the first column
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 });

                // Process rows: skip header (slice(1)), get first cell (row[0]), filter empty/null, trim whitespace
                wordData = jsonData
                    .slice(1) // Assuming first row is header, remove if not
                    .map(row => row[0])
                    .filter(text => text !== null && text !== undefined && String(text).trim() !== '')
                    .map(text => String(text).trim());

                if (wordData.length === 0) {
                    throw new Error("選擇的 Excel 檔案第一欄沒有有效的文字內容。");
                }

                // 2. Calculate Word Frequencies using Jieba for Chinese Segmentation
                statusDiv.textContent = '正在執行中文斷詞並計算詞頻...';
                const wordFrequencies = {};

                // Check if jieba library is loaded (crucial for error handling)
                if (typeof jieba === 'undefined') {
                    // This error message is triggered if the CDN link in index.html fails to load
                    throw new Error("中文斷詞函式庫 (jieba-js) 未能成功載入！請檢查 HTML 中的 CDN 連結及網路連線。");
                }

                // Define Chinese stop words (customize as needed)
                const stopWords = new Set([
                    '的', '了', '是', '我', '你', '他', '她', '它', '們', '一個', '也', '在', '有', '和', '就', '不', '人', '都', '而', '及',
                    '與', '或', '這個', '那個', '我們', '你們', '他們', '她們', '它們', '之', '其', '或', '等', '於', '以', '及', '因', '為',
                    '從', '到', '由', '向', '於', '自', '至', '諸', '乎', '哉', '也', '但', '並', '且', '所', '把', '被', '將', '使', '得',
                     '對', '來說', '對於', '關於', '的話', '然而', '因此', '所以', '因為', '由於', '此外', '另外', '還有', '以及', '例如',
                     '!', '?', '.', ',', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}', '、', '。', '，', '！', '？', '；', '：', '“', '”',
                     '‘', '’', '（', '）', '【', '】', '《', '》', '「', '」', '『', '』', ' ', '\t', '\n', '\r' // Include symbols/whitespace
                ]);

                // Regex to remove punctuation and digits
                const punctuationRegex = /[\s\.。,，!！?？;；:：、\'\"“”‘’「」『』（）《》〈〉【】\[\]{}~～@#\$%\^&\*()_\+\-=|\\`\d]+/g;

                wordData.forEach(text => {
                    const segmentedWords = jieba.cut(String(text)); // Perform segmentation

                    segmentedWords.forEach(word => {
                        const cleanWord = word.replace(punctuationRegex, ''); // Clean word

                        // Filter: non-empty, longer than 1 char (optional), not a stop word
                        if (cleanWord && cleanWord.length > 1 && !stopWords.has(cleanWord)) {
                            wordFrequencies[cleanWord] = (wordFrequencies[cleanWord] || 0) + 1;
                        }
                    });
                });

                // Convert frequency map to WordCloud2 list format: [['word', size], ...]
                const listData = Object.entries(wordFrequencies).map(([word, count]) => [word, count]);

                if (listData.length === 0) {
                     throw new Error("經過斷詞與過濾後，沒有有效的詞彙可產生文字雲。請檢查 Excel 內容或調整停用詞列表。");
                }

                // 3. Prepare and Generate Word Cloud using WordCloud2.js
                wordCloudContainer.innerHTML = ''; // Clear previous cloud
                wordCloudContainer.classList.add('has-cloud'); // Add class for CSS styling (e.g., hide placeholder)
                statusDiv.textContent = '正在產生文字雲...';

                // WordCloud2 Options
                const options = {
                    list: listData, // Word frequency data
                    gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024), // Adjust grid based on container size
                    // Function to determine word size, capped to prevent oversized words
                    weightFactor: function (size) {
                        const containerHeight = wordCloudContainer.offsetHeight;
                        const containerWidth = wordCloudContainer.offsetWidth;
                        // Adjust base size calculation (exponent, multiplier) as needed
                        let calculatedSize = Math.pow(size, 0.9) * (containerWidth / 1024) * 10;
                        // Set max size relative to container dimensions
                        const maxSize = Math.min(containerHeight / 3.5, containerWidth / 3);
                        // Return the smaller of calculated size or max size, but respect minSize implicitly
                        return Math.min(calculatedSize, maxSize);
                    },
                    fontFamily: '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif', // CJK fonts + fallback
                    color: 'random-dark', // Word color scheme
                    backgroundColor: '#ffffff', // Background of the cloud area
                    rotateRatio: 0.4, // Proportion of words to rotate (0 to 1)
                    minSize: 8, // Minimum font size (pixels), slightly larger for CJK
                    shuffle: true, // Randomize word placement order
                    drawOutOfBound: false, // Prevent words from drawing outside the container
                };

                // Generate the word cloud
                WordCloud(wordCloudContainer, options);

                statusDiv.textContent = '文字雲產生完成！正在啟動動畫...';

                // 4. Initialize and Start Continuous Word Animation
                initializeAndStartAnimation();

            } catch (error) {
                // Error Handling within file processing and cloud generation
                console.error("處理過程發生錯誤:", error);
                statusDiv.textContent = `發生錯誤： ${error.message}`;
                alert(`處理檔案時發生錯誤： ${error.message}`);
                // Ensure animation stops on error
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                wordStates = [];
                wordCloudContainer.innerHTML = '產生失敗'; // Display error in container
                wordCloudContainer.classList.remove('has-cloud');
            } finally {
                // Re-enable the generate button regardless of success or failure
                generateCloudBtn.disabled = false;
            }
        }; // End of reader.onload

        reader.onerror = function(e) {
            // File Reading Error Handling
            console.error("讀取檔案時發生錯誤:", e);
            statusDiv.textContent = '讀取檔案失敗！';
            alert('讀取檔案失敗！');
            generateCloudBtn.disabled = false; // Re-enable button
        };

        // Start reading the selected file as an ArrayBuffer (needed by SheetJS)
        reader.readAsArrayBuffer(selectedFile);
    }); // End of generateCloudBtn click listener

    // --- Animation Functions ---

    /**
     * Initializes animation states for each word span and starts the animation loop.
     * This function is called after WordCloud() successfully generates the spans.
     */
    function initializeAndStartAnimation() {
        wordSpans = wordCloudContainer.querySelectorAll('span'); // Get all word spans generated by WordCloud2

        // Reset states array for the new cloud
        wordStates = [];

        if (wordSpans.length === 0) {
            console.warn("找不到文字元素來執行動畫 (可能詞彙過少或 WordCloud 尚未完成)。");
            return; // No spans found, cannot animate
        }

        const moveSpeed = 0.5; // Base movement speed, adjust for faster/slower animation

        wordSpans.forEach(span => {
            // Ensure spans are absolutely positioned for left/top manipulation
            // WordCloud2 generally sets this, but we double-check/force it if needed.
            if (window.getComputedStyle(span).position !== 'absolute') {
                 span.style.position = 'absolute';
                 console.warn("Word span was not absolutely positioned; forcing. Animation might be affected if WordCloud2 output changes.");
            }
            // Store initial state: the DOM element, its starting position (read from inline style),
            // and a random initial velocity vector (dx, dy).
            wordStates.push({
                element: span,
                x: parseFloat(span.style.left) || 0, // Get initial X from style, default to 0
                y: parseFloat(span.style.top) || 0,  // Get initial Y from style, default to 0
                dx: (Math.random() - 0.5) * 2 * moveSpeed, // Random X velocity (-moveSpeed to +moveSpeed)
                dy: (Math.random() - 0.5) * 2 * moveSpeed  // Random Y velocity (-moveSpeed to +moveSpeed)
            });
        });

        // Cancel any previous animation frame before starting a new loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        // Start the animation loop using requestAnimationFrame
        animateWords();
        statusDiv.textContent = '文字雲產生完成！動畫已啟動。';
    }

    /**
     * The main animation loop function, called repeatedly via requestAnimationFrame.
     * Updates position, handles boundary collision (bounce), and applies styles to word spans.
     */
    function animateWords() {
        // Get current container dimensions (can change if window is resized)
        const containerWidth = wordCloudContainer.offsetWidth;
        const containerHeight = wordCloudContainer.offsetHeight;

        // Update each word's state
        wordStates.forEach(state => {
            const elem = state.element;
            // Get element dimensions (needed for boundary check)
            // Consider caching these if elements don't resize and performance is critical
            const elemWidth = elem.offsetWidth;
            const elemHeight = elem.offsetHeight;

            // 1. Calculate new potential position based on current velocity
            let newX = state.x + state.dx;
            let newY = state.y + state.dy;

            // 2. Boundary Collision Detection and Bounce Logic
            let bounced = false; // Flag to avoid double-perturbation on bounce frames
            // Left boundary collision
            if (newX < 0) {
                newX = 0; // Clamp position to edge
                state.dx = Math.abs(state.dx) * (0.8 + Math.random() * 0.4); // Reverse X velocity + slight random factor
                bounced = true;
            }
            // Right boundary collision
            else if (newX + elemWidth > containerWidth) {
                newX = containerWidth - elemWidth; // Clamp position to edge
                state.dx = -Math.abs(state.dx) * (0.8 + Math.random() * 0.4); // Reverse X velocity + slight random factor
                bounced = true;
            }
            // Top boundary collision
            if (newY < 0) {
                newY = 0; // Clamp position to edge
                state.dy = Math.abs(state.dy) * (0.8 + Math.random() * 0.4); // Reverse Y velocity + slight random factor
                bounced = true;
            }
            // Bottom boundary collision
            else if (newY + elemHeight > containerHeight) {
                newY = containerHeight - elemHeight; // Clamp position to edge
                state.dy = -Math.abs(state.dy) * (0.8 + Math.random() * 0.4); // Reverse Y velocity + slight random factor
                bounced = true;
            }

            // Update state position
            state.x = newX;
            state.y = newY;

            // 3. Add slight random perturbation to velocity for non-linear movement
            // Apply only if not bouncing in this frame to prevent excessive jitter at edges
            if (!bounced) {
               state.dx += (Math.random() - 0.5) * 0.1; // Small random change in dx
               state.dy += (Math.random() - 0.5) * 0.1; // Small random change in dy
            }

            // 4. Optional: Limit maximum speed to prevent words from moving too fast
            const maxSpeed = moveSpeed * 2; // Define a maximum speed
            state.dx = Math.max(-maxSpeed, Math.min(maxSpeed, state.dx));
            state.dy = Math.max(-maxSpeed, Math.min(maxSpeed, state.dy));

            // 5. Apply the updated position to the actual DOM element's style
            elem.style.left = state.x + 'px';
            elem.style.top = state.y + 'px';
        }); // End of wordStates.forEach

        // 6. Request the next animation frame to continue the loop
        animationFrameId = requestAnimationFrame(animateWords);
    } // End of animateWords function

}); // End of DOMContentLoaded listener
