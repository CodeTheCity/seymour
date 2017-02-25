'use strict';

const redis = require('redis');
const Bot = require('./Bot');

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


function getArgs(msg) {
  return msg.split(' ').slice(1);
}