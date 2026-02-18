// 就労選択支援サービス - アセスメントアプリケーション
// Main JavaScript v202602120240
(function() {
    'use strict';
    
    const VERSION = '202602120252';
    console.log(`Assessment App v${VERSION} initializing...`);
    
    // ===== 設定 =====
    const ITEMS_URL = `./items.json?v=${VERSION}`;
    
    // ===== グローバル変数 =====
    let assessmentItems = [];
    let currentAssessment = {
        basicInfo: {},
        scores: {},
        memos: {}
    };
    let currentLoadedAssessmentId = null;
    let categoryCharts = new Map();
    let eventDelegationInitialized = false; // イベントデリゲーション重複防止フラグ
    
    // ===== 評価基準データ =====
    const scoreCriteria = {
        1: { label: "非常に困難", color: "#0d6efd" },
        2: { label: "支援が必要", color: "#198754" },
        3: { label: "普通", color: "#ffc107" },
        4: { label: "良好", color: "#fd7e14" },
        5: { label: "非常に良好", color: "#dc3545" }
    };
    
    // ===== スコア別カラー取得 =====
    function getScoreColor(score) {
        if (score === null || score === undefined) return '#e5e7eb'; // 未入力はグレー
        return scoreCriteria[score]?.color || '#94a3b8';
    }
    
    // ===== 日付正規化（YYYY-MM-DD形式に変換） =====
    function normalizeDateToISO(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return '';
        
        // すでに YYYY-MM-DD 形式ならそのまま返す
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
            return dateStr.trim();
        }
        
        // YYYY/M/D 形式を YYYY-MM-DD に変換
        const match = dateStr.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (match) {
            const year = match[1];
            const month = String(match[2]).padStart(2, '0');
            const day = String(match[3]).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // 変換できない場合は空文字を返す
        return '';
    }
    
    // ===== 文字列正規化（キー突合用） =====
    function normalizeString(str) {
        if (!str) return '';
        return String(str)
            .trim()                           // 前後の空白を除去
            .replace(/\u3000/g, ' ')            // 全角空白→半角空白
            .replace(/\s+/g, ' ')               // 連続空白を１つに
            .replace(/[\r\n]+/g, '');         // 改行除去
    }
    
    // ===== 全角数字を半角に正規化 =====
    function normalizeNumber(str) {
        if (!str) return null;
        const normalized = String(str).trim().replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const num = Number(normalized);
        return (!isNaN(num) && num >= 1 && num <= 5) ? num : null;
    }
    
    // ===== 一意キー生成（正規化済みカテゴリ + 項目名） =====
    function makeItemKey(category, itemName, debugLog = false) {
        // ===== 【重要】trim()を必ず実行 =====
        category = String(category || '').trim();
        itemName = String(itemName || '').trim();
        
        const normCat = normalizeString(category);
        const normItem = normalizeString(itemName);
        const key = `${normCat}__${normItem}`;
        
        // ===== 【デバッグ】不可視文字チェック =====
        if (debugLog) {
            console.log('🔑 makeItemKey() called:');
            console.log('  category (raw):', JSON.stringify(category));
            console.log('  itemName (raw):', JSON.stringify(itemName));
            console.log('  category (normalized):', JSON.stringify(normCat));
            console.log('  itemName (normalized):', JSON.stringify(normItem));
            console.log('  key (final):', JSON.stringify(key));
        }
        
        return key;
    }
    
    // ===== LocalStorage管理（利用者単位） =====
    function getStorageKey(userName) {
        if (!userName || userName.trim() === '') return null;
        const safeUserName = userName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        return `assessments_${safeUserName}`;
    }
    
    function getCurrentUserName() {
        return document.getElementById('userName')?.value?.trim() || '';
    }
    
    function getUserAssessments(userName) {
        const key = getStorageKey(userName);
        if (!key) return [];
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('評価履歴の読み込みエラー:', e);
            return [];
        }
    }
    
    function saveUserAssessments(userName, assessments) {
        const key = getStorageKey(userName);
        if (!key) return false;
        try {
            localStorage.setItem(key, JSON.stringify(assessments));
            return true;
        } catch (e) {
            console.error('評価履歴の保存エラー:', e);
            return false;
        }
    }
    
    // ===== 評価項目の読み込み（items.json優先） =====
    async function loadAssessmentItems() {
        try {
            const response = await fetch(ITEMS_URL, { cache: "no-store" });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            let items = Array.isArray(data) ? data : (data.items || []);
            
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('items.jsonが空または不正な形式です');
            }
            
            assessmentItems = items;
            localStorage.setItem('assessmentItems_cache', JSON.stringify(items));
            console.log(`✅ items.json読み込み成功（${items.length}項目）`);
            return true;
            
        } catch (error) {
            console.warn('⚠️ items.json読み込み失敗:', error.message);
            
            // キャッシュフォールバック
            try {
                const cached = localStorage.getItem('assessmentItems_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.length > 0) {
                        assessmentItems = parsed;
                        console.log(`⚠️ キャッシュから復元（${parsed.length}項目）`);
                        showWarning('items.jsonが読み込めませんでした。キャッシュから復元しました。');
                        return true;
                    }
                }
            } catch (cacheError) {
                console.error('キャッシュ読み込みエラー:', cacheError);
            }
            
            // 完全失敗
            assessmentItems = [];
            showError('評価項目を読み込めませんでした', [
                'items.json がリポジトリのルート（index.htmlと同じ階層）にあるか確認してください',
                'items.json の形式が正しいJSON配列か確認してください',
                'ブラウザのコンソール（F12）でエラー詳細を確認してください'
            ]);
            return false;
        }
    }
    
    // ===== エラー表示 =====
    function showError(title, messages) {
        const container = document.getElementById('assessmentItems');
        let html = `
            <div class="alert alert-danger error-message">
                <h4><i class="bi bi-exclamation-triangle me-2"></i>${title}</h4>
                <ul>
        `;
        messages.forEach(msg => {
            html += `<li>${msg}</li>`;
        });
        html += `</ul></div>`;
        container.innerHTML = html;
    }
    
    function showWarning(message) {
        const container = document.getElementById('assessmentItems');
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning alert-dismissible fade show';
        warning.innerHTML = `
            <strong>警告:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        container.insertBefore(warning, container.firstChild);
    }
    
    // ===== 評価項目の表示 =====
    function renderAssessmentItems() {
        const container = document.getElementById('assessmentItems');
        
        if (!assessmentItems || assessmentItems.length === 0) {
            showError('評価項目がありません', ['items.jsonを確認してください']);
            return;
        }
        
        // カテゴリごとにグループ化
        const grouped = {};
        assessmentItems.forEach((item, index) => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({ ...item, index });
        });
        
        let html = '';
        
        Object.keys(grouped).forEach(category => {
            html += `<div class="category-section"><h3 class="category-title">${category}</h3>`;
            
            grouped[category].forEach(item => {
                const currentScore = currentAssessment.scores[item.index] || null;
                const currentMemo = currentAssessment.memos[item.index] || '';
                
                html += `
                    <div class="assessment-item card">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-3">
                                    <h5 class="item-name mb-1">${item.name}</h5>
                                    <small class="text-muted">${item.description || ''}</small>
                                </div>
                                <div class="col-md-6">
                                    <div class="score-buttons" data-item-index="${item.index}">
                `;
                
                for (let score = 1; score <= 5; score++) {
                    const active = currentScore === score ? 'active' : '';
                    const color = getScoreColor(score);
                    const bgColor = currentScore === score ? color : 'transparent';
                    const textColor = currentScore === score ? 'white' : color;
                    
                    html += `
                        <button type="button" 
                                class="btn btn-outline-primary score-btn ${active}" 
                                data-score="${score}"
                                style="border-color: ${color}; background-color: ${bgColor}; color: ${textColor};">
                            ${score}
                        </button>
                    `;
                }
                
                html += `
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <button type="button" 
                                            class="btn btn-sm btn-outline-secondary w-100 toggle-memo-btn" 
                                            data-item-index="${item.index}">
                                        <i class="bi bi-sticky me-1"></i>メモ
                                    </button>
                                </div>
                            </div>
                            <div class="memo-section mt-3 ${currentMemo ? '' : 'd-none'}" data-memo-section="${item.index}">
                                <textarea class="form-control memo-textarea" 
                                          rows="2" 
                                          placeholder="メモや所見を入力..." 
                                          data-item-index="${item.index}">${currentMemo}</textarea>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        container.innerHTML = html;
        
        // イベントデリゲーションを呼ぶ（初回のみ登録されるようガード済み）
        setupEventDelegation();
    }
    
    // ===== イベントデリゲーション（初回のみ登録・多重登録防止） =====
    function setupEventDelegation() {
        // 既に登録済みなら何もしない（多重登録防止）
        if (eventDelegationInitialized) {
            console.log('⚠️ イベントデリゲーションは既に登録済み（スキップ）');
            return;
        }
        
        const container = document.getElementById('assessmentItems');
        if (!container) {
            console.error('❌ #assessmentItems コンテナが見つかりません');
            return;
        }
        
        // スコアボタンとメモボタンのクリック
        container.addEventListener('click', function(e) {
            // スコアボタン
            const scoreBtn = e.target.closest('.score-btn');
            if (scoreBtn) {
                const score = parseInt(scoreBtn.dataset.score);
                const scoreButtonsGroup = scoreBtn.closest('.score-buttons');
                if (scoreButtonsGroup) {
                    const itemIndex = parseInt(scoreButtonsGroup.dataset.itemIndex);
                    selectScore(itemIndex, score);
                }
                return;
            }
            
            // メモトグルボタン
            const toggleMemoBtn = e.target.closest('.toggle-memo-btn');
            if (toggleMemoBtn) {
                const itemIndex = parseInt(toggleMemoBtn.dataset.itemIndex);
                toggleMemo(itemIndex);
                return;
            }
        });
        
        // メモのinput（リアルタイム保存）
        container.addEventListener('input', function(e) {
            const textarea = e.target.closest('.memo-textarea');
            if (textarea) {
                const itemIndex = parseInt(textarea.dataset.itemIndex);
                saveMemo(itemIndex, textarea.value);
            }
        });
        
        // メモのblur（フォーカス外れ時保存）
        container.addEventListener('blur', function(e) {
            const textarea = e.target.closest('.memo-textarea');
            if (textarea) {
                const itemIndex = parseInt(textarea.dataset.itemIndex);
                saveMemo(itemIndex, textarea.value);
            }
        }, true);
        
        // メモのchange（変更時保存）
        container.addEventListener('change', function(e) {
            const textarea = e.target.closest('.memo-textarea');
            if (textarea) {
                const itemIndex = parseInt(textarea.dataset.itemIndex);
                saveMemo(itemIndex, textarea.value);
            }
        });
        
        // 登録完了フラグ
        eventDelegationInitialized = true;
        console.log('✅ イベントデリゲーション登録完了（初回のみ・多重登録なし）');
    }
    
    // ===== スコア選択 =====
    function selectScore(itemIndex, score) {
        currentAssessment.scores[itemIndex] = score;
        
        // ボタンのアクティブ状態を更新
        const scoreButtonsGroup = document.querySelector(`.score-buttons[data-item-index="${itemIndex}"]`);
        if (scoreButtonsGroup) {
            const buttons = scoreButtonsGroup.querySelectorAll('.score-btn');
            buttons.forEach(btn => {
                const btnScore = parseInt(btn.dataset.score);
                const color = getScoreColor(btnScore);
                
                if (btnScore === score) {
                    btn.classList.add('active');
                    btn.style.backgroundColor = color;
                    btn.style.color = 'white';
                } else {
                    btn.classList.remove('active');
                    btn.style.backgroundColor = 'transparent';
                    btn.style.color = color;
                }
            });
        }
    }
    
    // ===== メモのトグル =====
    function toggleMemo(itemIndex) {
        const memoSection = document.querySelector(`[data-memo-section="${itemIndex}"]`);
        if (memoSection) {
            memoSection.classList.toggle('d-none');
        }
    }
    
    // ===== メモの保存 =====
    function saveMemo(itemIndex, value) {
        currentAssessment.memos[itemIndex] = value;
    }
    
    // ===== 評価結果の保存 =====
    function saveAssessment() {
        const userName = document.getElementById('userName').value.trim();
        const managementNumber = document.getElementById('managementNumber').value.trim();
        const evaluatorName = document.getElementById('evaluatorName').value.trim();
        const entryDate = document.getElementById('entryDate').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!userName || !evaluatorName || !entryDate || !startDate || !endDate) {
            alert('基本情報（※必須項目）をすべて入力してください');
            return;
        }
        
        if (Object.keys(currentAssessment.scores).length === 0) {
            alert('少なくとも1つの項目を評価してください');
            return;
        }
        
        const assessmentData = {
            id: Date.now(),
            basicInfo: { userName, managementNumber, evaluatorName, entryDate, startDate, endDate },
            scores: { ...currentAssessment.scores },
            memos: { ...currentAssessment.memos },
            items: assessmentItems.map(item => ({ ...item })),
            timestamp: new Date().toISOString()
        };
        
        const userAssessments = getUserAssessments(userName);
        userAssessments.push(assessmentData);
        
        if (saveUserAssessments(userName, userAssessments)) {
            alert(`✅ 評価結果を保存しました\n\n利用者: ${userName}\n評価ID: ${assessmentData.id}`);
            loadPastAssessments();
        } else {
            alert('❌ 保存に失敗しました');
        }
    }
    
    // ===== フォームのクリア =====
    function clearForm() {
        document.getElementById('userName').value = '';
        document.getElementById('managementNumber').value = '';
        document.getElementById('evaluatorName').value = '';
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        
        currentAssessment = { basicInfo: {}, scores: {}, memos: {} };
        currentLoadedAssessmentId = null;
        
        renderAssessmentItems();
        
        document.getElementById('pastAssessments').innerHTML = '<p class="text-muted">利用者名を入力すると、その利用者の過去の評価が表示されます。</p>';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // ===== 過去の評価結果を読み込み =====
    function loadPastAssessments() {
        const userName = getCurrentUserName();
        const container = document.getElementById('pastAssessments');
        
        if (!userName) {
            container.innerHTML = '<p class="text-muted">利用者名を入力すると、その利用者の過去の評価が表示されます。</p>';
            return;
        }
        
        const assessments = getUserAssessments(userName);
        
        if (assessments.length === 0) {
            container.innerHTML = `<div class="alert alert-info"><strong>${userName}</strong> さんの過去の評価結果はありません</div>`;
            return;
        }
        
        let html = '<div class="list-group">';
        
        assessments.slice().reverse().forEach(assessment => {
            const avgScore = calculateAverageScore(assessment.scores);
            const mgmtNum = assessment.basicInfo.managementNumber ? ` [${assessment.basicInfo.managementNumber}]` : '';
            
            html += `
                <div class="list-group-item history-item" data-assessment-id="${assessment.id}" data-user-name="${userName}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${assessment.basicInfo.entryDate} - ${assessment.basicInfo.userName}${mgmtNum}</h6>
                            <p class="mb-1 text-muted small">
                                評価者: ${assessment.basicInfo.evaluatorName} | 
                                期間: ${assessment.basicInfo.startDate} 〜 ${assessment.basicInfo.endDate} | 
                                平均スコア: <strong>${avgScore.toFixed(2)}</strong>
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-danger delete-history-btn" 
                                    data-assessment-id="${assessment.id}" 
                                    data-user-name="${userName}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // イベントリスナー設定
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (!e.target.closest('.delete-history-btn')) {
                    const id = parseInt(this.dataset.assessmentId);
                    const userName = this.dataset.userName;
                    loadAssessment(userName, id);
                }
            });
        });
        
        container.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.assessmentId);
                const userName = this.dataset.userName;
                deleteAssessmentHistory(userName, id);
            });
        });
    }
    
    // ===== 平均スコアの計算 =====
    function calculateAverageScore(scores) {
        const values = Object.values(scores);
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    // ===== 評価データの読み込み =====
    function loadAssessment(userName, id) {
        const assessments = getUserAssessments(userName);
        const assessment = assessments.find(a => a.id === id);
        
        if (!assessment) {
            alert('評価データが見つかりません');
            return;
        }
        
        if (!confirm(`この評価結果をフォームに読み込みますか？\n\n評価日: ${assessment.basicInfo.entryDate}`)) {
            return;
        }
        
        // 日付フィールドを正規化してセット
        document.getElementById('userName').value = assessment.basicInfo.userName || '';
        document.getElementById('managementNumber').value = assessment.basicInfo.managementNumber || '';
        document.getElementById('evaluatorName').value = assessment.basicInfo.evaluatorName || '';
        document.getElementById('entryDate').value = normalizeDateToISO(assessment.basicInfo.entryDate);
        document.getElementById('startDate').value = normalizeDateToISO(assessment.basicInfo.startDate);
        document.getElementById('endDate').value = normalizeDateToISO(assessment.basicInfo.endDate);
        
        currentAssessment.scores = { ...assessment.scores };
        currentAssessment.memos = { ...(assessment.memos || {}) };
        currentLoadedAssessmentId = id;
        
        renderAssessmentItems();
        alert('✅ 評価データを読み込みました');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // ===== 評価履歴の削除 =====
    function deleteAssessmentHistory(userName, id) {
        if (!confirm('この評価結果を削除してもよろしいですか？')) {
            return;
        }
        
        const assessments = getUserAssessments(userName);
        const filtered = assessments.filter(a => a.id !== id);
        
        saveUserAssessments(userName, filtered);
        
        if (currentLoadedAssessmentId === id) {
            currentLoadedAssessmentId = null;
        }
        
        loadPastAssessments();
        alert('✅ 評価結果を削除しました');
    }
    
    // ===== 評価結果を見る =====
    function viewResults() {
        const userName = getCurrentUserName();
        if (!userName || Object.keys(currentAssessment.scores).length === 0) {
            alert('評価データを入力してください');
            return;
        }
        
        const avgScore = calculateAverageScore(currentAssessment.scores);
        
        let html = `<h6>利用者: ${userName}</h6>`;
        html += `<p>平均スコア: <strong>${avgScore.toFixed(2)}</strong></p><hr>`;
        
        const grouped = {};
        assessmentItems.forEach((item, index) => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({ ...item, index });
        });
        
        Object.keys(grouped).forEach(category => {
            html += `<h5>${category}</h5><ul>`;
            grouped[category].forEach(item => {
                const score = currentAssessment.scores[item.index];
                const memo = currentAssessment.memos[item.index] || '';
                if (score) {
                    html += `<li><strong>${item.name}</strong>: ${score} (${scoreCriteria[score].label})`;
                    if (memo) html += `<br><small class="text-muted">メモ: ${memo}</small>`;
                    html += `</li>`;
                }
            });
            html += '</ul>';
        });
        
        document.getElementById('resultsContent').innerHTML = html;
        new bootstrap.Modal(document.getElementById('resultsModal')).show();
    }
    
    // ===== チャート表示 =====
    function viewChart() {
        const userName = getCurrentUserName();
        if (!userName || Object.keys(currentAssessment.scores).length === 0) {
            alert('評価データを入力してください');
            return;
        }
        
        categoryCharts.forEach(chart => chart.destroy());
        categoryCharts.clear();
        
        new bootstrap.Modal(document.getElementById('chartModal')).show();
        setTimeout(() => renderChart(), 300);
    }
    
    function renderChart() {
        const container = document.getElementById('chartContainer');
        container.innerHTML = '';
        
        // カテゴリ別に定義項目を抽出（assessmentItems = 固定順の定義配列）
        const categorizedItems = {};
        assessmentItems.forEach((item, index) => {
            if (!categorizedItems[item.category]) {
                categorizedItems[item.category] = [];
            }
            categorizedItems[item.category].push({ ...item, index });
        });
        
        const BAR_HEIGHT = 32;
        const GAP = 6;
        const PADDING = 40;
        
        Object.keys(categorizedItems).forEach(category => {
            const allItemsInCategory = categorizedItems[category];
            
            // ===== 【重要】固定長配列生成：全定義項目を必ず含む =====
            // 未入力項目も配列に含め、nullで保持（詰めない）
            const labels = [];
            const data = [];
            
            allItemsInCategory.forEach(item => {
                const score = currentAssessment.scores[item.index];
                
                // 全項目をlabelsに追加（未入力でも必ず追加）
                labels.push(item.name);
                
                // 未入力はnull（0ではない）
                data.push(score !== undefined && score !== null ? score : null);
            });
            
            // ===== Chart.js用検証ログ（配列確認） =====
            console.log(`📊 [${category}] Chart.js渡し前検証:`, {
                'labels.length': labels.length,
                'data.length': data.length,
                'Array.isArray(labels)': Array.isArray(labels),
                'Array.isArray(data)': Array.isArray(data),
                'data sample': data.slice(0, 5),
                '未入力項目数': data.filter(v => v === null).length,
                '入力済項目数': data.filter(v => v !== null).length
            });
            
            // 配列長一致を保証
            if (labels.length !== data.length) {
                console.error(`❌ 配列長不一致: labels=${labels.length}, data=${data.length}`);
                return;
            }
            
            if (!Array.isArray(data)) {
                console.error(`❌ dataが配列ではない: ${typeof data}`);
                return;
            }
            
            // 色配列（nullはグレー）
            const colors = data.map(s => getScoreColor(s));
            
            const block = document.createElement('div');
            block.className = 'chart-block';
            
            const header = document.createElement('div');
            header.className = 'd-flex justify-content-between align-items-center mb-2';
            header.innerHTML = `<h5>${category}</h5>`;
            
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-sm btn-outline-primary';
            saveBtn.innerHTML = '<i class="bi bi-download me-1"></i>このカテゴリを保存';
            saveBtn.addEventListener('click', () => saveCategoryChart(category));
            header.appendChild(saveBtn);
            
            block.appendChild(header);
            
            const canvas = document.createElement('canvas');
            canvas.width = 520;
            canvas.height = allItemsInCategory.length * (BAR_HEIGHT + GAP) + PADDING;
            block.appendChild(canvas);
            container.appendChild(block);
            
            // Chart.js生成（横向き棒グラフ、数値配列形式）
            const chart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,  // 文字列配列
                    datasets: [{
                        label: 'スコア',
                        data: data,  // 数値配列（nullを含む）
                        backgroundColor: colors,
                        borderWidth: 0,
                        barThickness: BAR_HEIGHT,
                        borderRadius: 4
                        // skipNull, parsing は削除（Chart.js v3では不要/無効）
                    }]
                },
                options: {
                    indexAxis: 'y',  // 横向き棒グラフ
                    responsive: false,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#ffffff',
                            font: { size: 14, weight: 'bold' },
                            anchor: 'center',
                            align: 'center',
                            // nullは空文字表示（ラベルなし）
                            formatter: (v) => v === null || v === undefined ? '' : v
                        }
                    },
                    scales: {
                        x: { 
                            min: 0, 
                            max: 5, 
                            ticks: { stepSize: 1 },
                            beginAtZero: true
                        },
                        y: { 
                            display: false,  // ラベルは非表示（Canvas外にテキスト表示のため）
                            ticks: {
                                autoSkip: false  // 全ラベルを表示
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
            
            categoryCharts.set(category, chart);
        });
    }
    
    function saveCategoryChart(categoryName) {
        const chart = categoryCharts.get(categoryName);
        if (!chart) return;
        
        const link = document.createElement('a');
        link.download = `assessment_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        link.href = chart.toBase64Image();
        link.click();
    }
    
    // ===== CSV読込 =====
    function handleImportCSV() {
        document.getElementById('importCSVFile').click();
    }
    
    function processImportedCSV(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                let text = e.target.result;
                
                // BOM削除
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.substring(1);
                }
                
                // ===== 【PAPAPARSE】header名でアクセス方式に統一 =====
                console.log('\n🔥🔥🔥 PapaParse によるCSV読み込み開始 🔥🔥🔥');
                
                const parseResult = Papa.parse(text, {
                    header: true,           // ヘッダ行を列名として使用
                    skipEmptyLines: true,   // 空行をスキップ
                    quoteChar: '"',         // 引用符
                    delimiter: ',',         // 区切り文字
                    trimHeaders: true,      // ヘッダの前後空白を削除
                    dynamicTyping: false    // 数値を自動変換しない（文字列として取得）
                });
                
                if (parseResult.errors && parseResult.errors.length > 0) {
                    console.error('⚠️ PapaParse エラー:', parseResult.errors);
                }
                
                const dataRows = parseResult.data;
                
                console.log('📊 PapaParse 結果:');
                console.log('  パース成功:', !parseResult.errors || parseResult.errors.length === 0);
                console.log('  データ行数:', dataRows.length);
                console.log('  ヘッダ列（フィールド名）:', parseResult.meta.fields);
                console.log('  最初のデータ行（オブジェクト形式）:', dataRows[0]);
                
                if (dataRows.length === 0) {
                    alert('❌ データ行がありません');
                    return;
                }
                
                // 必須列の存在チェック
                const requiredCols = ['カテゴリ', '項目', 'スコア'];
                const missingCols = requiredCols.filter(col => !(col in dataRows[0]));
                if (missingCols.length > 0) {
                    alert(`❌ CSV形式が不正です（必須列が不足: ${missingCols.join(', ')}）`);
                    return;
                }
                
                // 基本情報（最初の行から取得）
                const firstRow = dataRows[0];
                const basicInfo = {
                    entryDate: firstRow['記入日'] || '',
                    userName: firstRow['利用者名'] || '',
                    managementNumber: firstRow['管理番号'] || '',
                    evaluatorName: firstRow['評価実施者名'] || '',
                    startDate: firstRow['評価期間開始'] || '',
                    endDate: firstRow['評価期間終了'] || ''
                };
                
                if (!basicInfo.userName) {
                    alert('❌ 利用者名が取得できません');
                    return;
                }
                
                // ===== 【根本修正】状態を完全初期化（既存値への依存を排除） =====
                console.log('\n🔥🔥🔥 CSVインポート: 状態初期化開始 🔥🔥🔥');
                
                // currentAssessment.scores を全項目 null に初期化
                currentAssessment.scores = {};
                assessmentItems.forEach((item, index) => {
                    currentAssessment.scores[index] = null;
                });
                console.log('✅ currentAssessment.scores を全項目nullに初期化');
                
                // インポート専用のMap（既存のscoreMapは使わない）
                const importScoreMap = new Map();
                const importMemoMap = new Map();
                
                console.log('\n🔥🔥🔥 importScoreMap構築開始（CSV専用・header名アクセス方式） 🔥🔥🔥');
                
                dataRows.forEach((row, rowIndex) => {
                    // ===== 【PAPAPARSE】header名で直接アクセス =====
                    const categoryRaw = row['カテゴリ'];
                    const itemNameRaw = row['項目'];
                    const scoreRaw = row['スコア'];      // ← 必ず「スコア」列のみ
                    const hyokaText = row['評価'] || '';  // 参照のみ（計算には使用しない）
                    const memo = row['メモ'] || '';
                    
                    // 一意キーを生成（正規化込み）
                    const key = makeItemKey(categoryRaw, itemNameRaw, false);
                    
                    // ===== 【強制】スコア算出: Number(String(row["スコア"]).trim()) のみ =====
                    // 評価列は絶対に使わない
                    const scoreTrimmed = String(scoreRaw || '').trim();
                    const scoreNum = Number(scoreTrimmed);
                    const score = (!isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;
                    
                    // ===== 【決着ログ（必須）】対象キー専用 =====
                    if (key === "職業生活__欠席等の連絡") {
                        console.log("\n=== CSV DEBUG ===");
                        console.log("key:", key);
                        console.log("row['スコア']=", row['スコア']);
                        console.log("row['評価']=", row['評価']);
                        console.log("computed score=", score);
                        console.log("=== CSV DEBUG END ===");
                    }
                    
                    // 重複キー警告
                    if (importScoreMap.has(key)) {
                        console.warn("⚠️ DUPLICATE KEY:", key, "old:", importScoreMap.get(key), "new:", score, "row:", row);
                    }
                    
                    importScoreMap.set(key, score);
                    
                    if (memo) {
                        importMemoMap.set(key, memo);
                    }
                });
                
                // ===== 【決着ログ（必須）】ループ後の確認 =====
                console.log("\n=== POST IMPORT ===");
                console.log("職業生活__欠席等の連絡:", importScoreMap.get("職業生活__欠席等の連絡"));
                console.log("=== POST IMPORT END ===");
                
                // デバッグ: 特定カテゴリのスコアMapを表示（最初の20件）
                const firstCategory = assessmentItems.length > 0 ? assessmentItems[0].category : null;
                if (firstCategory) {
                    const categoryEntries = [...importScoreMap.entries()]
                        .filter(([k, v]) => k.startsWith(firstCategory + '__'))
                        .slice(0, 20)
                        .map(([k, v]) => ({ key: k, score: v }));
                    
                    console.log(`📋 importScoreMap サンプル [カテゴリ: ${firstCategory}]:`);
                    console.table(categoryEntries);
                }
                
                // ===== 【デバッグ】特定キーの追跡 =====
                const debugKey = '職業生活__欠席等の連絡';
                console.log('\n🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍');
                console.log(`対象キー: "${debugKey}"`);
                console.log(`対象キー(JSON): ${JSON.stringify(debugKey)}`);
                console.log(`importScoreMapに存在: ${importScoreMap.has(debugKey)}`);
                if (importScoreMap.has(debugKey)) {
                    const finalScore = importScoreMap.get(debugKey);
                    console.log(`✅ importScoreMap.get("${debugKey}") = ${finalScore} (type: ${typeof finalScore})`);
                    if (finalScore === 5) {
                        console.log('🎉🎉🎉 達成条件クリア：スコアが5です！ 🎉🎉🎉');
                    } else {
                        console.error(`❌ 達成条件未達成：スコアが ${finalScore} です（期待値: 5）`);
                    }
                } else {
                    console.log('⚠️ importScoreMapに該当キーが存在しません');
                    console.log('importScoreMap内の全キー（職業生活カテゴリ）:');
                    const syokugyouKeys = [...importScoreMap.keys()].filter(k => k.startsWith('職業生活'));
                    syokugyouKeys.forEach(k => {
                        console.log(`  - キー: "${k}" → スコア: ${importScoreMap.get(k)}`);
                        console.log(`    JSON: ${JSON.stringify(k)}`);
                    });
                }
                
                // ===== 【重要】newScores を全項目 null で初期化 =====
                const newScores = {};
                const newMemos = {};
                assessmentItems.forEach((item, index) => {
                    newScores[index] = null;  // 全項目nullで初期化
                    newMemos[index] = null;
                });
                console.log('✅ newScores を全項目nullに初期化');
                
                // ===== 【インポート完了後の確認ログ（必須）】 =====
                console.log('\n🔥🔥🔥 POST IMPORT KEY 確認 🔥🔥🔥');
                console.log('POST IMPORT KEY "職業生活__欠席等の連絡" =', importScoreMap.get('職業生活__欠席等の連絡'));
                if (importScoreMap.get('職業生活__欠席等の連絡') === 5) {
                    console.log('🎉 達成条件: importScoreMap に 5 が格納されています！');
                } else {
                    console.error('❌ importScoreMap の値が 5 ではありません:', importScoreMap.get('職業生活__欠席等の連絡'));
                }
                
                // ===== 【重要】importScoreMap だけを見て newScores を構築 =====
                console.log('\n🔥🔥🔥 newScores構築: importScoreMapのみ使用（既存scoreMap禁止） 🔥🔥🔥');
                let matchCount = 0;
                const restoreLog = [];  // UI復元検証ログ
                let debugKeyIndex = -1;  // デバッグ用: 特定キーのindex
                
                assessmentItems.forEach((item, index) => {
                    // ===== 【デバッグ】特定項目の詳細ログ =====
                    const isDebugTargetItem = (item.category && item.category.includes('職業生活')) && 
                                             (item.name && item.name.includes('欠席'));
                    
                    if (isDebugTargetItem) {
                        console.log(`\n🔍 [items.json index=${index}] デバッグ対象項目:`);
                        console.log('  item.category:', JSON.stringify(item.category));
                        console.log('  item.name:', JSON.stringify(item.name));
                    }
                    
                    const key = makeItemKey(item.category, item.name, isDebugTargetItem);
                    
                    // ===== 【デバッグ】特定キーのindex検出 =====
                    if (key === debugKey) {
                        debugKeyIndex = index;
                        console.log(`\n✅ 対象項目を発見:`);
                        console.log(`  カテゴリ: "${item.category}"`);
                        console.log(`  項目名: "${item.name}"`);
                        console.log(`  index: ${index}`);
                        console.log(`  生成されたキー: "${key}"`);
                        console.log(`  生成されたキー(JSON): ${JSON.stringify(key)}`);
                    }
                    
                    // ===== 【強制】importScoreMap だけを見る（既存scoreMap禁止） =====
                    if (importScoreMap.has(key)) {
                        const score = importScoreMap.get(key);
                        
                        // ===== 【NEWSCORES TRACE】index=25専用デバッグ =====
                        if (index === 25 || key === debugKey) {
                            console.log("\n=== NEWSCORES TRACE START ===");
                            console.log("target index:", index);
                            console.log("target key:", JSON.stringify(key));
                            console.log("item.category:", JSON.stringify(item.category));
                            console.log("item.name:", JSON.stringify(item.name));
                            console.log("before newScores[" + index + "]:", newScores[index]);
                            console.log("ASSIGN SOURCE:");
                            console.log("  from: importScoreMap.get(key)");
                            console.log("  key:", JSON.stringify(key));
                            console.log("  raw value from importScoreMap:", score);
                            console.log("  type:", typeof score);
                            console.log("  importScoreMap.has(key):", importScoreMap.has(key));
                        }
                        
                        if (score !== null) {
                            newScores[index] = score;
                            matchCount++;
                            
                            // ===== 【NEWSCORES TRACE】代入後 =====
                            if (index === 25 || key === debugKey) {
                                console.log("after newScores[" + index + "]:", newScores[index]);
                                console.trace("STACK TRACE");
                                console.log("=== NEWSCORES TRACE END ===");
                            }
                            
                            // ===== 【デバッグ】特定キーのスコア代入 =====
                            if (key === debugKey) {
                                console.log(`\n📝 newScoresへの代入:`);
                                console.log(`  newScores[${index}] = ${score}`);
                            }
                            
                            // 復元検証ログ（最初の10件）
                            if (restoreLog.length < 10) {
                                restoreLog.push({
                                    index: index,
                                    key: key,
                                    'importScoreMapから': score,
                                    'UIに復元': newScores[index],
                                    '一致': score === newScores[index] ? '✅' : '❌'
                                });
                            }
                        } else {
                            // ===== 【NEWSCORES TRACE】nullの場合 =====
                            if (index === 25 || key === debugKey) {
                                console.log("score is null, NOT assigning to newScores");
                                console.log("=== NEWSCORES TRACE END ===");
                            }
                        }
                    } else {
                        // ===== 【NEWSCORES TRACE】キーが存在しない場合 =====
                        if (index === 25 || (item.category && item.category.includes('職業生活') && item.name && item.name.includes('欠席'))) {
                            console.log("\n=== NEWSCORES TRACE START (KEY NOT FOUND) ===");
                            console.log("target index:", index);
                            console.log("target key:", JSON.stringify(key));
                            console.log("item.category:", JSON.stringify(item.category));
                            console.log("item.name:", JSON.stringify(item.name));
                            console.log("importScoreMap.has(key):", false);
                            console.log("Available keys in importScoreMap (職業生活):");
                            const syokugyouKeys = [...importScoreMap.keys()].filter(k => k.includes('職業生活'));
                            syokugyouKeys.forEach(k => {
                                console.log("  -", JSON.stringify(k), "→", importScoreMap.get(k));
                            });
                            console.log("newScores[" + index + "] will remain undefined (not assigned)");
                            console.log("=== NEWSCORES TRACE END ===");
                        }
                    }
                    
                    if (importMemoMap.has(key)) {
                        newMemos[index] = importMemoMap.get(key);
                    }
                });
                
                // UI復元検証ログを表示
                if (restoreLog.length > 0) {
                    console.log('🔍 UI復元検証 (最初の10件):');
                    console.table(restoreLog);
                }
                
                if (matchCount === 0) {
                    alert('❌ 項目が一致しませんでした\n\nCSVのカテゴリ名・項目名が現在のitems.jsonと一致しているか確認してください');
                    return;
                }
                
                // 履歴として保存
                const assessmentData = {
                    id: Date.now(),
                    basicInfo: basicInfo,
                    scores: newScores,
                    memos: newMemos,
                    items: assessmentItems.map(item => ({ ...item })),
                    timestamp: new Date().toISOString()
                };
                
                const userAssessments = getUserAssessments(basicInfo.userName);
                userAssessments.push(assessmentData);
                
                if (saveUserAssessments(basicInfo.userName, userAssessments)) {
                    alert(`✅ CSV読み込み成功\n\n利用者: ${basicInfo.userName}\n一致件数: ${matchCount}/${dataRows.length}\n評価ID: ${assessmentData.id}`);
                    
                    // フォームに反映（日付を正規化）
                    document.getElementById('userName').value = basicInfo.userName;
                    document.getElementById('managementNumber').value = basicInfo.managementNumber;
                    document.getElementById('evaluatorName').value = basicInfo.evaluatorName;
                    document.getElementById('entryDate').value = normalizeDateToISO(basicInfo.entryDate);
                    document.getElementById('startDate').value = normalizeDateToISO(basicInfo.startDate);
                    document.getElementById('endDate').value = normalizeDateToISO(basicInfo.endDate);
                    
                    currentAssessment.scores = { ...newScores };
                    currentAssessment.memos = { ...newMemos };
                    currentLoadedAssessmentId = assessmentData.id;
                    
                    // ===== 【デバッグ】currentAssessment.scoresへの反映確認 =====
                    if (debugKeyIndex >= 0) {
                        console.log(`\n📊 currentAssessment.scoresへの反映:`);
                        console.log(`  currentAssessment.scores[${debugKeyIndex}] = ${currentAssessment.scores[debugKeyIndex]}`);
                    }
                    
                    renderAssessmentItems();
                    
                    // ===== 【デバッグ】UI描画後のラジオボタン状態確認 =====
                    if (debugKeyIndex >= 0) {
                        setTimeout(() => {
                            console.log(`\n🎨 UI描画後のラジオボタン状態:`);
                            console.log(`  対象index: ${debugKeyIndex}`);
                            
                            const scoreButtons = document.querySelector(`[data-item-index="${debugKeyIndex}"]`);
                            if (scoreButtons) {
                                const activeBtn = scoreButtons.querySelector('.score-btn.active');
                                if (activeBtn) {
                                    const selectedScore = parseInt(activeBtn.getAttribute('data-score'));
                                    console.log(`  選択中のスコア（UIラジオボタン）: ${selectedScore}`);
                                    console.log(`  期待値（importScoreMap）: ${importScoreMap.get(debugKey)}`);
                                    console.log(`  期待値（newScores）: ${newScores[debugKeyIndex]}`);
                                    console.log(`  期待値（currentAssessment）: ${currentAssessment.scores[debugKeyIndex]}`);
                                    
                                    if (selectedScore === importScoreMap.get(debugKey)) {
                                        console.log(`  ✅ 一致しています！`);
                                    } else {
                                        console.error(`  ❌ 不一致！ UI=${selectedScore}, importScoreMap=${importScoreMap.get(debugKey)}`);
                                    }
                                } else {
                                    console.log(`  ⚠️ activeなボタンが見つかりません（未選択状態）`);
                                }
                            } else {
                                console.error(`  ❌ data-item-index="${debugKeyIndex}" のボタングループが見つかりません`);
                            }
                            console.log('🔍🔍🔍 [特定キー追跡終了] 🔍🔍🔍\n');
                        }, 100);
                    }
                    
                    loadPastAssessments();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    alert('❌ 保存に失敗しました');
                }
            } catch (error) {
                console.error('CSV読み込みエラー:', error);
                alert(`❌ CSV読み込み中にエラーが発生しました\n\n${error.message}`);
            } finally {
                event.target.value = '';
            }
        };
        
        reader.onerror = function() {
            alert('❌ ファイル読み込みに失敗しました');
        };
        
        reader.readAsText(file, 'UTF-8');
    }
    
    // ===== CSV出力 =====
    function handleExportCSV() {
        const userName = getCurrentUserName();
        if (!userName || Object.keys(currentAssessment.scores).length === 0) {
            alert('評価データを入力してください');
            return;
        }
        
        const BOM = '\uFEFF';
        const header = ['記入日', '利用者名', '管理番号', '評価実施者名', '評価期間開始', '評価期間終了', 'カテゴリ', '項目', 'スコア', '評価', 'メモ'];
        
        let rows = [header];
        
        assessmentItems.forEach((item, index) => {
            const score = currentAssessment.scores[index];
            if (score) {
                rows.push([
                    document.getElementById('entryDate').value,
                    document.getElementById('userName').value,
                    document.getElementById('managementNumber').value,
                    document.getElementById('evaluatorName').value,
                    document.getElementById('startDate').value,
                    document.getElementById('endDate').value,
                    item.category,
                    item.name,
                    score,
                    scoreCriteria[score].label,
                    (currentAssessment.memos[index] || '').replace(/\n/g, ' ')
                ]);
            }
        });
        
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `assessment_${userName}_${Date.now()}.csv`;
        link.click();
    }
    
    // ===== グローバルイベントリスナーの設定 =====
    function setupGlobalEventListeners() {
        document.getElementById('toggleCriteria')?.addEventListener('click', function() {
            document.getElementById('criteriaPanel').classList.toggle('d-none');
        });
        
        document.getElementById('saveAssessment')?.addEventListener('click', saveAssessment);
        document.getElementById('clearForm')?.addEventListener('click', clearForm);
        document.getElementById('viewResults')?.addEventListener('click', viewResults);
        document.getElementById('viewChart')?.addEventListener('click', viewChart);
        document.getElementById('exportCSV')?.addEventListener('click', handleExportCSV);
        document.getElementById('importCSV')?.addEventListener('click', handleImportCSV);
        document.getElementById('importCSVFile')?.addEventListener('change', processImportedCSV);
        document.getElementById('printResults')?.addEventListener('click', () => window.print());
        document.getElementById('saveChartImage')?.addEventListener('click', function() {
            const first = Array.from(categoryCharts.keys())[0];
            if (first) saveCategoryChart(first);
        });
        
        document.getElementById('userName')?.addEventListener('blur', function() {
            if (this.value.trim()) loadPastAssessments();
        });
    }
    
    // ===== 初期化処理 =====
    async function initialize() {
        try {
            document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
            
            const loaded = await loadAssessmentItems();
            
            if (loaded && assessmentItems.length > 0) {
                setupGlobalEventListeners();
                renderAssessmentItems();
                loadPastAssessments();
                console.log(`✅ App initialized successfully (${assessmentItems.length} items)`);
            } else {
                setupGlobalEventListeners();
                console.error('❌ Failed to load assessment items');
            }
        } catch (error) {
            console.error('❌ Initialization error:', error);
            showError('初期化エラーが発生しました', [error.message]);
        }
    }
    
    // ===== DOMContentLoaded =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
