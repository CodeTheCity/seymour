'use strict';

const redis = require('redis');
const Bot = require('./bot.js');

const client = redis.createClient();

const bot = new Bot({
  token: process.env.SLACK_TOKEN,
  autoReconnect: true,
  autoMark: true
});

client.on('error', (err) => {
  console.log('Error ' + err);
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

// Test connection to redis
client.set('hello', 'hello world!');

client.get('hello', (err, reply) => {
  if(err) {
    console.log(err);
    return;
  }

  console.log(`Retrieved: ${reply}`);
});
// End - test connection to redis

bot.respondTo('hello', (message, channel, user) => {
  bot.send(`Hello to you too, ${user.name}!`, channel);
}, true);

bot.respondTo('remind', (message, channel, user) => {
  let args = getArgs(message.text);

  let key = args.shift();
  let value = args.join(' ');

  client.set(key, value, (err) => {
    if (err) {
      bot.send('Oops! I tried to store something but something went wrong :(', channel);
    } else {
      bot.send(`Okay ${user.name}, I will remember that for you.`, channel);
    }
  });
}, true);

bot.respondTo('recall', (message, channel, user) => {
  bot.setTypingIndicator(message.channel);

  let key = getArgs(message.text).shift();

  client.get(key, (err, reply) => {
    if (err) {
      console.log(err);
      bot.send('Oops! I tried to recall something but something went wrong :(', channel);
      return;
    }

    bot.send('Here\'s what I remember: ' + reply, channel);
  });
});

bot.respondTo('suggest', (message, channel, user) => {
  let args = getArgs(message.text)

  switch(args[0]) {
    case 'plant':
      client.smembers(`${user.name}:killed`, (err, set) => {
        if (err) {
          bot.send('Oops! I tried to check if you had killed any plants but something went wrong :(', channel);
          return;
        }

        if (set.length > 1) {
          bot.send(`You\'ve already killed ${set.length} plants. Is this wise going for another one?`, channel);
        } else {
          bot.send('Let me think about that and I\'ll get back to you.', channel);
        }
      });
      break;

    default:
      bot.send(`That\'s not really my speciality ${user.name}. Plants are more my bag you could say!`, channel);
      break;
  }
}, true);

bot.respondTo('plants', (message, channel, user) => {
  let args = getArgs(message.text)

  switch(args[0]) {
    case 'add':
      addPlant(user.name, args.slice(1).join(' '), channel);
      break;

    case 'remove':
      removePlant(user.name, args[1], channel);
      break;

    case 'killed':
      if (args.length == 1) {
        showKilledPlants(user.name, channel);
      } else {
        killedPlant(user.name, args[1], channel);
      }
      break;

    case 'help':
      bot.send('Add plants with \`plants add [PLANT]\`, remove them with \`plants remove [PLANT_NUMBER]\` and if you\'ve killed it then \`plants killed [PLANT_NUMBER]\`. For a list of plants you\'ve killed \`plants killed\`', channel);
      break;

    default:
      showPlants(user.name, channel);
      break;
  }

}, true);

function showPlants(name, channel) {
  client.smembers(name, (err, set) => {
    if (err || set.length < 1) {
      bot.send(`You don\'t have any plants yet, ${name}! Why not add one with \`plants add [PLANT]\`?`, channel);
      return;
    }

    bot.send(`${name}'s plant list:`, channel);

    set.forEach((plant, index) => {
      bot.send(`${index + 1}.${plant}`, channel);
    });
  });
}

function addPlant(name, plant, channel) {
  if(plant === '') {
    bot.send('Usage: \`plant add [PLANT]\`');
    return;
  }

  client.sadd(name, plant);
  bot.send('You\'ve added a plant. Make sure you look after it. Did you know I can help you with that?', channel);
  showPlants(name, channel);
}

function removePlant(name, target, channel) {
  let plantNum = parseInt(target, 10);

  if (Number.isNaN(plantNum)) {
    bot.send('Usage: \`plant delete [PLANT_NUMBER]\`', channel);
    return;
  }

  client.smembers(name, (err, set) => {
    if (err || set.length < 1) {
      bot.send(`You don\'t have any plants to remove, ${name}!`, channel);
      return;
    }

    if (plantNum > set.length || plantNum <= 0) {
      bot.send('Oops, that plant doesn\'t exist!');
      return;
    }

    client.srem(name, set[plantNum - 1]);
    bot.send('You removed a plant. I hope it has gone to a good home.', channel);
    showPlants(name, channel);
  });
}

function showKilledPlants(name, channel) {
  client.smembers(`${name}:killed`, (err, set) => {
    if (err || set.length < 1) {
      bot.send(`You haven\'t killed any plants yet, ${name}! Keep up the good work`, channel);
      return;
    }

    bot.send(`${name}'s plant memorial list:`, channel);

    set.forEach((plant, index) => {
      bot.send(`${index + 1}. ${plant}`, channel);
    });
  });
}

function killedPlant(name, target, channel) {
  let plantNum = parseInt(target, 10);

  if (Number.isNaN(plantNum)) {
    bot.send('Usage: \`plant killed [PLANT_NUMBER]\`', channel);
    return;
  }

  client.smembers(name, (err, set) => {
    if (err || set.length < 1) {
      bot.send(`You don\'t have any plants to kill, ${name}!`, channel);
      return;
    }

    if (plantNum > set.length || plantNum <= 0) {
      bot.send('Oops, that plant doesn\'t exist!', channel);
      return;
    }

    client.srem(name, set[plantNum - 1]);
    bot.send('You killed a plant. :scream: That\'s such a shame! It was my favourite.', channel);
    showPlants(name, channel);

    client.sadd(`${name}:killed`, set[plantNum - 1]);
    showKilledPlants(name, channel);
  });
}

function getArgs(msg) {
  return msg.split(' ').slice(1);
}