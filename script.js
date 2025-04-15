document.addEventListener('DOMContentLoaded', () => {
    const selectFileBtn = document.getElementById('selectFileBtn');
    const generateCloudBtn = document.getElementById('generateCloudBtn');
    const excelFileInput = document.getElementById('excelFile');
    const wordCloudContainer = document.getElementById('wordCloudContainer');
    const statusDiv = document.getElementById('status');

    let selectedFile = null;
    let wordData = []; // 用於儲存從 Excel 提取的文字列表

    // --- 按鈕 1: 選擇檔案 ---
    selectFileBtn.addEventListener('click', () => {
        excelFileInput.click(); // 觸發隱藏的 file input
    });

    // --- 檔案輸入框變更事件 ---
    excelFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            statusDiv.textContent = `已選擇檔案： ${file.name}`;
            generateCloudBtn.disabled = false; // 啟用產生按鈕
            // 清除舊的文字雲和資料
            wordCloudContainer.innerHTML = '';
            wordCloudContainer.classList.remove('has-cloud');
            wordData = [];
            // 重置 file input 的值，以便可以重新選擇同一個檔案
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

        statusDiv.textContent = '正在讀取並處理檔案...';
        generateCloudBtn.disabled = true; // 防止重複點擊

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 假設我們要讀取第一個工作表
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    throw new Error("Excel 檔案中找不到工作表。");
                }
                const worksheet = workbook.Sheets[firstSheetName];

                // 將工作表轉換為 JSON 陣列 (每個元素是一列，header: 1 表示將每行轉為陣列)
                // range: 0 表示讀取第一欄 (A欄)
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 });

                // 提取第一欄的所有文字 (跳過可能的標題行，這裡假設第一行是標題，所以從索引 1 開始)
                wordData = jsonData
                    .slice(1) // 如果沒有標題行，可以移除 .slice(1)
                    .map(row => row[0]) // 取每列的第一個元素 (A欄)
                    .filter(text => text !== null && text !== undefined && String(text).trim() !== '') // 過濾空值或純空白
                    .map(text => String(text).trim()); // 轉換為字串並去除前後空白

                if (wordData.length === 0) {
                    throw new Error("選擇的 Excel 檔案第一欄沒有有效的文字內容。");
                }

                statusDiv.textContent = '正在產生文字雲...';

                // 1. 計算詞頻
                const wordFrequencies = {};
                wordData.forEach(text => {
                    // 簡單的分詞 (可以根據需要使用更複雜的分詞庫)
                    // 這裡僅以空格分隔，並轉為小寫以統一計算
                    const words = text.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        // 移除基本標點符號 (可擴充)
                        const cleanWord = word.replace(/[.,!?;:()"']/g, '');
                        if (cleanWord) {
                            wordFrequencies[cleanWord] = (wordFrequencies[cleanWord] || 0) + 1;
                        }
                    });
                });

                // 2. 將詞頻轉換為 WordCloud2.js 需要的格式 [ [word, frequency], ... ]
                const listData = Object.entries(wordFrequencies).map(([word, count]) => [word, count]);

                // 3. 清除舊的文字雲並產生新的
                wordCloudContainer.innerHTML = ''; // 清空容器
                wordCloudContainer.classList.add('has-cloud'); // 標記已有雲圖 (用於CSS隱藏提示)

                // 4. 設定 WordCloud2 選項並繪製
const options = {
            list: listData,
            gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),

            // *** 修改 weightFactor ***
            weightFactor: function (size) {
                const containerHeight = wordCloudContainer.offsetHeight;
                const containerWidth = wordCloudContainer.offsetWidth;
                // 基礎大小計算 (可以保持或調整)
                // 我們乘以一個較小的基礎比例因子，讓大小對頻率的反應不至於太劇烈
                let calculatedSize = Math.pow(size, 0.9) * (containerWidth / 1024) * 10; // 降低指數和基礎比例因子

                // *** 設定最大字體大小上限 ***
                // 讓最大字體不超過容器高度的 1/3 或 1/4 是一個常見做法
                // 同時也考慮容器寬度，取較小者的一部分作為限制
                const maxSize = Math.min(containerHeight / 3.5, containerWidth / 3); // 例如，不超過高度的1/3.5或寬度的1/3

                // 確保計算出的尺寸不超過最大限制，同時也不會小於 minSize
                // Math.min 用於確保不超過 maxSize
                // minSize 會由 WordCloud 內部處理，我們主要關心上限
                return Math.min(calculatedSize, maxSize);
            },

            fontFamily: 'Arial, sans-serif',
            color: 'random-dark',
            backgroundColor: '#ffffff',
            rotateRatio: 0.5, // 保持旋轉
            minSize: 5,       // 最小字體大小
            shuffle: true,    // 保持隨機繪製

            // ***** 新增的選項 *****
            drawOutOfBound: false, // <--- 新增：禁止繪製超出邊界的文字

            // 其他可能的選項保持不變或根據需要添加
            // shape: 'circle',
            // ellipticity: 0.65,
        };

                WordCloud(wordCloudContainer, options);

                statusDiv.textContent = '文字雲產生完成！';

            } catch (error) {
                console.error("處理 Excel 或產生文字雲時發生錯誤:", error);
                statusDiv.textContent = `發生錯誤： ${error.message}`;
                alert(`處理檔案時發生錯誤： ${error.message}`);
                wordCloudContainer.innerHTML = '產生失敗'; // 顯示錯誤訊息
                wordCloudContainer.classList.remove('has-cloud');
            } finally {
                generateCloudBtn.disabled = false; // 處理完畢後重新啟用按鈕
            }
        };

        reader.onerror = function(e) {
            console.error("讀取檔案時發生錯誤:", e);
            statusDiv.textContent = '讀取檔案失敗！';
            alert('讀取檔案失敗！');
            generateCloudBtn.disabled = false; // 啟用按鈕
        };

        // 以 ArrayBuffer 格式讀取檔案，這是 SheetJS 建議的方式
        reader.readAsArrayBuffer(selectedFile);
    });
});
