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

                // Check if jieba library is loaded
                if (typeof jieba === 'undefined') {
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
                // Error Handling
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
        };

        reader.onerror = function(e) {
            // File Reading Error Handling
            console.error("讀取檔案時發生錯誤:", e);
            statusDiv.textContent = '讀取檔案失敗！';
            alert('讀取檔案失敗！');
            generateCloudBtn.disabled = false; // Re-enable button
        };

        // Start reading the selected file as an ArrayBuffer
        reader.readAsArrayBuffer(selectedFile);
    });

    // --- Animation Functions ---

    /**
     * Initializes animation states for each word span and starts the animation loop.
     */
    function initializeAndStartAnimation() {
        wordSpans = wordCloudContainer.querySelectorAll('span'); // Get all word spans
        wordStates = []; // Reset states array

        if (wordSpans.length === 0) {
            console.warn("找不到文字元素來執行動畫。");
            return;
        }

        const moveSpeed = 0.5; // Base movement speed, adjust as needed

        wordSpans.forEach(span => {
            // Ensure spans are absolutely positioned (WordCloud2 usually does this)
             if (window.getComputedStyle(span).position !== 'absolute') {
                 span.style.position = 'absolute'; // Force absolute if needed
                 console.warn("Word span was not absolutely positioned; forcing. Animation might be affected if WordCloud2 output changes.");
            }
            // Store initial state: element, position (read from style), random velocity
            wordStates.push({
                element: span,
                x: parseFloat(span.style.left) || 0,
                y: parseFloat(span.style.top) || 0,
                dx: (Math.random() - 0.5) * 2 * moveSpeed, // Random X velocity
                dy: (Math.random() - 0.5) * 2 * moveSpeed  // Random Y velocity
            });
        });

        // Cancel any previous animation frame before starting a new one
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        // Start the animation loop
        animateWords();
        statusDiv.textContent = '文字雲產生完成！動畫已啟動。';
    }

    /**
     * The main animation loop using requestAnimationFrame.
     * Updates position, handles boundary collision (bounce), and applies styles.
     */
    function animateWords() {
        const containerWidth = wordCloudContainer.offsetWidth;
        const containerHeight = wordCloudContainer.offsetHeight;

        wordStates.forEach(state => {
            const elem = state.element;
            // Get element dimensions (consider caching if performance is critical)
            const elemWidth = elem.offsetWidth;
            const elemHeight = elem.offsetHeight;

            // 1. Update position based on velocity
            state.x += state.dx;
            state.y += state.dy;

            // 2. Boundary Collision Detection and Bounce
            let bounced = false;
            // Left boundary
            if (state.x < 0) {
                state.x = 0;
                state.dx = Math.abs(state.dx) * (0.8 + Math.random() * 0.4); // Bounce right + slight randomness
                bounced = true;
            }
            // Right boundary
            if (state.x + elemWidth > containerWidth) {
                state.x = containerWidth - elemWidth;
                state.dx = -Math.abs(state.dx) * (0.8 + Math.random() * 0.4); // Bounce left + slight randomness
                bounced = true;
            }
            // Top boundary
            if (state.y < 0) {
                state.y = 0;
                state.dy = Math.abs(state.dy) * (0.8 + Math.random() * 0.4); // Bounce down + slight randomness
                bounced = true;
            }
            // Bottom boundary
            if (state.y + elemHeight > containerHeight) {
                state.y = containerHeight - elemHeight;
                state.dy = -Math.abs(state.dy) * (0.8 + Math.random() * 0.4); // Bounce up + slight randomness
                bounced = true;
            }

             // 3. Add slight random perturbation to velocity for non-linear movement
             if (!bounced) { // Only perturb if not bouncing to avoid erratic jumps at edges
                state.dx += (Math.random() - 0.5) * 0.1;
                state.dy += (Math.random() - 0.5) * 0.1;
             }

             // 4. Optional: Limit maximum speed
             const maxSpeed = moveSpeed * 2;
             state.dx = Math.max(-maxSpeed, Math.min(maxSpeed, state.dx));
             state.dy = Math.max(-maxSpeed, Math.min(maxSpeed, state.dy));

            // 5. Apply updated position to the element's style
            elem.style.left = state.x + 'px';
            elem.style.top = state.y + 'px';
        });

        // 6. Request the next frame to continue the loop
        animationFrameId = requestAnimationFrame(animateWords);
    }

}); // End of DOMContentLoaded
