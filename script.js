document.addEventListener('DOMContentLoaded', () => {
    const selectFileBtn = document.getElementById('selectFileBtn');
    const generateCloudBtn = document.getElementById('generateCloudBtn');
    const excelFileInput = document.getElementById('excelFile');
    const wordCloudContainer = document.getElementById('wordCloudContainer');
    const statusDiv = document.getElementById('status');

    let selectedFile = null;
    let wordData = [];

    // --- 新增：動畫相關的全域變數 ---
    let wordSpans = []; // 儲存文字的 <span> 元素
    let wordStates = []; // 儲存每個文字的動畫狀態 {element, x, y, dx, dy}
    let animationFrameId = null; // 儲存 requestAnimationFrame 的 ID

    // --- 按鈕 1: 選擇檔案 (不變) ---
   
        selectFileBtn.addEventListener('click', () => {
        excelFileInput.click();
    });

    // --- 檔案輸入框變更事件 ---
    excelFileInput.addEventListener('change', (event) => {
        // --- 新增：停止當前的動畫 ---
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        wordStates = []; // 清空舊狀態

        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            statusDiv.textContent = `已選擇檔案： ${file.name}`;
            generateCloudBtn.disabled = false;
            wordCloudContainer.innerHTML = '';
            wordCloudContainer.classList.remove('has-cloud');
            wordData = [];
            excelFileInput.value = '';
        } else {
            statusDiv.textContent = '未選擇任何檔案。';
            generateCloudBtn.disabled = true;
            selectedFile = null;
        }
    });

    // --- 按鈕 2: 產生文字雲 ---
    generateCloudBtn.addEventListener('click', () => {
        if (!selectedFile) {
            alert('請先選擇一個 Excel 檔案！');
            return;
        }

        // --- 新增：停止當前的動畫 ---
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        wordStates = []; // 清空舊狀態

        statusDiv.textContent = '正在讀取並處理檔案...';
        generateCloudBtn.disabled = true;

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) throw new Error("Excel 檔案中找不到工作表。");
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 });
                wordData = jsonData.slice(1).map(row => row[0]).filter(text => text !== null && text !== undefined && String(text).trim() !== '').map(text => String(text).trim());

                if (wordData.length === 0) throw new Error("選擇的 Excel 檔案第一欄沒有有效的文字內容。");

                statusDiv.textContent = '正在產生文字雲...';

                const wordFrequencies = {};
                wordData.forEach(text => {
                    const words = text.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        const cleanWord = word.replace(/[.,!?;:()"']/g, '');
                        if (cleanWord) wordFrequencies[cleanWord] = (wordFrequencies[cleanWord] || 0) + 1;
                    });
                });
                const listData = Object.entries(wordFrequencies).map(([word, count]) => [word, count]);

                wordCloudContainer.innerHTML = '';
                wordCloudContainer.classList.add('has-cloud');

                const options = {
                    list: listData,
                    gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),
                    weightFactor: function (size) {
                        const containerHeight = wordCloudContainer.offsetHeight;
                        const containerWidth = wordCloudContainer.offsetWidth;
                        let calculatedSize = Math.pow(size, 0.9) * (containerWidth / 1024) * 10;
                        const maxSize = Math.min(containerHeight / 3.5, containerWidth / 3);
                        return Math.min(calculatedSize, maxSize);
                    },
                    fontFamily: 'Arial, sans-serif',
                    color: 'random-dark',
                    backgroundColor: '#ffffff',
                    rotateRatio: 0.5,
                    minSize: 5,
                    shuffle: true,
                    drawOutOfBound: false,
                    // *** 重要：WordCloud2 需要能回調 ***
                    // 我們使用 'hover' 事件來觸發，雖然有點取巧，
                    // 但可以確保元素已渲染。或者設置一個短延遲。
                    // 一個更可靠的方式是監聽容器的 DOM 變化，但較複雜。
                    // 這裡我們在 WordCloud 調用後直接啟動。
                };

                // --- 執行 WordCloud ---
                WordCloud(wordCloudContainer, options);

                statusDiv.textContent = '文字雲產生完成！正在啟動動畫...';

                // --- 新增：啟動文字移動動畫 ---
                initializeAndStartAnimation();


            } catch (error) {
                console.error("處理 Excel 或產生文字雲時發生錯誤:", error);
                statusDiv.textContent = `發生錯誤： ${error.message}`;
                alert(`處理檔案時發生錯誤： ${error.message}`);
                wordCloudContainer.innerHTML = '產生失敗';
                wordCloudContainer.classList.remove('has-cloud');
            } finally {
                generateCloudBtn.disabled = false;
            }
        };

        reader.onerror = function(e) {
            console.error("讀取檔案時發生錯誤:", e);
            statusDiv.textContent = '讀取檔案失敗！';
            alert('讀取檔案失敗！');
            generateCloudBtn.disabled = false;
        };

        reader.readAsArrayBuffer(selectedFile);
    });

    // --- 新增：初始化並啟動動畫的函數 ---
    function initializeAndStartAnimation() {
        wordSpans = wordCloudContainer.querySelectorAll('span');
        wordStates = []; // 重置狀態

        if (wordSpans.length === 0) {
            console.warn("找不到文字元素來執行動畫。");
            return;
        }

        const moveSpeed = 0.5; // 控制基礎移動速度，可調整

        wordSpans.forEach(span => {
            // 確保 span 有 position: absolute，WordCloud2 通常會設定
            if (window.getComputedStyle(span).position !== 'absolute') {
                 span.style.position = 'relative'; // 或 absolute，依賴 WordCloud 輸出
                 // 如果 WordCloud2 未設定 absolute，此動畫邏輯需大改
                 console.warn("Word span is not absolutely positioned, animation might not work as expected.");
            }
            wordStates.push({
                element: span,
                x: parseFloat(span.style.left) || 0, // 從樣式讀取初始位置
                y: parseFloat(span.style.top) || 0,
                dx: (Math.random() - 0.5) * 2 * moveSpeed, // 隨機初始速度 (-moveSpeed to +moveSpeed)
                dy: (Math.random() - 0.5) * 2 * moveSpeed
            });
        });

        // 清除可能殘留的舊幀
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        // 啟動動畫循環
        animateWords();
        statusDiv.textContent = '文字雲產生完成！動畫已啟動。';
    }

    // --- 新增：動畫循環函數 ---
    function animateWords() {
        const containerWidth = wordCloudContainer.offsetWidth;
        const containerHeight = wordCloudContainer.offsetHeight;

        wordStates.forEach(state => {
            const elem = state.element;
            const elemWidth = elem.offsetWidth;
            const elemHeight = elem.offsetHeight;

            // 1. 計算新位置
            state.x += state.dx;
            state.y += state.dy;

            // 2. 邊界檢測與反彈
            // 左邊界
            if (state.x < 0) {
                state.x = 0;
                state.dx = -state.dx * (0.8 + Math.random() * 0.4); // 反彈並加一點隨機性
            }
            // 右邊界
            if (state.x + elemWidth > containerWidth) {
                state.x = containerWidth - elemWidth;
                state.dx = -state.dx * (0.8 + Math.random() * 0.4);
            }
            // 上邊界
            if (state.y < 0) {
                state.y = 0;
                state.dy = -state.dy * (0.8 + Math.random() * 0.4);
            }
            // 下邊界
            if (state.y + elemHeight > containerHeight) {
                state.y = containerHeight - elemHeight;
                state.dy = -state.dy * (0.8 + Math.random() * 0.4);
            }

             // 隨機微擾速度，避免直線運動
             state.dx += (Math.random() - 0.5) * 0.1;
             state.dy += (Math.random() - 0.5) * 0.1;
             // 限制最大速度 (可選)
             const maxSpeed = moveSpeed * 2;
             state.dx = Math.max(-maxSpeed, Math.min(maxSpeed, state.dx));
             state.dy = Math.max(-maxSpeed, Math.min(maxSpeed, state.dy));


            // 3. 應用新位置
            elem.style.left = state.x + 'px';
            elem.style.top = state.y + 'px';
        });

        // 4. 請求下一幀
        animationFrameId = requestAnimationFrame(animateWords);
    }

}); // End of DOMContentLoaded
