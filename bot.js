require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Storage for applications
const userApplications = {};

// ID of your group. Make sure to replace it with the actual ID of your group.
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID; // Ensure the ID starts with "-".

// Function to create a keyboard with the "Start Again" button
const getKeyboardWithRestart = (language) => {
    const restartButton = language === 'Русский' ? 'Начать заново' : 'Янги бошлаш';
    return Markup.keyboard([[restartButton]]).resize();
};

// Start command
bot.start((ctx) => {
    const userId = ctx.from.id;
    // Check if there is existing data to delete
    if (userApplications[userId]) {
        notifyDeletion(userId, userApplications[userId]); // Notify about deletion of the old application
    }
    userApplications[userId] = { step: 'language' }; // Initialize user object
    ctx.reply('Добро пожаловать! Пожалуйста, выберите язык.', Markup.keyboard([
        ['Русский', 'Узбекский'],
        ['Начать заново'] // Adding the "Start Again" button
    ]).resize());
});

// Handler for the "Start Again" command
bot.hears(['Начать заново', 'Янги бошлаш'], (ctx) => {
    const userId = ctx.from.id;
    // Check if there is existing data to delete
    if (userApplications[userId]) {
        notifyDeletion(userId, userApplications[userId]); // Notify about deletion of the old application
    }
    userApplications[userId] = { step: 'language' }; // Reset user data
    ctx.reply('Вы можете начать заново. Пожалуйста, выберите язык.', Markup.keyboard([
        ['Русский', 'Узбекский'],
        ['Начать заново']
    ]).resize());
});

// Notification for deleting the old application
const notifyDeletion = async (userId, userApp) => {
    // Only send a notification if there is data to delete
    if (userApp.name || userApp.phone || userApp.location) {
        const deletionMessage = `
        Заявка удалена:
        Имя: ${userApp.name || 'Не указано'}
        Телефон: ${userApp.phone || 'Не указано'}
        Язык: ${userApp.language || 'Не указано'}
        Локация: ${userApp.location ? `Широта: ${userApp.location.latitude}, Долгота: ${userApp.location.longitude}` : 'Не указано'}
        `;
        await bot.telegram.sendMessage(GROUP_CHAT_ID, deletionMessage);
    }
    delete userApplications[userId];
};

// Handle language selection
bot.hears(['Русский', 'Узбекский'], (ctx) => {
    const userId = ctx.from.id;
    if (!userApplications[userId]) {
        userApplications[userId] = { step: 'language' };
    }

    const language = ctx.message.text;
    userApplications[userId].language = language;
    userApplications[userId].step = 'name'; // Proceed to the next step

    const message = language === 'Русский' ? 'Вы выбрали Русский. Пожалуйста, укажите ваше имя:' : 'Сиз ўзбекчани танладингиз. Илтимос, исмингизни киритинг:';
    ctx.reply(message, getKeyboardWithRestart(language));
});

// Handle text messages depending on the stage
bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    if (!userApplications[userId]) {
        userApplications[userId] = { step: 'language' }; // Initialize if not already done
        ctx.reply('Пожалуйста, выберите язык.', Markup.keyboard([
            ['Русский', 'Узбекский'],
            ['Начать заново']
        ]).resize());
        return;
    }

    const userApp = userApplications[userId];
    const language = userApp.language;

    if (userApp.step === 'name') {
        userApp.name = ctx.message.text;
        userApp.step = 'phone'; // Proceed to the next step

        const message = language === 'Русский' ? 'Пожалуйста, укажите ваш номер телефона:' : 'Илтимос, телефон рақамингизни киритинг:';
        ctx.reply(message, Markup.keyboard([
            [Markup.button.contactRequest(language === 'Русский' ? 'Отправить номер телефона' : 'Телефон рақамини юбориш')],
            [language === 'Русский' ? 'Начать заново' : 'Янги бошлаш'] // Adding the "Start Again" button
        ]).resize());
    } else {
        const message = language === 'Русский' ? 'Пожалуйста, следуйте инструкциям и выберите доступную опцию.' : 'Илтимос, кўрсатмаларга амал қилинг ва мавжуд параметрни танланг.';
        ctx.reply(message, getKeyboardWithRestart(language));
    }
});

// Handle contact
bot.on('contact', (ctx) => {
    const userId = ctx.from.id;
    if (!userApplications[userId]) {
        ctx.reply('Пожалуйста, начните с выбора языка, отправив /start.');
        return;
    }

    const userApp = userApplications[userId];
    const language = userApp.language;

    if (userApp.step === 'phone') {
        userApp.phone = ctx.message.contact.phone_number;
        userApp.step = 'location'; // Proceed to the next step

        const message = language === 'Русский' ? 'Пожалуйста, отправьте ваше местоположение:' : 'Илтимос, жойлашувингизни юборинг:';
        ctx.reply(message, Markup.keyboard([
            [Markup.button.locationRequest(language === 'Русский' ? 'Отправить местоположение' : 'Жойлашувни юбориш')],
            [language === 'Русский' ? 'Начать заново' : 'Янги бошлаш'] // Adding the "Start Again" button
        ]).resize());
    } else {
        const message = language === 'Русский' ? 'Пожалуйста, следуйте инструкциям и выберите доступную опцию.' : 'Илтимос, кўрсатмаларга амал қилинг ва мавжуд параметрни танланг.';
        ctx.reply(message, getKeyboardWithRestart(language));
    }
});

// Handle location
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    if (!userApplications[userId]) {
        ctx.reply('Пожалуйста, начните с выбора языка, отправив /start.');
        return;
    }

    const userApp = userApplications[userId];
    const language = userApp.language;

    if (userApp.step === 'location') {
        userApp.location = ctx.message.location;
        userApp.step = 'completed'; // Process completed

        // Remove the keyboard after receiving location
        const completionMessage = language === 'Русский' ? 'Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.' : 'Сизнинг аризангиз учун раҳмат! Биз сиз билан тез орада боғланамиз.';
        ctx.reply(completionMessage, getKeyboardWithRestart(language)); // Keep the "Start Again" button

        // Send a notification about the new application to the group
        const applicationDetails = `
      Новая заявка:
      Имя: ${userApp.name}
      Телефон: ${userApp.phone}
      Язык: ${userApp.language}
      Локация: Широта: ${userApp.location.latitude}, Долгота: ${userApp.location.longitude}
    `;

        // Send a message to the group
        await bot.telegram.sendMessage(GROUP_CHAT_ID, applicationDetails);

        // Keep the user's application for potential deletion notification
    } else {
        const message = language === 'Русский' ? 'Пожалуйста, следуйте инструкциям и выберите доступную опцию.' : 'Илтимос, кўрсатмаларга амал қилинг ва мавжуд параметрни танланг.';
        ctx.reply(message, getKeyboardWithRestart(language));
    }
});

// Launch the bot
bot.launch();
console.log('Бот запущен');
