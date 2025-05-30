// ゲーム設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム状態
const gameState = {
    keys: {},
    lastTime: 0,
    virtualInput: {
        movement: { x: 0, y: 0 },
        aim: { x: 0, y: 0 },
        shooting: false
    },
    lastShotTime: 0,
    shotCooldown: 150, // ミリ秒
    score: 0,
    enemiesKilled: 0,
    
    // ウェーブシステム
    currentWave: 1,
    enemiesInWave: 8, // 最初のウェーブの敵数（5から8に増加）
    enemiesSpawned: 0, // 現在のウェーブで出現した敵数
    enemiesKilledInWave: 0, // 現在のウェーブで倒した敵数
    waveComplete: false,
    nextWaveDelay: 3000, // 次のウェーブまでの遅延（ミリ秒）
    waveCompleteTime: 0,
    gamePhase: 'playing', // 'playing', 'wave_complete', 'wave_starting', 'game_over'
    
    // ゲームオーバー関連
    isGameOver: false,
    gameOverTime: 0
};

// プレイヤー設定
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 20,
    height: 20,
    speed: 220, // ピクセル/秒
    rotationSpeed: 180, // 度/秒
    angle: 0, // 角度（度）
    color: '#00ff00', // 暗い背景に見えるように明るい緑に戻す
    maxHP: 100,
    currentHP: 100,
    lastDamageTime: 0,
    damageInterval: 500 // ダメージ間隔（ミリ秒）
};

// 弾の設定
const bullets = [];
const bulletSettings = {
    speed: 800, // ピクセル/秒（500から800に向上）
    width: 4,
    height: 8,
    color: '#ffff00' // 暗い背景に見えるように黄色に戻す
};

// 敵の設定
const enemies = [];
const enemyTypes = {
    normal: {
        speed: 90,
        width: 22,
        height: 22,
        color: '#ff4444',
        hp: 1,
        maxHP: 1,
        scoreValue: 100
    },
    tank: {
        speed: 60,
        width: 32,
        height: 32,
        color: '#8B0000', // ダークレッド
        hp: 5,
        maxHP: 5,
        scoreValue: 250
    },
    fast: {
        speed: 150,
        width: 16,
        height: 16,
        color: '#FF69B4', // ピンク
        hp: 1,
        maxHP: 1,
        scoreValue: 150
    }
};

const enemySettings = {
    spawnRate: 800, // ミリ秒
    lastSpawnTime: 0,
    simultaneousSpawn: 1 // 同時出現数（初期値）
};

// 爆発エフェクトの設定
const explosions = [];
const explosionSettings = {
    particleCount: 8, // パーティクル数
    particleSpeed: 150, // パーティクルの初期速度
    particleLifetime: 0.8, // パーティクルの生存時間（秒）
    particleSize: 3, // パーティクルのサイズ
    colors: ['#ff6600', '#ff9900', '#ffcc00', '#ff3300', '#ffff00'] // 爆発の色
};

// 画面揺れエフェクトの設定
const screenShake = {
    intensity: 0, // 現在の揺れの強度
    duration: 0, // 残り時間
    offsetX: 0, // X軸のオフセット
    offsetY: 0  // Y軸のオフセット
};

// バーチャルパッドの設定
const virtualPads = {
    movement: {
        element: null,
        stick: null,
        isDragging: false,
        startPos: { x: 0, y: 0 },
        moveHandler: null,
        endHandler: null,
        isTouch: false
    },
    aim: {
        element: null,
        stick: null,
        isDragging: false,
        startPos: { x: 0, y: 0 },
        moveHandler: null,
        endHandler: null,
        isTouch: false
    }
};

// キーボードイベント処理
document.addEventListener('keydown', (e) => {
    gameState.keys[e.code] = true;
    
    // ゲームオーバー時のリスタート
    if (e.code === 'KeyR' && gameState.isGameOver) {
        e.preventDefault();
        restartGame();
        return;
    }
    
    // スペースキーで弾を発射（ゲームオーバー時は無効）
    if (e.code === 'Space' && !gameState.isGameOver) {
        e.preventDefault(); // スペースキーのデフォルト動作を防ぐ
        shootBullet();
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
});

// 弾を発射する関数
function shootBullet() {
    const currentTime = Date.now();
    if (currentTime - gameState.lastShotTime > gameState.shotCooldown) {
        // プレイヤーの向いている方向に弾を発射
        const radians = player.angle * Math.PI / 180; // 角度をラジアンに変換
        
        const bullet = {
            x: player.x + player.width / 2 - bulletSettings.width / 2,
            y: player.y + player.height / 2 - bulletSettings.height / 2,
            width: bulletSettings.width,
            height: bulletSettings.height,
            vx: Math.cos(radians) * bulletSettings.speed,
            vy: Math.sin(radians) * bulletSettings.speed
        };
        
        bullets.push(bullet);
        gameState.lastShotTime = currentTime;
    }
}

// バーチャルパッドの初期化
function initVirtualPads() {
    // 移動パッド
    const movementPad = document.querySelector('.movement-pad .pad-outer');
    const movementStick = document.getElementById('movementStick');
    
    // 照準パッド
    const aimPad = document.querySelector('.rotation-pad .pad-outer');
    const aimStick = document.getElementById('aimStick');
    
    if (movementPad && movementStick) {
        virtualPads.movement.element = movementPad;
        virtualPads.movement.stick = movementStick;
        setupPad('movement');
    }
    
    if (aimPad && aimStick) {
        virtualPads.aim.element = aimPad;
        virtualPads.aim.stick = aimStick;
        setupPad('aim');
    }
}

// パッドのセットアップ
function setupPad(padType) {
    const pad = virtualPads[padType];
    const element = pad.element;
    const stick = pad.stick;
    
    // タッチイベント
    element.addEventListener('touchstart', (e) => handlePadStart(e, padType));
    
    // マウスイベント（デバッグ用）
    element.addEventListener('mousedown', (e) => handlePadStart(e, padType));
}

// パッド操作開始
function handlePadStart(e, padType) {
    e.preventDefault();
    const pad = virtualPads[padType];
    const rect = pad.element.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    pad.isDragging = true;
    pad.startPos.x = rect.left + rect.width / 2;
    pad.startPos.y = rect.top + rect.height / 2;
    
    // 文書全体にイベントリスナーを追加
    const moveHandler = (e) => handlePadMove(e, padType);
    const endHandler = (e) => handlePadEnd(e, padType);
    
    if (e.touches) {
        // タッチイベント
        document.addEventListener('touchmove', moveHandler);
        document.addEventListener('touchend', endHandler);
        document.addEventListener('touchcancel', endHandler);
        pad.isTouch = true;
    } else {
        // マウスイベント
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', endHandler);
        pad.isTouch = false;
    }
    
    // ハンドラーを保存
    pad.moveHandler = moveHandler;
    pad.endHandler = endHandler;
}

// パッド操作中
function handlePadMove(e, padType) {
    e.preventDefault();
    const pad = virtualPads[padType];
    
    if (!pad.isDragging) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    updatePadPosition(clientX, clientY, padType);
}

// パッド操作終了
function handlePadEnd(e, padType) {
    e.preventDefault();
    const pad = virtualPads[padType];
    
    if (!pad.isDragging) return;
    
    pad.isDragging = false;
    
    // 文書からイベントリスナーを削除
    if (pad.moveHandler && pad.endHandler) {
        if (pad.isTouch) {
            // タッチイベント
            document.removeEventListener('touchmove', pad.moveHandler);
            document.removeEventListener('touchend', pad.endHandler);
            document.removeEventListener('touchcancel', pad.endHandler);
        } else {
            // マウスイベント
            document.removeEventListener('mousemove', pad.moveHandler);
            document.removeEventListener('mouseup', pad.endHandler);
        }
        
        // ハンドラーをクリア
        pad.moveHandler = null;
        pad.endHandler = null;
        pad.isTouch = false;
    }
    
    // スティックを中央に戻す
    pad.stick.style.transform = 'translate(0px, 0px)';
    
    // 入力をリセット
    if (padType === 'movement') {
        gameState.virtualInput.movement.x = 0;
        gameState.virtualInput.movement.y = 0;
    } else if (padType === 'aim') {
        gameState.virtualInput.aim.x = 0;
        gameState.virtualInput.aim.y = 0;
    }
}

// パッド位置の更新
function updatePadPosition(clientX, clientY, padType) {
    // ゲームオーバー時は入力を無効にする
    if (gameState.isGameOver) {
        return;
    }
    
    const pad = virtualPads[padType];
    
    // 画面サイズに応じて操作範囲を調整
    let maxRadius;
    if (window.innerWidth <= 480) {
        maxRadius = 31; // 小さい画面: (100-38)/2
    } else if (window.innerHeight <= 500 && window.innerWidth > window.innerHeight) {
        maxRadius = 25; // ランドスケープ: (80-30)/2
    } else {
        maxRadius = 37.5; // 通常: (120-45)/2
    }
    
    let deltaX = clientX - pad.startPos.x;
    let deltaY = clientY - pad.startPos.y;
    
    // 距離を制限
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
    }
    
    // スティックの位置を更新
    pad.stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    // ゲーム入力を更新
    if (padType === 'movement') {
        gameState.virtualInput.movement.x = deltaX / maxRadius;
        gameState.virtualInput.movement.y = deltaY / maxRadius;
    } else if (padType === 'aim') {
        gameState.virtualInput.aim.x = deltaX / maxRadius;
        gameState.virtualInput.aim.y = deltaY / maxRadius;
    }
}

// プレイヤーの更新
function updatePlayer(deltaTime) {
    // ゲームオーバー時は更新しない
    if (gameState.isGameOver) {
        return;
    }
    
    const moveDistance = player.speed * (deltaTime / 1000);
    const rotationDistance = player.rotationSpeed * (deltaTime / 1000);
    
    // 照準スティックによる回転と射撃
    const aimDistance = Math.sqrt(gameState.virtualInput.aim.x ** 2 + gameState.virtualInput.aim.y ** 2);
    if (aimDistance > 0.2) { // デッドゾーン
        // 照準方向にプレイヤーを向ける（座標系を正しく調整）
        const aimAngle = Math.atan2(gameState.virtualInput.aim.y, gameState.virtualInput.aim.x) * 180 / Math.PI;
        player.angle = aimAngle;
        
        // 自動射撃（クールダウン付き）
        const currentTime = Date.now();
        if (currentTime - gameState.lastShotTime > gameState.shotCooldown) {
            shootBullet();
            gameState.lastShotTime = currentTime;
        }
    } else {
        // 照準スティックが使われていない場合は従来の回転
        if (gameState.keys['ArrowLeft']) {
            player.angle -= rotationDistance;
        }
        if (gameState.keys['ArrowRight']) {
            player.angle += rotationDistance;
        }
    }
    
    // 角度を0-360度の範囲に正規化
    player.angle = ((player.angle % 360) + 360) % 360;
    
    // WASD移動（画面基準で移動 + バーチャルパッド）
    let moveX = 0;
    let moveY = 0;
    
    // キーボード入力
    if (gameState.keys['KeyW']) {
        moveY -= moveDistance;
    }
    if (gameState.keys['KeyS']) {
        moveY += moveDistance;
    }
    if (gameState.keys['KeyA']) {
        moveX -= moveDistance;
    }
    if (gameState.keys['KeyD']) {
        moveX += moveDistance;
    }
    
    // バーチャルパッド入力
    if (Math.abs(gameState.virtualInput.movement.x) > 0.1) {
        moveX += gameState.virtualInput.movement.x * moveDistance;
    }
    if (Math.abs(gameState.virtualInput.movement.y) > 0.1) {
        moveY += gameState.virtualInput.movement.y * moveDistance;
    }
    
    // 位置を更新
    player.x += moveX;
    player.y += moveY;
    
    // 画面境界の制限
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
}

// 弾の更新
function updateBullets(deltaTime) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // 弾の位置を更新
        bullet.x += bullet.vx * (deltaTime / 1000);
        bullet.y += bullet.vy * (deltaTime / 1000);
        
        // 画面外に出た弾を削除
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }
}

// 敵の生成
function spawnEnemy(currentTime) {
    // ウェーブが完了していたら敵を生成しない
    if (gameState.waveComplete || gameState.gamePhase !== 'playing') return;
    
    // 敵の生成タイミングをチェック
    if (currentTime - enemySettings.lastSpawnTime > enemySettings.spawnRate) {
        // 現在のウェーブで必要な敵数をすべて生成し終わったら生成を停止
        if (gameState.enemiesSpawned >= gameState.enemiesInWave) return;
        
        // 同時に生成する敵の数を決定（1から設定値まで）
        const spawnCount = Math.min(
            Math.floor(Math.random() * enemySettings.simultaneousSpawn) + 1,
            gameState.enemiesInWave - gameState.enemiesSpawned
        );
        
        for (let i = 0; i < spawnCount; i++) {
            createEnemy();
            gameState.enemiesSpawned++;
        }
        
        enemySettings.lastSpawnTime = currentTime;
    }
}

// 敵を作成する関数
function createEnemy() {
    // 敵のタイプをランダムに選択
    const typeNames = Object.keys(enemyTypes);
    const randomType = typeNames[Math.floor(Math.random() * typeNames.length)];
    const enemyType = enemyTypes[randomType];
    
    // 画面の端からランダムに出現
    let x, y;
    const side = Math.floor(Math.random() * 4); // 0: 上, 1: 右, 2: 下, 3: 左
    
    switch (side) {
        case 0: // 上
            x = Math.random() * canvas.width;
            y = -enemyType.height;
            break;
        case 1: // 右
            x = canvas.width;
            y = Math.random() * canvas.height;
            break;
        case 2: // 下
            x = Math.random() * canvas.width;
            y = canvas.height;
            break;
        case 3: // 左
            x = -enemyType.width;
            y = Math.random() * canvas.height;
            break;
    }
    
    const enemy = {
        x: x,
        y: y,
        width: enemyType.width,
        height: enemyType.height,
        type: randomType,
        hp: enemyType.hp,
        maxHP: enemyType.maxHP,
        scoreValue: enemyType.scoreValue
    };
    
    enemies.push(enemy);
}

// 敵の更新
function updateEnemies(deltaTime) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const enemyType = enemyTypes[enemy.type];
        
        // プレイヤーに向かって移動（プレイヤー追跡）
        const dx = player.x + player.width / 2 - (enemy.x + enemy.width / 2);
        const dy = player.y + player.height / 2 - (enemy.y + enemy.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const moveDistance = enemyType.speed * (deltaTime / 1000);
            enemy.x += (dx / distance) * moveDistance;
            enemy.y += (dy / distance) * moveDistance;
        }
        
        // 画面外に大きく離れた敵を削除（メモリ節約）
        const margin = 100;
        if (enemy.x < -margin || enemy.x > canvas.width + margin || 
            enemy.y < -margin || enemy.y > canvas.height + margin) {
            enemies.splice(i, 1);
        }
    }
}

// 弾と敵の衝突判定
function checkBulletEnemyCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            if (checkCollision(bullet, enemy)) {
                // 弾を削除
                bullets.splice(i, 1);
                
                // 敵のHPを減らす
                enemy.hp--;
                
                // 敵が倒された場合
                if (enemy.hp <= 0) {
                    // 爆発エフェクト
                    createExplosion(enemy.x, enemy.y);
                    
                    // スコア加算
                    gameState.score += enemyTypes[enemy.type].scoreValue;
                    gameState.enemiesKilled++;
                    gameState.enemiesKilledInWave++;
                    
                    // 敵を削除
                    enemies.splice(j, 1);
                }
                
                break;
            }
        }
    }
}

// プレイヤーと敵の衝突判定
function checkPlayerEnemyCollisions(currentTime) {
    // ダメージ間隔をチェック
    if (currentTime - player.lastDamageTime < player.damageInterval) {
        return;
    }
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        if (checkCollision(player, enemy)) {
            // プレイヤーがダメージを受ける
            player.currentHP -= 10;
            player.lastDamageTime = currentTime;
            
            // 敵のHPを減らす（体当たりでも1ダメージのみ）
            enemy.hp--;
            
            // 敵が倒された場合
            if (enemy.hp <= 0) {
                // 爆発エフェクトを生成
                createExplosion(enemy.x, enemy.y);
                
                // スコアを追加（体当たりで倒した場合、半分のスコア）
                gameState.score += Math.floor(enemy.scoreValue / 2);
                gameState.enemiesKilled++;
                gameState.enemiesKilledInWave++;
                
                // 敵を削除
                enemies.splice(i, 1);
            }
            
            // HPが0以下になったらゲームオーバー処理
            if (player.currentHP <= 0) {
                player.currentHP = 0;
                gameState.isGameOver = true;
                gameState.gamePhase = 'game_over';
                gameState.gameOverTime = currentTime;
                
                // バーチャルパッドをリセット
                gameState.virtualInput.movement.x = 0;
                gameState.virtualInput.movement.y = 0;
                gameState.virtualInput.aim.x = 0;
                gameState.virtualInput.aim.y = 0;
                
                console.log('ゲームオーバー！');
            }
            
            break; // 1フレームに1回のダメージのみ
        }
    }
}

// 衝突判定の補助関数
function checkCollision(rect1, rect2) {
    return !(rect1.x + rect1.width < rect2.x || 
             rect2.x + rect2.width < rect1.x || 
             rect1.y + rect1.height < rect2.y || 
             rect2.y + rect2.height < rect1.y);
}

// 画面揺れエフェクトを開始する関数
function startScreenShake(intensity = 8, duration = 200) {
    screenShake.intensity = intensity;
    screenShake.duration = duration;
}

// 画面揺れエフェクトを更新する関数
function updateScreenShake(deltaTime) {
    if (screenShake.duration > 0) {
        screenShake.duration -= deltaTime;
        
        // 揺れの強度を時間経過とともに減衰
        const shakeRatio = screenShake.duration / 200; // 200msを基準
        const currentIntensity = screenShake.intensity * shakeRatio;
        
        // ランダムなオフセットを生成
        screenShake.offsetX = (Math.random() - 0.5) * currentIntensity * 2;
        screenShake.offsetY = (Math.random() - 0.5) * currentIntensity * 2;
        
        if (screenShake.duration <= 0) {
            screenShake.offsetX = 0;
            screenShake.offsetY = 0;
        }
    }
}

// 爆発エフェクトの生成
function createExplosion(x, y) {
    // 画面揺れエフェクトを開始
    startScreenShake(6, 150);
    
    const explosion = {
        x: x,
        y: y,
        particles: [],
        createdTime: Date.now()
    };
    
    // 火花のパーティクル
    for (let i = 0; i < explosionSettings.particleCount; i++) {
        const angle = (Math.PI * 2 * i) / explosionSettings.particleCount;
        const speed = explosionSettings.particleSpeed * (0.5 + Math.random() * 0.5);
        
        const particle = {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: explosionSettings.particleLifetime * (0.8 + Math.random() * 0.4),
            maxLife: explosionSettings.particleLifetime,
            size: explosionSettings.particleSize * (0.5 + Math.random() * 0.5),
            color: explosionSettings.colors[Math.floor(Math.random() * explosionSettings.colors.length)],
            type: 'fire'
        };
        
        explosion.particles.push(particle);
    }
    
    // 煙のパーティクル
    for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = explosionSettings.particleSpeed * 0.3;
        
        const particle = {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: explosionSettings.particleLifetime * 1.5,
            maxLife: explosionSettings.particleLifetime * 1.5,
            size: explosionSettings.particleSize * 2,
            color: '#666666',
            type: 'smoke'
        };
        
        explosion.particles.push(particle);
    }
    
    explosions.push(explosion);
}

// 爆発エフェクトの更新
function updateExplosions(deltaTime) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        
        for (let j = explosion.particles.length - 1; j >= 0; j--) {
            const particle = explosion.particles[j];
            
            // パーティクルの位置更新
            particle.x += particle.vx * (deltaTime / 1000);
            particle.y += particle.vy * (deltaTime / 1000);
            
            // パーティクルの寿命減少
            particle.life -= deltaTime / 1000;
            
            // 煙は上昇する
            if (particle.type === 'smoke') {
                particle.vy -= 50 * (deltaTime / 1000); // 上向きの力
                particle.vx *= 0.995; // 横方向の減衰
            }
            
            // 寿命が尽きたパーティクルを削除
            if (particle.life <= 0) {
                explosion.particles.splice(j, 1);
            }
        }
        
        // パーティクルがすべてなくなったら爆発を削除
        if (explosion.particles.length === 0) {
            explosions.splice(i, 1);
        }
    }
}

// ウェーブシステムの更新
function updateWaveSystem(currentTime) {
    // ウェーブ完了判定
    if (!gameState.waveComplete && 
        gameState.enemiesKilledInWave >= gameState.enemiesInWave && 
        enemies.length === 0) {
        gameState.waveComplete = true;
        gameState.waveCompleteTime = currentTime;
        gameState.gamePhase = 'wave_complete';
        console.log(`ウェーブ ${gameState.currentWave} クリア！`);
    }
    
    // 次のウェーブへの移行
    if (gameState.waveComplete && 
        currentTime - gameState.waveCompleteTime > gameState.nextWaveDelay) {
        startNextWave();
    }
}

// 次のウェーブを開始
function startNextWave() {
    gameState.currentWave++;
    
    // 敵数を指数関数的に増加（8 × 1.5^(wave-1)）
    gameState.enemiesInWave = Math.floor(8 * Math.pow(1.5, gameState.currentWave - 1));
    
    // 同時出現数も増加（最大4まで）
    enemySettings.simultaneousSpawn = Math.min(1 + Math.floor(gameState.currentWave / 3), 4);
    
    // ウェーブ状態をリセット
    gameState.enemiesSpawned = 0;
    gameState.enemiesKilledInWave = 0;
    gameState.waveComplete = false;
    gameState.waveCompleteTime = 0;
    gameState.gamePhase = 'playing';
    
    console.log(`ウェーブ ${gameState.currentWave} 開始！ 敵数: ${gameState.enemiesInWave}, 同時出現数: ${enemySettings.simultaneousSpawn}`);
}

// 背景の描画
function drawBackground() {
    // 背景色
    ctx.fillStyle = '#1a2744';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // グリッド線
    ctx.strokeStyle = '#2a3754';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    
    // 垂直線
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // 水平線
    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// プレイヤーの描画
function drawPlayer() {
    ctx.save(); // 現在の描画状態を保存
    
    // プレイヤーの中心に移動
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    
    // プレイヤーを回転
    ctx.rotate(player.angle * Math.PI / 180);
    
    // ダメージ時の点滅効果
    const currentTime = Date.now();
    const timeSinceDamage = currentTime - player.lastDamageTime;
    const isFlashing = timeSinceDamage < 200 && Math.floor(timeSinceDamage / 50) % 2 === 0;
    
    if (isFlashing) {
        ctx.fillStyle = '#ff4444'; // 赤色で点滅
    } else {
        ctx.fillStyle = player.color;
    }
    
    // プレイヤーの本体（中心基準で描画）
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // 向いている方向を示す三角形
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2 - 5); // 上の点
    ctx.lineTo(-5, -player.height / 2); // 左下の点
    ctx.lineTo(5, -player.height / 2); // 右下の点
    ctx.closePath();
    ctx.fill();
    
    ctx.restore(); // 描画状態を復元
}

// 弾の描画
function drawBullets() {
    ctx.fillStyle = bulletSettings.color;
    for (const bullet of bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
}

// 敵の描画
function drawEnemies() {
    for (const enemy of enemies) {
        const enemyType = enemyTypes[enemy.type];
        
        ctx.fillStyle = enemyType.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // タンクタイプの敵で、ダメージを受けている場合はHPバーを表示
        if (enemy.type === 'tank' && enemy.hp < enemy.maxHP) {
            const barWidth = enemy.width;
            const barHeight = 4;
            const barX = enemy.x;
            const barY = enemy.y - 8;
            
            // HPバーの背景
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // HPバーの前景
            const hpRatio = enemy.hp / enemy.maxHP;
            ctx.fillStyle = hpRatio > 0.5 ? '#00ff00' : hpRatio > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }
    }
}

// 爆発エフェクトの描画
function drawExplosions() {
    for (const explosion of explosions) {
        for (const particle of explosion.particles) {
            const alpha = Math.max(0, particle.life / particle.maxLife);
            
            if (particle.type === 'fire') {
                ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            } else {
                ctx.fillStyle = `rgba(102, 102, 102, ${alpha * 0.5})`;
            }
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// HPバーの描画
function drawHPBar() {
    // レスポンシブ設定
    const isMobile = canvas.width < 768;
    const scale = isMobile ? 0.8 : 1.0;
    
    const barWidth = 200 * scale;
    const barHeight = 20 * scale;
    const barX = isMobile ? canvas.width * 0.05 : 20;
    const barY = isMobile ? canvas.height * 0.05 : 20;
    
    // HPバーの背景
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // HPバーの前景
    const hpRatio = player.currentHP / player.maxHP;
    if (hpRatio > 0.5) {
        ctx.fillStyle = '#00ff00';
    } else if (hpRatio > 0.25) {
        ctx.fillStyle = '#ffff00';
    } else {
        ctx.fillStyle = '#ff0000';
    }
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    
    // HPバーの枠
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // HPテキスト
    ctx.fillStyle = '#ffffff';
    ctx.font = `${16 * scale}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${player.currentHP}/${player.maxHP}`, barX, barY + barHeight + (20 * scale));
    
    // ダメージ時のオーバーレイ
    const currentTime = Date.now();
    const timeSinceDamage = currentTime - player.lastDamageTime;
    if (timeSinceDamage < 300) {
        const alpha = Math.max(0, (300 - timeSinceDamage) / 300);
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.3})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// スコアの描画
function drawScore() {
    // レスポンシブ設定
    const isMobile = canvas.width < 768;
    const scale = isMobile ? 0.8 : 1.0;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `${18 * scale}px Arial`;
    ctx.textAlign = 'right';
    
    const rightX = isMobile ? canvas.width * 0.95 : canvas.width - 20;
    const topY = isMobile ? canvas.height * 0.05 + (20 * scale) : 40;
    
    ctx.fillText(`Score: ${gameState.score}`, rightX, topY);
    ctx.fillText(`Kills: ${gameState.enemiesKilled}`, rightX, topY + (25 * scale));
}

// ウェーブ情報の描画
function drawWaveInfo(currentTime) {
    // レスポンシブ設定
    const isMobile = canvas.width < 768;
    const scale = isMobile ? 0.8 : 1.0;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `${20 * scale}px Arial`;
    ctx.textAlign = 'center';
    
    const centerX = canvas.width / 2;
    const topY = isMobile ? canvas.height * 0.05 + (25 * scale) : 40;
    
    if (gameState.gamePhase === 'wave_complete') {
        const timeLeft = Math.max(0, gameState.nextWaveDelay - (currentTime - gameState.waveCompleteTime));
        ctx.fillText(`Wave ${gameState.currentWave} Complete! Next wave in ${Math.ceil(timeLeft / 1000)}...`, centerX, topY);
    } else {
        const remaining = gameState.enemiesInWave - gameState.enemiesKilledInWave;
        ctx.fillText(`Wave ${gameState.currentWave} - Enemies: ${remaining}`, centerX, topY);
    }
}

// ゲームオーバー画面の描画
function drawGameOver() {
    // レスポンシブ設定
    const isMobile = canvas.width < 768;
    const scale = isMobile ? 0.8 : 1.0;
    
    // 半透明の背景オーバーレイ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 画面中央の設定
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // フォントサイズを画面サイズに応じて調整
    const titleFontSize = Math.floor(48 * scale);
    const subtitleFontSize = Math.floor(24 * scale);
    const textFontSize = Math.floor(18 * scale);
    const smallFontSize = Math.floor(14 * scale);
    
    // ゲームオーバータイトル
    ctx.fillStyle = '#ff0000';
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(3, 4 * scale);
    ctx.strokeText('GAME OVER', centerX, centerY - (80 * scale));
    ctx.fillText('GAME OVER', centerX, centerY - (80 * scale));
    
    // 最終スコア
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${subtitleFontSize}px Arial`;
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.strokeText(`FINAL SCORE: ${gameState.score}`, centerX, centerY - (30 * scale));
    ctx.fillText(`FINAL SCORE: ${gameState.score}`, centerX, centerY - (30 * scale));
    
    // 統計情報
    ctx.font = `${textFontSize}px Arial`;
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeText(`WAVE REACHED: ${gameState.currentWave}`, centerX, centerY + (10 * scale));
    ctx.fillText(`WAVE REACHED: ${gameState.currentWave}`, centerX, centerY + (10 * scale));
    
    ctx.strokeText(`ENEMIES KILLED: ${gameState.enemiesKilled}`, centerX, centerY + (40 * scale));
    ctx.fillText(`ENEMIES KILLED: ${gameState.enemiesKilled}`, centerX, centerY + (40 * scale));
    
    // リスタート指示
    ctx.font = `${smallFontSize}px Arial`;
    ctx.fillStyle = '#ffff00';
    ctx.strokeText('Press R to Restart or Refresh the page', centerX, centerY + (100 * scale));
    ctx.fillText('Press R to Restart or Refresh the page', centerX, centerY + (100 * scale));
}

// ゲームをリスタートする関数
function restartGame() {
    // ゲーム状態をリセット
    gameState.isGameOver = false;
    gameState.gamePhase = 'playing';
    gameState.score = 0;
    gameState.enemiesKilled = 0;
    gameState.currentWave = 1;
    gameState.enemiesInWave = 8;
    gameState.enemiesSpawned = 0;
    gameState.enemiesKilledInWave = 0;
    gameState.waveComplete = false;
    gameState.waveCompleteTime = 0;
    gameState.gameOverTime = 0;
    
    // プレイヤーをリセット
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.angle = 0;
    player.currentHP = player.maxHP;
    player.lastDamageTime = 0;
    
    // 配列をクリア
    bullets.length = 0;
    enemies.length = 0;
    explosions.length = 0;
    
    // スポーンタイマーをリセット
    enemySettings.lastSpawnTime = 0;
    
    console.log('ゲームリスタート！');
}

// ゲームループ
function gameLoop(currentTime) {
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    
    // 画面をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ゲームオーバー時は更新処理をスキップ
    if (!gameState.isGameOver) {
        // 敵の出現
        spawnEnemy(currentTime);
        
        // 更新
        updatePlayer(deltaTime);
        updateBullets(deltaTime);
        updateEnemies(deltaTime);
        updateExplosions(deltaTime);
        updateWaveSystem(currentTime);
        
        // 衝突判定
        checkBulletEnemyCollisions();
        checkPlayerEnemyCollisions(currentTime);
    }
    
    // 画面揺れは常に更新（ゲームオーバー時も）
    updateScreenShake(deltaTime);
    
    // 描画（ゲームオーバー時も継続）
    drawBackground();
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawExplosions();
    drawHPBar();
    drawScore();
    drawWaveInfo(currentTime);
    
    // ゲームオーバー時の描画
    if (gameState.isGameOver) {
        drawGameOver();
    }
    
    // 次のフレームをリクエスト
    requestAnimationFrame(gameLoop);
}

// ゲーム開始
console.log('トップダウンシューターゲーム開始！');
console.log('WASD: 上下左右移動 | 左右矢印キー: 回転 | スペース: 射撃');
console.log('モバイル: 左パッド移動 | 右パッド照準・自動射撃');
console.log('ウェーブシステム: 各ウェーブの敵をすべて倒してクリアしよう！');
console.log(`ウェーブ ${gameState.currentWave} 開始！ 敵数: ${gameState.enemiesInWave}`);

// バーチャルパッドを初期化
initVirtualPads();

requestAnimationFrame(gameLoop);
