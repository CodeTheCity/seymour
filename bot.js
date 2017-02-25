'use strict';

const RtmClient = require('@slack/client').RtmClient;
const MemoryDataStore = require('@slack/client').MemoryDataStore;
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;

class Bot {
  constructor(opts) {
    let slackToken = opts.token;
    let autoReconnect = opts.autoReconnect || true;
    let autoMark = opts.autoMark || true;

    this.slack = new RtmClient(slackToken, {
      logLevel: 'error',
      dataStore: new MemoryDataStore(),
      autoReconnect: autoReconnect,
      autoMark: autoMark
    });

    this.slack.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      let user = this.slack.dataStore.getUserById(this.slack.activeUserId);
      let team = this.slack.dataStore.getTeamById(this.slack.activeTeamId);
      this.name = user.name;

      console.log(`Connected to ${team.name} as ${user.name}`);
    });

    this.keywords = new Map();

    this.slack.on(RTM_EVENTS.MESSAGE, (message) => {
      if(!message.text) {
        return;
      }

      let channel = this.slack.dataStore.getChannelGroupOrDMById(message.channel);
      let user = this.slack.dataStore.getUserById(message.user);

      for(let regex of this.keywords.keys()) {
        if (regex.test(message.text)) {
          let callback = this.keywords.get(regex);
          callback(message, channel, user);
        }
      }
    });

    this.slack.start();
  }

  send(message, channel, cb) {
    this.slack.sendMessage(message, channel.id, () => {
      if (cb) {
        cb();
      }
    });
  }

  respondTo(keywords, callback, start) {
    if(start) {
      keywords = '^' + keywords;
    }

    let regex = new RegExp(keywords, 'i');

    this.keywords.set(regex, callback);
  }

  setTypingIndicator(channel) {
    this.slack.send({ type: 'typing', channel: channel.id });
  }
}

module.exports = Bot;