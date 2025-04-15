document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References --- (保持不變)
    const selectFileBtn = document.getElementById('selectFileBtn');
    const generateCloudBtn = document.getElementById('generateCloudBtn');
    const excelFileInput = document.getElementById('excelFile');
    const wordCloudContainer = document.getElementById('wordCloudContainer');
    const statusDiv = document.getElementById('status');

    // --- Global Variables --- (保持不變)
    let selectedFile = null;
    let wordData = [];

    // --- Animation State Variables --- (保持不變)
    let wordSpans = [];
    let wordStates = [];
    let animationFrameId = null;

    // --- *** 新增：將移動速度定義在外部，方便共用 *** ---
    const BASE_MOVE_SPEED = 1.2; // **增加**基礎移動速度 (原為 0.5)
    const MAX_SPEED_MULTIPLIER = 2.0; // 最大速度是基礎速度的多少倍
    const PERTURBATION_FACTOR = 0.3; // **增加**隨機擾動幅度 (原為 0.1)

    // --- Button 1: Trigger File Selection --- (保持不變)
    selectFileBtn.addEventListener('click', () => { /* ... */ });

    // --- File Input Change Event --- (保持不變)
    excelFileInput.addEventListener('change', (event) => { /* ... */ });

    // --- Button 2: Generate Word Cloud --- (大部分不變)
    generateCloudBtn.addEventListener('click', () => {
        // ... (前面讀取、分析、產生 WordCloud 的部分保持不變) ...

        reader.onload = function(e) {
            try {
                // ... (讀取 Excel, 計算詞頻, WordCloud 選項設定等不變) ...

                // WordCloud 選項 (只顯示部分，確保與之前一致)
                 const options = {
                    list: listData,
                    gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),
                    weightFactor: function (size) { /* ... (保持不變) ... */ },
                    fontFamily: 'Arial, sans-serif',
                    color: 'random-dark',
                    backgroundColor: '#ffffff',
                    rotateRatio: 0.4,
                    minSize: 5,
                    shuffle: true,
                    drawOutOfBound: false,
                };

                // Generate the word cloud
                WordCloud(wordCloudContainer, options);

                statusDiv.textContent = '文字雲產生完成！正在啟動動畫...';

                // 4. Initialize and Start Continuous Word Animation (調用不變)
                initializeAndStartAnimation();

            } catch (error) {
                 // ... (錯誤處理不變) ...
            } finally {
                 // ... (finally 區塊不變) ...
            }
        }; // End reader.onload

        // ... (reader.onerror 和 readAsArrayBuffer 不變) ...
    }); // End generateCloudBtn click listener


    // --- Animation Functions (主要修改在這裡) ---

    /**
     * Initializes animation states for each word span and starts the animation loop.
     * Uses the globally defined BASE_MOVE_SPEED.
     */
    function initializeAndStartAnimation() {
        wordSpans = wordCloudContainer.querySelectorAll('span');
        wordStates = [];

        if (wordSpans.length === 0) {
            console.warn("找不到文字元素來執行動畫。");
            return;
        }

        // 使用定義在外部的基礎速度
        const moveSpeed = BASE_MOVE_SPEED;

        wordSpans.forEach(span => {
             if (window.getComputedStyle(span).position !== 'absolute') {
                 span.style.position = 'absolute';
                 console.warn("Word span was not absolutely positioned; forcing.");
            }
            wordStates.push({
                element: span,
                x: parseFloat(span.style.left) || 0,
                y: parseFloat(span.style.top) || 0,
                // 初始速度基於調整後的 moveSpeed
                dx: (Math.random() - 0.5) * 2 * moveSpeed,
                dy: (Math.random() - 0.5) * 2 * moveSpeed
            });
        });

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        animateWords(); // 直接呼叫，不需要傳遞 moveSpeed
        statusDiv.textContent = '文字雲產生完成！動畫已啟動。';
    }

    /**
     * The main animation loop function - MODIFIED FOR MORE DYNAMIC MOVEMENT.
     */
    function animateWords() {
        const containerWidth = wordCloudContainer.offsetWidth;
        const containerHeight = wordCloudContainer.offsetHeight;
        // 使用定義在外部的常數
        const moveSpeed = BASE_MOVE_SPEED;
        const maxSpeed = moveSpeed * MAX_SPEED_MULTIPLIER;
        const perturbation = PERTURBATION_FACTOR;

        wordStates.forEach(state => {
            const elem = state.element;
            const elemWidth = elem.offsetWidth;
            const elemHeight = elem.offsetHeight;

            // 1. Calculate new potential position
            let newX = state.x + state.dx;
            let newY = state.y + state.dy;

            // 2. Boundary Collision Detection and Bounce Logic (MODIFIED)
            let bounced = false;
            // Left boundary
            if (newX < 0) {
                newX = 0;
                state.dx = -state.dx; // 直接反轉速度
                bounced = true;
            }
            // Right boundary
            else if (newX + elemWidth > containerWidth) {
                newX = containerWidth - elemWidth;
                state.dx = -state.dx; // 直接反轉速度
                bounced = true;
            }
            // Top boundary
            if (newY < 0) {
                newY = 0;
                state.dy = -state.dy; // 直接反轉速度
                bounced = true;
            }
            // Bottom boundary
            else if (newY + elemHeight > containerHeight) {
                newY = containerHeight - elemHeight;
                state.dy = -state.dy; // 直接反轉速度
                bounced = true;
            }

            // Update state position AFTER potential clamping
            state.x = newX;
            state.y = newY;

            // 3. Add random perturbation to velocity (MODIFIED - increased magnitude)
            if (!bounced) {
               // 幅度更大的隨機擾動
               state.dx += (Math.random() - 0.5) * perturbation;
               state.dy += (Math.random() - 0.5) * perturbation;
            }

            // 4. Limit maximum speed (Using updated maxSpeed)
            state.dx = Math.max(-maxSpeed, Math.min(maxSpeed, state.dx));
            state.dy = Math.max(-maxSpeed, Math.min(maxSpeed, state.dy));

            // 5. Apply updated position
            elem.style.left = state.x + 'px';
            elem.style.top = state.y + 'px';
        }); // End of wordStates.forEach

        // 6. Request the next animation frame
        animationFrameId = requestAnimationFrame(animateWords);
    } // End of animateWords function

}); // End of DOMContentLoaded
