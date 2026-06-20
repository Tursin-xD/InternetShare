const WebSocket = require('ws');
const http = require('http');
const readline = require('readline');

// Создаем интерфейс для ввода текста в консоли
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Программа сразу спрашивает имя при запуске
rl.question('Enter your name to start sharing internet: ', (friendName) => {
    // Убираем лишние пробелы из имени
    const cleanName = friendName.trim();
    
    // Формируем уникальную ссылку подключения с его именем
    const RENDER_WS_URL = `wss://://onrender.com{cleanName}`; 
    
    console.log(`\n[System] Connecting as: ${cleanName}...`);
    connect(RENDER_WS_URL);
    
    rl.close();
});

function connect(url) {
    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log('[Success] Connected! Your internet is now streaming to the website.');
    });

    ws.on('message', async (message) => {
        const requestData = JSON.parse(message);
        
        // Скачиваем целевой сайт, используя реальный интернет друга
        http.get(requestData.url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                // Отправляем скачанный сайт обратно на ваш сервер Render
                ws.send(JSON.stringify({ id: requestData.id, html: data }));
            });
        }).on('error', (err) => {
            console.log(`[Error] Failed to fetch URL: ${err.message}`);
        });
    });

    ws.on('close', () => {
        console.log('[Disconnected] Connection lost. Reconnecting in 5 seconds...');
        setTimeout(() => connect(url), 5000); // Авто-реконнект при обрыве сети
    });
    
    ws.on('error', (err) => {
        console.log(`[WebSocket Error] ${err.message}`);
    });
}
