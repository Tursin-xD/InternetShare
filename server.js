const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Сюда сервер будет автоматически записывать подключенных друзей по их именам
let activeFriends = {};
let pendingRequests = {};

// 1. Обработка туннелей от скриптов ваших друзей
wss.on('connection', (ws, req) => {
    // Вытаскиваем имя, которое друг ввел в консоли (из конца URL ссылки)
    const friendName = req.url.split('/').pop();
    
    if (!friendName) {
        ws.close();
        return;
    }

    activeFriends[friendName] = ws;
    console.log(`[SYSTEM] Friend "${friendName}" connected and is now sharing internet!`);

    // Принимаем скачанный сайт обратно от друга и отдаем его вам в браузер
    ws.on('message', (message) => {
        try {
            const response = JSON.parse(message);
            if (pendingRequests[response.id]) {
                pendingRequests[response.id].send(response.html);
                delete pendingRequests[response.id];
            }
        } catch (err) {
            console.log("[ERROR] Failed to parse friend response:", err.message);
        }
    });

    // Если друг закрыл консоль или у него пропал свет — удаляем его из списка
    ws.on('close', () => {
        console.log(`[SYSTEM] Friend "${friendName}" disconnected.`);
        delete activeFriends[friendName];
    });
});

// 2. Главная страница вашего сайта (Интерфейс в браузере)
app.get('/', (req, res) => {
    const friendsOnline = Object.keys(activeFriends);
    
    // Генерируем выпадающий список со всеми друзьями, кто сейчас в сети
    let friendsOptions = friendsOnline.map(name => 
        `<option value="${name}">${name}</option>`
    ).join('');

    if (friendsOnline.length === 0) {
        friendsOptions = `<option value="" disabled selected>No friends online right now 😢</option>`;
    }

    res.send(`
        <body style="background:#0f0f1a; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
            <h1>P2P Cloud Proxy Web Share 🌐</h1>
            <p>Your current website URL is hosted on Render.</p>
            
            <form action="/browse" method="get" style="margin-top: 30px;">
                <div style="margin-bottom: 20px;">
                    <label style="display:block; margin-bottom:10px;">1. Choose which friend to get internet from:</label>
                    <select name="friend" style="padding:10px; width:420px; border-radius:5px; background:#1e1e2f; color:#fff; border:1px solid #4a90e2;" required>
                        ${friendsOptions}
                    </select>
                </div>

                <div>
                    <label style="display:block; margin-bottom:10px;">2. Enter the website you want to open:</label>
                    <input type="text" name="url" placeholder="http://example.com" style="padding:10px; width:400px; border-radius:5px; border:none;" required>
                </div>
                
                <button type="submit" style="margin-top:20px; padding:12px 30px; background:#4a90e2; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Browse via Selected Friend</button>
            </form>
        </body>
    `);
});

// 3. Перенаправление запроса через выбранного друга
app.get('/browse', (req, res) => {
    let targetUrl = req.query.url;
    const chosenFriend = req.query.friend;
    const friendWs = activeFriends[chosenFriend];

    if (!friendWs) {
        return res.status(503).send(`Friend "${chosenFriend}" is not online or went offline.`);
    }

    // Автоматически добавляем http:// если вы забыли его ввести в строку
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'http://' + targetUrl;
    }

    const requestId = Math.random().toString(36).substring(7);
    pendingRequests[requestId] = res;

    // Пушим запрос в туннель к конкретному другу
    friendWs.send(JSON.stringify({ id: requestId, url: targetUrl }));
    
    // Ставим таймаут в 30 секунд, чтобы сайт не зависал, если у друга завис интернет
    setTimeout(() => {
        if (pendingRequests[requestId]) {
            pendingRequests[requestId].status(504).send("Friend's computer took too long to respond.");
            delete pendingRequests[requestId];
        }
    }, 30000);
});

// Запуск сервера на порту Render
server.listen(process.env.PORT || 10000, () => {
    console.log('P2P Proxy Server is running!');
});
