const BOARD_SIZE = 15;
const CELL_EMPTY = 0;
const CELL_BLACK = 1;
const CELL_WHITE = 2;

let board = [];
let currentPlayer = CELL_BLACK;
let isGameActive = true;
let lastMove = null;
let gameMode = 'pvp'; // 'pvp' or 'pve'
let isComputerTurn = false;

const boardElement = document.getElementById('board');
const statusText = document.getElementById('status-text');
const resetBtn = document.getElementById('reset-btn');
const modeRadios = document.querySelectorAll('input[name="mode"]');

// ゲーム初期化
function initGame() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CELL_EMPTY));
    currentPlayer = CELL_BLACK;
    isGameActive = true;
    lastMove = null;
    isComputerTurn = false;

    // モード設定の読み込み
    const selectedMode = document.querySelector('input[name="mode"]:checked');
    if (selectedMode) {
        gameMode = selectedMode.value;
    }

    updateStatus();
    renderBoard();
}

// 盤面描画
function renderBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(row, col));

            const cellValue = board[row][col];
            if (cellValue !== CELL_EMPTY) {
                const stone = document.createElement('div');
                stone.classList.add('stone');
                stone.classList.add(cellValue === CELL_BLACK ? 'black' : 'white');

                // 最後の手にマーク
                if (lastMove && lastMove.row === row && lastMove.col === col) {
                    stone.classList.add('last-move');
                }

                cell.appendChild(stone);
            }
            boardElement.appendChild(cell);
        }
    }
}

// セルクリック処理
function handleCellClick(row, col) {
    if (!isGameActive || board[row][col] !== CELL_EMPTY || isComputerTurn) {
        return;
    }

    placeStone(row, col);

    if (isGameActive && gameMode === 'pve' && currentPlayer === CELL_WHITE) {
        isComputerTurn = true;
        setTimeout(computerMove, 500); // 少し遅らせて人間らしく
    }
}

// 石を置く処理
function placeStone(row, col) {
    board[row][col] = currentPlayer;
    lastMove = { row, col };

    // 勝利判定
    const winLine = checkWin(row, col, currentPlayer);

    updateCell(row, col);

    if (winLine) {
        isGameActive = false;
        highlightWinLine(winLine);
        statusText.textContent = `${currentPlayer === CELL_BLACK ? '黒' : '白'}の勝ちです！`;
        isComputerTurn = false;
        return;
    }

    // 連続数チェック（3個、4個の通知）
    const maxConsecutive = getMaxConsecutive(row, col, currentPlayer);
    if (maxConsecutive === 4) {
        announceConsecutive('4個');
    } else if (maxConsecutive === 3) {
        announceConsecutive('3個');
    }

    // 引き分け判定
    if (checkDraw()) {
        isGameActive = false;
        statusText.textContent = '引き分けです！';
        isComputerTurn = false;
        return;
    }

    // プレイヤー交代
    currentPlayer = currentPlayer === CELL_BLACK ? CELL_WHITE : CELL_BLACK;
    updateStatus();
}

// 最大連続数を取得
function getMaxConsecutive(row, col, player) {
    const directions = [
        { dr: 0, dc: 1 },  // 横
        { dr: 1, dc: 0 },  // 縦
        { dr: 1, dc: 1 },  // 右下がり斜め
        { dr: 1, dc: -1 }  // 左下がり斜め
    ];

    let maxCount = 1;

    for (const { dr, dc } of directions) {
        let count = 1;

        // 正方向
        let r = row + dr;
        let c = col + dc;
        while (isValidCell(r, c) && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }

        // 負方向
        r = row - dr;
        c = col - dc;
        while (isValidCell(r, c) && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }

        if (count > maxCount) {
            maxCount = count;
        }
    }

    return maxCount;
}

// 連続数の通知
function announceConsecutive(message) {
    const announcement = document.createElement('div');
    announcement.className = 'announcement';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    // アニメーション後に削除
    setTimeout(() => {
        announcement.remove();
    }, 1500);
}

// CPUの思考ルーチン
function computerMove() {
    if (!isGameActive) return;

    let bestMove = null;

    // 1. 自分が勝てる手があるか (5連)
    bestMove = findWinningMove(CELL_WHITE);
    if (bestMove) {
        placeStone(bestMove.row, bestMove.col);
        isComputerTurn = false;
        return;
    }

    // 2. 相手の勝利を阻止する (4連)
    bestMove = findWinningMove(CELL_BLACK);
    if (bestMove) {
        placeStone(bestMove.row, bestMove.col);
        isComputerTurn = false;
        return;
    }

    // 3. 自分の4連を作る（簡易評価）
    // 4. 相手の3連を防ぐ（簡易評価）
    // 評価関数ベースで最善手を探す
    bestMove = findBestMoveByScore();

    if (bestMove) {
        placeStone(bestMove.row, bestMove.col);
    } else {
        // 万が一打つ場所がない場合（引き分け判定で弾かれるはずだが念のため）
        // ランダムな空きマス
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === CELL_EMPTY) {
                    placeStone(r, c);
                    isComputerTurn = false;
                    return;
                }
            }
        }
    }
    isComputerTurn = false;
}

// 勝利手を探す（単純なリーチ判定）
function findWinningMove(player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === CELL_EMPTY) {
                board[row][col] = player; // 仮に置く
                if (checkWin(row, col, player)) {
                    board[row][col] = CELL_EMPTY; // 戻す
                    return { row, col };
                }
                board[row][col] = CELL_EMPTY; // 戻す
            }
        }
    }
    return null;
}

// 評価関数による最善手探索
function findBestMoveByScore() {
    let maxScore = -Infinity;
    let bestMoves = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === CELL_EMPTY) {
                const score = evaluateMove(row, col);
                if (score > maxScore) {
                    maxScore = score;
                    bestMoves = [{ row, col }];
                } else if (score === maxScore) {
                    bestMoves.push({ row, col });
                }
            }
        }
    }

    if (bestMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * bestMoves.length);
        return bestMoves[randomIndex];
    }
    return null;
}

// 手の評価
function evaluateMove(row, col) {
    let score = 0;

    // 自分の攻撃評価
    score += evaluateLine(row, col, CELL_WHITE);
    // 相手の防御評価（防御の方が重要度高め）
    score += evaluateLine(row, col, CELL_BLACK) * 1.2;

    // 中央に近いほど少し加点
    const center = Math.floor(BOARD_SIZE / 2);
    const dist = Math.abs(row - center) + Math.abs(col - center);
    score += (BOARD_SIZE * 2 - dist);

    return score;
}

// 特定のマスに置いた時のライン評価
function evaluateLine(row, col, player) {
    const directions = [
        { dr: 0, dc: 1 },
        { dr: 1, dc: 0 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    let totalScore = 0;

    for (const { dr, dc } of directions) {
        let count = 1; // 今置く石
        let openEnds = 0;

        // 正方向
        let r = row + dr;
        let c = col + dc;
        while (isValidCell(r, c) && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }
        if (isValidCell(r, c) && board[r][c] === CELL_EMPTY) {
            openEnds++;
        }

        // 負方向
        r = row - dr;
        c = col - dc;
        while (isValidCell(r, c) && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }
        if (isValidCell(r, c) && board[r][c] === CELL_EMPTY) {
            openEnds++;
        }

        // 評価値計算
        if (count >= 5) totalScore += 100000;
        else if (count === 4 && openEnds >= 1) totalScore += 10000; // 4連（片方でも空いてれば脅威）
        else if (count === 3 && openEnds === 2) totalScore += 1000; // 両端空き3連
        else if (count === 3 && openEnds === 1) totalScore += 100;
        else if (count === 2 && openEnds === 2) totalScore += 100;
        else if (count === 2 && openEnds === 1) totalScore += 10;
    }

    return totalScore;
}


// 特定のセルだけ更新（アニメーション用）
function updateCell(row, col) {
    const index = row * BOARD_SIZE + col;
    const cell = boardElement.children[index];

    // 既存のlast-moveを削除
    const prevLastMove = document.querySelector('.last-move');
    if (prevLastMove) {
        prevLastMove.classList.remove('last-move');
    }

    const stone = document.createElement('div');
    stone.classList.add('stone');
    stone.classList.add(board[row][col] === CELL_BLACK ? 'black' : 'white');
    stone.classList.add('last-move');
    cell.appendChild(stone);
}

// 勝利ラインのハイライト
function highlightWinLine(winLine) {
    winLine.forEach(({ row, col }) => {
        const index = row * BOARD_SIZE + col;
        const cell = boardElement.children[index];
        cell.classList.add('win-line');
    });
}

// ステータス更新
function updateStatus() {
    if (gameMode === 'pve' && currentPlayer === CELL_WHITE && isComputerTurn) {
        statusText.textContent = 'CPU思考中...';
    } else if (gameMode === 'pve' && currentPlayer === CELL_WHITE) {
        statusText.textContent = 'CPU思考中...';
    } else {
        statusText.textContent = `${currentPlayer === CELL_BLACK ? '黒' : '白'}の番です`;
    }
}

// 勝利判定ロジック
function checkWin(row, col, player) {
    const directions = [
        { dr: 0, dc: 1 },  // 横
        { dr: 1, dc: 0 },  // 縦
        { dr: 1, dc: 1 },  // 右下がり斜め
        { dr: 1, dc: -1 }  // 左下がり斜め
    ];

    for (const { dr, dc } of directions) {
        const line = getConsecutiveStones(row, col, dr, dc, player);
        if (line.length >= 5) {
            return line;
        }
    }
    return null;
}

// 指定方向の連続した石を取得
function getConsecutiveStones(row, col, dr, dc, player) {
    const line = [{ row, col }];

    // 正方向
    for (let i = 1; i < 5; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (isValidCell(r, c) && board[r][c] === player) {
            line.push({ row: r, col: c });
        } else {
            break;
        }
    }

    // 負方向
    for (let i = 1; i < 5; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (isValidCell(r, c) && board[r][c] === player) {
            line.push({ row: r, col: c });
        } else {
            break;
        }
    }

    return line;
}

// セルが盤面内かチェック
function isValidCell(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// 引き分け判定
function checkDraw() {
    return board.every(row => row.every(cell => cell !== CELL_EMPTY));
}

// リセットボタン
resetBtn.addEventListener('click', initGame);

// モード切替イベント
modeRadios.forEach(radio => {
    radio.addEventListener('change', initGame);
});

// ゲーム開始
initGame();
