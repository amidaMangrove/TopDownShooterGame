// ゲーム設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 音響効果システム
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 爆発音を再生
function playExplosionSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('音響効果エラー:', error);
    }
}

// ヒット音を再生
function playHitSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.log('ヒット音エラー:', error);
    }
}

// プレイヤーダメージ音を再生
function playDamageSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.log('ダメージ音エラー:', error);
    }
}

// Audio Context初期化
function initAudio() {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

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
    shotCooldown: 150,
    score: 0,
    enemiesKilled: 0,
    currentWave: 1,
    enemiesInWave: 8,
    enemiesSpawned: 0,
    enemiesKilledInWave: 0,
    waveComplete: false,
    nextWaveDelay: 3000,
    waveCompleteTime: 0,
    gamePhase: 'playing',
    isGameOver: false,
    gameOverTime: 0
};

// プレイヤー設定
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 20,
    height: 20,
    speed: 220,
    rotationSpeed: 180,
    angle: 0,
    color: '#00ff00',
    maxHP: 100,
    currentHP: 100,
    lastDamageTime: 0,
    damageInterval: 500
};

// 弾の設定
const bullets = [];
const bulletSettings = {
    speed: 800,
    width: 4,
    height: 8,
    color: '#ffff00'
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
        color: '#8B0000',
        hp: 5,
        maxHP: 5,
        scoreValue: 250
    },
    fast: {
        speed: 150,
        width: 16,
        height: 16,
        color: '#FF69B4',
        hp: 1,
        maxHP: 1,
        scoreValue: 150
    }
};

const enemySettings = {
    spawnRate: 800,
    lastSpawnTime: 0,
    simultaneousSpawn: 1
};

// 爆発エフェクトの設定
const explosions = [];
const explosionSettings = {
    particleCount: 8,
    particleSpeed: 150,
    particleLifetime: 0.8,
    particleSize: 3,
    colors: ['#ff6600', '#ff9900', '#ffcc00', '#ff3300', '#ffff00']
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
        e.preventDefault();
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
        const radians = (player.angle - 90) * Math.PI / 180;
        
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
        
        // 射撃音を再生
        playHitSound();
    }
}

// プレイヤーダメージ時の処理
function handlePlayerDamage() {
    player.currentHP -= 10;
    player.lastDamageTime = Date.now();
    
    // ダメージ音を再生
    playDamageSound();
    
    if (player.currentHP <= 0) {
        player.currentHP = 0;
        gameState.isGameOver = true;
        gameState.gamePhase = 'game_over';
        gameState.gameOverTime = Date.now();
        
        // バーチャルパッドをリセット
        gameState.virtualInput.movement.x = 0;
        gameState.virtualInput.movement.y = 0;
        gameState.virtualInput.aim.x = 0;
        gameState.virtualInput.aim.y = 0;
        
        console.log('ゲームオーバー！');
    }
}

// 敵を倒した時の処理
function handleEnemyDestroyed(enemy) {
    // 爆発エフェクトを生成
    createExplosion(enemy.x, enemy.y);
    
    // 爆発音を再生
    playExplosionSound();
    
    // スコア加算
    gameState.score += enemyTypes[enemy.type].scoreValue;
    gameState.enemiesKilled++;
    gameState.enemiesKilledInWave++;
}

// 残りのゲーム関数は元のファイルから必要なものを移植...
// （ここでは効果音の実装に焦点を当てています）

console.log('効果音システム実装完了！');
console.log('敵を倒すと爆発音が鳴ります');
console.log('プレイヤーがダメージを受けると警告音が鳴ります');
console.log('弾を撃つとヒット音が鳴ります');
