// --- 設定 ---
const TARGET_COLUMN_INDEX = 0; // 讀取第幾欄 (0=第一欄)
// 簡單的中文停用詞列表 (可自行擴充)
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '與', '或', '也', '就', '都', '而', '及', '於',
  '我', '你', '他', '她', '它', '們', '之', '人', '一個', '上', '下', '左', '右',
  '前', '後', '中', '為', '被', '以', '因', '從', '向', '對', '此', '彼', '其',
  '有', '無', '來', '去', '說', '做', '看', '用', '得', '嗎', '吧', '呢', '啊',
  '喔', '嗯', '欸', '等', '等等', ':', '：', ',', '，', '.', '。', '?', '？',
  '!', '！', ';', '；', '"', "'", '(', ')', '（', '）', '[', ']', '【', '】',
  ' ', '\t', '\n', '\r', // 空白字符
]);
// 動畫設定
const ANIMATION_INTERVAL_MS = 300; // 每隔多少毫秒移動一次 (數字越小越快)
// --- 設定結束 ---

// DOM 元素
const selectFileButton = document.getElementById('selectFileButton');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const generateCloudButton = document.getElementById('generateCloudButton');
const wordCloudContainer = document.getElementById('wordCloudContainer');
const loadingMessage = document.getElementById('loadingMessage');
const jiebaStatus = document.getElementById('jiebaStatus');

let selectedFile = null;
let jiebaReady = false;
let animationIntervalId = null; // <<-- 新增：儲存動畫計時器的 ID

// --- Jieba 字典載入 (保持不變) ---
const JIEBA_DICT_PATH = 'https://cdn.jsdelivr.net/npm/jieba-js/dict/';
console.log("開始載入 Jieba 字典...");
jieba_load_dict(
    JIEBA_DICT_PATH + 'jieba.dict.utf8',
    JIEBA_DICT_PATH + 'hmm_model.utf8',
    JIEBA_DICT_PATH + 'user.dict.utf8',
    JIEBA_DICT_PATH + 'idf.utf8',
    JIEBA_DICT_PATH + 'stop_words.utf8',
    () => {
        console.log("Jieba 字典載入成功！");
        jiebaStatus.textContent = 'Jieba 字典已就緒。';
        jiebaStatus.style.color = 'green';
        jiebaReady = true;
        selectFileButton.disabled = false;
        if (selectedFile) generateCloudButton.disabled = false;
    },
    (err) => {
        console.error("Jieba 字典載入失敗:", err);
        jiebaStatus.textContent = '錯誤：Jieba 字典載入失敗！';
        jiebaStatus.style.color = 'red';
        alert("無法載入中文分詞所需字典。");
        jiebaReady = false;
        selectFileButton.disabled = false; // 允許選擇檔案，但在生成時會提示
    }
);


// --- 事件監聽器 ---

// 按鈕 1: 選擇檔案 (保持不變)
selectFileButton.addEventListener('click', () => {
    fileInput.click();
});

// 檔案選擇變更 (保持不變)
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        selectedFile = files[0];
        fileNameDisplay.textContent = `已選擇檔案： ${selectedFile.name}`;
        generateCloudButton.disabled = !jiebaReady; // 字典就緒才能生成
        wordCloudContainer.innerHTML = '';
        loadingMessage.style.display = 'none';
         // 清除舊動畫 (如果有的話)
        if (animationIntervalId) {
            clearInterval(animationIntervalId);
            animationIntervalId = null;
        }
    } else {
        selectedFile = null;
        fileNameDisplay.textContent = '尚未選擇檔案';
        generateCloudButton.disabled = true;
    }
    fileInput.value = null;
});

// 按鈕 2: 生成文字雲
generateCloudButton.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('請先選擇一個 Excel 檔案！');
        return;
    }
    if (!jiebaReady) {
        alert('Jieba 字典尚未載入完成或載入失敗，無法進行中文分詞。');
        return;
    }

    // 清除舊的動畫計時器
    if (animationIntervalId) {
        clearInterval(animationIntervalId);
        animationIntervalId = null;
        console.log("已停止舊的動畫。");
    }

    setLoadingState(true);
    wordCloudContainer.innerHTML = ''; // 清除舊的文字雲 DOM 結構

    try {
        const arrayBuffer = await readFileAsArrayBuffer(selectedFile);
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("Excel 檔案中找不到工作表。");

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        let allText = extractTextFromColumn(jsonData, TARGET_COLUMN_INDEX);
        if (!allText.trim()) throw new Error(`指定的欄位 (第 ${TARGET_COLUMN_INDEX + 1} 欄) 沒有找到可用的文字內容。`);

        console.log("開始使用 Jieba 分詞...");
        const segmentedWords = jieba_cut(allText, true);
        console.log(`分詞完成，共得到 ${segmentedWords.length} 個詞語 (含重複)。`);

        const wordCounts = {};
        segmentedWords.forEach(word => {
            const trimmedWord = word.trim().toLowerCase();
            if (trimmedWord && trimmedWord.length > 1 && !CHINESE_STOP_WORDS.has(trimmedWord) && !/^[0-9.]+$/.test(trimmedWord) && !/^[a-zA-Z]+$/.test(trimmedWord)) {
                wordCounts[trimmedWord] = (wordCounts[trimmedWord] || 0) + 1;
            }
        });

        const listData = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        if (listData.length === 0) throw new Error("經過分詞與過濾後，沒有有效的詞語可生成文字雲。");
        console.log(`過濾和計數後，得到 ${listData.length} 個不重複詞語。`);

        // --- 生成文字雲 ---
        // 注意：wordcloud2.js 會為每個詞創建一個 span，通常已有 position: absolute
        WordCloud(wordCloudContainer, {
            list: listData,
            gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),
            weightFactor: size => Math.pow(size, 0.8) * wordCloudContainer.offsetWidth / 512,
            fontFamily: 'Microsoft JhengHei, Microsoft YaHei, PingFang SC, sans-serif',
            color: 'random-dark',
            backgroundColor: '#f0f0f0',
            rotateRatio: 0.3,
            minSize: 8,
            shuffle: true,
             // 添加一個回調函數，在繪製完成後執行（雖然 wordcloud2.js 不保證有標準的完成回調，
             // 但通常繪製是同步的，或者我們可以放在 WordCloud 調用之後）
             // callback: () => { startWordAnimation(); } // 如果有標準 callback 才用
        });

        // --- 在 WordCloud 調用後啟動動畫 ---
        // 使用 setTimeout 稍微延遲，確保 DOM 元素已生成
        setTimeout(startWordAnimation, 100); // 延遲 100 毫秒

    } catch (error) {
        console.error("處理過程發生錯誤:", error);
        alert(`處理失敗：${error.message}`);
        wordCloudContainer.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">無法生成文字雲。<br>${error.message}</p>`;
    } finally {
        setLoadingState(false);
    }
});

// --- 輔助函式 ---

// 讀取檔案 (保持不變)
function readFileAsArrayBuffer(file) { /* ... */ }
// 提取文字 (保持不變)
function extractTextFromColumn(jsonData, columnIndex) { /* ... */ }
// 設定載入狀態 (保持不變)
function setLoadingState(isLoading) { /* ... */ }


// --- 新增：啟動文字雲動畫的函式 ---
function startWordAnimation() {
    const words = wordCloudContainer.querySelectorAll('span'); // wordcloud2.js 通常生成 span
    if (!words || words.length === 0) {
        console.log("找不到詞語元素來啟動動畫。");
        return;
    }

    console.log(`找到 ${words.length} 個詞語元素，開始動畫...`);

    // 確保容器是相對定位的 (CSS 中已設定)
    // wordCloudContainer.style.position = 'relative'; // 如果 CSS 沒設定

    const containerWidth = wordCloudContainer.offsetWidth;
    const containerHeight = wordCloudContainer.offsetHeight;

    // 清除可能存在的舊計時器 (雙重保險)
    if (animationIntervalId) {
        clearInterval(animationIntervalId);
    }

    animationIntervalId = setInterval(() => {
        words.forEach(word => {
            // wordcloud2.js 通常已設定 position: absolute
            // word.style.position = 'absolute'; // 如果需要

            // 計算新的隨機位置 (限制在容器邊界內)
            // 減去詞語自身寬高的一半可以讓詞語中心在隨機點，但會增加複雜度，先簡化
            const wordWidth = word.offsetWidth; // 可選，用於更精確的邊界
            const wordHeight = word.offsetHeight; // 可選

            // 簡單邊界：左上角在 0 到 (容器寬度 - 詞語寬度) 之間
            const newX = Math.random() * (containerWidth - wordWidth);
            const newY = Math.random() * (containerHeight - wordHeight);

            // 應用新位置 (直接設定，無平滑過渡，實現"快速"移動)
            word.style.left = `${newX}px`;
            word.style.top = `${newY}px`;

            // 如果想要平滑過渡效果，可以取消註解下面的 CSS，
            // 但會變成 "飄動" 而不是 "快速跳動"
            // word.style.transition = 'left 0.5s ease-in-out, top 0.5s ease-in-out';
        });
    }, ANIMATION_INTERVAL_MS); // 每隔指定時間執行一次
}

// --- (確保輔助函數完整複製過來) ---
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("讀取檔案時發生錯誤: " + e));
        reader.readAsArrayBuffer(file);
    });
}

function extractTextFromColumn(jsonData, columnIndex) {
    let text = "";
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row.length > columnIndex) {
            const cellValue = String(row[columnIndex]).trim();
            if (cellValue) {
                text += cellValue + "\n";
            }
        }
    }
    return text;
}

function setLoadingState(isLoading) {
     generateCloudButton.disabled = isLoading || !jiebaReady;
     selectFileButton.disabled = isLoading || !jiebaReady;
     loadingMessage.style.display = isLoading ? 'block' : 'none';
}
