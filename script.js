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
    // ... (停止動畫, 檢查 selectedFile 等不變) ...

    reader.onload = function(e) {
        try {
            // ... (讀取 Excel, 獲取 wordData 的代碼不變) ...

            if (wordData.length === 0) throw new Error("選擇的 Excel 檔案第一欄沒有有效的文字內容。");

            // --- *** 修改：詞頻計算邏輯 *** ---
            statusDiv.textContent = '正在分析文字並計算詞頻...';
            const wordFrequencies = {};

            // 檢查 jieba 是否已載入
            if (typeof jieba === 'undefined') {
                throw new Error("中文斷詞函式庫 (jieba-js) 未能成功載入！請檢查網路連線或 CDN 連結。");
            }

            // 定義中文停用詞 (可根據需要擴充)
            const stopWords = new Set([
                '的', '了', '是', '我', '你', '他', '她', '它', '們', '一個', '也', '在', '有', '和', '就', '不', '人', '都', '而', '及',
                '與', '或', '這個', '那個', '我們', '你們', '他們', '她們', '它們', '之', '其', '或', '等', '於', '以', '及', '因', '為',
                '從', '到', '由', '向', '於', '自', '至', '諸', '乎', '哉', '也', '但', '並', '且', '所', '把', '被', '將', '使', '得',
                 '對', '來說', '對於', '關於', '的話', '然而', '因此', '所以', '因為', '由於', '此外', '另外', '還有', '以及', '例如',
                 '!', '?', '.', ',', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}', '、', '。', '，', '！', '？', '；', '：', '“', '”',
                 '‘', '’', '（', '）', '【', '】', '《', '》', '「', '」', '『', '』', ' ', '\t', '\n', '\r' // 也包含一些符號和空白
            ]);

            // 定義更全面的標點符號和空白的正規表示式
            const punctuationRegex = /[\s\.。,，!！?？;；:：、\'\"“”‘’「」『』（）《》〈〉【】\[\]{}~～@#\$%\^&\*()_\+\-=|\\`\d]+/g; // 加入了數字 \d

            wordData.forEach(text => {
                // 使用 jieba.cut 進行斷詞
                const segmentedWords = jieba.cut(String(text)); // 確保輸入是字串

                segmentedWords.forEach(word => {
                    // 去除標點符號和數字
                    const cleanWord = word.replace(punctuationRegex, '');

                    // 過濾掉空字串、單個字元（可選，有時需要保留單字詞）以及停用詞
                    if (cleanWord && cleanWord.length > 1 && !stopWords.has(cleanWord)) {
                        // 直接使用詞彙本身作為 key，中文通常不需轉小寫
                        wordFrequencies[cleanWord] = (wordFrequencies[cleanWord] || 0) + 1;
                    }
                });
            });
            // --- *** 詞頻計算邏輯修改結束 *** ---


            const listData = Object.entries(wordFrequencies).map(([word, count]) => [word, count]);

            if (listData.length === 0) {
                 throw new Error("經過斷詞與過濾後，沒有有效的詞彙可產生文字雲。");
            }

            wordCloudContainer.innerHTML = '';
            wordCloudContainer.classList.add('has-cloud');
            statusDiv.textContent = '正在產生文字雲...';

            // --- *** 修改：WordCloud2 選項中的字體 *** ---
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
                // *** 修改字體設定 ***
                fontFamily: '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif', // 優先使用常見的繁中字體
                color: 'random-dark',
                backgroundColor: '#ffffff',
                rotateRatio: 0.5,
                minSize: 8, // 中文字體建議最小尺寸稍大一點
                shuffle: true,
                drawOutOfBound: false,
            };
            // --- *** 字體修改結束 *** ---

            WordCloud(wordCloudContainer, options);
            statusDiv.textContent = '文字雲產生完成！正在啟動動畫...';
            initializeAndStartAnimation(); // 保持動畫啟動不變

        } catch (error) {
            // ... (錯誤處理不變) ...
             console.error("處理過程發生錯誤:", error);
             statusDiv.textContent = `發生錯誤： ${error.message}`;
             alert(`處理檔案時發生錯誤： ${error.message}`);
             // 確保動畫停止
             if (animationFrameId) {
                 cancelAnimationFrame(animationFrameId);
                 animationFrameId = null;
             }
             wordStates = [];
             wordCloudContainer.innerHTML = '產生失敗';
             wordCloudContainer.classList.remove('has-cloud');
        } finally {
            generateCloudBtn.disabled = false;
        }
    };

    // ... (reader.onerror, initializeAndStartAnimation, animateWords 函數保持不變) ...
     reader.readAsArrayBuffer(selectedFile);
});
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

        const moveSpeed = 3; // 控制基礎移動速度，可調整

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
             const maxSpeed = moveSpeed * 10;
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
