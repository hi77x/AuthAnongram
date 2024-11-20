const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// Замените на ваш реальный токен Telegram бота
const token = '7893230202:AAGMkl3cEnK-nATZK0DY7LJN6e5k_32wO0k';


// Инициализация Telegram бота
const bot = new TelegramBot(token, { polling: true });

// Инициализация сервера Express
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Файл JSON для хранения данных пользователей и магазина
const dataFile = 'users.json';
const storeFile = 'store.json';

// Загрузка существующих данных или инициализация пустого объекта
let userData = {};
if (fs.existsSync(dataFile)) {
 userData = JSON.parse(fs.readFileSync(dataFile));
}

// Загрузка данных магазина или инициализация магазина
let storeData = [];
if (fs.existsSync(storeFile)) {
 storeData = JSON.parse(fs.readFileSync(storeFile));
} else {
 // Инициализация магазина с номерами
 storeData = [
  { number: '777 7 77', price: 2 },
  { number: '777 88 88', price: 2 },
  { number: '777 78 7', price: 2 },
  { number: '777 777 77', price: 2 },
  { number: '777 12 7', price: 2 },
 ];
 fs.writeFileSync(storeFile, JSON.stringify(storeData, null, 2));
}

// Функция для сохранения данных пользователей
function saveUserData() {
 fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2));
}

// Функция для сохранения данных магазина
function saveStoreData() {
 fs.writeFileSync(storeFile, JSON.stringify(storeData, null, 2));
}

// Функция для генерации случайного кода
function generateCode() {
 return Math.floor(100000 + Math.random() * 900000).toString();
}

// Функция для генерации уникального номера в формате '+777 XX XX'
function generateNumber() {
 const digits = () => Math.floor(10 + Math.random() * 90);
 return `+777 ${digits()} ${digits()}`;
}

// Обработка команды '/start'
bot.onText(/\/start/, (msg) => {
 const chatId = msg.chat.id;
 const userId = msg.from.id;

 // Сохранение chat ID пользователя
 if (!userData[userId]) {
  userData[userId] = {
   chatId: chatId,
   numbers: [],
  };
  saveUserData();
 }

 bot.sendMessage(chatId, 'Добро пожаловать! Используйте /generate для получения номера.');
});

// Обработка команды '/generate'
bot.onText(/\/generate/, (msg) => {
 const chatId = msg.chat.id;
 const userId = msg.from.id;

 // Проверка существования пользователя
 if (!userData[userId]) {
    bot.sendMessage(chatId, 'Пожалуйста, используйте /start для запуска бота.');
    return;
  }

  const price = 1; // Цена за генерацию номера (в минимальных единицах валюты)

  // Отправка счёта на оплату для генерации номера
  bot.sendInvoice(
    chatId,
    'Покупка номера',
    'Оплатите, чтобы получить новый номер.',
    `generate_number_${userId}_${Date.now()}`, // payload
    'generate_number', // start_parameter
    'XTR', // Валюта (замените на нужную вам)
    [
      { label: 'Новый номер', amount: price * 1 }, // Цена в минимальных единицах валюты (например, центы)
    ],
    {
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      is_flexible: false,
    }
  );
});

// Обработка pre-checkout запроса
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

// Обработка успешной оплаты
bot.on('successful_payment', (msg) => {
  const userId = msg.from.id;
  const payload = msg.successful_payment.invoice_payload;

  if (payload.startsWith('generate_number')) {
    // Генерация и отправка номера после оплаты
    const number = generateNumber();
    userData[userId].numbers.push(number);
    saveUserData();

    bot.sendMessage(msg.chat.id, `Ваш номер: ${number}`);
  } else if (payload.startsWith('buyNumber_')) {
    // Обработка покупки номера из магазина
    const rawNumber = payload.split('_')[1];
    const number = `+${rawNumber.slice(0, 3)} ${rawNumber.slice(3, 5)} ${rawNumber.slice(5)}`;

    // Добавляем номер пользователю
    userData[userId].numbers.push(number);
    saveUserData();

    // Удаляем номер из магазина
    storeData = storeData.filter((item) => item.number !== number);
    saveStoreData();

    bot.sendMessage(msg.chat.id, `Покупка успешна! Теперь вы владеете номером ${number}.`);
  }
});

// Обработка команды '/mynumbers' для отображения номеров пользователя
bot.onText(/\/mynumbers/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!userData[userId] || userData[userId].numbers.length === 0) {
    bot.sendMessage(chatId, 'У вас нет номеров. Используйте /generate или посетите магазин.');
    return;
  }
  const numbersList = userData[userId].numbers.join('\n');
  bot.sendMessage(chatId, `Ваши номера:\n${numbersList}`);
});

// Обработка команды '/store' для отображения магазина номеров
bot.onText(/\/store/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (storeData.length === 0) {
    bot.sendMessage(chatId, 'В магазине нет доступных номеров.');
    return;
  }

  const options = {
    reply_markup: {
      inline_keyboard: storeData.map((item) => [
        {
          text: `${item.number} - ${item.price}⭐️`,
          callback_data: `buy_${item.number.replace(/\s+/g, '')}_${item.price}`,
        },
      ]),
    },
  };

  bot.sendMessage(chatId, 'Доступные номера:', options);
});

// Обработка нажатий на инлайн-кнопки
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  if (data.startsWith('buy_')) {
    const parts = data.split('_');
    const rawNumber = parts[1];
    const price = parseInt(parts[2]);
    const number = `+${rawNumber.slice(0, 3)} ${rawNumber.slice(3, 5)} ${rawNumber.slice(5)}`;

    // Отправка счёта на оплату для покупки номера
    bot.sendInvoice(
      callbackQuery.from.id,
      `Покупка номера ${number}`,
      `Оплатите, чтобы приобрести номер ${number}.`,
      `buyNumber_${rawNumber}`, // payload
      'buy_number', // start_parameter
      'XTR', // Валюта (замените на нужную вам)
      [
        { label: `Покупка номера ${number}`, amount: price * 1 }, // Цена в минимальных единицах валюты
      ],
      {
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false,
      }
    );

    // Ответ на callback_query
    bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Маршруты Express

// Отображение страницы входа
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Обработка кнопки "Получить код"
app.post('/getcode', (req, res) => {
  const number = req.body.number;

  // Поиск пользователя по номеру
  let userId = null;
  for (const id in userData) {
    if (userData[id].numbers.includes(number)) {
      userId = id;
      break;
    }
  }

  if (!userId) {
    res.send('Номер не найден.');
    return;
  }

  // Генерация кода и отправка его через бота
  const code = generateCode();
  userData[userId].code = code;
  saveUserData();

  const chatId = userData[userId].chatId;
  bot.sendMessage(
    chatId,
    `Ваш код для авторизации: ${code}\nЕсли код запрашивали не вы, не сообщайте его никому.`
  );

  res.sendFile(__dirname + '/public/entercode.html');
});

// Обработка ввода кода
app.post('/auth', (req, res) => {
  const enteredCode = req.body.code;

  // Поиск пользователя по коду
  let userId = null;
  for (const id in userData) {
    if (userData[id].code === enteredCode) {
      userId = id;
      break;
    }
  }

  if (!userId) {
    res.send('Неверный код.');
    return;
  }

  // Очистка кода и переход к защищенному контенту
  delete userData[userId].code;
  saveUserData();

  res.sendFile(__dirname + '/public/content.html');
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

