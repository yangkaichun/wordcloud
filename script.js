// --- 設定 ---
// 設定要讀取的 Excel 欄位索引 (0 代表第一欄, 1 代表第二欄, 依此類推)
const TARGET_COLUMN_INDEX = 0;
// --- 設定結束 ---


// 取得 DOM 元素
const selectFileButton = document.getElementById('selectFileButton');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const generateCloudButton = document.getElementById('generateCloudButton');
const wordCloudContainer = document.getElementById('wordCloudContainer');
const loadingMessage = document.getElementById('loadingMessage');

let selectedFile = null; // 用於儲存使用者選擇的檔案

// 按鈕 1 的點擊事件：觸發隱藏的 file input
selectFileButton.addEventListener('click', () => {
    fileInput.click(); // 模擬點擊隱藏的檔案輸入框
});

// 檔案輸入框的變更事件：當使用者選擇檔案後觸發
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        selectedFile = files[0];
        fileNameDisplay.textContent = `已選擇檔案： ${selectedFile.name}`;
        generateCloudButton.disabled = false; // 啟用生成按鈕
        wordCloudContainer.innerHTML = ''; // 清除之前的文字雲
        loadingMessage.style.display = 'none'; // 隱藏載入訊息
    } else {
        selectedFile = null;
        fileNameDisplay.textContent = '尚未選擇檔案';
        generateCloudButton.disabled = true; // 禁用生成按鈕
    }
    // 清除 input 的值，這樣即使選擇同一個檔案也能再次觸發 change 事件
    fileInput.value = null;
});

// 按鈕 2 的點擊事件：讀取 Excel 並生成文字雲
generateCloudButton.addEventListener('click', () => {
    if (!selectedFile) {
        alert('請先選擇一個 Excel 檔案！');
        return;
    }

    // 禁用按鈕並顯示載入訊息，防止重複點擊
    generateCloudButton.disabled = true;
    selectFileButton.disabled = true;
    loadingMessage.style.display = 'block';
    wordCloudContainer.innerHTML = ''; // 清除舊的文字雲

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            // 使用 SheetJS 解析 Excel 檔案
            const workbook = XLSX.read(data, { type: 'array' });

            // 獲取第一個工作表名稱
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                throw new Error("Excel 檔案中找不到工作表。");
            }
            const worksheet = workbook.Sheets[firstSheetName];

            // 將工作表轉換為 Array of Arrays (AoA) 格式
            // {header: 1} 表示第一行是標頭，會轉換成物件陣列
            // range 選項可以限制讀取的範圍，例如 'A2:A100' 只讀取 A2 到 A100
            // defval: '' 若儲存格為空，給予空字串
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            // --- 提取目標欄位的文字 ---
            let allText = "";
            // 從第二行開始讀取 (假設第一行是標題)
            // 如果沒有標題行，可以從 i = 0 開始
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                // 確保該行存在且目標欄位索引有效
                if (row && row.length > TARGET_COLUMN_INDEX) {
                    const cellValue = String(row[TARGET_COLUMN_INDEX]).trim(); // 轉換為字串並去除前後空白
                    if (cellValue) { // 只處理非空字串
                        allText += cellValue + " "; // 將所有文字串接起來，用空格分隔
                    }
                }
            }

            if (!allText.trim()) {
                 throw new Error(`指定的欄位 (第 ${TARGET_COLUMN_INDEX + 1} 欄) 沒有找到可用的文字內容。`);
            }

            // --- 文字處理與詞頻計算 (基礎：按空白分割) ---
            const words = allText.toLowerCase().split(/\s+/).filter(word => word.length > 1); // 轉小寫、用空白分割、過濾掉單個字元

            const wordCounts = {};
            words.forEach(word => {
                // 基本過濾: 可以增加更多停用詞或正則表達式過濾
                if (word && !/^[0-9]+$/.test(word)) { // 過濾純數字
                   wordCounts[word] = (wordCounts[word] || 0) + 1;
                }
            });

            // 將詞頻物件轉換為 wordcloud2.js 需要的陣列格式 [[word, count], ...]
            const listData = Object.entries(wordCounts)
                                   .sort((a, b) => b[1] - a[1]); // 依詞頻排序 (可選)

            if (listData.length === 0) {
                throw new Error("處理後沒有有效的詞語可生成文字雲。");
            }

            // --- 使用 wordcloud2.js 生成文字雲 ---
            WordCloud(wordCloudContainer, {
                list: listData,
                gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),
                weightFactor: function (size) {
                    // 調整字體大小的權重，可以自行調整公式
                    return Math.pow(size, 0.8) * wordCloudContainer.offsetWidth / 512;
                },
                fontFamily: 'Microsoft YaHei, sans-serif', // 字體
                color: 'random-dark', // 顏色配置
                backgroundColor: '#f0f0f0', // 背景色
                rotateRatio: 0.5, // 旋轉比例
                minSize: 5 // 最小字體大小
                // 更多選項參考 wordcloud2.js 文件
            });

        } catch (error) {
            console.error("處理 Excel 檔案或生成文字雲時發生錯誤:", error);
            alert(`處理失敗：${error.message}`);
            wordCloudContainer.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">無法生成文字雲，請檢查檔案格式或內容。<br>${error.message}</p>`;
        } finally {
             // 無論成功或失敗，都要重新啟用按鈕並隱藏載入訊息
            generateCloudButton.disabled = false;
            selectFileButton.disabled = false;
            loadingMessage.style.display = 'none';
        }
    };

    reader.onerror = function(e) {
        console.error("讀取檔案時發生錯誤:", e);
        alert('讀取檔案失敗！');
        generateCloudButton.disabled = false; // 重新啟用按鈕
        selectFileButton.disabled = false;
        loadingMessage.style.display = 'none'; // 隱藏載入訊息
    };

    // 以 ArrayBuffer 格式讀取檔案內容
    reader.readAsArrayBuffer(selectedFile);
});
